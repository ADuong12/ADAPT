from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_teacher
from ..services import adaptation, versioning

router = APIRouter(prefix="/api", tags=["adaptations"])


def _summary(v: models.LessonPlanVersion) -> schemas.VersionSummary:
    return schemas.VersionSummary(
        version_id=v.version_id,
        version_number=v.version_number,
        parent_version_id=v.parent_version_id,
        is_head=bool(v.is_head),
        instruction=v.instruction,
        model_used=v.model_used,
        provider=v.provider,
        token_count=v.token_count,
        created_at=v.created_at,
    )


def _adaptation_out(db: Session, adapted_id: int) -> schemas.AdaptationOut:
    head = versioning.head_version(db, adapted_id)
    if not head:
        raise HTTPException(404, "no versions for this adaptation")
    versions = versioning.list_versions(db, adapted_id)
    adapted = db.get(models.AdaptedLesson, adapted_id)
    return schemas.AdaptationOut(
        adapted_id=adapted.adapted_id,
        lesson_id=adapted.lesson_id,
        teacher_id=adapted.teacher_id,
        cluster_id=adapted.cluster_id,
        head_version=_summary(head),
        versions=[_summary(v) for v in versions],
    )


@router.post("/adapt", response_model=schemas.AdaptationOut)
def adapt(
    body: schemas.AdaptRequest,
    db: Session = Depends(get_db),
    teacher: models.Teacher = Depends(current_teacher),
) -> schemas.AdaptationOut:
    try:
        version = adaptation.generate(
            db,
            teacher=teacher,
            lesson_id=body.lesson_id,
            cluster_id=body.cluster_id,
            kb_ids=body.kb_ids,
            include_student_context=body.include_student_context,
        )
    except RuntimeError as e:
        raise HTTPException(400, str(e)) from e
    return _adaptation_out(db, version.adapted_id)


@router.post("/adaptations/{adapted_id}/refine", response_model=schemas.AdaptationOut)
def refine(
    adapted_id: int,
    body: schemas.RefineRequest,
    db: Session = Depends(get_db),
    teacher: models.Teacher = Depends(current_teacher),
) -> schemas.AdaptationOut:
    try:
        adaptation.refine(db, teacher=teacher, adapted_id=adapted_id, instruction=body.instruction)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(400, str(e)) from e
    return _adaptation_out(db, adapted_id)


@router.get("/adaptations/{adapted_id}", response_model=schemas.AdaptationOut)
def get_adaptation(adapted_id: int, db: Session = Depends(get_db), teacher: models.Teacher = Depends(current_teacher)) -> schemas.AdaptationOut:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted:
        raise HTTPException(404, "not found")
    if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin":
        raise HTTPException(403, "forbidden")
    return _adaptation_out(db, adapted_id)


@router.get("/adaptations/{adapted_id}/versions", response_model=list[schemas.VersionSummary])
def list_versions(adapted_id: int, db: Session = Depends(get_db), teacher: models.Teacher = Depends(current_teacher)) -> list[schemas.VersionSummary]:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted:
        raise HTTPException(404, "not found")
    if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin":
        raise HTTPException(403, "forbidden")
    return [_summary(v) for v in versioning.list_versions(db, adapted_id)]


@router.get("/adaptations/{adapted_id}/versions/{version_id}", response_model=schemas.VersionDetail)
def get_version(adapted_id: int, version_id: int, db: Session = Depends(get_db), teacher: models.Teacher = Depends(current_teacher)) -> schemas.VersionDetail:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted:
        raise HTTPException(404, "not found")
    if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin":
        raise HTTPException(403, "forbidden")
    v = db.get(models.LessonPlanVersion, version_id)
    if not v or v.adapted_id != adapted_id:
        raise HTTPException(404, "version not found")
    summary = _summary(v).model_dump()
    return schemas.VersionDetail(
        **summary,
        rendered_html=v.rendered_html,
        plan_json=versioning.parse_plan_json(v),
    )


@router.post("/adaptations/{adapted_id}/rollback", response_model=schemas.AdaptationOut)
def rollback(adapted_id: int, body: schemas.RollbackRequest, db: Session = Depends(get_db), teacher: models.Teacher = Depends(current_teacher)) -> schemas.AdaptationOut:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted:
        raise HTTPException(404, "not found")
    if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin":
        raise HTTPException(403, "forbidden")
    try:
        versioning.rollback_to(db, adapted_id=adapted_id, version_id=body.version_id)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    db.commit()
    return _adaptation_out(db, adapted_id)


@router.get("/adaptations/{adapted_id}/versions/{version_id}/print", response_class=HTMLResponse)
def print_version(adapted_id: int, version_id: int, db: Session = Depends(get_db), teacher: models.Teacher = Depends(current_teacher)) -> HTMLResponse:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted:
        raise HTTPException(404, "not found")
    if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin":
        raise HTTPException(403, "forbidden")
    v = db.get(models.LessonPlanVersion, version_id)
    if not v or v.adapted_id != adapted_id:
        raise HTTPException(404, "version not found")
    return HTMLResponse(content=v.rendered_html)


@router.get("/adaptations/{adapted_id}/versions/{version_id}/export.html")
def export_version(adapted_id: int, version_id: int, db: Session = Depends(get_db), teacher: models.Teacher = Depends(current_teacher)) -> Response:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted:
        raise HTTPException(404, "not found")
    if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin":
        raise HTTPException(403, "forbidden")
    v = db.get(models.LessonPlanVersion, version_id)
    if not v or v.adapted_id != adapted_id:
        raise HTTPException(404, "version not found")
    filename = f"adapt-lesson-{adapted_id}-v{v.version_number}.html"
    return Response(
        content=v.rendered_html,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/adaptations/{adapted_id}/feedback")
def submit_feedback(
    adapted_id: int,
    body: schemas.FeedbackIn,
    db: Session = Depends(get_db),
    teacher: models.Teacher = Depends(current_teacher),
) -> dict:
    adapted = db.get(models.AdaptedLesson, adapted_id)
    if not adapted:
        raise HTTPException(404, "not found")
    if adapted.teacher_id != teacher.teacher_id:
        raise HTTPException(403, "forbidden")
    fb = models.AdaptationFeedback(adapted_id=adapted_id, rating=body.rating, comments=body.comments)
    db.add(fb)
    db.commit()
    return {"ok": True, "feedback_id": fb.feedback_id}
