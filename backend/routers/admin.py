from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import require_admin

router = APIRouter(prefix="/api/institutions", tags=["admin"])


@router.get("/{institution_id}/overview")
def overview(institution_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)) -> dict:
    inst = db.get(models.Institution, institution_id)
    if not inst:
        raise HTTPException(404, "institution not found")
    teacher_count = db.execute(
        select(func.count()).where(models.Teacher.institution_id == institution_id, models.Teacher.role == "teacher")
    ).scalar_one()
    class_count = db.execute(
        select(func.count(models.Class.class_id))
        .join(models.Teacher, models.Teacher.teacher_id == models.Class.teacher_id)
        .where(models.Teacher.institution_id == institution_id)
    ).scalar_one()
    student_count = db.execute(
        select(func.count(distinct(models.Enrollment.student_id)))
        .join(models.Class, models.Class.class_id == models.Enrollment.class_id)
        .join(models.Teacher, models.Teacher.teacher_id == models.Class.teacher_id)
        .where(models.Teacher.institution_id == institution_id)
    ).scalar_one()
    adaptation_count = db.execute(
        select(func.count(models.AdaptedLesson.adapted_id))
        .join(models.Teacher, models.Teacher.teacher_id == models.AdaptedLesson.teacher_id)
        .where(models.Teacher.institution_id == institution_id)
    ).scalar_one()
    return {
        "institution": schemas.InstitutionOut.model_validate(inst).model_dump(),
        "metrics": {
            "teachers": int(teacher_count),
            "classes": int(class_count),
            "students": int(student_count),
            "adaptations": int(adaptation_count),
        },
    }


@router.get("/{institution_id}/teachers")
def teachers(institution_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)) -> list[dict]:
    rows = db.execute(
        select(
            models.Teacher,
            func.count(distinct(models.Class.class_id)),
            func.count(distinct(models.Enrollment.student_id)),
            func.count(distinct(models.AdaptedLesson.adapted_id)),
        )
        .outerjoin(models.Class, models.Class.teacher_id == models.Teacher.teacher_id)
        .outerjoin(models.Enrollment, models.Enrollment.class_id == models.Class.class_id)
        .outerjoin(models.AdaptedLesson, models.AdaptedLesson.teacher_id == models.Teacher.teacher_id)
        .where(models.Teacher.institution_id == institution_id)
        .group_by(models.Teacher.teacher_id)
    ).all()
    return [
        {
            "teacher": schemas.TeacherOut.model_validate(t).model_dump(),
            "class_count": int(c),
            "student_count": int(s),
            "adaptation_count": int(a),
        }
        for t, c, s, a in rows
    ]


@router.get("/{institution_id}/classes")
def classes(institution_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)) -> list[dict]:
    rows = db.execute(
        select(
            models.Class,
            models.Teacher.first_name,
            models.Teacher.last_name,
            func.count(models.Enrollment.student_id),
        )
        .join(models.Teacher, models.Teacher.teacher_id == models.Class.teacher_id)
        .outerjoin(models.Enrollment, models.Enrollment.class_id == models.Class.class_id)
        .where(models.Teacher.institution_id == institution_id)
        .group_by(models.Class.class_id)
    ).all()
    return [
        {
            "class_id": cl.class_id,
            "class_name": cl.class_name,
            "grade_band": cl.grade_band,
            "teacher_name": f"{fn} {ln}",
            "student_count": int(sc),
        }
        for cl, fn, ln, sc in rows
    ]


@router.get("/{institution_id}/clusters")
def clusters(institution_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)) -> list[dict]:
    rows = db.execute(
        select(
            models.StudentCluster.cluster_name,
            func.count(distinct(models.Student.student_id)),
            func.count(distinct(models.Class.class_id)),
        )
        .join(models.Student, models.Student.cluster_id == models.StudentCluster.cluster_id)
        .join(models.Enrollment, models.Enrollment.student_id == models.Student.student_id)
        .join(models.Class, models.Class.class_id == models.Enrollment.class_id)
        .join(models.Teacher, models.Teacher.teacher_id == models.Class.teacher_id)
        .where(models.Teacher.institution_id == institution_id)
        .group_by(models.StudentCluster.cluster_id)
    ).all()
    return [
        {"cluster_name": cn, "student_count": int(sc), "class_count": int(cc)} for cn, sc, cc in rows
    ]
