<!-- generated-by: gsd-doc-writer -->

# Development Guide

## Local Setup

1. Clone the repository and enter the project directory:
   ```bash
   git clone https://github.com/<org>/ADAPT.git
   cd ADAPT
   ```

2. Create and activate a Python virtual environment (Python 3.10+ required):
   ```bash
   python -m venv .venv
   .venv\Scripts\activate      # Windows
   source .venv/bin/activate   # macOS/Linux
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Copy the environment template and configure (at minimum, set `ADAPT_GEMINI_API_KEY` for LLM access):
   ```bash
   cp .env.example .env
   ```

5. Initialize the database schema:
   ```bash
   python scripts/migrate.py
   ```

6. (Optional) Seed sample lesson-plan versions:
   ```bash
   python scripts/seed_versions.py
   ```

7. Start the development server:
   ```bash
   python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

   Alternatively, use the background runner:
   ```bash
   python start_server.py          # start
   python start_server.py --status # check health
   python start_server.py --stop   # stop
   ```

8. Open the frontend at `http://localhost:8000/app/login.html` or the API docs at `http://localhost:8000/docs`.

## Build Commands

| Command | Description |
|---------|-------------|
| `python -m uvicorn backend.main:app --reload` | Start dev server with hot reload on port 8000 |
| `python start_server.py` | Start server in background (uses uvicorn) |
| `python start_server.py --stop` | Stop background server |
| `python start_server.py --status` | Check if background server is running |
| `python scripts/migrate.py` | Apply DDL from `adapt-database.sql` to `adapt.db` (idempotent) |
| `python scripts/seed_versions.py` | Create sample `lesson_plan_version` rows from seeded data |
| `python scripts/ingest_kbs.py` | Ingest knowledge-base PDFs/TXTs into ChromaDB |
| `python scripts/ingest_kbs.py --kb-id 4` | Ingest only a single knowledge base |
| `python -m pytest tests/` | Run integration test suite (requires live server) |

## Code Style

The project follows a consistent Python code style enforced by convention:

- **`from __future__ import annotations`** is placed at the top of every Python file to enable modern type annotation syntax.
- **Type hints** are used throughout function signatures and variable declarations.
- **No comments** unless absolutely necessary — the code is intended to be self-documenting through clear naming and type annotations.
- **No formal linter or formatter config** is present in the repository (no `.eslintrc`, `.prettierrc`, or `biome.json`). The backend is pure Python with no frontend build step or JS linting.
- **Pydantic v2** schemas use `model_config = ConfigDict(from_attributes=True)` for ORM mode.
- **SQLAlchemy 2.0** Mapped types (`Mapped[str]`, `Mapped[int]`) are used throughout `models.py`.

When working on the frontend (`adapt-frontend-prototype-echristian-aduong/`), note it is a static HTML/CSS/JS prototype with no build step, bundler, or formatter.

## Branch Conventions

No branch naming convention is documented in the repository. See CONTRIBUTING.md if it becomes available.

## PR Process

No PR template or formal contributing guidelines are present in the repository yet. General guidance:

- Open a pull request against the default branch with a clear description of changes.
- Ensure the server starts cleanly and integration tests pass before requesting review.
- Keep PRs focused on a single concern (feature, bug fix, or refactor).

## Architecture Walkthrough

Understanding the project layout helps when adding features or debugging:

```
ADAPT/
├── backend/                  # FastAPI application
│   ├── main.py               # App factory, router registration, static file mount
│   ├── config.py             # Settings class (env vars, paths, default models)
│   ├── db.py                 # SQLAlchemy engine, SessionLocal, session_scope()
│   ├── models.py             # ORM models (Teacher, Lesson, AdaptedLesson, etc.)
│   ├── schemas.py             # Pydantic v2 request/response schemas
│   ├── deps.py               # FastAPI dependencies (current_teacher, require_admin)
│   ├── security.py           # Fernet encrypt/decrypt for stored API keys
│   ├── routers/              # API endpoint modules
│   │   ├── auth.py           # /api/auth/* — fake-login, teacher list, /me
│   │   ├── lessons.py        # /api/lessons/* — CRUD + source-file listing
│   │   ├── adaptations.py    # /api/adapt*, /api/adaptations/* — core workflow
│   │   ├── clusters.py       # /api/clusters/* — student clusters + KB linking
│   │   ├── knowledge_bases.py# /api/knowledge-bases/* — KB listing
│   │   ├── teachers.py       # /api/teachers/* — dashboard, classes, students
│   │   ├── settings.py       # /api/teachers/:id/llm-config — LLM key storage
│   │   ├── file_edits.py     # /api/lesson-file-edits/* — source file editing
│   │   └── admin.py          # /api/institutions/* — admin overview endpoints
│   ├── services/             # Business logic layer
│   │   ├── adaptation.py     # LLM orchestration: generate + refine adapted lessons
│   │   ├── versioning.py     # Version create, list, head, rollback
│   │   ├── renderer.py       # Jinja2 HTML rendering of lesson plans
│   │   └── source_editor.py  # Edit .docx/.pptx source files via LLM
│   ├── llm/                  # LLM provider abstraction
│   │   ├── base.py           # LLMProvider Protocol (name, generate, ping)
│   │   ├── gemini.py         # Google Gemini provider
│   │   ├── openrouter.py     # OpenRouter provider
│   │   ├── huggingface.py   # HuggingFace provider
│   │   └── __init__.py       # PROVIDERS registry + make_provider() factory
│   ├── rag/                  # Retrieval-Augmented Generation
│   │   ├── chunker.py        # PDF/TXT text extraction + section chunking
│   │   ├── embedder.py       # Sentence-transformers embedding
│   │   ├── store.py          # ChromaDB upsert/query
│   │   └── retriever.py      # Top-k retrieval for a lesson query
│   ├── prompts/
│   │   └── system.txt        # System prompt for lesson adaptation
│   └── templates/
│       └── lesson_plan.html.j2  # Jinja2 template for rendered HTML output
├── adapt-frontend-prototype-echristian-aduong/  # Static frontend
│   ├── api.js                # ADAPT_API helper (fetch wrapper)
│   ├── auth.js               # localStorage-based fakeauth
│   ├── dashboard.html        # Teacher dashboard
│   ├── settings.html         # LLM key configuration
│   ├── personalize.html      # Lesson adaptation form
│   ├── results.html          # Adaptation results + version history
│   └── ...                   # Other pages (login, my-classes, etc.)
├── scripts/                  # Utility scripts
│   ├── migrate.py            # Apply DDL from adapt-database.sql
│   ├── ingest_kbs.py         # Chunk + embed KB documents into ChromaDB
│   └── seed_versions.py      # Create sample lesson_plan_version rows
├── tests/
│   ├── conftest.py           # Shared fixtures (base_url, auth headers)
│   └── test_api.py           # Integration tests (requires live server)
├── adapt-database.sql        # Full DDL + seed data
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
└── start_server.py           # Background server launcher
```

### Adding a New API Endpoint

1. **Model** — Add a new SQLAlchemy model class in `backend/models.py` if a new table is needed.
2. **Schema** — Add Pydantic request/response schemas in `backend/schemas.py`.
3. **Router** — Create a route function in the appropriate `backend/routers/` file using `APIRouter(prefix="/api/...", tags=[...])`.
4. **Register** — Import and include the router in `backend/main.py` via `app.include_router(...)`. (Skip this step if the route was added to an existing router file.)
5. **Migration** — Add the corresponding `CREATE TABLE IF NOT EXISTS` statement to `adapt-database.sql` and run `python scripts/migrate.py`.

### Adding a New LLM Provider

1. Create a new file in `backend/llm/` (e.g., `anthropic.py`).
2. Implement the `LLMProvider` protocol:
   - `name: str` — human-readable provider name
   - `generate(*, system: str, user: str, max_tokens: int = 4096) -> LLMResult`
   - `ping() -> tuple[bool, str | None]`
3. Register the class in `backend/llm/__init__.py` in the `PROVIDERS` dict.
4. Add a default model entry in `backend/config.py` under `default_models`.

### Data Flow: Lesson Adaptation

1. Client sends `POST /api/adapt` with `lesson_id`, `cluster_id`, `kb_ids`, and `include_student_context`.
2. Router delegates to `services/adaptation.py:generate()`, which:
   - Resolves the teacher's configured LLM provider (or falls back to `ADAPT_GEMINI_API_KEY`).
   - Builds context blocks (lesson metadata, cluster description, student roster, RAG-retrieved KB chunks).
   - Calls `provider.generate()` with the system prompt (`prompts/system.txt`) and assembled user prompt.
   - Parses the LLM JSON response into structured `plan_json`.
   - Renders the plan to HTML via `services/renderer.py` (Jinja2 template).
   - Creates a versioned `LessonPlanVersion` row via `services/versioning.py`.
   - Logs RAG context metadata in `RAGContextLog`.
3. Client receives `AdaptationOut` with the head version and full version list.

## Running Tests

The test suite in `tests/test_api.py` consists of **integration tests** that require a running ADAPT server:

1. Start the server:
   ```bash
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
   Or use the background runner:
   ```bash
   python start_server.py
   ```

2. In a separate terminal, run:
   ```bash
   python -m pytest tests/
   ```

3. To run a single test class or test:
   ```bash
   python -m pytest tests/test_api.py::TestHealth
   python -m pytest tests/test_api.py::TestHealth::test_health
   ```

The test fixtures in `tests/conftest.py` default to `http://127.0.0.1:8000` and use `X-Teacher-Id` headers for the MVP fakeauth system.

## Database Migrations

ADAPT uses a simple, idempotent SQL migration approach:

- **Schema definition**: `adapt-database.sql` at the project root contains all `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements.
- **Applying migrations**: Run `python scripts/migrate.py` — it parses the SQL file and executes every DDL block against `adapt.db`.
- **Adding tables or indexes**: Edit `adapt-database.sql` to add new `CREATE TABLE IF NOT EXISTS` or `CREATE INDEX IF NOT EXISTS` blocks, then re-run `python scripts/migrate.py`.

Because all statements use `IF NOT EXISTS`, the script is safe to re-run at any time.

## Environment Configuration

See [CONFIGURATION.md](CONFIGURATION.md) for the full environment variable reference. Key variables for development:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADAPT_SECRET_KEY` | Optional | Auto-generated | Fernet key for encrypting LLM API keys at rest. Auto-generated on first run and stored in `.secret_key`. |
| `ADAPT_GEMINI_API_KEY` | Optional | — | Fallback Gemini key; lets teachers skip the Settings screen in local installs. |
| `ADAPT_EMBEDDING_MODEL` | Optional | `all-MiniLM-L6-v2` | Sentence-transformers model used for KB chunk embeddings. |

The database (`adapt.db`) and ChromaDB data (`chroma_data/`) are created automatically on first run.