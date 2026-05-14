<!-- generated-by: gsd-doc-writer -->

# Architecture

ADAPT is an AI-driven personalized lesson planning tool for K-12 CS educators. The Node.js/Express 5 backend serves a React SPA frontend and exposes a RESTful API. Teachers select a lesson and learner cluster, the system uses RAG to retrieve relevant knowledge base context, calls an LLM (via OpenRouter) to generate an adapted lesson plan, renders it as HTML via EJS templates, and stores it as an immutable version. Teachers can refine, rollback, provide feedback, and export plans.

## Component Diagram

```
Browser (React SPA)
    │
    ├── /api/auth ──── Auth Service (bcryptjs + JWT)
    ├── /api/teachers ──── Dashboard, Profile, Classes, Students
    ├── /api/lessons ──── CRUD, Search, Source Files
    ├── /api/clusters ──── Listing, KB Assignment
    ├── /api/knowledge-bases ──── KB Listing
    ├── /api/institutions ──── Admin Overview (RBAC: admin only)
    ├── /api/adapt ─────────┐
    ├── /api/adaptations/* ──┤ Adaptation Service
    │                        ├── Versioning Service (immutable versions)
    │                        ├── Renderer (EJS → HTML)
    │                        ├── RAG Pipeline
    │                        │   ├── Chunker (Python embed server)
    │                        │   ├── Embedder (sentence-transformers)
    │                        │   ├── ChromaDB Store
    │                        │   └── Retriever (semantic search)
    │                        └── OpenRouter LLM Provider
    ├── /api/file-edits ──── Source Editor Service (DOCX/PPTX/PDF)
    │                        ├── LLM calls via OpenRouter
    │                        └── RAG context (optional)
    └── /api/teachers/:id/llm-config ──── AES-256-GCM encrypted API keys

SQLite DB ──── All persistence (users, lessons, adaptations, versions, etc.)
```

## Data Flow

### Generate an Adapted Lesson

1. **Request** — `POST /api/adapt` with `lesson_id`, `cluster_id`, optional `kb_ids` and `include_student_context`.
2. **Auth** — `requireAuth` middleware validates JWT, attaches `req.user` (teacher_id, role, institution_id).
3. **Provider resolution** — `adaptation._resolve_provider()` checks for an active `LLMProviderConfig` for the teacher; falls back to `OPENROUTER_API_KEY` from config.
4. **Context assembly** — `buildContextBlocks()` composes a user prompt from: lesson metadata, cluster description, student profiles (if requested), and RAG-retrieved KB chunks.
5. **RAG retrieval** — `retriever.retrieveForLesson()` sends the query to a Python embed server which returns ChromaDB-matched chunks per KB.
6. **LLM generation** — OpenRouter API call with system prompt and assembled context. Response is coerced to structured JSON.
7. **Rendering** — `renderer.renderLessonPlan()` fills `templates/lesson_plan.ejs` with the plan JSON, lesson metadata, and cluster info to produce styled HTML.
8. **Versioning** — `versioning.createVersion()` creates a new `lesson_plan_version` row with `is_head=1`, demoting the previous head. The `adapted_lesson` row is updated.
9. **Response** — Returns `adaptationOut` with head version summary and full version list.

### Refine, Rollback, Feedback

- **Refine** (`POST /api/adaptations/:id/refine`) — Loads head version's `plan_json`, includes it with the teacher's instruction, creates a new version linked via `parent_version_id`.
- **Rollback** (`POST /api/adaptations/:id/rollback`) — Flips `is_head` flags: target version becomes head, all others demoted. No data deleted.
- **Feedback** (`POST /api/adaptations/:id/feedback`) — Inserts `adaptation_feedback` row with rating (1-5) and optional comments.

### Source File Editing

1. `POST /api/file-edits` with `lesson_id`, `source_path`, `instruction`, optional `cluster_id`, `kb_ids`.
2. `source-editor.editSourceFile()` extracts text blocks from DOCX (mammoth), PPTX (pptxgenjs), or PDF (pdf-parse).
3. Text blocks are sent to OpenRouter with RAG context for rewriting.
4. Rewritten text is reinserted into the document format, preserving layout where possible.
5. Returns an `edit_id` and download URL.

## Authentication & Authorization

### JWT Auth (Phase 1)

- **Registration**: `POST /api/auth/register` — bcryptjs password hashing, returns access + refresh tokens.
- **Login**: `POST /api/auth/login` — credential validation, returns token pair.
- **Setup password**: `PUT /api/auth/setup-password` — for seeded teachers without passwords.
- **Refresh**: `POST /api/auth/refresh` — exchanges refresh token for new token pair. Old refresh token is invalidated.
- **Logout**: `POST /api/auth/logout` — revokes the refresh token.

### RBAC Middleware

| Middleware | Purpose |
|---|---|
| `requireAuth` | Validates Bearer JWT, sets `req.user` (teacher_id, role, institution_id). Returns 401 on missing/invalid/expired tokens. |
| `requireRole(...roles)` | Checks `req.user.role` against allowed roles. Returns 403 if insufficient permissions. |
| `requireOwnerOrAdmin` | Checks `req.user.teacher_id === req.params.id || req.user.role === 'admin'`. Returns 403 for non-owner non-admin, 401 if missing auth. |

### API Key Encryption

Teacher LLM API keys are encrypted at rest with AES-256-GCM. Encryption keys are stored as three colon-separated segments (IV:authTag:ciphertext). The `crypto` module provides `encrypt()`, `decrypt()`, and `redact()` functions.

## Database

SQLite via `better-sqlite3` provides all persistence. The schema includes:

- **Organizational**: `institution`, `teacher` (with `role` field: 'teacher' | 'admin')
- **Curricular**: `class`, `student_cluster`, `student`, `enrollment`, `lesson`, `knowledge_base`, `cluster_kb`
- **Adaptation lifecycle**: `adapted_lesson`, `lesson_plan_version` (immutable versioning with `is_head` flag), `lesson_kb_used`, `adaptation_feedback`, `rag_context_log`
- **Auth**: `refresh_token`
- **Configuration**: `llm_provider_config` (per-teacher encrypted API keys)

Versioning uses the `is_head` flag pattern — only one version per `adapted_lesson` is marked as head at a time. Rollback flips flags; no data is deleted.

## Frontend Architecture

React SPA built with Vite:

- **Routing**: React Router v6 with `<ProtectedRoute>` and `<AdminRoute>` guards
- **Auth**: `AuthContext` provider stores JWT in localStorage, auto-refreshes tokens via `useApi` hook
- **API**: `useApi()` hook wraps fetch with auth headers, token refresh, and error handling
- **Pages**: 12 pages covering login, dashboard, classes, KB browser, settings, personalize wizard, workspace, print, and admin views
- **Styling**: Plain CSS (no component library), responsive layout with sidebar navigation

## RAG Pipeline

The RAG subsystem uses a Python embedding server alongside the Node.js backend:

1. **Ingestion** (`scripts/ingest_kbs.py`) — Reads KB documents, chunks by section, embeds with `all-MiniLM-L6-v2`, upserts into ChromaDB collections per `kb_id`.
2. **Embedding server** (`server/src/services/rag/embed_server.py`) — Flaskservice that accepts text and returns embeddings via HTTP.
3. **Retrieval** (`server/src/services/rag/retriever.js`) — Embeds the query via the embed server, queries ChromaDB per requested KB with cosine similarity, returns top-k chunks.
4. **Context injection** — Retrieved chunks are injected into the LLM prompt with KB attribution.

## LLM Provider Layer

OpenRouter is the primary (and currently only) LLM provider:

- Configured per-teacher via `PUT /api/teachers/:id/llm-config`
- Only one active provider per teacher at a time
- API keys encrypted at rest with AES-256-GCM
- Fallback: `OPENROUTER_API_KEY` environment variable