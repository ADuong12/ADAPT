<!-- generated-by: gsd-doc-writer -->

# Architecture

ADAPT is an AI-driven personalized lesson planning tool for K-12 CS educators. The Node.js/Express 5 backend serves a React SPA frontend and exposes a RESTful API. Teachers select a lesson and learner cluster, the system uses RAG to retrieve relevant knowledge base context, calls an LLM to generate an adapted lesson plan in three structured phases, renders it as HTML via EJS templates, and stores it as an immutable version. Teachers can refine, rollback, provide feedback, and export plans.

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
    │                        ├── Plan Exporter (DOCX/PDF)
    │                        ├── RAG Pipeline
    │                        │   ├── Chunker (section-based)
    │                        │   ├── Embedder (HTTP client → embed server)
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
2. **Auth** — `requireAuth` middleware validates JWT, attaches `req.user` (teacher_id, role, institution_id). Returns 401 on missing/invalid/expired tokens.
3. **Provider resolution** — `resolveProvider()` loads the teacher's active `LLMProviderConfig` from `llm_provider_config`. If none exists, it throws a 400 error (`No LLM configured. Add an API key in Settings.`). There is no fallback to a global API key.
4. **Context assembly** — `buildContextBlocks()` composes a prompt from: lesson metadata, cluster description, student profiles (if requested), and RAG-retrieved KB chunks.
5. **RAG retrieval** — `retriever.retrieveForLesson()` sends the query to the Python embed server, which returns ChromaDB-matched chunks per KB. If the embed server is unavailable, retrieval returns an empty array so generation can still proceed.
6. **LLM generation (3-phase)** — The adaptation service makes three sequential OpenRouter calls:
   - **Recommendations** — generates 3-6 personalized recommendations grounded in KB context.
   - **Plan steps** — generates 3-5 concrete lesson plan steps based on the recommendations.
   - **Companion materials** — generates 0-6 companion materials based on the plan.
   Each phase returns coerced JSON arrays.
7. **Rendering** — `renderer.renderLessonPlan()` fills `templates/lesson_plan.ejs` with the plan JSON, lesson metadata, and cluster info to produce styled HTML.
8. **Versioning** — `versioning.createVersion()` creates a new `lesson_plan_version` row with `is_head=1`, demoting the previous head. The `adapted_lesson` summary fields are updated.
9. **RAG logging** — Retrieved chunk metadata and token counts are logged to `rag_context_log`.
10. **Response** — Returns `adaptationOut` with head version summary and full version list.

### Refine, Rollback, Feedback

- **Refine** (`POST /api/adaptations/:id/refine`) — Loads the head version's `plan_json`, includes it with the teacher's instruction, and reruns the 3-phase generation pipeline to create a new version linked via `parent_version_id`.
- **Rollback** (`POST /api/adaptations/:id/rollback`) — Flips `is_head` flags: the target version becomes head, all others demoted. No data is deleted.
- **Feedback** (`POST /api/adaptations/:id/feedback`) — Inserts an `adaptation_feedback` row with rating (1-5) and optional comments.

### Export

- **Print** (`GET /api/adaptations/:id/versions/:version_id/print`) — Returns the rendered HTML for browser printing.
- **HTML download** (`GET /api/adaptations/:id/versions/:version_id/export.html`) — Returns the rendered HTML as a downloadable file attachment.
- **DOCX export** (`GET /api/adaptations/:id/versions/:version_id/export-docx`) — Generates a formatted Word document via `docx` library, including recommendations, plan steps, companion materials, KB references, and original source media (hyperlinks and images from DOCX source files).
- **PDF export** (`GET /api/adaptations/:id/versions/:version_id/export-pdf`) — Generates a formatted PDF via `pdf-lib` with the same structured content.

### Source File Editing

1. `POST /api/file-edits` with `lesson_id`, `source_path`, `instruction`, optional `cluster_id`, `kb_ids`.
2. `source-editor.editSourceFile()` extracts text blocks from DOCX (`mammoth`), PPTX (`officeparser`), or PDF (`pdf-parse`).
3. Text blocks are batched (max ~7000 chars per batch) and sent to OpenRouter with optional RAG context for rewriting.
4. Rewritten text is reinserted into the document format: DOCX is rebuilt with `docx` (preserving images and hyperlinks), PPTX with `pptxgenjs`, PDF with `pdf-lib`.
5. Returns a download URL for the edited file at `/api/lesson-file-edits/:filename`.

## Authentication & Authorization

### JWT Auth

- **Registration**: `POST /api/auth/register` — bcryptjs password hashing, returns access + refresh tokens.
- **Login**: `POST /api/auth/login` — credential validation, returns token pair.
- **Setup password**: `PUT /api/auth/setup-password` — for seeded teachers without passwords.
- **Refresh**: `POST /api/auth/refresh` — exchanges refresh token for a new token pair. Old refresh token is invalidated.
- **Logout**: `POST /api/auth/logout` — revokes the refresh token.

### RBAC Middleware

| Middleware | Purpose |
|---|---|
| `requireAuth` | Validates Bearer JWT, sets `req.user` (teacher_id, role, institution_id). Returns 401 on missing/invalid/expired tokens. |
| `requireRole(...roles)` | Checks `req.user.role` against allowed roles. Returns 403 if insufficient permissions. |
| `requireOwnerOrAdmin` | Checks `req.user.teacher_id === req.params.id \|\| req.user.role === 'admin'`. Returns 403 for non-owner non-admin, 401 if missing auth. |

### API Key Encryption

Teacher LLM API keys are encrypted at rest with AES-256-GCM. Encryption keys are stored as three colon-separated segments (`IV:authTag:ciphertext`). The `crypto` module provides `encrypt()`, `decrypt()`, and `redact()` functions.

## Database

SQLite via `better-sqlite3` provides all persistence. The schema includes:

- **Organizational**: `institution`, `teacher` (with `role` field: 'teacher' | 'admin')
- **Curricular**: `class`, `student_cluster`, `student`, `enrollment`, `lesson`, `knowledge_base`, `cluster_kb`
- **Files**: `file_storage`, `lesson_file`
- **Adaptation lifecycle**: `adapted_lesson`, `lesson_plan_version` (immutable versioning with `is_head` flag), `lesson_kb_used`, `adaptation_feedback`, `rag_context_log`
- **Auth**: `refresh_token`
- **Configuration**: `llm_provider_config` (per-teacher encrypted API keys)

Schema initialization is idempotent: `db/init.js` runs on startup, creating the `refresh_token` table and `password_hash` column if they do not yet exist. Versioning uses the `is_head` flag pattern — only one version per `adapted_lesson` is marked as head at a time. Rollback flips flags; no data is deleted.

## Frontend Architecture

React SPA built with Vite:

- **Routing**: React Router v7 with `<ProtectedRoute>` and `<AdminRoute>` guards
- **Auth**: `AuthContext` provider stores JWT in localStorage, auto-refreshes tokens via `useApi` hook
- **API**: `useApi()` hook wraps fetch with auth headers, token refresh, and error handling
- **Pages**: 13 pages covering login, setup-password, dashboard, classes, lesson library, KB browser, settings, personalize wizard, workspace, print, and admin views (dashboard, teachers, classes)
- **Styling**: Plain CSS (no component library), responsive layout with sidebar navigation

## RAG Pipeline

The RAG subsystem uses a Python embedding server alongside the Node.js backend:

1. **Ingestion** (`scripts/ingest_kbs.js`) — Reads KB documents, chunks by section with `chunkBySection()`, embeds via the embed server using `all-MiniLM-L6-v2`, and upserts into ChromaDB collections per `kb_id`.
2. **Embedding server** (`embed-server/`) — Python Flask service built from `embed-server/Dockerfile`, exposed on port 9876. Accepts text arrays and returns embeddings via HTTP.
3. **Embed client** (`server/src/services/rag/embedder.js`) — HTTP client that POSTs to `EMBED_SERVER_URL` (default `http://127.0.0.1:9876/embed`) with a 30s timeout.
4. **Store** (`server/src/services/rag/store.js`) — ChromaDB v3.x client using cosine similarity (`hnsw:space: cosine`). Uses a dummy embedding function since embeddings are passed manually.
5. **Retrieval** (`server/src/services/rag/retriever.js`) — Embeds the query via the embed client, queries ChromaDB per requested KB, and returns top-k chunks with distance scores. Returns an empty array if the embed server is unavailable, allowing the adaptation pipeline to degrade gracefully.
6. **Context injection** — Retrieved chunks are injected into the LLM prompt with KB attribution.

## LLM Provider Layer

The `llm_provider_config` table schema allows `openrouter`, `openai`, and `anthropic` as providers. Only **OpenRouter** is currently implemented (`server/src/services/llm/openrouter.js`):

- Configured per-teacher via `PUT /api/teachers/:id/llm-config`
- Only one active provider per teacher at a time (others are deactivated automatically)
- API keys encrypted at rest with AES-256-GCM
- No global fallback key — if a teacher has no active config, all LLM-dependent endpoints return a 400 error
- Test endpoint (`POST /api/teachers/:id/llm-config/test`) is a 501 stub awaiting multi-provider adapter implementation

## Key Abstractions

| Abstraction | File | Description |
|---|---|---|
| `OpenRouterProvider` | `server/src/services/llm/openrouter.js` | LLM provider class that calls OpenRouter chat completions and coerces fenced JSON responses. |
| `AppError` / `NotFoundError` / `AuthError` / `ValidationError` | `server/src/errors/index.js` | Custom error hierarchy used by middleware and routes to produce consistent HTTP error responses. |
| `requireAuth` | `server/src/middleware/auth.js` | Express middleware that validates Bearer JWTs and attaches `req.user`. |
| `requireRole` / `requireOwnerOrAdmin` | `server/src/middleware/rbac.js` | Express middleware enforcing role-based and ownership-based access control. |
| `adaptation.generate` / `adaptation.refine` | `server/src/services/adaptation.js` | Core adaptation orchestrator that assembles context, runs 3-phase LLM generation, renders HTML, and versions the result. |
| `versioning.createVersion` / `versioning.rollbackTo` | `server/src/services/versioning.js` | Immutable version management using the `is_head` flag pattern. |
| `source-editor.editSourceFile` | `server/src/services/source-editor.js` | Extracts text from DOCX/PPTX/PDF, rewrites via LLM, and rebuilds the document preserving images and hyperlinks where possible. |
| `plan-exporter.exportDocx` / `exportPdf` | `server/src/services/plan-exporter.js` | Generates structured DOCX and PDF exports from versioned plan JSON. |
| `retriever.retrieveForLesson` | `server/src/services/rag/retriever.js` | Resilient RAG retriever that returns empty results if the embed server is unavailable. |
| `AuthContext` / `useApi` | `client/src/auth/AuthContext.jsx` / `client/src/api/useApi.js` | Frontend auth provider and API hook that manage JWT storage, automatic refresh, and authenticated fetch. |

## Directory Structure Rationale

The project is organized as a classic full-stack web application with separate client and server directories:

```
ADAPT/
├── client/               React SPA (Vite build)
│   ├── src/
│   │   ├── api/          useApi hook and API wrappers
│   │   ├── auth/         AuthContext, ProtectedRoute, AdminRoute
│   │   ├── layouts/      AppLayout with sidebar navigation
│   │   └── pages/        13 page components
│   └── Dockerfile        Nginx static server
├── server/               Express 5 API
│   ├── src/
│   │   ├── config/       Environment and runtime configuration
│   │   ├── db/           better-sqlite3 connection, schema init, seeding
│   │   ├── errors/       Custom error classes
│   │   ├── middleware/   Auth, RBAC, and error handler middleware
│   │   ├── prompts/      System prompt templates for LLM calls
│   │   ├── routes/       Express route modules (one per domain)
│   │   ├── services/     Business logic: adaptation, auth, crypto, versioning, renderer, plan-exporter, source-editor, RAG pipeline
│   │   └── templates/    EJS templates for HTML rendering
│   └── Dockerfile        Node.js production server
├── embed-server/         Python Flask embedding service (optional RAG)
├── scripts/              Data ingestion and seeding utilities
├── nginx/                Nginx configuration for Docker
├── Sample Lessons/       Source lesson files for editing
├── uploads/              Edited file output directory
└── docs/                 Project documentation
```

The server follows a **layered architecture**: routes handle HTTP, middleware handles cross-cutting concerns (auth, RBAC, errors), and services contain all business logic. The RAG pipeline is further decomposed into chunker, embedder, store, and retriever so each piece can be tested and swapped independently. The frontend is organized by feature (pages, auth, layouts) rather than by technical role, keeping related UI code colocated.

## Docker Deployment

ADAPT ships with Docker Compose for production deployment.

```
┌──────────────────────────────────────────────────────┐
│  Host :80                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │  nginx                                          │  │
│  │  /          → React SPA (static files)         │  │
│  │  /api/*    → proxy to server:3000              │  │
│  │  /uploads/* → proxy to server:3000             │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────┐                              │
│  │  server :3000      │  Express API + SQLite        │
│  │                    │  Health check on /api/health │
│  └────────────────────┘                              │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐      │
│  │  embed-server :9876│  │  chromadb :8000     │      │
│  │  (optional: rag)   │  │  (optional: rag)    │      │
│  └────────────────────┘  └────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

Key design decisions:

- **Single port**: Nginx reverse-proxies the API, so only port 80 is exposed to the host (configurable via `ADAPT_PORT`)
- **Data volume**: SQLite database, uploads, and `.secret_key` persist in a Docker named volume at `/app/data`
- **Health checks**: The server container exposes a healthcheck that fetches `/api/health`
- **RAG as opt-in**: The `embed-server` and `chromadb` containers run only with `--profile rag`
