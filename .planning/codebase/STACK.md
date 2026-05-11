# Technology Stack

**Analysis Date:** 2026-05-11

## Languages

**Primary:**
- Python 3.11+ — Backend API, RAG pipeline, LLM orchestration, document processing, database models

**Secondary:**
- SQL — Schema definition and seed data in `adapt-database.sql`
- HTML/CSS/JavaScript (vanilla) — Frontend prototype in `adapt-frontend-prototype-echristian-aduong/`
- Jinja2 templates — Lesson plan HTML rendering in `backend/templates/lesson_plan.html.j2`

## Runtime

**Environment:**
- Python 3.11+ (uses `from __future__ import annotations`, union type syntax `X | None`, `type[...]`)
- No pinned Python version file (`.python-version` / `.nvmrc` absent)

**Package Manager:**
- pip (via `requirements.txt`)
- Lockfile: Not present (no `requirements.lock` or `Pipfile.lock`)

## Frameworks

**Core:**
- FastAPI 0.115.6 — REST API framework, serves backend at `backend/main.py`
- Uvicorn 0.34.0 — ASGI server with standard extras, started via `python -m uvicorn backend.main:app`
- SQLAlchemy 2.0.36 — ORM with mapped columns (`Mapped`, `mapped_column`), declarative base, future mode

**Data & AI:**
- ChromaDB 0.5.18 — Vector database for knowledge-base chunk storage and cosine similarity search
- sentence-transformers 3.3.1 — Local embedding model (`all-MiniLM-L6-v2` by default) for RAG chunk embeddings
- google-generativeai 0.8.3 — Google Gemini SDK for LLM generation

**Document Processing:**
- PyPDF2 3.0.1 — PDF text extraction (fallback)
- pdfplumber 0.11.4 — PDF text extraction (primary)
- python-docx 1.2.0 — DOCX reading and AI-assisted editing with run-level text preservation
- python-pptx 1.0.2 — PPTX reading and AI-assisted editing with run-level text preservation
- reportlab 4.5.0 — PDF generation for AI-edited source file exports

**Templating:**
- Jinja2 3.1.4 — HTML template rendering for lesson plans

**Security:**
- cryptography 44.0.0 — Fernet symmetric encryption for API key storage at rest

**Testing:**
- pytest — Integration test runner (tests hit a live uvicorn server)
- requests 2.32.3 — HTTP client used both in tests and in LLM provider calls (OpenRouter, HuggingFace)

**Utilities:**
- python-dotenv 1.0.1 — Environment variable loading from `.env` and `keys.env`

## Key Dependencies

**Critical:**
- `fastapi` 0.115.6 — All API routes, Pydantic validation, dependency injection
- `sqlalchemy` 2.0.36 — All database models in `backend/models.py`, session management in `backend/db.py`
- `chromadb` 0.5.18 — Vector store for RAG pipeline in `backend/rag/store.py`
- `sentence-transformers` 3.3.1 — Embedding generation in `backend/rag/embedder.py`
- `google-generativeai` 0.8.3 — Gemini LLM provider in `backend/llm/gemini.py`
- `cryptography` 44.0.0 — Fernet encryption for stored API keys in `backend/security.py`

**Infrastructure:**
- `uvicorn` 0.34.0 — Production ASGI server
- `requests` 2.32.3 — HTTP client for OpenRouter and HuggingFace API calls

## Configuration

**Environment:**
- Environment loaded via `python-dotenv` from `.env` and `keys.env` (see `backend/config.py`)
- Config class: `backend/config.py` → `Settings` singleton
- Key environment variables:
  - `ADAPT_SECRET_KEY` — Fernet key for encrypting LLM API keys (auto-generated if empty)
  - `ADAPT_GEMINI_API_KEY` — Optional fallback Gemini key for solo-teacher local installs
  - `ADAPT_EMBEDDING_MODEL` — Sentence-transformers model name (default: `all-MiniLM-L6-v2`)

**Build:**
- No build step required — pure Python backend
- Database initialization: `python -m scripts.migrate` (DDL from `adapt-database.sql`)
- Knowledge base ingestion: `python -m scripts.ingest_kbs` (chunks KB docs into ChromaDB)
- Version seeding: `python -m scripts.seed_versions` (creates initial lesson plan versions)
- Server startup: `python start_server.py` (launches uvicorn on `0.0.0.0:8000`)

**Path Configuration (in `backend/config.py`):**
- `db_path`: `ROOT / "adapt.db"` (SQLite)
- `chroma_path`: `ROOT / "chroma_data"` (ChromaDB persistent storage)
- `knowledge_bases_dir`: `ROOT / "Knowledge Bases"` (source PDF/TXT files)
- `sample_lessons_dir`: `ROOT / "Sample Lessons"` (DOCX/PPTX lesson source files)
- `uploads_dir`: `ROOT / "uploads"` (AI-edited file output)

## Platform Requirements

**Development:**
- Python 3.11+
- pip install -r requirements.txt
- ~80MB disk for default embedding model download on first run
- Gemini API key (or OpenRouter/HuggingFace key) for LLM features
- Run `python -m scripts.migrate` to create SQLite schema
- Run `python -m scripts.ingest_kbs` to populate ChromaDB

**Production:**
- Single-machine deployment (SQLite + local ChromaDB)
- No containerization configured (no Dockerfile or docker-compose)
- Server runs via uvicorn on port 8000
- Frontend served as static files from `adapt-frontend-prototype-echristian-aduong/` at `/app`
- API docs at `/docs` (Swagger UI via FastAPI)

## Default LLM Models

Configured in `backend/config.py` → `Settings.default_models`:
- **Gemini**: `gemini-2.5-flash`
- **OpenRouter**: `meta-llama/llama-3.1-8b-instruct:free`
- **HuggingFace**: `meta-llama/Llama-3.1-8B-Instruct`

---

*Stack analysis: 2026-05-11*
