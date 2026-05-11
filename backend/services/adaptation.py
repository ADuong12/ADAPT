from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from ..llm import LLMResult, make_provider
from ..rag import retriever
from ..security import decrypt
from . import renderer, versioning

_PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"
_SYSTEM_PROMPT = (_PROMPT_DIR / "system.txt").read_text(encoding="utf-8")


def _resolve_provider(db: Session, teacher_id: int):
    cfg = db.execute(
        select(models.LLMProviderConfig)
        .where(
            models.LLMProviderConfig.teacher_id == teacher_id,
            models.LLMProviderConfig.is_active == 1,
        )
        .order_by(models.LLMProviderConfig.updated_at.desc())
    ).scalar_one_or_none()
    if cfg:
        return make_provider(cfg.provider, decrypt(cfg.api_key_encrypted), cfg.model)
    if settings.gemini_api_key_fallback:
        return make_provider("gemini", settings.gemini_api_key_fallback)
    raise RuntimeError(
        "No LLM configured. Add an API key in Settings, or set ADAPT_GEMINI_API_KEY in the environment."
    )


def _build_context_blocks(
    *,
    lesson: models.Lesson,
    cluster: models.StudentCluster,
    kb_specs: list[dict],
    students: list[models.Student],
    previous_plan_json: dict[str, Any] | None,
    instruction: str | None,
) -> tuple[str, list[dict]]:
    """Returns (user_prompt, retrieved_chunks_metadata)."""
    query_text = " ".join(
        filter(
            None,
            [
                lesson.title,
                lesson.cs_topic,
                lesson.objectives,
                cluster.cluster_name,
                cluster.cluster_description,
            ],
        )
    )
    chunks = retriever.retrieve_for_lesson(query_text, kb_specs, top_k_per_kb=3)

    parts: list[str] = []
    parts.append("# Base lesson")
    parts.append(f"Title: {lesson.title}")
    parts.append(f"Grade: {lesson.grade_level or '—'}")
    parts.append(f"CS topic: {lesson.cs_topic or '—'}")
    parts.append(f"CS standard: {lesson.cs_standard or '—'}")
    parts.append(f"Objectives: {lesson.objectives or '—'}")

    parts.append("\n# Target learner cluster")
    parts.append(f"Name: {cluster.cluster_name}")
    parts.append(f"Description: {cluster.cluster_description or '—'}")

    if students:
        parts.append("\n# Students in this cluster (for personalization, do not invent additional students)")
        for s in students:
            parts.append(
                f"- {s.first_name} {s.last_name}: math={s.math_performance or '—'}, "
                f"ela={s.ela_performance or '—'}, notes={s.learner_variability or '—'}"
            )

    parts.append("\n# Knowledge base context")
    if not chunks:
        parts.append("(No retrieved chunks. Rely on the KB names below as your guidance.)")
        for spec in kb_specs:
            parts.append(f"- KB #{spec['kb_id']} {spec['kb_name']} ({spec.get('category', '—')})")
    else:
        for c in chunks:
            parts.append(f"\n[KB #{c.kb_id} {c.kb_name} — {c.section_title}]")
            parts.append(c.text)

    if previous_plan_json:
        parts.append("\n# Previous version (refine instead of regenerating from scratch)")
        parts.append(json.dumps(previous_plan_json, ensure_ascii=False))
        parts.append("\n# Refinement instruction")
        parts.append(instruction or "")
    else:
        parts.append("\n# Task")
        parts.append(
            "Produce a personalized lesson plan for the cluster above. Cite KBs in `sources` "
            "as 'KB #<id> <kb_name>'. Output JSON only."
        )

    chunk_meta = [
        {"kb_id": c.kb_id, "kb_name": c.kb_name, "section": c.section_title, "distance": c.distance}
        for c in chunks
    ]
    return "\n".join(parts), chunk_meta


_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def _coerce_to_plan_json(text: str) -> dict[str, Any]:
    """LLMs sometimes wrap JSON in fences or add prose. Be forgiving."""
    text = text.strip()
    candidate = text
    m = _JSON_FENCE.search(text)
    if m:
        candidate = m.group(1)
    else:
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1 and last > first:
            candidate = text[first : last + 1]
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        return {
            "recommendations": [
                {
                    "title": "Model returned malformed JSON",
                    "body": text[:600],
                    "tag": "other",
                    "sources": [],
                }
            ],
            "plan_steps": [],
            "companion_materials": [],
        }
    data.setdefault("recommendations", [])
    data.setdefault("plan_steps", [])
    data.setdefault("companion_materials", [])
    return data


def _kb_specs(db: Session, kb_ids: list[int]) -> list[dict]:
    if not kb_ids:
        return []
    rows = db.execute(
        select(models.KnowledgeBase).where(models.KnowledgeBase.kb_id.in_(kb_ids))
    ).scalars()
    return [{"kb_id": kb.kb_id, "kb_name": kb.kb_name, "category": kb.category} for kb in rows]


def _students_in_cluster_for_teacher(db: Session, teacher_id: int, cluster_id: int) -> list[models.Student]:
    rows = db.execute(
        select(models.Student)
        .join(models.Enrollment, models.Enrollment.student_id == models.Student.student_id)
        .join(models.Class, models.Class.class_id == models.Enrollment.class_id)
        .where(models.Class.teacher_id == teacher_id, models.Student.cluster_id == cluster_id)
    ).scalars()
    return list(rows)


def generate(
    db: Session,
    *,
    teacher: models.Teacher,
    lesson_id: int,
    cluster_id: int,
    kb_ids: list[int],
    include_student_context: bool,
) -> models.LessonPlanVersion:
    lesson = db.get(models.Lesson, lesson_id)
    cluster = db.get(models.StudentCluster, cluster_id)
    if not lesson or not cluster:
        raise LookupError("lesson or cluster not found")

    adapted = models.AdaptedLesson(
        lesson_id=lesson_id,
        teacher_id=teacher.teacher_id,
        cluster_id=cluster_id,
        recommendations="",
        adapted_plan="",
        companion_materials="",
    )
    db.add(adapted)
    db.flush()

    for kb_id in kb_ids:
        db.add(models.LessonKBUsed(adapted_id=adapted.adapted_id, kb_id=kb_id))

    students = _students_in_cluster_for_teacher(db, teacher.teacher_id, cluster_id) if include_student_context else []
    kb_specs = _kb_specs(db, kb_ids)
    user_prompt, chunk_meta = _build_context_blocks(
        lesson=lesson,
        cluster=cluster,
        kb_specs=kb_specs,
        students=students,
        previous_plan_json=None,
        instruction=None,
    )

    provider = _resolve_provider(db, teacher.teacher_id)
    result: LLMResult = provider.generate(system=_SYSTEM_PROMPT, user=user_prompt)
    plan_json = _coerce_to_plan_json(result.text)

    rendered = renderer.render_lesson_plan(
        lesson={
            "title": lesson.title,
            "grade_level": lesson.grade_level,
            "cs_topic": lesson.cs_topic,
            "cs_standard": lesson.cs_standard,
        },
        cluster={"cluster_name": cluster.cluster_name, "cluster_description": cluster.cluster_description},
        plan_json=plan_json,
        knowledge_bases_used=kb_specs,
        provider=result.provider,
        model_used=result.model,
    )

    version = versioning.create_version(
        db,
        adapted_id=adapted.adapted_id,
        parent_version_id=None,
        instruction=None,
        rendered_html=rendered,
        plan_json=plan_json,
        model_used=result.model,
        provider=result.provider,
        token_count=result.token_count,
    )

    adapted.recommendations = json.dumps(plan_json.get("recommendations") or [])
    adapted.adapted_plan = json.dumps(plan_json.get("plan_steps") or [])
    adapted.companion_materials = json.dumps(plan_json.get("companion_materials") or [])

    db.add(
        models.RAGContextLog(
            adapted_id=adapted.adapted_id,
            kb_chunks_used=json.dumps(chunk_meta),
            token_count=result.token_count,
            context_layers=json.dumps(
                {
                    "lesson": True,
                    "cluster": True,
                    "students": bool(students),
                    "kb_chunks": len(chunk_meta),
                    "previous_version": False,
                }
            ),
        )
    )
    db.commit()
    return version


def refine(db: Session, *, teacher: models.Teacher, adapted_id: int, instruction: str) -> models.LessonPlanVersion:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted or adapted.teacher_id != teacher.teacher_id:
        raise LookupError("adapted lesson not found")
    head = versioning.head_version(db, adapted_id)
    if not head:
        raise LookupError("no head version to refine from")

    lesson = db.get(models.Lesson, adapted.lesson_id)
    cluster = db.get(models.StudentCluster, adapted.cluster_id)
    kb_ids = [
        row.kb_id
        for row in db.execute(
            select(models.LessonKBUsed).where(models.LessonKBUsed.adapted_id == adapted_id)
        ).scalars()
    ]
    kb_specs = _kb_specs(db, kb_ids)
    students = _students_in_cluster_for_teacher(db, teacher.teacher_id, adapted.cluster_id)

    user_prompt, chunk_meta = _build_context_blocks(
        lesson=lesson,
        cluster=cluster,
        kb_specs=kb_specs,
        students=students,
        previous_plan_json=versioning.parse_plan_json(head),
        instruction=instruction,
    )

    provider = _resolve_provider(db, teacher.teacher_id)
    result = provider.generate(system=_SYSTEM_PROMPT, user=user_prompt)
    plan_json = _coerce_to_plan_json(result.text)

    rendered = renderer.render_lesson_plan(
        lesson={
            "title": lesson.title,
            "grade_level": lesson.grade_level,
            "cs_topic": lesson.cs_topic,
            "cs_standard": lesson.cs_standard,
        },
        cluster={"cluster_name": cluster.cluster_name, "cluster_description": cluster.cluster_description},
        plan_json=plan_json,
        knowledge_bases_used=kb_specs,
        provider=result.provider,
        model_used=result.model,
    )

    version = versioning.create_version(
        db,
        adapted_id=adapted_id,
        parent_version_id=head.version_id,
        instruction=instruction,
        rendered_html=rendered,
        plan_json=plan_json,
        model_used=result.model,
        provider=result.provider,
        token_count=result.token_count,
    )

    db.add(
        models.RAGContextLog(
            adapted_id=adapted_id,
            kb_chunks_used=json.dumps(chunk_meta),
            token_count=result.token_count,
            context_layers=json.dumps(
                {
                    "lesson": True,
                    "cluster": True,
                    "students": bool(students),
                    "kb_chunks": len(chunk_meta),
                    "previous_version": True,
                }
            ),
        )
    )
    db.commit()
    return version
