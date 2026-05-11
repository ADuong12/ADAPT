from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ----- Org / classes / students -----

class InstitutionOut(_Base):
    institution_id: int
    name: str
    type: str | None = None
    district: str | None = None


class TeacherOut(_Base):
    teacher_id: int
    first_name: str
    last_name: str
    email: str
    role: str
    institution_id: int | None = None


class StudentClusterOut(_Base):
    cluster_id: int
    cluster_name: str
    cluster_description: str | None = None


class StudentOut(_Base):
    student_id: int
    first_name: str
    last_name: str
    cluster_id: int | None
    cluster_name: str | None = None
    math_performance: str | None = None
    ela_performance: str | None = None
    learner_variability: str | None = None


class ClassOut(_Base):
    class_id: int
    class_name: str
    grade_band: str | None = None
    subject: str | None = None
    school_year: int | None = None
    students: list[StudentOut] = []


class StudentUpdateIn(BaseModel):
    cluster_id: int | None = None
    math_performance: str | None = None
    ela_performance: str | None = None
    learner_variability: str | None = None


# ----- Lessons & KBs -----

class LessonOut(_Base):
    lesson_id: int
    title: str
    grade_level: str | None = None
    cs_topic: str | None = None
    cs_standard: str | None = None
    objectives: str | None = None


class LessonSourceFileOut(BaseModel):
    source_path: str
    filename: str
    file_type: str
    size_bytes: int


class LessonSourceEditIn(BaseModel):
    source_path: str
    instruction: str = Field(min_length=1, max_length=2000)
    cluster_id: int | None = None
    kb_ids: list[int] = Field(default_factory=list)


class LessonSourceEditOut(BaseModel):
    filename: str
    file_type: str
    download_url: str
    note: str


class KnowledgeBaseOut(_Base):
    kb_id: int
    kb_name: str
    category: str | None = None
    description: str | None = None
    source_url: str | None = None


class ClusterWithKBs(_Base):
    cluster_id: int
    cluster_name: str
    cluster_description: str | None = None
    kb_count: int
    student_count: int


class ClusterKBUpdateIn(BaseModel):
    kb_ids: list[int] = Field(default_factory=list)


# ----- Dashboard -----

class RecentAdaptation(_Base):
    adapted_id: int
    lesson_title: str
    grade_level: str | None
    cs_topic: str | None
    cluster_name: str
    head_version_number: int
    generated_at: datetime


class RosterEntry(_Base):
    student_id: int
    student_name: str
    cluster_name: str | None
    class_name: str


class DashboardOut(_Base):
    teacher: TeacherOut
    institution: InstitutionOut | None
    metrics: dict[str, int]
    recent_adaptations: list[RecentAdaptation]
    roster: list[RosterEntry]


# ----- Adaptation lifecycle -----

class AdaptRequest(BaseModel):
    lesson_id: int
    cluster_id: int
    kb_ids: list[int] = Field(default_factory=list)
    include_student_context: bool = True


class RefineRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=2000)


class RollbackRequest(BaseModel):
    version_id: int


class VersionSummary(_Base):
    version_id: int
    version_number: int
    parent_version_id: int | None
    is_head: bool
    instruction: str | None
    model_used: str | None
    provider: str | None
    token_count: int | None
    created_at: datetime


class VersionDetail(VersionSummary):
    rendered_html: str
    plan_json: dict[str, Any] | None


class AdaptationOut(_Base):
    adapted_id: int
    lesson_id: int
    teacher_id: int
    cluster_id: int
    head_version: VersionSummary
    versions: list[VersionSummary]


# ----- Settings -----

class LLMConfigIn(BaseModel):
    provider: str
    model: str | None = None
    api_key: str = Field(min_length=4, max_length=512)


class LLMConfigOut(BaseModel):
    provider: str
    model: str | None
    api_key_redacted: str
    is_active: bool


class LLMTestResult(BaseModel):
    ok: bool
    provider: str
    model: str | None
    latency_ms: int | None = None
    error: str | None = None


# ----- Feedback -----

class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comments: str | None = None
