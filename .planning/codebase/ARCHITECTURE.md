<!-- refreshed: 2026-05-11 -->
# Architecture

**Analysis Date:** 2026-05-11

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                   Frontend (Static HTML Prototype)                       │
│            `adapt-frontend-prototype-echristian-aduong/`                 │
│   login.html · dashboard.html · personalize.html · results.html · …    │
│   api.js (fetch wrapper) · auth.js (login/session) · style.css          │
├──────────────────────────────────────────────────────────────────────────┤
│                        REST API Layer                                     │
│                     `backend/routers/`                                   │
│   auth · lessons · adaptations · clusters · knowledge_bases ·           │
│   teachers · settings · admin · file_edits                                │
├──────────┬──────────┬──────────┬─────────────────────────────────────────┤
│ DB Layer  │ Services │  RAG +   │          LLM Providers                │
│ models.py │ Ser-     │  Embed   │  gemini · openrouter · huggingface   │
│ db.py     │ vices    │  Ding    │  (Protocol-based, per-teacher config)  │
│ schemas.py│          │  + Store │                                       │
├──────────┴──────────┴──────────┴─────────────────────────────────────────┤
│                 Data Stores                                              │
│   SQLite (adapt.db) · ChromaDB (chroma_data/) · Jinja2 Templates      │
│   File System (Knowledge Bases/ · uploads/)                             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| FastAPI App | Request routing, CORS, static mount, health check | `backend/main.py` |
| Models | SQLAlchemy ORM definitions for all tables | `backend/models.py` |
| Schemas | Pydantic request/response validation models | `backend/schemas.py` |
| DB Engine | SQLite connection, session factory, `session_scope` context | `backend/db.py` |
| Auth Dependencies | `current_teacher` (fakeauth via header), `require_admin` | `backend/deps.py` |
| Security | Fernet encrypt/decrypt API keys, redaction | `backend/security.py` |
| Config | Central settings (paths, defaults, env vars) | `backend/config.py` |
| Adaptation Service | Orchestrate lesson generation: LLM → template → version | `backend/services/adaptation.py` |
| Versioning Service | Create, list, head, rollback plan versions | `backend/services/versioning.py` |
| Renderer | Jinja2 HTML template rendering for lesson plans | `backend/services/renderer.py` |
| Source Editor | Edit source DOCX/PPTX/PDF files via LLM | `backend/services/source_editor.py` |
| RAG Retriever | Query ChromaDB for relevant KB chunks | `backend/rag/retriever.py` |
| RAG Store | ChromaDB collection management, upsert, query | `backend/rag/store.py` |
| RAG Chunker | Text extraction and section-based chunking | `backend/rag/chunker.py` |
| RAG Embedder | sentence-transformers embedding wrapper | `backend/rag/embedder.py` |
| LLM Provider Protocol | Abstract interface for LLM calls | `backend/llm/base.py` |
| Gemini Provider | Google Gemini API integration | `backend/llm/gemini.py` |
| OpenRouter Provider | OpenRouter API integration | `backend/llm/openrouter.py` |
| HuggingFace Provider | HuggingFace Inference API integration | `backend/llm/huggingface.py` |
| Auth Router | Login, teacher listing, current user | `backend/routers/auth.py` |
| Lessons Router | CRUD for lessons, source file discovery | `backend/routers/lessons.py` |
| Adaptations Router | Generate, refine, rollback, export, feedback | `backend/routers/adaptations.py` |
| Clusters Router | List clusters, get/update cluster-KB assignments | `backend/routers/clusters.py` |
| KB Router | List knowledge bases | `backend/routers/knowledge_bases.py` |
| Teachers Router | Dashboard, classes, student updates | `backend/routers/teachers.py` |
| Settings Router | LLM config CRUD + connection test | `backend/routers/settings.py` |
| Admin Router | Institution overview, teacher/class/cluster stats | `backend/routers/admin.py` |
| File Edits Router | Download AI-edited source files | `backend/routers/file_edits.py` |
| System Prompt | LLM system prompt for lesson adaptation | `backend/prompts/system.txt` |
| Lesson Template | Jinja2 HTML template for rendered plans | `backend/templates/lesson_plan.html.j2` |
| DB Migrate Script | Apply DDL from `adapt-database.sql` | `scripts/migrate.py` |
| KB Ingest Script | Load KB files → ChromaDB | `scripts/ingest_kbs.py` |
| Seed Versions Script | Create initial version rows from seed data | `scripts/seed_versions.py` |
| Server Starter | Background uvicorn launcher (Windows) | `start_server.py` |
| Frontend API Wrapper | Shared fetch with X-Teacher-Id header | `adapt-frontend-prototype-echristian-aduong/api.js` |
| Frontend Auth | Login session, role gating, logout | `adapt-frontend-prototype-echristian-aduong/auth.js` |

## Pattern Overview

**Overall:** Layered monolith (FastAPI backend + static HTML frontend)

**Key Characteristics:**
- Fake authentication via `X-Teacher-Id` header (MVP, no real password auth)
- Multi-provider LLM abstraction via Protocol class
- Per-teacher LLM configurations with encrypted API keys
- RAG pipeline:.chunk → embed → store in ChromaDB → retrieve by cosine similarity
- Versioned lesson plans with head-pointer pattern (linked list of versions, `is_head` flag)
- Server-side HTML rendering via Jinja2 templates (not SPA)
- SQLite as the sole relational database (no migration framework)

## Layers

### Router Layer:
- Purpose: HTTP request handling, auth checks, response serialization
- Location: `backend/routers/`
- Contains: FastAPI router definitions with Pydantic schema validation
- Depends on: `models`, `schemas`, `deps`, `services`, `db`
- Used by: Frontend via HTTP

### Service Layer:
- Purpose: Business logic orchestration (adaptation generation, versioning, rendering, source editing)
- Location: `backend/services/`
- Contains: `adaptation.py`, `versioning.py`, `renderer.py`, `source_editor.py`
- Depends on: `models`, `llm`, `rag`, `db`, `security`
- Used by: Router layer

### RAG Layer:
- Purpose: Knowledge base text retrieval via embedding similarity
- Location: `backend/rag/`
- Contains: `retriever.py`, `store.py`, `chunker.py`, `embedder.py`
- Depends on: ChromaDB, sentence-transformers, `config`
- Used by: `services/adaptation.py`, `services/source_editor.py`

### LLM Layer:
- Purpose: Abstract LLM provider calls with provider-specific implementations
- Location: `backend/llm/`
- Contains: `base.py` (Protocol), `gemini.py`, `openrouter.py`, `huggingface.py`
- Depends on: `config`, `google-generativeai`, `requests`
- Used by: `services/adaptation.py`, `services/source_editor.py`, `routers/settings.py`

### Data Layer:
- Purpose: ORM models, database sessions, schema validation
- Location: `backend/models.py`, `backend/db.py`, `backend/schemas.py`
- Contains: SQLAlchemy models, engine/session, Pydantic request/response types
- Depends on: SQLAlchemy, Pydantic
- Used by: Routers, Services

### Frontend Layer:
- Purpose: Teacher-facing UI (static HTML pages)
- Location: `adapt-frontend-prototype-echristian-aduong/`
- Contains: Multi-page HTML app, shared `api.js` and `auth.js`
- Depends on: Backend REST API
- Used by: Teachers via browser

## Data Flow

### Primary Request Path — Lesson Adaptation

1. Teacher selects lesson + cluster + KBs on personalize.html, clicks "Generate"
2. `POST /api/adapt` → `backend/routers/adaptations.py:adapt()` (`adaptations.py:46`)
3. `adaptation.generate()` resolves LLM provider from teacher config (`backend/services/adaptation.py:168`)
4. `_build_context_blocks()` assembles lesson info + cluster + students + RAG chunks (`backend/services/adaptation.py:40`)
5. `retriever.retrieve_for_lesson()` embeds query and searches ChromaDB (`backend/rag/retriever.py:17`)
6. LLM provider `.generate()` sends system+user prompt, receives JSON plan (`backend/llm/gemini.py:22` or `openrouter.py:26` or `huggingface.py:21`)
7. `_coerce_to_plan_json()` parses/fallbacks LLM response (`backend/services/adaptation.py:116`)
8. `renderer.render_lesson_plan()` renders Jinja2 template to HTML (`backend/services/renderer.py:22`)
9. `versioning.create_version()` stores version row with `is_head=1` (`backend/services/versioning.py:37`)
10. Returns `AdaptationOut` with head version + all versions

### Refinement Flow

1. `POST /api/adaptations/{id}/refine` → `backend/routers/adaptations.py:refine()` (`adaptations.py:65`)
2. `adaptation.refine()` loads head version, injects previous plan + instruction (`backend/services/adaptation.py:261`)
3. New version created with `parent_version_id` pointing to previous head (`backend/services/versioning.py:37`)

### Source File Edit Flow

1. `POST /api/lessons/{id}/edit-source-file` → `backend/routers/lessons.py:edit_source_file()` (`lessons.py:33`)
2. `source_editor.edit_source_file()` extracts text from DOCX/PPTX/PDF (`backend/services/source_editor.py:289`)
3. Sends text blocks through LLM in batches (`backend/services/source_editor.py:219`)
4. Rewrites in place (DOCX/PPTX preserving runs) or generates new PDF via ReportLab (`backend/services/source_editor.py:275`)
5. Returns download URL for the edited file

## Key Abstractions

**LLMProvider Protocol:**
- Purpose: Define common interface for all LLM backends
- Examples: `backend/llm/base.py`
- Pattern: Python Protocol (structural typing) with `generate()` and `ping()` methods
- Factory: `make_provider(name, api_key, model)` in `backend/llm/__init__.py`

**Session-scoped DB access:**
- Purpose: Provide SQLAlchemy sessions via FastAPI dependency injection
- Examples: `backend/db.py:get_db()` (generator), `backend/db.py:session_scope()` (context manager)
- Pattern: Generator yields session with auto-close; context manager auto-commits/rollbacks

**Versioned Lesson Plans:**
- Purpose: Track iterative LLM-generated content with rollback capability
- Examples: `backend/models.py:LessonPlanVersion`, `backend/services/versioning.py`
- Pattern: Linked list of versions per `AdaptedLesson`. A single `is_head=1` row marks the current version. Refinement creates a new version with `parent_version_id`. Rollback just shifts the `is_head` flag.

**Fernet-encrypted API keys:**
- Purpose: Store third-party LLM API keys securely at rest
- Examples: `backend/security.py`
- Pattern: AES encryption via `cryptography.fernet.Fernet`. Key generated on first run and stored in `.secret_key`. Runtime encrypt/decrypt functions for `LLMProviderConfig.api_key_encrypted`.

**RAG Pipeline:**
- Purpose: Provide contextually relevant KB excerpts to the LLM prompt
- Examples: `backend/rag/retriever.py`, `backend/rag/store.py`, `backend/rag/chunker.py`, `backend/rag/embedder.py`
- Pattern: Text is extracted from source files, split into sections, embedded with `all-MiniLM-L6-v2`, and stored in per-KB ChromaDB collections. At query time, the lesson title/topic/description is embedded and compared via cosine similarity to retrieve top-k chunks.

## Entry Points

**Web Server (`start_server.py`):**
- Location: `start_server.py`
- Triggers: Manual execution (`python start_server.py`)
- Responsibilities: Launches uvicorn in background, writes PID file, health-check polling

**Application (`backend/main.py`):**
- Location: `backend/main.py`
- Triggers: Uvicorn loads `backend.main:app`
- Responsibilities: Creates FastAPI app, registers CORS middleware, mounts routers, mounts static frontend files, exposes `/api/health` and `/`

**DB Migration (`scripts/migrate.py`):**
- Location: `scripts/migrate.py`
- Triggers: Manual execution (`python -m scripts.migrate`)
- Responsibilities: Parses `adapt-database.sql` DDL, applies to `adapt.db`

**KB Ingestion (`scripts/ingest_kbs.py`):**
- Location: `scripts/ingest_kbs.py`
- Triggers: Manual execution (`python -m scripts.ingest_kbs`)
- Responsibilities: Reads KB source files from `Knowledge Bases/`, chunks, embeds, and upserts into ChromaDB

**Integration Tests (`tests/test_api.py`):**
- Location: `tests/test_api.py`
- Triggers: pytest (requires running server)
- Responsibilities: End-to-end integration tests against live API

## Architectural Constraints

- **Threading:** Single-process uvicorn with `check_same_thread=False` for SQLite. No async endpoints (all sync). Sentence-transformers embedder loads model lazily via `lru_cache`.
- **Global state:** `backend/config.py:settings` (module singleton), `backend/db.py:engine` and `SessionLocal` (module singletons), `backend/rag/store.py:get_client()` (`lru_cache`), `backend/rag/embedder.py:get_model()` (`lru_cache`), `backend/security.py:_fernet` (module-level singleton)
- **Circular imports:** None detected. Architecture is strictly layered: routers → services → (llm, rag) → (config, models, db).
- **Fake authentication:** MVP auth uses `X-Teacher-Id` header with no password verification. Anyone who knows a teacher_id can impersonate that teacher.
- **SQLite constraints:** SQLite file lock limits concurrent writes. The `check_same_thread=False` flag allows cross-thread reads but write serialization may bottleneck under load.
- **Frontend as static files:** The frontend is pure HTML+JS served from disk, not a build step or SPA framework. It communicates with the API via `fetch()` in `api.js`.

## Anti-Patterns

### Direct ORM Access in Routers for Complex Queries

**What happens:** Some routers contain multi-join SQLAlchemy queries directly in the endpoint function (`backend/routers/teachers.py:dashboard()` has 30+ lines of complex joins and aggregates, `backend/routers/clusters.py:list_clusters()` builds subqueries inline).
**Why it's wrong:** Mixed concerns — routers should delegate to services. Complex queries are harder to test and reuse.
**Do this instead:** Extract query logic into the service layer or a repository pattern, keeping routers as thin handlers. Reference: `backend/routers/adaptations.py` which correctly delegates to `services/adaptation`.

### Router-Inlined Source Resolver

**What happens:** `backend/routers/settings.py` contains LLM provider resolution logic (`_ensure_self`, provider validation, deactivation) that duplicates what `backend/services/adaptation.py:_resolve_provider()` does differently.
**Why it's wrong:** Two distinct patterns for the same concept (resolving a teacher's LLM config).
**Do this instead:** Centralize provider resolution in the service layer and have both the settings router and adaptation service call the same function.

### No Database Migrations Framework

**What happens:** Schema changes are applied via raw SQL parsing in `scripts/migrate.py`, which splits `adapt-database.sql` by semicolons.
**Why it's wrong:** No version tracking, no rollback capability. Adding columns requires manually editing the SQL file and hoping `IF NOT EXISTS` covers it.
**Do this instead:** Use Alembic (standard for FastAPI/SQLAlchemy projects) with auto-generated migrations.

## Error Handling

**Strategy:** HTTP exceptions with status codes in routers; `LookupError`/`RuntimeError` in services that routers translate.

**Patterns:**
- `HTTPException(status_code, detail)` for 4xx responses in routers
- `LookupError("...not found")` for missing entities in services → routers catch and return 404
- `RuntimeError("No LLM configured...")` for missing configuration → routers catch and return 400
- LLM JSON parse failures fall back to a stub response structure in `_coerce_to_plan_json()` (`backend/services/adaptation.py:116`)
- Source file edit parse failures in `_parse_items()` raise `RuntimeError` → router returns 400

## Cross-Cutting Concerns

**Logging:** No structured logging framework. Only implicit logging via uvicorn access logs. No application-level log statements.
**Validation:** Pydantic schemas for request/response validation with `from_attributes=True` for ORM conversion. Field constraints via `Field(min_length=, ge=, le=)`.
**Authentication:** MVP fakeauth via `X-Teacher-Id` header. `backend/deps.py:current_teacher()` resolves the header to a `models.Teacher` row. `require_admin()` checks `teacher.role == "admin"`. Frontend stores `currentTeacherId` in `localStorage`.

---

*Architecture analysis: 2026-05-11*