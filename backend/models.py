from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Institution(Base):
    __tablename__ = "institution"
    institution_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())


class Teacher(Base):
    __tablename__ = "teacher"
    teacher_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(100), unique=True)
    institution_id: Mapped[int | None] = mapped_column(ForeignKey("institution.institution_id"), nullable=True)
    role: Mapped[str] = mapped_column(String(30), default="teacher")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    institution: Mapped[Institution | None] = relationship(Institution)
    classes: Mapped[list["Class"]] = relationship(back_populates="teacher")


class Class(Base):
    __tablename__ = "class"
    class_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher.teacher_id"))
    class_name: Mapped[str] = mapped_column(String(100))
    grade_band: Mapped[str | None] = mapped_column(String(20), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(50), nullable=True)
    school_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    teacher: Mapped[Teacher] = relationship(back_populates="classes")
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="class_")


class StudentCluster(Base):
    __tablename__ = "student_cluster"
    cluster_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cluster_name: Mapped[str] = mapped_column(String(100))
    cluster_description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Student(Base):
    __tablename__ = "student"
    student_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))
    cluster_id: Mapped[int | None] = mapped_column(ForeignKey("student_cluster.cluster_id"), nullable=True)
    math_performance: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ela_performance: Mapped[str | None] = mapped_column(String(20), nullable=True)
    learner_variability: Mapped[str | None] = mapped_column(Text, nullable=True)

    cluster: Mapped[StudentCluster | None] = relationship(StudentCluster)


class Enrollment(Base):
    __tablename__ = "enrollment"
    enrollment_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("class.class_id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("student.student_id"))
    enrolled_date: Mapped[datetime | None] = mapped_column(Date, server_default=func.current_date())

    __table_args__ = (UniqueConstraint("class_id", "student_id"),)

    class_: Mapped[Class] = relationship(back_populates="enrollments")
    student: Mapped[Student] = relationship()


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"
    kb_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kb_name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ClusterKB(Base):
    __tablename__ = "cluster_kb"
    cluster_kb_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cluster_id: Mapped[int] = mapped_column(ForeignKey("student_cluster.cluster_id"))
    kb_id: Mapped[int] = mapped_column(ForeignKey("knowledge_base.kb_id"))

    __table_args__ = (UniqueConstraint("cluster_id", "kb_id"),)


class Lesson(Base):
    __tablename__ = "lesson"
    lesson_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    grade_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cs_topic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cs_standard: Mapped[str | None] = mapped_column(String(30), nullable=True)
    objectives: Mapped[str | None] = mapped_column(Text, nullable=True)


class AdaptedLesson(Base):
    __tablename__ = "adapted_lesson"
    adapted_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lesson.lesson_id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher.teacher_id"))
    cluster_id: Mapped[int] = mapped_column(ForeignKey("student_cluster.cluster_id"))
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    adapted_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    companion_materials: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    lesson: Mapped[Lesson] = relationship()
    teacher: Mapped[Teacher] = relationship()
    cluster: Mapped[StudentCluster] = relationship()
    versions: Mapped[list["LessonPlanVersion"]] = relationship(
        back_populates="adapted",
        order_by="LessonPlanVersion.version_number",
    )


class LessonKBUsed(Base):
    __tablename__ = "lesson_kb_used"
    lesson_kb_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    adapted_id: Mapped[int] = mapped_column(ForeignKey("adapted_lesson.adapted_id"))
    kb_id: Mapped[int] = mapped_column(ForeignKey("knowledge_base.kb_id"))

    __table_args__ = (UniqueConstraint("adapted_id", "kb_id"),)


class AdaptationFeedback(Base):
    __tablename__ = "adaptation_feedback"
    feedback_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    adapted_id: Mapped[int | None] = mapped_column(ForeignKey("adapted_lesson.adapted_id"), nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (CheckConstraint("rating >= 1 AND rating <= 5"),)


class RAGContextLog(Base):
    __tablename__ = "rag_context_log"
    log_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    adapted_id: Mapped[int | None] = mapped_column(ForeignKey("adapted_lesson.adapted_id"), nullable=True)
    kb_chunks_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context_layers: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())


class LessonPlanVersion(Base):
    __tablename__ = "lesson_plan_version"
    version_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    adapted_id: Mapped[int] = mapped_column(ForeignKey("adapted_lesson.adapted_id"))
    parent_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("lesson_plan_version.version_id"), nullable=True
    )
    version_number: Mapped[int] = mapped_column(Integer)
    is_head: Mapped[int] = mapped_column(Integer, default=0)
    instruction: Mapped[str | None] = mapped_column(Text, nullable=True)
    rendered_html: Mapped[str] = mapped_column(Text)
    plan_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(80), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(40), nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (UniqueConstraint("adapted_id", "version_number"),)

    adapted: Mapped[AdaptedLesson] = relationship(back_populates="versions")
    parent: Mapped["LessonPlanVersion | None"] = relationship(
        "LessonPlanVersion", remote_side="LessonPlanVersion.version_id"
    )


class LLMProviderConfig(Base):
    __tablename__ = "llm_provider_config"
    config_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teacher.teacher_id"))
    provider: Mapped[str] = mapped_column(String(40))
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    api_key_encrypted: Mapped[str] = mapped_column(Text)
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (UniqueConstraint("teacher_id", "provider"),)
