from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_teacher

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


def _ensure_self_or_admin(teacher: models.Teacher, target_id: int) -> None:
    if teacher.teacher_id != target_id and teacher.role != "admin":
        raise HTTPException(403, "you can only access your own data")


@router.get("/{teacher_id}/dashboard", response_model=schemas.DashboardOut)
def dashboard(teacher_id: int, db: Session = Depends(get_db), me: models.Teacher = Depends(current_teacher)) -> schemas.DashboardOut:
    _ensure_self_or_admin(me, teacher_id)
    teacher = db.get(models.Teacher, teacher_id)
    if not teacher:
        raise HTTPException(404, "teacher not found")
    institution = teacher.institution

    student_count = db.execute(
        select(func.count(distinct(models.Enrollment.student_id)))
        .join(models.Class, models.Class.class_id == models.Enrollment.class_id)
        .where(models.Class.teacher_id == teacher_id)
    ).scalar_one()

    cluster_count = db.execute(
        select(func.count(distinct(models.Student.cluster_id)))
        .join(models.Enrollment, models.Enrollment.student_id == models.Student.student_id)
        .join(models.Class, models.Class.class_id == models.Enrollment.class_id)
        .where(models.Class.teacher_id == teacher_id)
    ).scalar_one()

    adaptation_count = db.execute(
        select(func.count(models.AdaptedLesson.adapted_id)).where(models.AdaptedLesson.teacher_id == teacher_id)
    ).scalar_one()

    kb_count = db.execute(select(func.count(models.KnowledgeBase.kb_id))).scalar_one()

    # Recent adapted lessons with their head version number
    head_version_subq = (
        select(
            models.LessonPlanVersion.adapted_id,
            func.max(models.LessonPlanVersion.version_number).label("head_n"),
        )
        .where(models.LessonPlanVersion.is_head == 1)
        .group_by(models.LessonPlanVersion.adapted_id)
        .subquery()
    )

    recent_rows = db.execute(
        select(
            models.AdaptedLesson,
            models.Lesson.title,
            models.Lesson.grade_level,
            models.Lesson.cs_topic,
            models.StudentCluster.cluster_name,
            func.coalesce(head_version_subq.c.head_n, 1).label("head_n"),
        )
        .join(models.Lesson, models.Lesson.lesson_id == models.AdaptedLesson.lesson_id)
        .join(models.StudentCluster, models.StudentCluster.cluster_id == models.AdaptedLesson.cluster_id)
        .outerjoin(head_version_subq, head_version_subq.c.adapted_id == models.AdaptedLesson.adapted_id)
        .where(models.AdaptedLesson.teacher_id == teacher_id)
        .order_by(models.AdaptedLesson.generated_at.desc())
        .limit(6)
    ).all()

    recent = [
        schemas.RecentAdaptation(
            adapted_id=al.adapted_id,
            lesson_title=title,
            grade_level=grade,
            cs_topic=topic,
            cluster_name=cn,
            head_version_number=int(hn),
            generated_at=al.generated_at,
        )
        for al, title, grade, topic, cn, hn in recent_rows
    ]

    roster_rows = db.execute(
        select(
            models.Student.student_id,
            models.Student.first_name,
            models.Student.last_name,
            models.StudentCluster.cluster_name,
            models.Class.class_name,
        )
        .join(models.Enrollment, models.Enrollment.student_id == models.Student.student_id)
        .join(models.Class, models.Class.class_id == models.Enrollment.class_id)
        .outerjoin(models.StudentCluster, models.StudentCluster.cluster_id == models.Student.cluster_id)
        .where(models.Class.teacher_id == teacher_id)
        .order_by(models.Class.class_name, models.Student.last_name)
    ).all()

    roster = [
        schemas.RosterEntry(
            student_id=sid,
            student_name=f"{fn} {ln}",
            cluster_name=cn,
            class_name=cln,
        )
        for sid, fn, ln, cn, cln in roster_rows
    ]

    return schemas.DashboardOut(
        teacher=schemas.TeacherOut.model_validate(teacher),
        institution=schemas.InstitutionOut.model_validate(institution) if institution else None,
        metrics={
            "students": int(student_count),
            "clusters": int(cluster_count),
            "adaptations": int(adaptation_count),
            "knowledge_bases": int(kb_count),
            "classes": len(set(r.class_name for r in roster)),
        },
        recent_adaptations=recent,
        roster=roster,
    )


@router.get("/{teacher_id}/classes", response_model=list[schemas.ClassOut])
def classes(teacher_id: int, db: Session = Depends(get_db), me: models.Teacher = Depends(current_teacher)) -> list[schemas.ClassOut]:
    _ensure_self_or_admin(me, teacher_id)
    classes = list(db.execute(select(models.Class).where(models.Class.teacher_id == teacher_id)).scalars())
    out: list[schemas.ClassOut] = []
    for cl in classes:
        rows = db.execute(
            select(models.Student, models.StudentCluster.cluster_name)
            .join(models.Enrollment, models.Enrollment.student_id == models.Student.student_id)
            .outerjoin(models.StudentCluster, models.StudentCluster.cluster_id == models.Student.cluster_id)
            .where(models.Enrollment.class_id == cl.class_id)
            .order_by(models.Student.last_name)
        ).all()
        students = [
            schemas.StudentOut(
                student_id=s.student_id,
                first_name=s.first_name,
                last_name=s.last_name,
                cluster_id=s.cluster_id,
                cluster_name=cn,
                math_performance=s.math_performance,
                ela_performance=s.ela_performance,
                learner_variability=s.learner_variability,
            )
            for s, cn in rows
        ]
        out.append(
            schemas.ClassOut(
                class_id=cl.class_id,
                class_name=cl.class_name,
                grade_band=cl.grade_band,
                subject=cl.subject,
                school_year=cl.school_year,
                students=students,
            )
        )
    return out


@router.patch("/{teacher_id}/students/{student_id}", response_model=schemas.StudentOut)
def update_student(
    teacher_id: int,
    student_id: int,
    body: schemas.StudentUpdateIn,
    db: Session = Depends(get_db),
    me: models.Teacher = Depends(current_teacher),
) -> schemas.StudentOut:
    _ensure_self_or_admin(me, teacher_id)
    student = db.execute(
        select(models.Student)
        .join(models.Enrollment, models.Enrollment.student_id == models.Student.student_id)
        .join(models.Class, models.Class.class_id == models.Enrollment.class_id)
        .where(models.Class.teacher_id == teacher_id, models.Student.student_id == student_id)
        .limit(1)
    ).scalar_one_or_none()
    if not student:
        raise HTTPException(404, "student not found for this teacher")

    if body.cluster_id is not None:
        cluster = db.get(models.StudentCluster, body.cluster_id)
        if not cluster:
            raise HTTPException(404, "cluster not found")
        student.cluster_id = body.cluster_id
    if body.math_performance is not None:
        student.math_performance = body.math_performance
    if body.ela_performance is not None:
        student.ela_performance = body.ela_performance
    if body.learner_variability is not None:
        student.learner_variability = body.learner_variability

    db.commit()
    db.refresh(student)
    cluster_name = student.cluster.cluster_name if student.cluster else None
    return schemas.StudentOut(
        student_id=student.student_id,
        first_name=student.first_name,
        last_name=student.last_name,
        cluster_id=student.cluster_id,
        cluster_name=cluster_name,
        math_performance=student.math_performance,
        ela_performance=student.ela_performance,
        learner_variability=student.learner_variability,
    )
