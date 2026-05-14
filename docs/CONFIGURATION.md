<!-- generated-by: gsd-doc-writer -->

# Configuration

ADAPT uses environment variables for secrets and runtime settings, loaded via `dotenv` from a `.env` file in the `server/` directory. All configuration is centralized in `server/src/config/index.js`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes* | `dev-secret-change-in-production` | Secret for signing JWT access tokens. Must be changed in production. |
| `ENCRYPTION_KEY` | Yes* | *(empty)* | 64-char hex string for AES-256-GCM encryption of stored LLM API keys. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `OPENROUTER_API_KEY` | No | — | Fallback OpenRouter API key used when a teacher has no personal LLM config. |
| `PORT` | No | `3000` | HTTP server port. |
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`). |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed CORS origins. In development mode, `null` origin is implicitly allowed (for local file access). |

*Required for production. Dev defaults work for local development.

### RAG Pipeline Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB server URL for vector storage. |
| `EMBED_SERVER_URL` | No | `http://127.0.0.1:9876/embed` | Python embedding server URL for sentence-transformers. |

## Configuration Loading

`server/src/config/index.js` loads environment variables on startup:

```js
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
```

The `.env` file is resolved relative to `server/src/config/`, pointing to `server/.env`. Copy `.env.example` to `.env` and fill in the values:

```bash
cd server
cp .env.example .env
# Edit .env — set JWT_SECRET, ENCRYPTION_KEY, and optionally OPENROUTER_API_KEY
```

## File-Based Paths

| Setting | Value | Description |
|---|---|---|
| Database | `<ROOT>/adapt-database.sql` | SQLite DDL + seed data (loaded by `db/init.js`) |
| Database path | In-memory via `better-sqlite3` | SQLite runs embedded, no separate file path needed in config |
| Knowledge Bases | `<ROOT>/Knowledge Bases/` | Source documents for RAG ingestion |
| Sample Lessons | `<ROOT>/Sample Lessons/` | Lesson template source files |
| Templates | `server/src/templates/` | EJS template for lesson plan rendering |

`<ROOT>` refers to the project root (three levels above `server/src/config/`).

## LLM Provider Configuration

LLM providers are configured **per-teacher** through the Settings UI or the API (`PUT /api/teachers/:id/llm-config`). The configuration is stored in the `llm_provider_config` database table:

| Field | Type | Description |
|---|---|---|
| `provider` | string | Currently only `openrouter` is supported |
| `model` | string (nullable) | Model identifier (e.g., `meta-llama/llama-3.1-8b-instruct:free`) |
| `api_key_encrypted` | text | AES-256-GCM encrypted API key stored at rest |
| `is_active` | integer | Only one provider can be active per teacher at a time |

### Fallback Behavior

When a teacher has no active `llm_provider_config`, the system falls back to the `OPENROUTER_API_KEY` environment variable. If neither is available, adaptation requests return a `400` error.

### API Key Encryption

Teacher LLM API keys are encrypted at rest using AES-256-GCM:

- **Algorithm**: `aes-256-gcm` with 12-byte IV and 16-byte auth tag
- **Storage format**: `iv:authTag:ciphertext` (base64-encoded segments)
- **Key source**: `ENCRYPTION_KEY` environment variable (64-char hex = 256 bits)
- **Redaction**: API keys returned by the API show only first 3 and last 4 characters (e.g., `sk-…9fKx`). Short keys are fully masked.

See `server/src/services/crypto.js` for implementation details.

## CORS Configuration

CORS origins are configured via `CORS_ORIGINS`:

```js
// server/src/config/index.js
corsOrigins: process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').concat(process.env.NODE_ENV === 'development' ? ['null'] : [])
  : ['http://localhost:3000']
```

In development mode, the `null` origin is implicitly appended to allow local file:// access. For production, list all allowed origins separated by commas (e.g., `https://adapt.example.com,https://admin.adapt.example.com`).

## Database

SQLite via `better-sqlite3` provides all persistence. The database is initialized on server startup by `server/src/db/init.js`:

1. Reads and executes `adapt-database.sql` from the project root (idempotent — uses `IF NOT EXISTS`)
2. Adds `password_hash` column to `teacher` table (idempotent — catches duplicate column error)
3. Creates `refresh_token` table and indexes (idempotent)

The admin user (Robert Chen, `teacher_id=4`) receives a default password hash via `server/src/db/seed.js`.

## Files Excluded from Version Control

The following files and directories are in `.gitignore` and must not be committed:

| File / Directory | Purpose |
|---|---|
| `server/.env` | Environment variables (secrets) |
| `server/.secret_key` | Auto-generated encryption key (Not currently used — ENCRYPTION_KEY is in .env) |
| `node_modules/` | Installed dependencies |
| `chroma_data/` | ChromaDB vector store data |
| `uploads/` | User-uploaded files |

## Environment-Specific Notes

### Development

- `JWT_SECRET` defaults to `dev-secret-change-in-production` — acceptable for local use only
- `CORS_ORIGINS` includes `null` origin for local file:// access
- SQLite database is created from `adapt-database.sql` on first startup

### Production

- `JWT_SECRET` **must** be set to a cryptographically random string
- `ENCRYPTION_KEY` **must** be set to a 64-char hex string
- `OPENROUTER_API_KEY` should be set if no per-teacher configs will be used
- `CORS_ORIGINS` should list only trusted domains
- `NODE_ENV=production` should be set