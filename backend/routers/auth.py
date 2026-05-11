from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_teacher

router = APIRouter(prefix="/api/auth", tags=["auth"])


class FakeLoginIn(BaseModel):
    username: str | None = None
    password: str | None = None
    teacher_id: int | None = None


@router.get("/teachers", response_model=list[schemas.TeacherOut])
def list_teachers_for_login(db: Session = Depends(get_db)) -> list[schemas.TeacherOut]:
    """Public — login.html uses this to render the picker. Returns name+role only."""
    rows = db.execute(select(models.Teacher).order_by(models.Teacher.last_name)).scalars()
    return [schemas.TeacherOut.model_validate(t) for t in rows]


@router.post("/fake-login", response_model=schemas.TeacherOut)
def fake_login(payload: FakeLoginIn, db: Session = Depends(get_db)) -> schemas.TeacherOut:
    """Accepts anything. If teacher_id is provided and exists, return that teacher; else return teacher_id=1."""
    target_id = payload.teacher_id or 1
    teacher = db.get(models.Teacher, target_id)
    if not teacher:
        # Fall back to any teacher in the DB.
        teacher = db.execute(select(models.Teacher).order_by(models.Teacher.teacher_id).limit(1)).scalar_one_or_none()
        if not teacher:
            raise HTTPException(status_code=500, detail="no teachers seeded; cannot fakeauth")
    return schemas.TeacherOut.model_validate(teacher)


@router.get("/me", response_model=schemas.TeacherOut)
def me(teacher: models.Teacher = Depends(current_teacher)) -> schemas.TeacherOut:
    return schemas.TeacherOut.model_validate(teacher)
