# Codebase Structure

**Analysis Date:** 2026-05-11

## Directory Layout

```
ADAPT/
├── backend/                          # Python FastAPI backend package
│   ├── __init__.py                   # Empty (package marker)
│   ├── main.py                       # FastAPI app, router registry, static mount
│   ├── config.py                     # Settings singleton, paths, defaults
│   ├── db.py                         # SQLAlchemy engine, session, Base
│   ├── models.py                     # ORM models (11 tables)
│   ├── schemas.py                    # Pydantic request/response schemas
│   ├── security.py                   # Fernet encrypt/decrypt/redact
│   ├── deps.py                       # FastAPI dependencies (auth)
│   ├── llm/                          # LLM provider abstraction
│   │   ├── __init__.py               # PROVIDERS registry, make_provider factory
│   │   ├── base.py                   # LLMResult dataclass, LLMProvider Protocol
│   │   ├── gemini.py                 # Google Gemini provider
│   │   ├── openrouter.py             # OpenRouter provider
│   │   └── huggingface.py            # HuggingFace Inference provider
│   ├── rag/                           # RAG pipeline
│   │   ├── __init__.py               # Empty
│   │   ├── chunker.py                # Text extraction & section chunking
│   │   ├── embedder.py               # sentence-transformers wrapper
│   │   ├── retriever.py              # Query ChromaDB for relevant chunks
│   │   └── store.py                  # ChromaDB collection upsert/query
│   ├── routers/                       # FastAPI route handlers
│   │   ├── __init__.py               # Empty
│   │   ├── auth.py                   # /api/auth/* (login, me)
│   │   ├── lessons.py                # /api/lessons/* (CRUD, source files)
│   │   ├── adaptations.py            # /api/adapt/*, /api/adaptations/*
│   │   ├── clusters.py              # /api/clusters/* (CRUD, KB assignment)
│   │   ├── knowledge_bases.py       # /api/knowledge-bases/*
│   │   ├── teachers.py              # /api/teachers/* (dashboard, classes, students)
│   │   ├── settings.py              # /api/teachers/{id}/llm-config/*
│   │   ├── admin.py                 # /api/institutions/* (admin overview)
│   │   └── file_edits.py            # /api/lesson-file-edits/*
│   ├── services/                      # Business logic
│   │   ├── __init__.py               # Empty
│   │   ├── adaptation.py             # Orchestrate LLM + RAG → lesson plan
│   │   ├── versioning.py             # Plan version lifecycle
│   │   ├── renderer.py               # Jinja2 HTML rendering
│   │   └── source_editor.py          # AI-powered DOCX/PPTX/PDF editing
│   ├── prompts/                       # LLM prompt templates
│   │   └── system.txt                # System prompt for lesson adaptation
│   └── templates/                     # Jinja2 HTML templates
│       └── lesson_plan.html.j2        # Rendered lesson plan template
├── adapt-frontend-prototype-echristian-aduong/  # Static HTML frontend
│   ├── api.js                         # Shared fetch wrapper with auth header
│   ├── auth.js                        # Login gate, role gating, logout
│   ├── style.css                      # Global CSS variables & layout
│   ├── login.html                     # Login / teacher picker
│   ├── dashboard.html                 # Teacher dashboard
│   ├── my-classes.html                # Class roster management
│   ├── lesson-library.html            # Lesson listing
│   ├── kb-browser.html                # Knowledge base browser
│   ├── personalize.html               # Lesson adaptation form
│   ├── results.html                   # Adaptation results viewer
│   ├── print.html                     # Print-friendly view
│   ├── settings.html                  # LLM config / API key setup
│   ├── admin-dashboard.html           # Admin overview
│   ├── admin-classes.html             # Admin class management
│   └── admin-teachers.html            # Admin teacher management
├── scripts/                           # Operational scripts
│   ├── migrate.py                     # Apply DDL from adapt-database.sql
│   ├── ingest_kbs.py                  # Ingest KB files into ChromaDB
│   └── seed_versions.py               # Create initial version rows from seed data
├── tests/                             # Integration tests
│   ├── __init__.py                    # Empty
│   ├── conftest.py                    # Pytest fixtures, base URL, auth headers
│   ├── test_api.py                    # Full API integration tests
│   └── manual-walkthrough.md          # Manual test guide
├── Knowledge Bases/                   # Source KB documents (PDF, TXT)
├── Sample Lessons/                    # Source lesson files (DOCX, PPTX, PDF)
├── .planning/                         # Project planning docs
│   └── codebase/                      # Architecture & structure docs
├── adapt-database.sql                 # Full schema DDL + seed data
├── start_server.py                    # Uvicorn launcher (Windows background)
├── requirements.txt                   # Python dependencies
├── .env.example                       # Environment variable template
├── keys.env.example                   # API key template (gitignored)
└── .gitignore                         # Ignores .env, keys.env, .secret_key, adapt.db, etc.
```

## Directory Purposes

**`backend/`:**
- Purpose: Complete Python FastAPI backend as a single package
- Contains: API routes, business logic, ORM models, LLM/RAG integrations
- Key files: `backend/main.py` (app entry), `backend/models.py` (all 11 tables), `backend/schemas.py` (all DTOs)

**`backend/routers/`:**
- Purpose: Flat router modules grouped by domain (one file per resource)
- Contains: FastAPI `APIRouter` definitions with http method handlers
- Key files: `backend/routers/adaptations.py` (most complex, 180 lines)

**`backend/services/`:**
- Purpose: Core business logic, separated from HTTP concerns
- Contains: Orchestration functions called by routers
- Key files: `backend/services/adaptation.py` (336 lines, largest service)

**`backend/llm/`:**
- Purpose: Multi-provider LLM abstraction
- Contains: Protocol interface + 3 provider implementations
- Key files: `backend/llm/base.py` (protocol), `backend/llm/__init__.py` (factory)

**`backend/rag/`:**
- Purpose: Knowledge base retrieval pipeline
- Contains: Embedding, storage, chunking, and retrieval
- Key files: `backend/rag/retriever.py` (entry point for context building)

**`adapt-frontend-prototype-echristian-aduong/`:**
- Purpose: Teacher-facing web UI (static HTML/JS/CSS, no build step)
- Contains: Multi-page application with shared `api.js` and `auth.js`
- Key files: `api.js` (HTTP client), `auth.js` (session management)

**`scripts/`:**
- Purpose: Operational/seed scripts for database setup and data ingestion
- Contains: CLI scripts run manually for setup
- Key files: `scripts/migrate.py` (schema setup), `scripts/ingest_kbs.py` (RAG indexing)

**`tests/`:**
- Purpose: Integration tests against a running server
- Contains: pytest test classes covering all API endpoints
- Key files: `tests/conftest.py` (fixtures), `tests/test_api.py` (all tests)

**`Knowledge Bases/`:**
- Purpose: Raw knowledge base source documents (PDFs, TXTs) for RAG ingestion
- Contains: Reference documents used by `scripts/ingest_kbs.py`

**`Sample Lessons/`:**
- Purpose: Original lesson source files (DOCX, PPTX, PDF) for AI editing
- Contains: Files matched by `backend/services/source_editor.py`

## Key File Locations

**Entry Points:**
- `backend/main.py`: FastAPI application (`app` object used by uvicorn)
- `start_server.py`: Server launcher script (`python start_server.py`)
- `backend/config.py`: Centralized settings singleton (`settings`)

**Configuration:**
- `backend/config.py`: All paths, defaults, env vars (`Settings` class)
- `.env.example`: Template for environment variables
- `keys.env.example`: Template for API keys (gitignored)
- `requirements.txt`: Python dependencies (pinned versions)
- `adapt-database.sql`: Full schema + seed data DDL

**Core Logic:**
- `backend/services/adaptation.py`: Lesson generation orchestration
- `backend/services/versioning.py`: Version creation and rollback
- `backend/services/renderer.py`: Jinja2 template rendering
- `backend/services/source_editor.py`: AI-powered source file editing
- `backend/prompts/system.txt`: LLM system prompt for adaptation

**Data Models:**
- `backend/models.py`: All 11 SQLAlchemy ORM models
- `backend/schemas.py`: All Pydantic request/response schemas
- `backend/db.py`: Engine, session factory, `Base`

**Authentication:**
- `backend/deps.py`: `current_teacher()` and `require_admin()` dependencies
- `backend/security.py`: Fernet encryption for API keys
- `adapt-frontend-prototype-echristian-aduong/auth.js`: Client-side login/session

**Testing:**
- `tests/test_api.py`: Integration tests (requires running server)
- `tests/conftest.py`: Pytest fixtures

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `source_editor.py`, `versioning.py`)
- Router files: Match the resource name in `snake_case` (e.g., `knowledge_bases.py` for `/api/knowledge-bases`)
- Frontend HTML: `kebab-case.html` (e.g., `lesson-library.html`, `my-classes.html`)
- Templates: `snake_case.html.j2` (e.g., `lesson_plan.html.j2`)
- Prompts: `snake_case.txt` (e.g., `system.txt`)
- Scripts: `snake_case.py` (e.g., `ingest_kbs.py`, `seed_versions.py`)

**Functions:**
- Public service functions: `snake_case` (e.g., `generate()`, `refine()`, `create_version()`)
- Private helpers: prefixed with underscore (e.g., `_build_context_blocks()`, `_coerce_to_plan_json()`, `_resolve_provider()`)

**Variables:**
- Module-level singletons: `snake_case` (e.g., `settings`, `engine`, `SessionLocal`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `ALLOWED_EXTENSIONS`, `KB_FILE_MAP`, `_SYSTEM_PROMPT`)

**Types (Pydantic schemas):**
- Output schemas: `PascalCaseOut` (e.g., `LessonOut`, `TeacherOut`, `AdaptationOut`)
- Input schemas: `PascalCaseIn` (e.g., `AdaptRequest`, `RefineRequest`, `LLMConfigIn`)
- Shared base: `_Base` (Pydantic `ConfigDict(from_attributes=True)`)

**Tables (ORM):**
- Table names: `snake_case` (e.g., `student_cluster`, `lesson_plan_version`)
- Model classes: `PascalCase` (e.g., `StudentCluster`, `LessonPlanVersion`)

## Where to Add New Code

**New API endpoint (new resource):**
- Router: `backend/routers/<resource_name>.py` — create new `APIRouter`, add to `backend/main.py` imports and `app.include_router()`
- Schema: Add request/response classes in `backend/schemas.py`
- Model: Add table class in `backend/models.py` if needed
- Migration: Add `CREATE TABLE IF NOT EXISTS` to `adapt-database.sql` and run `python -m scripts.migrate`

**New LLM provider:**
- Create `backend/llm/<provider_name>.py` implementing `LLMProvider` Protocol (`generate()`, `ping()`)
- Register in `backend/llm/__init__.py` `PROVIDERS` dict
- Add default model in `backend/config.py:Settings.default_models`

**New frontend page:**
- Create `adapt-frontend-prototype-echristian-aduong/<page-name>.html`
- Include `<link rel="stylesheet" href="style.css">`, `<script src="api.js"></script>`, `<script src="auth.js"></script>`
- Add navigation link in sidebar across existing pages
- Test by serving from `/app/<page-name>.html`

**New business logic for existing resource:**
- Add function in `backend/services/<existing>.py` or create new service file
- Import and call from the appropriate router

**New knowledge base document:**
- Place file in `Knowledge Bases/`
- Add entry to `scripts/ingest_kbs.py:KB_FILE_MAP`
- Run `python -m scripts.ingest_kbs --kb-id <id>`

**New lesson source file:**
- Place file in `Sample Lessons/`
- Files are auto-discovered by `backend/services/source_editor.py:source_files_for_lesson()` via token matching against lesson titles

**New test:**
- Add test class to `tests/test_api.py`
- Use `api()` helper, `h` (teacher auth), or `admin_h` (admin auth) fixtures

## Special Directories

**`Knowledge Bases/`:**
- Purpose: Raw KB source documents for RAG ingestion
- Generated: No (manually curated)
- Committed: Yes (tracked in git)

**`Sample Lessons/`:**
- Purpose: Original lesson files for AI source editing
- Generated: No (manually curated)
- Committed: Yes (tracked in git)

**`chroma_data/`:**
- Purpose: ChromaDB persistent vector store data
- Generated: Yes (by `scripts/ingest_kbs.py`)
- Committed: No (gitignored)

**`uploads/`:**
- Purpose: AI-edited source files and uploaded content
- Generated: Yes (by `backend/services/source_editor.py`)
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: Yes (by GSD commands)
- Committed: Yes (tracked in git)

**`outputs/`:**
- Purpose: Generated output files (not currently used in code)
- Generated: Yes
- Committed: No (gitignored)

---

*Structure analysis: 2026-05-11*