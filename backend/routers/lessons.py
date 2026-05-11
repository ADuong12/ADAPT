from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_teacher
from ..services import source_editor

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.get("", response_model=list[schemas.LessonOut])
def list_lessons(db: Session = Depends(get_db), _t=Depends(current_teacher)) -> list[schemas.LessonOut]:
    rows = db.execute(select(models.Lesson).order_by(models.Lesson.lesson_id)).scalars()
    return [schemas.LessonOut.model_validate(r) for r in rows]


@router.get("/{lesson_id}/source-files", response_model=list[schemas.LessonSourceFileOut])
def list_source_files(
    lesson_id: int,
    db: Session = Depends(get_db),
    _t=Depends(current_teacher),
) -> list[schemas.LessonSourceFileOut]:
    lesson = db.get(models.Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "lesson not found")
    return [schemas.LessonSourceFileOut(**f) for f in source_editor.source_files_for_lesson(lesson)]


@router.post("/{lesson_id}/edit-source-file", response_model=schemas.LessonSourceEditOut)
def edit_source_file(
    lesson_id: int,
    body: schemas.LessonSourceEditIn,
    db: Session = Depends(get_db),
    teacher: models.Teacher = Depends(current_teacher),
) -> schemas.LessonSourceEditOut:
    try:
        result = source_editor.edit_source_file(
            db,
            teacher=teacher,
            lesson_id=lesson_id,
            source_path=body.source_path,
            instruction=body.instruction,
            cluster_id=body.cluster_id,
            kb_ids=body.kb_ids,
        )
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(400, str(e)) from e
    return schemas.LessonSourceEditOut(**result)


@router.get("/{lesson_id}", response_model=schemas.LessonOut)
def get_lesson(lesson_id: int, db: Session = Depends(get_db), _t=Depends(current_teacher)) -> schemas.LessonOut:
    lesson = db.get(models.Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "lesson not found")
    return schemas.LessonOut.model_validate(lesson)
