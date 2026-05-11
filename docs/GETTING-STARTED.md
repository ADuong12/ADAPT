<!-- generated-by: gsd-doc-writer -->

# Getting Started

This guide walks you through installing, configuring, and running ADAPT locally for the first time.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Python 3.10+** — Required runtime (`python --version` to verify)
- **pip** — Python package manager (included with most Python distributions)
- **Git** — For cloning the repository
- **An LLM API key** — At least one of:
  - Google Gemini API key
  - OpenRouter API key
  - HuggingFace API token

## Installation Steps

### 1. Clone the repository

```bash
git clone <repository-url>
cd ADAPT
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs all required packages including FastAPI, Uvicorn, SQLAlchemy, ChromaDB, sentence-transformers, cryptography, google-generativeai, and others.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the values:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADAPT_SECRET_KEY` | Optional | Auto-generated | Fernet key for encrypting LLM API keys at rest. Leave empty to auto-generate on first run. |
| `ADAPT_GEMINI_API_KEY` | Optional | — | Fallback Gemini key for solo-teacher local installs. If set, you can skip the Settings screen. |
| `ADAPT_EMBEDDING_MODEL` | Optional | `all-MiniLM-L6-v2` | Sentence-transformers model used for knowledge base chunk embeddings. |

### 4. (Optional) Set up local secrets file

```bash
cp keys.env.example keys.env
```

Fill in real API key values in `keys.env`. This file should never be committed to version control.

### 5. Initialize the database

```bash
python scripts/migrate.py
```

This reads `adapt-database.sql` and creates the SQLite database (`adapt.db`) with all required tables and indexes. The script is idempotent — every statement uses `IF NOT EXISTS`, so it is safe to re-run when the schema changes.

### 6. (Optional) Seed demo data

```bash
python scripts/seed_versions.py
```

Creates initial lesson plan version rows from the sample adapted lessons. This is only needed if you want pre-populated demo data.

### 7. (Optional) Ingest Knowledge Base documents

```bash
python scripts/ingest_kbs.py
```

Ingests files from the `Knowledge Bases/` directory into ChromaDB. You can also target a single knowledge base:

```bash
python scripts/ingest_kbs.py --kb-id 4
```

## First Run

Start the ADAPT server:

```bash
python start_server.py
```

On success you will see:

```
Server started (PID <pid>): http://localhost:8000
Frontend: http://localhost:8000/app/login.html
API docs: http://localhost:8000/docs
```

### Server management commands

| Command | Description |
|---|---|
| `python start_server.py` | Start the server in the background |
| `python start_server.py --status` | Check if the server is running and view health status |
| `python start_server.py --stop` | Stop the running server |

### First-time setup in the UI

1. Open **http://localhost:8000/app/login.html** in your browser.
2. Select a teacher from the login page (the MVP uses a fakeauth picker).
3. Go to **Settings** and configure your LLM provider:
   - Choose a provider (Gemini, OpenRouter, or HuggingFace).
   - Enter your API key.
   - Click **Test Connection** to verify it works.
4. Go to **Lesson Library** and pick a lesson.
5. Go to **Personalize**, select a student cluster, and click **Generate** to create an adapted lesson plan.

## Common Setup Issues

### "No LLM configured" error

If you see this error in the UI, it means no LLM provider and API key have been set. Either:

- Set `ADAPT_GEMINI_API_KEY` in your `.env` file as a fallback, **or**
- Configure a provider and API key in the **Settings** page of the UI.

### Health check fails after starting the server

The health endpoint (`/api/health`) is polled automatically after startup. If it fails:

- Check `server_stderr.log` in the project root for error messages.
- Ensure port 8000 is not already in use by another process.
- Verify that all dependencies installed correctly (`pip install -r requirements.txt`).

### ChromaDB errors

If you encounter ChromaDB-related errors:

- Ensure the `chroma_data/` directory exists and is writable.
- Re-run `python scripts/ingest_kbs.py` to repopulate the vector store.

## Next Steps

- **[Architecture](ARCHITECTURE.md)** — Understand the system design and component layout.
- **[Configuration](CONFIGURATION.md)** — Full reference for all environment variables and config options.
