from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from . import models
from .db import get_db


def current_teacher(
    x_teacher_id: int | None = Header(default=None, alias="X-Teacher-Id"),
    db: Session = Depends(get_db),
) -> models.Teacher:
    """MVP fakeauth: trust the X-Teacher-Id header. login.html sets it from localStorage."""
    if not x_teacher_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing X-Teacher-Id header")
    teacher = db.get(models.Teacher, x_teacher_id)
    if not teacher:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown teacher")
    return teacher


def require_admin(teacher: models.Teacher = Depends(current_teacher)) -> models.Teacher:
    if teacher.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin only")
    return teacher
