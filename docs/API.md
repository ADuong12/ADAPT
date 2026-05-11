<!-- generated-by: gsd-doc-writer -->

# ADAPT API Reference

## Authentication

ADAPT uses a header-based authentication mechanism for the MVP. All `/api/` endpoints (except `/api/auth/*`) require an `X-Teacher-Id` header identifying the current teacher.

```
X-Teacher-Id: <teacher_id>
```

The login flow works as follows:

1. Call `GET /api/auth/teachers` to list all teachers.
2. Call `POST /api/auth/fake-login` with a `teacher_id` to receive the teacher object.
3. Include the returned `teacher_id` as the `X-Teacher-Id` header in all subsequent requests.

Some endpoints enforce additional authorization:
- **Self or admin** — the requesting teacher must own the resource or have the `admin` role.
- **Self only** — the requesting teacher must own the resource (e.g., LLM config settings).
- **Admin only** — the requesting teacher must have the `admin` role.

## Endpoints Overview

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | Service info (service name, frontend path, OpenAPI docs path) | None |
| GET | `/api/health` | Health check | None |
| GET | `/api/auth/teachers` | List all teachers (for login picker) | None |
| POST | `/api/auth/fake-login` | Fake login returning a teacher object | None |
| GET | `/api/auth/me` | Get current authenticated teacher | X-Teacher-Id |
| GET | `/api/lessons` | List all lessons | X-Teacher-Id |
| GET | `/api/lessons/{lesson_id}` | Get a lesson by ID | X-Teacher-Id |
| GET | `/api/lessons/{lesson_id}/source-files` | List source files for a lesson | X-Teacher-Id |
| POST | `/api/lessons/{lesson_id}/edit-source-file` | AI-edit a lesson source file | X-Teacher-Id |
| GET | `/api/clusters` | List all clusters with KB and student counts | X-Teacher-Id |
| GET | `/api/clusters/{cluster_id}/kbs` | List KBs linked to a cluster | X-Teacher-Id |
| PUT | `/api/clusters/{cluster_id}/kbs` | Update KB links for a cluster | X-Teacher-Id |
| GET | `/api/knowledge-bases` | List all knowledge bases | X-Teacher-Id |
| GET | `/api/teachers/{teacher_id}/dashboard` | Dashboard data (metrics, recent adaptations, roster) | Self or admin |
| GET | `/api/teachers/{teacher_id}/classes` | Classes with enrolled students | Self or admin |
| PATCH | `/api/teachers/{teacher_id}/students/{student_id}` | Update student cluster/performance | Self or admin |
| GET | `/api/teachers/{teacher_id}/llm-config` | Get active LLM configuration | Self only |
| PUT | `/api/teachers/{teacher_id}/llm-config` | Set LLM configuration | Self only |
| POST | `/api/teachers/{teacher_id}/llm-config/test` | Test LLM connection | Self only |
| POST | `/api/adapt` | Generate an adapted lesson | X-Teacher-Id |
| GET | `/api/adaptations/{adapted_id}` | Get adaptation with version summary | Self or admin |
| POST | `/api/adaptations/{adapted_id}/refine` | Refine an adaptation with an instruction | X-Teacher-Id |
| GET | `/api/adaptations/{adapted_id}/versions` | List all versions of an adaptation | Self or admin |
| GET | `/api/adaptations/{adapted_id}/versions/{version_id}` | Get version detail with rendered HTML | Self or admin |
| POST | `/api/adaptations/{adapted_id}/rollback` | Rollback to a specific version | X-Teacher-Id |
| GET | `/api/adaptations/{adapted_id}/versions/{version_id}/print` | Render version as HTML page | Self or admin |
| GET | `/api/adaptations/{adapted_id}/versions/{version_id}/export.html` | Download version as HTML file | Self or admin |
| POST | `/api/adaptations/{adapted_id}/feedback` | Submit feedback (rating 1–5) | Self only |
| GET | `/api/lesson-file-edits/{filename}` | Download an AI-edited file | X-Teacher-Id |
| GET | `/api/institutions/{institution_id}/overview` | Institution metrics | Admin only |
| GET | `/api/institutions/{institution_id}/teachers` | Teachers with stats for an institution | Admin only |
| GET | `/api/institutions/{institution_id}/classes` | Classes for an institution | Admin only |
| GET | `/api/institutions/{institution_id}/clusters` | Cluster distribution for an institution | Admin only |

## Request and Response Formats

All request and response bodies use JSON. The API is built on FastAPI and provides an interactive OpenAPI/Swagger UI at `/docs`.

### Common Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Teacher-Id` | Yes (except `/api/auth/*`) | Integer ID of the authenticated teacher |
| `Content-Type` | Yes (for POST/PUT/PATCH) | Must be `application/json` |

## Auth Endpoints

### GET /api/auth/teachers

List all teachers. Public endpoint used by the login page.

**Response:** `200 OK`

```json
[
  {
    "teacher_id": 1,
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@school.edu",
    "role": "teacher",
    "institution_id": 1
  }
]
```

### POST /api/auth/fake-login

Authenticate as a teacher. Accepts any combination of fields; if `teacher_id` is provided and exists, returns that teacher. Falls back to `teacher_id=1` otherwise.

**Request body:**

```json
{
  "teacher_id": 1
}
```

All fields (`username`, `password`, `teacher_id`) are optional.

**Response:** `200 OK` — returns a `TeacherOut` object.

### GET /api/auth/me

Get the currently authenticated teacher.

**Response:** `200 OK` — returns a `TeacherOut` object.

## Lesson Endpoints

### GET /api/lessons

List all lessons.

**Response:** `200 OK`

```json
[
  {
    "lesson_id": 1,
    "title": "Intro to Algorithms",
    "grade_level": "3-5",
    "cs_topic": "Algorithms",
    "cs_standard": "CS-3-5-1",
    "objectives": "Students will understand basic algorithmic thinking"
  }
]
```

### GET /api/lessons/{lesson_id}

Get a single lesson by ID.

**Response:** `200 OK` — returns a `LessonOut` object, or `404` if not found.

### GET /api/lessons/{lesson_id}/source-files

List source files (`.docx`, `.pptx`, `.pdf`) attached to a lesson.

**Response:** `200 OK`

```json
[
  {
    "source_path": "Sample Lessons/intro-algorithms.pptx",
    "filename": "intro-algorithms.pptx",
    "file_type": "pptx",
    "size_bytes": 245760
  }
]
```

### POST /api/lessons/{lesson_id}/edit-source-file

AI-edit a lesson's source file, producing a modified version.

**Request body:**

```json
{
  "source_path": "Sample Lessons/intro-algorithms.pptx",
  "instruction": "Simplify the language for ELL students",
  "cluster_id": 2,
  "kb_ids": [1, 3]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_path` | string | Yes | Path to the source file |
| `instruction` | string | Yes | Edit instruction (1–2000 chars) |
| `cluster_id` | integer | No | Cluster context for the edit |
| `kb_ids` | integer[] | No | Knowledge base IDs to inform the edit |

**Response:** `200 OK`

```json
{
  "filename": "intro-algorithms-edited.pptx",
  "file_type": "pptx",
  "download_url": "/api/lesson-file-edits/intro-algorithms-edited.pptx",
  "note": "AI-edited file ready for download"
}
```

## Cluster Endpoints

### GET /api/clusters

List all student clusters with their linked knowledge base count and student count.

**Response:** `200 OK`

```json
[
  {
    "cluster_id": 1,
    "cluster_name": "ELL Beginners",
    "cluster_description": "Students with beginning English proficiency",
    "kb_count": 3,
    "student_count": 12
  }
]
```

### GET /api/clusters/{cluster_id}/kbs

List knowledge bases linked to a specific cluster.

**Response:** `200 OK` — returns an array of `KnowledgeBaseOut` objects.

### PUT /api/clusters/{cluster_id}/kbs

Replace the knowledge bases linked to a cluster. All existing links are removed and replaced with the provided list.

**Request body:**

```json
{
  "kb_ids": [1, 3, 5]
}
```

**Response:** `200 OK` — returns the updated array of `KnowledgeBaseOut` objects.

## Knowledge Base Endpoints

### GET /api/knowledge-bases

List all knowledge bases.

**Response:** `200 OK`

```json
[
  {
    "kb_id": 1,
    "kb_name": "UDL Guidelines",
    "category": "framework",
    "description": "Universal Design for Learning guidelines for accessible instruction",
    "source_url": "https://udlguidelines.cast.org/"
  }
]
```

## Teacher Endpoints

### GET /api/teachers/{teacher_id}/dashboard

Get dashboard data for a teacher including metrics, recent adaptations, and roster.

**Authorization:** Self or admin.

**Response:** `200 OK`

```json
{
  "teacher": { "teacher_id": 1, "first_name": "Jane", "last_name": "Smith", "email": "jane@school.edu", "role": "teacher", "institution_id": 1 },
  "institution": { "institution_id": 1, "name": "Westfield Elementary", "type": "public", "district": "Westfield SD" },
  "metrics": { "students": 28, "clusters": 4, "adaptations": 12, "knowledge_bases": 8, "classes": 3 },
  "recent_adaptations": [
    {
      "adapted_id": 5,
      "lesson_title": "Intro to Algorithms",
      "grade_level": "3-5",
      "cs_topic": "Algorithms",
      "cluster_name": "ELL Beginners",
      "head_version_number": 2,
      "generated_at": "2025-03-14T10:30:00Z"
    }
  ],
  "roster": [
    { "student_id": 1, "student_name": "Alex Johnson", "cluster_name": "ELL Beginners", "class_name": "CS Fundamentals" }
  ]
}
```

### GET /api/teachers/{teacher_id}/classes

Get all classes for a teacher, each with its enrolled students.

**Authorization:** Self or admin.

**Response:** `200 OK` — returns an array of `ClassOut` objects, each with an embedded `students` array.

### PATCH /api/teachers/{teacher_id}/students/{student_id}

Update a student's cluster assignment and/or performance levels. The student must be enrolled in one of the teacher's classes.

**Authorization:** Self or admin.

**Request body:** All fields are optional (partial update).

```json
{
  "cluster_id": 2,
  "math_performance": "below_level",
  "ela_performance": "on_level",
  "learner_variability": "high"
}
```

**Response:** `200 OK` — returns the updated `StudentOut` object.

## Settings Endpoints

### GET /api/teachers/{teacher_id}/llm-config

Get the active LLM provider configuration for a teacher.

**Authorization:** Self only.

**Response:** `200 OK`

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "api_key_redacted": "sk-...xyz",
  "is_active": true
}
```

Returns `null` if no configuration has been set yet.

### PUT /api/teachers/{teacher_id}/llm-config

Set or update the LLM provider configuration. Only one provider can be active at a time; setting a new provider deactivates the previous one.

**Authorization:** Self only.

**Request body:**

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "api_key": "AIza..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | One of: `gemini`, `openrouter`, `huggingface` |
| `model` | string | No | Model identifier (provider default used if omitted) |
| `api_key` | string | Yes | API key for the provider (4–512 chars) |

**Provider defaults** when `model` is omitted:
- `gemini` → `gemini-2.5-flash`
- `openrouter` → `meta-llama/llama-3.1-8b-instruct:free`
- `huggingface` → `meta-llama/Llama-3.1-8B-Instruct`

**Response:** `200 OK` — returns `LLMConfigOut`.

### POST /api/teachers/{teacher_id}/llm-config/test

Test the active LLM configuration by making a ping request to the provider.

**Authorization:** Self only.

**Response:** `200 OK`

```json
{
  "ok": true,
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "latency_ms": 342,
  "error": null
}
```

## Adaptation Endpoints

### POST /api/adapt

Generate an adapted lesson for a specific student cluster.

**Request body:**

```json
{
  "lesson_id": 1,
  "cluster_id": 2,
  "kb_ids": [1, 3],
  "include_student_context": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `lesson_id` | integer | Yes | — | ID of the lesson to adapt |
| `cluster_id` | integer | Yes | — | ID of the student cluster to adapt for |
| `kb_ids` | integer[] | No | `[]` | Knowledge base IDs to inform the adaptation |
| `include_student_context` | boolean | No | `true` | Whether to include student context in the prompt |

**Response:** `200 OK` — returns `AdaptationOut`.

### GET /api/adaptations/{adapted_id}

Get an adaptation with its version history summary.

**Authorization:** Self or admin.

**Response:** `200 OK`

```json
{
  "adapted_id": 5,
  "lesson_id": 1,
  "teacher_id": 1,
  "cluster_id": 2,
  "head_version": {
    "version_id": 8,
    "version_number": 2,
    "parent_version_id": 7,
    "is_head": true,
    "instruction": null,
    "model_used": "gemini-2.5-flash",
    "provider": "gemini",
    "token_count": 1200,
    "created_at": "2025-03-14T10:35:00Z"
  },
  "versions": [ ]
}
```

### POST /api/adaptations/{adapted_id}/refine

Refine an existing adaptation with an additional instruction. Creates a new version.

**Request body:**

```json
{
  "instruction": "Add more visual aids and simplify vocabulary"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `instruction` | string | Yes | Refinement instruction (1–2000 chars) |

**Response:** `200 OK` — returns `AdaptationOut`.

### GET /api/adaptations/{adapted_id}/versions

List all versions of an adaptation.

**Authorization:** Self or admin.

**Response:** `200 OK` — returns an array of `VersionSummary` objects.

### GET /api/adaptations/{adapted_id}/versions/{version_id}

Get full detail for a specific version, including rendered HTML and the structured plan.

**Authorization:** Self or admin.

**Response:** `200 OK` — returns `VersionDetail` (extends `VersionSummary` with `rendered_html` and `plan_json`).

### POST /api/adaptations/{adapted_id}/rollback

Rollback an adaptation to a previous version. The target version becomes the new head.

**Request body:**

```json
{
  "version_id": 7
}
```

**Response:** `200 OK` — returns `AdaptationOut`.

### GET /api/adaptations/{adapted_id}/versions/{version_id}/print

Render a version's adapted lesson as an HTML page (for printing/viewing).

**Authorization:** Self or admin.

**Response:** `200 OK` — returns `text/html`.

### GET /api/adaptations/{adapted_id}/versions/{version_id}/export.html

Download a version's adapted lesson as an HTML file.

**Authorization:** Self or admin.

**Response:** `200 OK` — returns `text/html` with `Content-Disposition: attachment` header. Filename format: `adapt-lesson-{adapted_id}-v{version_number}.html`.

### POST /api/adaptations/{adapted_id}/feedback

Submit feedback for an adaptation. Only the owning teacher can provide feedback.

**Authorization:** Self only.

**Request body:**

```json
{
  "rating": 4,
  "comments": "Good adaptation, but could use more visual aids"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rating` | integer | Yes | Rating from 1 to 5 |
| `comments` | string | No | Optional text feedback |

**Response:** `200 OK`

```json
{
  "ok": true,
  "feedback_id": 3
}
```

## File Edit Endpoints

### GET /api/lesson-file-edits/{filename}

Download an AI-edited file by filename. This endpoint serves files produced by the `POST /api/lessons/{lesson_id}/edit-source-file` endpoint.

**Response:** `200 OK` — returns the file as a download.

## Admin Endpoints

### GET /api/institutions/{institution_id}/overview

Get aggregate metrics for an institution.

**Authorization:** Admin only.

**Response:** `200 OK`

```json
{
  "institution": { "institution_id": 1, "name": "Westfield Elementary", "type": "public", "district": "Westfield SD" },
  "metrics": { "teachers": 5, "classes": 12, "students": 280, "adaptations": 45 }
}
```

### GET /api/institutions/{institution_id}/teachers

List all teachers in an institution with their class, student, and adaptation counts.

**Authorization:** Admin only.

**Response:** `200 OK` — returns an array of objects with `teacher`, `class_count`, `student_count`, and `adaptation_count`.

### GET /api/institutions/{institution_id}/classes

List all classes in an institution with teacher name and student count.

**Authorization:** Admin only.

**Response:** `200 OK` — returns an array with `class_id`, `class_name`, `grade_band`, `teacher_name`, `student_count`.

### GET /api/institutions/{institution_id}/clusters

Get cluster distribution across an institution's students and classes.

**Authorization:** Admin only.

**Response:** `200 OK` — returns an array with `cluster_name`, `student_count`, `class_count`.

## Health Endpoints

### GET /

Returns service metadata.

**Response:** `200 OK`

```json
{
  "service": "ADAPT",
  "frontend": "/app/login.html",
  "openapi": "/docs"
}
```

### GET /api/health

Returns database health status.

**Response:** `200 OK`

```json
{
  "ok": true,
  "db": "adapt.db"
}
```

## Error Codes

All errors follow a standard JSON envelope:

```json
{
  "detail": "Error message describing the problem"
}
```

| HTTP Status | Meaning | Common Causes |
|-------------|---------|---------------|
| `400` | Bad Request | Invalid input, LLM generation failure, unknown LLM provider |
| `401` | Unauthorized | Missing or invalid `X-Teacher-Id` header |
| `403` | Forbidden | Teacher accessing another teacher's data without admin role |
| `404` | Not Found | Resource does not exist (lesson, adaptation, version, cluster, etc.) |
| `500` | Internal Server Error | No teachers seeded in database, unexpected server error |

## Rate Limits

The ADAPT API does not implement application-level rate limiting in its current MVP version. However, LLM provider endpoints (`POST /api/adapt`, `POST /api/adaptations/{id}/refine`, `POST /api/teachers/{id}/llm-config/test`) are subject to the rate limits of the configured LLM provider (Gemini, OpenRouter, or HuggingFace).

<!-- VERIFY: LLM provider rate limits depend on the user's plan and API key tier -->