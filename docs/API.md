<!-- generated-by: gsd-doc-writer -->

# ADAPT API Reference

## Authentication

ADAPT uses JWT Bearer token authentication. All `/api/` endpoints except `/api/auth/register`, `/api/auth/login`, `/api/auth/setup-password`, `/api/auth/setup-request`, `/api/auth/refresh`, and `/api/health` require a valid `Authorization: Bearer <token>` header.

### Token Lifecycle

| Action | Endpoint | Description |
|---|---|---|
| Register | `POST /api/auth/register` | Create account, receive access + refresh tokens |
| Login | `POST /api/auth/login` | Authenticate, receive access + refresh tokens |
| Setup password | `PUT /api/auth/setup-password` | Set password for seeded teacher (no password yet) |
| Refresh | `POST /api/auth/refresh` | Exchange refresh token for new token pair (one-time use) |
| Logout | `POST /api/auth/logout` | Revoke all refresh tokens for the authenticated user |
| Current user | `GET /api/auth/me` | Get current user info from JWT |

### Access Tokens

- **Algorithm**: HS256
- **Expiry**: 15 minutes
- **Payload**: `{ teacher_id, role, institution_id }`
- **Header**: `Authorization: Bearer <access_token>`

### Refresh Tokens

- **Format**: UUID v4
- **Expiry**: 7 days
- **One-time use**: Exchanged and invalidated on each refresh
- **Storage**: SHA-256 hashed in `refresh_token` table

### Authorization Middleware

| Middleware | Purpose |
|---|---|
| `requireAuth` | Validates JWT, sets `req.user`. Returns 401 on missing/invalid/expired tokens. |
| `requireRole(...roles)` | Checks `req.user.role` against allowed roles. Returns 403 if insufficient permissions. |
| `requireOwnerOrAdmin` | Checks `req.user.teacher_id === req.params.id || req.user.role === 'admin'`. Returns 403 for non-owner non-admin. |

## Common Request Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes (except auth endpoints) | `Bearer <access_token>` |
| `Content-Type` | Yes (for POST/PUT/PATCH) | `application/json` |

## Request/Response Formats

Successful responses return the resource directly as JSON (there is no wrapping envelope). Error responses use the standard envelope described below.

Representative success shapes:

- **Single object**: `GET /api/lessons/1` returns `{ lesson_id: 1, title: "...", ... }`
- **Array**: `GET /api/clusters` returns `[ { cluster_id: 1, ... }, ... ]`
- **Paginated list**: `GET /api/lessons` returns `{ lessons: [...], total: 3, page: 1, limit: 20 }`
- **Action result**: `POST /api/auth/register` returns `{ accessToken, refreshToken, user }`

## Error Responses

All errors follow a standard JSON envelope:

```json
{
  "error": "Error message describing the problem",
  "status": 400
}
```

Optional `detail` field for validation errors:

```json
{
  "error": "Invalid request body",
  "status": 400,
  "detail": [{ "path": ["body", "api_key"], "message": "..." }]
}
```

In non-production environments, `500` errors also include a `stack` field with the error stack trace.

| HTTP Status | Meaning | Common Causes |
|---|---|---|
| `400` | Bad Request | Invalid input, validation failure, LLM not configured |
| `401` | Unauthorized | Missing, invalid, or expired JWT token |
| `403` | Forbidden | Non-owner accessing another teacher's resource, non-admin accessing admin endpoint |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate email on registration |
| `500` | Internal Server Error | LLM generation failure, unexpected server error |

## Endpoints Overview

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Create account, receive tokens | No |
| POST | `/api/auth/login` | Authenticate, receive tokens | No |
| GET | `/api/auth/setup-request` | Check if teacher needs password setup | No |
| PUT | `/api/auth/setup-password` | Set initial password for seeded teacher | No |
| POST | `/api/auth/refresh` | Exchange refresh token for new pair | No |
| POST | `/api/auth/logout` | Revoke all refresh tokens | Yes |
| GET | `/api/auth/me` | Get current user info | Yes |
| GET | `/api/lessons` | List lessons with pagination and search | Yes |
| GET | `/api/lessons/:id` | Get single lesson | Yes |
| GET | `/api/lessons/:id/source-files` | List source files (stub) | Yes |
| GET | `/api/clusters` | List all student clusters | Yes |
| GET | `/api/clusters/:id/kbs` | List KBs linked to a cluster | Yes |
| PUT | `/api/clusters/:id/kbs` | Replace KB assignments for a cluster | Yes + Owner/Admin |
| GET | `/api/knowledge-bases` | List all knowledge bases | Yes |
| GET | `/api/teachers/:id/dashboard` | Get teacher dashboard data | Yes + Owner/Admin |
| GET | `/api/teachers/:id/classes` | Get classes with enrolled students | Yes + Owner/Admin |
| PATCH | `/api/teachers/:id/students/:student_id` | Update student cluster and performance | Yes + Owner/Admin |
| GET | `/api/teachers/:id/profile` | View teacher profile | Yes + Owner/Admin |
| PUT | `/api/teachers/:id/profile` | Update teacher profile name | Yes + Owner/Admin |
| GET | `/api/teachers/:id/llm-config` | Get active LLM provider config | Yes + Owner/Admin |
| PUT | `/api/teachers/:id/llm-config` | Set or update LLM provider config | Yes + Owner/Admin |
| POST | `/api/teachers/:id/llm-config/test` | Test LLM connection (stub) | Yes + Owner/Admin |
| POST | `/api/adapt` | Generate an adapted lesson plan | Yes |
| GET | `/api/adaptations/:adapted_id` | Get adaptation with version summary | Yes + Owner/Admin |
| POST | `/api/adaptations/:adapted_id/refine` | Refine adaptation with instruction | Yes + Owner/Admin |
| GET | `/api/adaptations/:adapted_id/versions` | List all versions of an adaptation | Yes + Owner/Admin |
| GET | `/api/adaptations/:adapted_id/versions/:version_id` | Get full version detail | Yes + Owner/Admin |
| POST | `/api/adaptations/:adapted_id/rollback` | Rollback to a previous version | Yes + Owner/Admin |
| GET | `/api/adaptations/:adapted_id/versions/:version_id/print` | Render version as HTML page | Yes + Owner/Admin |
| GET | `/api/adaptations/:adapted_id/versions/:version_id/export.html` | Download version as HTML | Yes + Owner/Admin |
| GET | `/api/adaptations/:adapted_id/versions/:version_id/export-docx` | Download version as DOCX | Yes + Owner/Admin |
| GET | `/api/adaptations/:adapted_id/versions/:version_id/export-pdf` | Download version as PDF | Yes + Owner/Admin |
| POST | `/api/adaptations/:adapted_id/feedback` | Submit feedback for an adaptation | Yes + Owner |
| POST | `/api/file-edits` | AI-edit a lesson source file | Yes |
| GET | `/api/file-edits/lessons/:lesson_id/sources` | List available source files for a lesson | Yes |
| GET | `/api/lesson-file-edits/:filename` | Download an AI-edited file | Yes |
| GET | `/api/institutions/:id/overview` | Get institution aggregate metrics | Yes + Admin |
| GET | `/api/institutions/:id/teachers` | List teachers in an institution | Yes + Admin |
| GET | `/api/institutions/:id/classes` | List classes in an institution | Yes + Admin |
| GET | `/api/institutions/:id/clusters` | Get cluster distribution | Yes + Admin |
| PUT | `/api/institutions/:id/settings` | System-wide settings (stub) | Yes + Admin |
| GET | `/api/health` | Health check | No |

---

## Auth Endpoints

### POST /api/auth/register

Register a new user account.

**Request body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@school.edu",
  "password": "securepassword"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | Yes | Split into `first_name` and `last_name` |
| `email` | string | Yes | Valid email format, must be unique |
| `password` | string | Yes | Minimum 8 characters |

**Response:** `200 OK`

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "550e8400-...",
  "user": { "teacher_id": 5, "email": "jane@school.edu", "role": "teacher" }
}
```

### POST /api/auth/login

Authenticate with email and password.

**Request body:**

```json
{
  "email": "jane@school.edu",
  "password": "securepassword"
}
```

**Response:** `200 OK` — returns token pair and user object.

### GET /api/auth/setup-request

Check if a teacher needs to set up their password.

**Query params:** `?email=jane@school.edu`

**Response:** `200 OK`

```json
{ "requires_setup": true }
```

### PUT /api/auth/setup-password

Set initial password for a seeded teacher (those without passwords).

**Request body:**

```json
{
  "email": "rchen@lincoln.edu",
  "password": "newpassword123"
}
```

**Response:** `200 OK` — returns token pair and user object.

### POST /api/auth/refresh

Exchange a refresh token for a new access/refresh token pair. The old refresh token is invalidated.

**Request body:**

```json
{ "refreshToken": "550e8400-..." }
```

**Response:** `200 OK`

```json
{ "accessToken": "eyJhbGci...", "refreshToken": "660f9511-..." }
```

### POST /api/auth/logout

Revoke all refresh tokens for the authenticated user. Requires `Authorization` header.

**Response:** `200 OK`

```json
{ "ok": true }
```

### GET /api/auth/me

Get the current authenticated user's info.

**Response:** `200 OK`

```json
{ "teacher_id": 1, "first_name": "Maria", "last_name": "Hernandez", "email": "maria@westfield.edu", "institution_id": 1, "role": "teacher" }
```

---

## Lesson Endpoints

### GET /api/lessons

List lessons with pagination and search.

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Results per page (max 100) |
| `q` | string | — | Search in title and cs_topic |
| `grade_level` | string | — | Filter by grade level |

**Response:** `200 OK`

```json
{
  "lessons": [
    { "lesson_id": 1, "title": "Intro to Algorithms", "grade_level": "3-5", "cs_topic": "Algorithms", "cs_standard": "CS-3-5-1", "objectives": "..." }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

### GET /api/lessons/:id

Get a single lesson by ID.

**Response:** `200 OK` — returns lesson object, or `404` if not found.

### GET /api/lessons/:id/source-files

_List source files for a lesson._ **Not yet implemented** — returns `501`.

---

## Cluster Endpoints

### GET /api/clusters

List all student clusters with their linked knowledge base count and student count.

**Response:** `200 OK`

```json
[
  { "cluster_id": 1, "cluster_name": "ELL Beginners", "cluster_description": "...", "kb_count": 3, "student_count": 12 }
]
```

### GET /api/clusters/:id/kbs

List knowledge bases linked to a specific cluster.

**Response:** `200 OK` — returns array of KB objects.

### PUT /api/clusters/:id/kbs

Replace KB assignments for a cluster. All existing links are removed and replaced.

**Request body:**

```json
{ "kb_ids": [1, 3, 5] }
```

**Authorization:** `requireOwnerOrAdmin`

**Response:** `200 OK` — returns updated array of KB objects.

---

## Knowledge Base Endpoints

### GET /api/knowledge-bases

List all knowledge bases.

**Response:** `200 OK`

```json
[
  { "kb_id": 1, "kb_name": "UDL Guidelines", "category": "framework", "description": "...", "source_url": "https://..." }
]
```

---

## Teacher Endpoints

### GET /api/teachers/:id/dashboard

Get dashboard data for a teacher: profile, institution, metrics, recent adaptations, and roster.

**Authorization:** `requireOwnerOrAdmin`

**Response:** `200 OK`

```json
{
  "teacher": { "teacher_id": 1, "first_name": "Maria", "last_name": "Hernandez", "email": "maria@westfield.edu", "institution_id": 1, "role": "teacher" },
  "institution": { "institution_id": 1, "name": "Westfield Elementary", "type": "public", "district": "Westfield SD" },
  "metrics": { "students": 28, "clusters": 4, "adaptations": 12, "knowledge_bases": 16, "classes": 3 },
  "recent_adaptations": [ { "adapted_id": 5, "lesson_title": "...", "grade_level": "3-5", "cs_topic": "...", "cluster_name": "...", "generated_at": "..." } ],
  "roster": [ { "student_id": 1, "student_name": "Alex Johnson", "cluster_name": "ELL Beginners", "class_name": "CS Fundamentals" } ]
}
```

### GET /api/teachers/:id/classes

Get classes for a teacher, each with enrolled students.

**Authorization:** `requireOwnerOrAdmin`

**Response:** `200 OK` — returns array of class objects with nested `students` array.

### PATCH /api/teachers/:id/students/:student_id

Update a student's cluster and/or performance levels. The student must be enrolled in one of the teacher's classes.

**Authorization:** `requireOwnerOrAdmin`

**Request body:** All fields optional (partial update).

```json
{
  "cluster_id": 2,
  "math_performance": "below_level",
  "ela_performance": "on_level",
  "learner_variability": "high"
}
```

**Response:** `200 OK` — returns updated student object with `cluster_name`.

### GET /api/teachers/:id/profile

View a teacher's profile.

**Authorization:** `requireOwnerOrAdmin`

**Response:** `200 OK` — returns teacher object.

### PUT /api/teachers/:id/profile

Update a teacher's profile name. Email and role cannot be changed via this endpoint.

**Authorization:** `requireOwnerOrAdmin`

**Request body:**

```json
{
  "first_name": "Maria",
  "last_name": "Hernandez-Lopez"
}
```

Both fields required. Max 50 characters each.

**Response:** `200 OK` — returns updated teacher object.

---

## Settings / LLM Config Endpoints

### GET /api/teachers/:id/llm-config

Get the active LLM provider configuration for a teacher. API key is returned redacted.

**Authorization:** `requireOwnerOrAdmin`

**Response:** `200 OK`

```json
{
  "provider": "openrouter",
  "model": "meta-llama/llama-3.1-8b-instruct:free",
  "api_key_redacted": "sk-\u2026abcd",
  "is_active": true
}
```

Returns `null` if no configuration has been set yet.

### PUT /api/teachers/:id/llm-config

Set or update LLM provider configuration. Only one provider can be active per teacher at a time; setting a new provider deactivates the previous one. The API key is encrypted with AES-256-GCM before storage.

**Authorization:** `requireOwnerOrAdmin`

**Request body:**

```json
{
  "provider": "openrouter",
  "model": "meta-llama/llama-3.1-8b-instruct:free",
  "api_key": "sk-or-v1-..."
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `provider` | string | Yes | One of: `openrouter`, `openai`, `anthropic` |
| `model` | string | No | Model identifier (stored as null if omitted) |
| `api_key` | string | Yes* | 4-512 characters. *Required when creating a new config; optional when updating an existing config if you want to keep the current key.* |

**Response:** `200 OK`

```json
{
  "provider": "openrouter",
  "model": "meta-llama/llama-3.1-8b-instruct:free",
  "api_key_redacted": "sk-\u2026abcd",
  "is_active": true
}
```

### POST /api/teachers/:id/llm-config/test

Test the active LLM provider connection. **Not yet implemented** — returns `501`.

---

## Adaptation Endpoints

### POST /api/adapt

Generate an adapted lesson plan for a specific student cluster.

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
|---|---|---|---|---|
| `lesson_id` | integer | Yes | — | ID of the lesson to adapt |
| `cluster_id` | integer | Yes | — | ID of the student cluster |
| `kb_ids` | integer[] | No | `[]` | Knowledge base IDs for RAG context |
| `include_student_context` | boolean | No | `true` | Include student profiles in LLM prompt |

**Response:** `201 Created` — returns `AdaptationOut` with head version and full version list.

```json
{
  "adapted_id": 5,
  "lesson_id": 1,
  "teacher_id": 1,
  "cluster_id": 2,
  "head_version": {
    "version_id": 8,
    "version_number": 1,
    "parent_version_id": null,
    "is_head": true,
    "instruction": null,
    "model_used": "meta-llama/llama-3.1-8b-instruct:free",
    "provider": "openrouter",
    "token_count": 1200,
    "created_at": "2025-03-14T10:35:00Z"
  },
  "versions": [ { "version_id": 8, "..." : "..." } ]
}
```

**Errors:** Returns `400` if no LLM configured for the teacher; `500` on LLM generation failure.

### GET /api/adaptations/:adapted_id

Get an adaptation with its version summary.

**Authorization:** Owner or admin (checked by `requireAdaptationOwner` middleware).

**Response:** `200 OK` — returns `AdaptationOut`.

### POST /api/adaptations/:adapted_id/refine

Refine an existing adaptation with an additional instruction. Creates a new version linked via `parent_version_id`.

**Authorization:** Owner or admin.

**Request body:**

```json
{ "instruction": "Add more visual aids and simplify vocabulary" }
```

**Response:** `200 OK` — returns `AdaptationOut` with new head version.

### GET /api/adaptations/:adapted_id/versions

List all versions of an adaptation.

**Authorization:** Owner or admin.

**Response:** `200 OK` — returns array of `VersionSummary` objects.

### GET /api/adaptations/:adapted_id/versions/:version_id

Get full version detail including rendered HTML and structured plan JSON.

**Authorization:** Owner or admin.

**Response:** `200 OK`

```json
{
  "version_id": 8,
  "version_number": 1,
  "parent_version_id": null,
  "is_head": true,
  "instruction": null,
  "model_used": "meta-llama/llama-3.1-8b-instruct:free",
  "provider": "openrouter",
  "token_count": 1200,
  "created_at": "2025-03-14T10:35:00Z",
  "rendered_html": "<html>...</html>",
  "plan_json": { "recommendations": [], "plan_steps": [], "companion_materials": [] }
}
```

### POST /api/adaptations/:adapted_id/rollback

Rollback to a previous version. The target version becomes the new head; no data is deleted.

**Authorization:** Owner or admin.

**Request body:**

```json
{ "version_id": 7 }
```

**Response:** `200 OK` — returns `AdaptationOut`.

### GET /api/adaptations/:adapted_id/versions/:version_id/print

Render a version as an HTML page (for viewing/printing).

**Authorization:** Owner or admin.

**Response:** `200 OK` — `Content-Type: text/html; charset=utf-8`

### GET /api/adaptations/:adapted_id/versions/:version_id/export.html

Download a version as an HTML file.

**Authorization:** Owner or admin.

**Response:** `200 OK` — `Content-Type: text/html; charset=utf-8` with `Content-Disposition: attachment; filename="adapt-lesson-{id}-v{number}.html"`

### GET /api/adaptations/:adapted_id/versions/:version_id/export-docx

Download a version as a Microsoft Word document.

**Authorization:** Owner or admin.

**Response:** `200 OK` — `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` with `Content-Disposition: attachment; filename="adapt-lesson-{id}-v{number}.docx"`

### GET /api/adaptations/:adapted_id/versions/:version_id/export-pdf

Download a version as a PDF file.

**Authorization:** Owner or admin.

**Response:** `200 OK` — `Content-Type: application/pdf` with `Content-Disposition: attachment; filename="adapt-lesson-{id}-v{number}.pdf"`

### POST /api/adaptations/:adapted_id/feedback

Submit feedback for an adaptation. Only the owning teacher can submit feedback.

**Authorization:** Owner only (not admin).

**Request body:**

```json
{
  "rating": 4,
  "comments": "Good adaptation, but could use more visual aids"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `rating` | integer | Yes | Rating from 1 to 5 |
| `comments` | string | No | Optional text feedback |

**Response:** `200 OK`

```json
{ "ok": true, "feedback_id": 3 }
```

---

## File Edit Endpoints

### POST /api/file-edits

AI-edit a lesson source file (DOCX, PPTX, or PDF).

**Request body:**

```json
{
  "lesson_id": 1,
  "source_path": "Sample Lessons/intro-algorithms.pptx",
  "instruction": "Simplify the language for ELL students",
  "cluster_id": 2,
  "kb_ids": [1, 3]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `lesson_id` | integer | Yes | Lesson the file belongs to |
| `source_path` | string | Yes | Path to the source file |
| `instruction` | string | Yes | Edit instruction |
| `cluster_id` | integer | No | Cluster context for the edit |
| `kb_ids` | integer[] | No | Knowledge base IDs to inform the edit |

**Response:** `201 Created`

```json
{
  "filename": "intro-algorithms-edited.pptx",
  "file_type": "pptx",
  "download_url": "/api/lesson-file-edits/intro-algorithms-edited.pptx",
  "note": "Original source file was not changed. Edited copy preserves hyperlinks and images from the original. Other layout and styling may vary."
}
```

### GET /api/file-edits/lessons/:lesson_id/sources

List available source files for a lesson.

**Response:** `200 OK`

```json
[
  {
    "source_path": "Sample Lessons/intro-algorithms.pptx",
    "filename": "intro-algorithms.pptx",
    "file_type": "pptx",
    "size_bytes": 256000
  }
]
```

### GET /api/lesson-file-edits/:filename

Download an AI-edited file by filename.

**Response:** `200 OK` — file download.

---

## Admin Endpoints

All admin endpoints require `requireAuth` + `requireRole('admin')`.

### GET /api/institutions/:id/overview

Get aggregate metrics for an institution.

**Response:** `200 OK`

```json
{
  "institution": { "institution_id": 1, "name": "Westfield Elementary", "type": "public", "district": "Westfield SD" },
  "metrics": { "teachers": 5, "classes": 12, "students": 280, "adaptations": 45 }
}
```

### GET /api/institutions/:id/teachers

List all teachers in an institution with their class, student, and adaptation counts.

**Response:** `200 OK`

```json
[
  {
    "teacher": { "teacher_id": 1, "first_name": "Maria", "last_name": "Hernandez", "email": "maria@westfield.edu", "role": "teacher", "institution_id": 1 },
    "class_count": 3,
    "student_count": 28,
    "adaptation_count": 12
  }
]
```

### GET /api/institutions/:id/classes

List all classes in an institution with teacher name and student count.

**Response:** `200 OK`

```json
[
  { "class_id": 1, "class_name": "CS Fundamentals", "grade_band": "3-5", "teacher_name": "Maria Hernandez", "student_count": 28 }
]
```

### GET /api/institutions/:id/clusters

Get cluster distribution across an institution's students and classes.

**Response:** `200 OK`

```json
[
  { "cluster_name": "ELL Beginners", "student_count": 12, "class_count": 3 }
]
```

### PUT /api/institutions/:id/settings

_System-wide settings management._ **Not yet implemented** — returns `501`.

---

## Health Endpoint

### GET /api/health

Health check endpoint. No authentication required.

**Response:** `200 OK`

```json
{ "status": "ok", "timestamp": "2025-03-14T10:30:00.000Z" }
```

---

## Rate Limits

ADAPT does not implement application-level rate limiting. However, LLM provider endpoints (`POST /api/adapt`, `POST /api/adaptations/:id/refine`, `POST /api/file-edits`) are subject to the rate limits of the configured OpenRouter API key.