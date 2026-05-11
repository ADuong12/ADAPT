<!-- generated-by: gsd-doc-writer -->

# Configuration

ADAPT uses environment variables for secrets and API keys, and file-based paths for local storage. All configuration is centralized in `backend/config.py`, which loads values from `.env` and `keys.env` files.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADAPT_SECRET_KEY` | No | Auto-generated | Fernet encryption key for encrypting LLM API keys at rest. If left empty, a key is auto-generated on first run and persisted to `.secret_key`. Generate manually with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ADAPT_GEMINI_API_KEY` | No | *(empty)* | Fallback Gemini API key for solo-teacher local installs. If set, the teacher can skip the Settings screen entirely. |
| `ADAPT_EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | Sentence-transformers model used for knowledge-base chunk embeddings. The default model is fast, free, and ~80 MB. |

## File-Based Configuration

The `Settings` class in `backend/config.py` defines paths and runtime defaults that do not require environment variables:

| Setting | Value | Description |
|---|---|---|
| `db_path` | `<ROOT>/adapt.db` | SQLite database file path |
| `chroma_path` | `<ROOT>/chroma_data` | ChromaDB persistent storage directory (auto-created) |
| `knowledge_bases_dir` | `<ROOT>/Knowledge Bases` | Source documents for knowledge bases |
| `sample_lessons_dir` | `<ROOT>/Sample Lessons` | Lesson template source files |
| `uploads_dir` | `<ROOT>/uploads` | Uploaded file storage (auto-created) |
| `default_models` | *(see below)* | Per-provider default LLM model names |
| `cors_origins` | `["*"]` | Allowed CORS origins |

`<ROOT>` refers to the project root directory (one level above `backend/`).

### Default LLM Models

| Provider | Default Model |
|---|---|
| `gemini` | `gemini-2.5-flash` |
| `openrouter` | `meta-llama/llama-3.1-8b-instruct:free` |
| `huggingface` | `meta-llama/Llama-3.1-8B-Instruct` |

## Required vs Optional Settings

The only truly **required** value for the application to start is the encryption key. However, ADAPT handles this automatically:

- **`ADAPT_SECRET_KEY`** — If not provided, a Fernet key is generated on first run and stored in `.secret_key` at the project root. No manual action needed unless you want to use a specific key.

All other environment variables are **optional**:

- **`ADAPT_GEMINI_API_KEY`** — Without this, teachers must configure their own API key through the Settings UI on first login.
- **`ADAPT_EMBEDDING_MODEL`** — Falls back to `all-MiniLM-L6-v2` if not set.

## Defaults

| Setting | Default | Source |
|---|---|---|
| Encryption key | Auto-generated Fernet key | `backend/security.py` — `_load_or_generate_key()` |
| Embedding model | `all-MiniLM-L6-v2` | `ADAPT_EMBEDDING_MODEL` env var / `config.py` |
| Gemini fallback key | *(empty)* | `ADAPT_GEMINI_API_KEY` env var / `config.py` |
| CORS origins | `["*"]` (allow all) | `config.py` |
| Upload directory | `<ROOT>/uploads` | `config.py` — auto-created on startup |
| ChromaDB directory | `<ROOT>/chroma_data` | `config.py` — auto-created on startup |

## Per-Environment Overrides

ADAPT loads environment files in this order (later files override earlier ones):

1. **`.env`** — Primary environment file (copy from `.env.example`)
2. **`keys.env`** — Local secrets file that overrides `.env` (copy from `keys.env.example`)

This two-file approach lets you keep general config in `.env` while isolating API keys in `keys.env`, which is particularly useful for shared development environments.

To set up:

```bash
# Copy the template files
cp .env.example .env
cp keys.env.example keys.env

# Edit .env with your configuration
# Edit keys.env with your secret values (never commit this file)
```

Both `.env` and `keys.env` are listed in `.gitignore` and will not be committed to version control.

## LLM Provider Configuration

LLM providers are configured **per-teacher** through the application's Settings UI, not through environment variables. The configuration is stored in the `llm_provider_config` database table with these fields:

| Field | Type | Description |
|---|---|---|
| `provider` | string | One of: `gemini`, `openrouter`, `huggingface` |
| `model` | string (nullable) | Model identifier; falls back to `default_models` if omitted |
| `api_key_encrypted` | text | Fernet-encrypted API key stored at rest |
| `is_active` | integer | Only one provider can be active per teacher at a time |

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/teachers/{id}/llm-config` | Retrieve the teacher's active LLM config (API key is redacted) |
| `PUT` | `/api/teachers/{id}/llm-config` | Set or update provider, model, and API key |
| `POST` | `/api/teachers/{id}/llm-config/test` | Test the active provider connection |

When a teacher sets a new active provider, all other providers for that teacher are automatically deactivated.

## Security

- **Encryption at rest**: LLM API keys are encrypted using Fernet (symmetric encryption) before being stored in the database. The encryption key is loaded from `ADAPT_SECRET_KEY` or auto-generated on first run and persisted to `.secret_key`.
- **Key file permissions**: On first-run key generation, `.secret_key` is set to mode `0o600` (owner read/write only) where the OS supports it.
- **API key redaction**: When returning API keys through the API, they are redacted to show only the first 3 and last 4 characters (e.g., `AIz…9fKx`). Short keys are fully masked.
- **Decryption failure**: If a stored key becomes unreadable (e.g., the Fernet key changes), the system raises a `ValueError` with the message "stored API key is unreadable; please re-enter it".

## Files Excluded from Version Control

The following configuration and data files are listed in `.gitignore` and must not be committed:

| File / Directory | Purpose |
|---|---|
| `.env` | Primary environment variables |
| `keys.env` | Local secret overrides |
| `.secret_key` | Auto-generated Fernet encryption key |
| `adapt.db` | SQLite database |
| `chroma_data/` | ChromaDB vector store |
| `uploads/` | User-uploaded files |
| `.server_pid` | Server process ID file |
| `server_stdout.log` | Server standard output log |
| `server_stderr.log` | Server error log |