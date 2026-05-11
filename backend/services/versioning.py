from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def head_version(db: Session, adapted_id: int) -> models.LessonPlanVersion | None:
    return db.execute(
        select(models.LessonPlanVersion)
        .where(
            models.LessonPlanVersion.adapted_id == adapted_id,
            models.LessonPlanVersion.is_head == 1,
        )
    ).scalar_one_or_none()


def list_versions(db: Session, adapted_id: int) -> list[models.LessonPlanVersion]:
    return list(
        db.execute(
            select(models.LessonPlanVersion)
            .where(models.LessonPlanVersion.adapted_id == adapted_id)
            .order_by(models.LessonPlanVersion.version_number)
        ).scalars()
    )


def next_version_number(db: Session, adapted_id: int) -> int:
    rows = list_versions(db, adapted_id)
    return (max((v.version_number for v in rows), default=0)) + 1


def create_version(
    db: Session,
    *,
    adapted_id: int,
    parent_version_id: int | None,
    instruction: str | None,
    rendered_html: str,
    plan_json: dict[str, Any] | None,
    model_used: str | None,
    provider: str | None,
    token_count: int | None,
) -> models.LessonPlanVersion:
    version_number = next_version_number(db, adapted_id)
    # demote any existing head
    for v in list_versions(db, adapted_id):
        if v.is_head:
            v.is_head = 0
    new_version = models.LessonPlanVersion(
        adapted_id=adapted_id,
        parent_version_id=parent_version_id,
        version_number=version_number,
        is_head=1,
        instruction=instruction,
        rendered_html=rendered_html,
        plan_json=json.dumps(plan_json) if plan_json is not None else None,
        model_used=model_used,
        provider=provider,
        token_count=token_count,
    )
    db.add(new_version)
    db.flush()
    return new_version


def rollback_to(db: Session, *, adapted_id: int, version_id: int) -> models.LessonPlanVersion:
    target = db.get(models.LessonPlanVersion, version_id)
    if not target or target.adapted_id != adapted_id:
        raise LookupError("version does not belong to this adaptation")
    for v in list_versions(db, adapted_id):
        v.is_head = 1 if v.version_id == version_id else 0
    return target


def parse_plan_json(version: models.LessonPlanVersion) -> dict[str, Any] | None:
    if not version.plan_json:
        return None
    try:
        return json.loads(version.plan_json)
    except json.JSONDecodeError:
        return None
