<!-- generated-by: gsd-doc-writer -->

# ADAPT

**AI-Driven Personalized Lesson Planning Tool** — a FastAPI + SQLite web app that uses RAG and LLMs to adapt K-12 CS lessons for diverse learner clusters.

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ADAPT.git
cd ADAPT

# Install Python dependencies
pip install -r requirements.txt

# Initialize the SQLite database
python scripts/migrate.py

# (Optional) Ingest knowledge bases into ChromaDB
python scripts/ingest_kbs.py
```

## Quick Start

1. Copy environment variables and configure:
   ```bash
   cp .env.example .env
   # Edit .env — at minimum set ADAPT_GEMINI_API_KEY for solo-teacher use
   ```

2. Start the server:
   ```bash
   python start_server.py
   ```

3. Open the app in your browser:
   - **Frontend**: http://localhost:8000/app/login.html
   - **API docs**: http://localhost:8000/docs

## Usage Examples

### Generate an adapted lesson plan

Send a `POST` request to `/api/lessons` with a source file and learner cluster data. The RAG pipeline retrieves relevant knowledge base chunks, and the configured LLM (Gemini, OpenRouter, or HuggingFace) produces an adapted lesson plan rendered via Jinja2 templates.

### Refine or rollback a lesson

Lesson plans are versioned with immutable version chains. Use the refine endpoint to iterate on a plan, or rollback to restore a previous version as the new head.

### AI-edit source files

Upload `.docx`, `.pptx`, or `.pdf` source files and request AI-driven edits while preserving the original formatting — powered by `python-docx`, `python-pptx`, and `pdfplumber`/`reportlab`.

## Project Structure

```
ADAPT/
├── backend/               # FastAPI application
│   ├── main.py            # App entry point & router mounting
│   ├── config.py          # Settings (env vars, paths, default models)
│   ├── models.py          # SQLAlchemy ORM models
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── db.py              # Database session management
│   ├── deps.py            # FastAPI dependency injection
│   ├── security.py        # Fernet encryption for API keys
│   ├── routers/           # API route handlers
│   │   ├── lessons.py     # Lesson CRUD & generation
│   │   ├── adaptations.py # Lesson adaptation endpoints
│   │   ├── clusters.py    # Learner cluster management
│   │   ├── knowledge_bases.py # KB management
│   │   ├── file_edits.py  # Source file AI editing
│   │   ├── settings.py    # Teacher LLM settings
│   │   ├── teachers.py    # Teacher profile management
│   │   ├── admin.py       # Admin routes
│   │   └── auth.py        # Fake auth (X-Teacher-Id header)
│   ├── services/          # Business logic
│   │   ├── adaptation.py  # Lesson adaptation orchestration
│   │   ├── renderer.py   # Jinja2 template rendering
│   │   ├── source_editor.py # .docx/.pptx/.pdf editing
│   │   └── versioning.py # Immutable version chains
│   ├── llm/               # LLM provider adapters
│   │   ├── base.py        # Abstract LLM interface
│   │   ├── gemini.py      # Google Gemini
│   │   ├── openrouter.py  # OpenRouter
│   │   └── huggingface.py # HuggingFace
│   ├── rag/               # RAG pipeline
│   │   ├── chunker.py    # Document chunking
│   │   ├── embedder.py   # Sentence-transformers embedding
│   │   ├── store.py      # ChromaDB vector store
│   │   └── retriever.py  # Semantic retrieval
│   ├── prompts/           # Jinja2 prompt templates
│   └── templates/         # Lesson plan Jinja2 templates
├── adapt-frontend-prototype-echristian-aduong/  # Static HTML/CSS/JS frontend
├── scripts/
│   ├── migrate.py         # DB schema initialization
│   ├── ingest_kbs.py     # Knowledge base ingestion into ChromaDB
│   └── seed_versions.py  # Seed versioning data
├── tests/                 # Integration tests (pytest)
├── Knowledge Bases/       # Source documents for RAG ingestion
├── Sample Lessons/         # Source .docx/.pptx/.pdf lesson files
├── start_server.py        # Server launcher (start/stop/status)
├── adapt-database.sql     # DDL for SQLite tables
├── requirements.txt       # Python dependencies
└── .env.example           # Environment variable template
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADAPT_SECRET_KEY` | No | Auto-generated | Fernet key for encrypting stored LLM API keys. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ADAPT_GEMINI_API_KEY` | No | — | Fallback Gemini key for solo-teacher local installs. If set, teachers can skip the Settings screen. |
| `ADAPT_EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | Sentence-transformers model used for knowledge base chunk embeddings. |

## Running Tests

```bash
pytest
```

Tests require a running server. Start the server first with `python start_server.py`, then run `pytest`.

## License

No license file detected — see repository for license information.