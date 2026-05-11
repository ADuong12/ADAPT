# External Integrations

**Analysis Date:** 2026-05-11

## APIs & External Services

### LLM Providers (Multi-provider architecture)

The system supports three LLM providers via a protocol-based abstraction (`backend/llm/base.py` → `LLMProvider`). Teachers configure their preferred provider via the Settings UI; API keys are stored encrypted in the database.

**Google Gemini:**
- Purpose: Primary LLM for lesson plan generation, refinement, and source file editing
- SDK/Client: `google-generativeai` 0.8.3 (imported in `backend/llm/gemini.py`)
- Auth: Per-teacher API key (encrypted at rest via Fernet in `LLMProviderConfig` table), or fallback `ADAPT_GEMINI_API_KEY` env var
- Default model: `gemini-2.5-flash`
- Fallback env var: `ADAPT_GEMINI_API_KEY` (for solo-teacher local installs)

**OpenRouter:**
- Purpose: Alternative LLM provider — routes to open-source models (Llama 3.1 8B free tier)
- SDK/Client: `requests` library (raw HTTP to `https://openrouter.ai/api/v1/chat/completions`)
- Auth: Per-teacher API key (encrypted at rest), sent as `Authorization: Bearer <key>` header
- Default model: `meta-llama/llama-3.1-8b-instruct:free`
- Implementation: `backend/llm/openrouter.py`

**HuggingFace Inference API:**
- Purpose: Alternative LLM provider — HuggingFace hosted models
- SDK/Client: `requests` library (raw HTTP to `https://api-inference.huggingface.co/models/<model>`)
- Auth: Per-teacher API key (encrypted at rest), sent as `Authorization: Bearer <key>` header
- Default model: `meta-llama/Llama-3.1-8B-Instruct`
- Implementation: `backend/llm/huggingface.py`

**LLM Provider Registry:**
- Factory function: `backend/llm/__init__.py` → `make_provider(name, api_key, model)`
- Provider resolution: `backend/services/adaptation.py` → `_resolve_provider(db, teacher_id)` — checks active provider config, falls back to env var Gemini key

## Data Storage

### Databases

**SQLite (Primary Relational):**
- Connection: `sqlite:///<ROOT>/adapt.db` (configured in `backend/db.py`)
- ORM: SQLAlchemy 2.0 with `DeclarativeBase`, `mapped_column`, future mode
- Engine: `create_engine` with `check_same_thread=False` for multi-threaded ASGI
- Session: `SessionLocal` sessionmaker with manual `get_db()` generator for FastAPI `Depends`
- Tables: 12 tables — `institution`, `teacher`, `class`, `student_cluster`, `student`, `enrollment`, `knowledge_base`, `cluster_kb`, `lesson`, `adapted_lesson`, `lesson_kb_used`, `adaptation_feedback`, `rag_context_log`, `lesson_plan_version`, `llm_provider_config`
- Schema source: `adapt-database.sql` (DDL + seed data)
- Migration: `scripts/migrate.py` (applies DDL idempotently)

**ChromaDB (Vector Store for RAG):**
- Connection: `chromadb.PersistentClient(path="<ROOT>/chroma_data")` (in `backend/rag/store.py`)
- Collections: One per knowledge base, named `kb_<kb_id>`
- Distance metric: Cosine similarity (`hnsw:space: cosine`)
- Operations: `upsert_chunks()`, `query()` with top-k retrieval
- Ingestion: `scripts/ingest_kbs.py` — reads PDF/TXT files, chunks, embeds, and upserts

### File Storage

**Local filesystem only:**
- Knowledge base source files: `Knowledge Bases/` directory (PDF, TXT)
- Sample lesson files: `Sample Lessons/` directory (DOCX, PPTX, PDF)
- AI-edited outputs: `uploads/lesson_edits/` directory
- Uploads dir created automatically: `backend/config.py` → `settings.uploads_dir.mkdir(exist_ok=True)`

### Caching

**In-process caching via `functools.lru_cache`:**
- Sentence-transformers model: `backend/rag/embedder.py` → `get_model()` (singleton)
- ChromaDB client: `backend/rag/store.py` → `get_client()` (singleton)
- Jinja2 environment: `backend/services/renderer.py` → `_env()` (singleton)

## Authentication & Identity

**Auth Provider:**
- Custom MVP "fakeauth" — no real authentication framework
- Implementation: `backend/deps.py` → `current_teacher()` dependency
- Mechanism: Trusts `X-Teacher-Id` HTTP header (set by frontend from `localStorage`)
- Frontend: `adapt-frontend-prototype-echristian-aduong/auth.js` and `api.js` — stores `currentTeacherId` and `currentTeacherRole` in `localStorage`
- Login: `backend/routers/auth.py` → `POST /api/auth/fake-login` — accepts any input, returns matching teacher
- Roles: `teacher` and `admin` (stored in `teacher.role` column)
- Admin guard: `backend/deps.py` → `require_admin()` dependency

**API Key Encryption:**
- Fernet symmetric encryption via `backend/security.py`
- Key source: `ADAPT_SECRET_KEY` env var → `.secret_key` file → auto-generated on first run
- Encrypted keys stored in `llm_provider_config.api_key_encrypted` column
- Redaction: `security.redact()` shows first 3 and last 4 chars

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Rollbar, or similar

**Logs:**
- Server stdout/stderr captured to `server_stdout.log` / `server_stderr.log` by `start_server.py`
- No structured logging framework — standard `print()` statements

**RAG Context Logging:**
- `rag_context_log` table records chunks used, token counts, and context layers per adaptation
- Written by `backend/services/adaptation.py` during `generate()` and `refine()`

## CI/CD & Deployment

**Hosting:**
- Local development / single-machine deployment only
- No containerization (no Dockerfile, no docker-compose)

**CI Pipeline:**
- None — no GitHub Actions, Makefile, or CI configuration detected

## Environment Configuration

**Required env vars (from `.env.example` and `keys.env.example`):**
- `ADAPT_SECRET_KEY` — Fernet encryption key (auto-generated if empty)
- `ADAPT_GEMINI_API_KEY` — Optional fallback Gemini API key
- `ADAPT_EMBEDDING_MODEL` — Sentence-transformers model name (default: `all-MiniLM-L6-v2`)

**Secrets location:**
- `.env` — Main environment config (gitignored)
- `keys.env` — API keys override (gitignored)
- `.secret_key` — Auto-generated Fernet key file (gitignored)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Data Processing Pipeline

### RAG Pipeline
1. **Ingestion** (`scripts/ingest_kbs.py`): Reads KB source files (PDF/TXT) from `Knowledge Bases/`
2. **Chunking** (`backend/rag/chunker.py`): Splits text by headings/sections (120–1400 char windows)
3. **Embedding** (`backend/rag/embedder.py`): Generates embeddings via sentence-transformers (`all-MiniLM-L6-v2`)
4. **Storage** (`backend/rag/store.py`): Upserts chunks + embeddings into ChromaDB per-KB collections
5. **Retrieval** (`backend/rag/retriever.py`): At query time, embeds the query, retrieves top-k chunks per KB via cosine similarity

### Document Editing Pipeline
1. **Source Discovery** (`backend/services/source_editor.py`): Fuzzy-matches lesson source files by filename token overlap
2. **Block Extraction**: Extracts editable text blocks from DOCX (paragraphs + tables), PPTX (text frames), PDF (pages)
3. **LLM Rewriting**: Sends batches of text blocks to LLM with teacher instruction + RAG context
4. **Run Preservation**: Replaces text in DOCX/PPTX at the run level to preserve formatting and hyperlinks
5. **Output**: Saves edited copy to `uploads/lesson_edits/` (original never modified)

---

*Integration audit: 2026-05-11*
