<!-- generated-by: gsd-doc-writer -->

# Development Guide

## Local Setup

### Option A: Docker

```bash
git clone https://github.com/<org>/ADAPT.git
cd ADAPT

# Configure secrets
cp .env.docker.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY

# Build and start
docker compose up --build -d
```

Open **http://localhost**. See [DOCKER.md](DOCKER.md) for details.

For development with live reload, use the local setup below instead.

### Option B: Local Development

1. Clone the repository and enter the project directory:
   ```bash
   git clone https://github.com/<org>/ADAPT.git
   cd ADAPT
   ```

2. Install server dependencies:
   ```bash
   cd server && npm install
   ```

3. Install client dependencies:
   ```bash
   cd ../client && npm install
   ```

4. Configure environment variables:
   ```bash
   cd ../server && cp .env.example .env
   ```
   At minimum, set `JWT_SECRET` and `ENCRYPTION_KEY` for production use. Dev defaults work for local development.

5. Start the backend with hot reload:
   ```bash
   cd server && npm run dev
   ```
   The server starts on `http://localhost:3000` and initializes the SQLite database from `adapt-database.sql` on first run.

6. Start the frontend in a separate terminal:
   ```bash
   cd client && npm run dev
   ```
   The React app runs on `http://localhost:5173` and proxies API requests to port 3000.

## Build Commands

### Server

| Command | Description |
|---------|-------------|
| `cd server && npm start` | Start production server (`node src/server.js`) |
| `cd server && npm run dev` | Start dev server with nodemon hot reload |
| `cd server && npm test` | Run all Vitest tests (129 tests, in-process) |
| `cd server && npm run test:watch` | Run tests in watch mode |
| `cd server && npm run test:coverage` | Run tests with V8 coverage |

### Client

| Command | Description |
|---------|-------------|
| `cd client && npm run dev` | Start Vite dev server on port 5173 |
| `cd client && npm run build` | Production build to `client/dist/` |
| `cd client && npm run lint` | Run ESLint on client code |
| `cd client && npm run preview` | Preview production build locally |

### Utilities

| Command | Description |
|---------|-------------|
| `python scripts/ingest_kbs.py` | Ingest KB documents into ChromaDB (requires Python + ChromaDB) |
| `python scripts/ingest_kbs.py --kb-id 4` | Ingest only a single knowledge base |

## Project Structure

```
ADAPT/
├── server/                        # Express 5 API server (CommonJS)
│   ├── src/
│   │   ├── app.js                # Express app + middleware setup
│   │   ├── server.js             # HTTP server entry point
│   │   ├── config/index.js       # Environment config (dotenv)
│   │   ├── db/
│   │   │   ├── index.js          # better-sqlite3 connection
│   │   │   ├── init.js           # Schema initialization (reads adapt-database.sql)
│   │   │   └── seed.js           # Admin password seeding
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT requireAuth middleware
│   │   │   ├── rbac.js           # requireRole, requireOwnerOrAdmin
│   │   │   └── errorHandler.js   # Centralized error handling (AppError hierarchy)
│   │   ├── routes/
│   │   │   ├── index.js          # /api route registration + health check
│   │   │   ├── auth.js           # /api/auth — register, login, refresh, logout, /me
│   │   │   ├── teachers.js       # /api/teachers — dashboard, profile, classes, students
│   │   │   ├── lessons.js        # /api/lessons — CRUD, search, source files
│   │   │   ├── clusters.js       # /api/clusters — listing, KB assignment
│   │   │   ├── knowledge-bases.js# /api/knowledge-bases — KB listing
│   │   │   ├── settings.js       # /api/teachers/:id/llm-config — LLM provider config
│   │   │   ├── admin.js          # /api/institutions — admin overview
│   │   │   ├── adaptations.js    # /api/adapt, /api/adaptations/* — generate, refine, version
│   │   │   └── file-edits.js     # /api/file-edits — source file AI editing
│   │   ├── services/
│   │   │   ├── adaptation.js     # Generate/refine orchestration + RAG context assembly
│   │   │   ├── versioning.js    # Immutable version management (is_head flag)
│   │   │   ├── renderer.js      # EJS → HTML rendering
│   │   │   ├── source-editor.js # DOCX/PPTX/PDF AI editing
│   │   │   ├── auth.js          # Token management (bcryptjs + JWT, access + refresh)
│   │   │   ├── crypto.js        # AES-256-GCM encrypt/decrypt/redact for API keys
│   │   │   └── llm/
│   │   │       └── openrouter.js# OpenRouter LLM provider
│   │   ├── rag/
│   │   │   ├── retriever.js      # Semantic KB retrieval
│   │   │   ├── chunker.js        # Document chunking
│   │   │   ├── embedder.js       # Embedding service client
│   │   │   └── store.js          # ChromaDB vector store client
│   │   ├── errors/index.js      # Custom error classes (AppError, NotFoundError, ValidationError, AuthError)
│   │   ├── prompts/system.txt    # System prompt for LLM lesson adaptation
│   │   └── templates/
│   │       └── lesson_plan.ejs  # EJS template for rendered HTML output
│   ├── tests/                    # Vitest + supertest tests (129 tests)
│   ├── vitest.config.js          # Vitest configuration
│   └── package.json              # CommonJS package
├── client/                        # React 19 SPA (Vite, ESM)
│   ├── src/
│   │   ├── App.jsx               # Router + layout
│   │   ├── main.jsx              # React entry point
│   │   ├── api/useApi.js         # Fetch wrapper with JWT refresh
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx    # JWT context provider
│   │   │   ├── ProtectedRoute.jsx # Route guard for authenticated users
│   │   │   └── AdminRoute.jsx    # Route guard for admin role
│   │   └── pages/                # 12 page components
│   └── package.json              # ESM package
├── adapt-database.sql            # Full DDL + seed data for SQLite
├── scripts/                       # Python utility scripts
│   ├── ingest_kbs.py            # Chunk + embed KB documents into ChromaDB
│   └── ...                       # Other Python utility scripts
└── .env.example                  # Environment variable template
```

## Docker Development

The project includes Docker configuration for containerized deployment:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Multi-service orchestration (nginx, server, embed-server, chromadb) |
| `server/Dockerfile` | Multi-stage Node.js build with SQLite persistence |
| `server/docker-entrypoint.sh` | Symlinks persistent volume to app paths |
| `client/Dockerfile` | Multi-stage Vite build → Nginx serving + reverse proxy |
| `client/nginx.default.conf` | Nginx config: serves SPA, proxies `/api/` to server |
| `embed-server/Dockerfile` | Python + sentence-transformers embedding service |
| `embed-server/requirements.txt` | Python dependencies for embedding server |
| `.dockerignore` | Excludes secrets, node_modules, build artifacts from builds |
| `.env.docker.example` | Template for Docker environment variables (no actual secrets) |

Key notes:

- The **nginx** container serves the frontend and reverse-proxies `/api/` to the server — no CORS issues
- The **server** container symlinks `adapt.db`, `uploads/`, and `.secret_key` to a persistent Docker volume
- **RAG services** (embed-server, chromadb) are opt-in via `docker compose --profile rag`
- Environment variables come from `.env` at the project root (gitignored, never committed)
- See [DOCKER.md](DOCKER.md) for full details

## Code Style

### Server (Node.js / CommonJS)

- **Module system**: CommonJS (`require`/`module.exports`) — set in `package.json` as `"type": "commonjs"`
- **Error handling**: Use the `AppError` hierarchy (`NotFoundError`, `ValidationError`, `AuthError`) from `server/src/errors/index.js`. Throw these directly in route handlers — the centralized `errorHandler` middleware catches them.
- **Route structure**: Each domain has its own file in `server/src/routes/`. Routes use Express `Router()` and are registered in `server/src/routes/index.js`.
- **Database**: Direct `better-sqlite3` prepared statements — no ORM. All queries use parameterized statements.
- **Auth middleware**: `requireAuth` (JWT validation), `requireRole(...roles)`, `requireOwnerOrAdmin` — attach as route-level middleware.
- **No comments** unless absolutely necessary — the code is intended to be self-documenting through clear naming.

### Client (React / ESM)

- **Module system**: ESM (`import`/`export`) — set in `package.json` as `"type": "module"`
- **Framework**: React 19 with React Router v7
- **Build tool**: Vite 8
- **Styling**: Plain CSS (no component library)
- **API layer**: `useApi()` hook wraps fetch with auth headers, token refresh, and error handling
- **No comments** unless absolutely necessary.

## Adding a New API Endpoint

1. **Route handler** — Create route functions in the appropriate `server/src/routes/` file (or create a new one).
2. **Register** — Import and mount the router in `server/src/routes/index.js` via `router.use('/path', newRouter)`.
3. **Middleware** — Add `requireAuth`, `requireRole('admin')`, or `requireOwnerOrAdmin` as needed.
4. **Error handling** — Throw `NotFoundError`, `ValidationError`, or `AuthError` for expected error cases.
5. **Schema** — If adding new tables, add `CREATE TABLE IF NOT EXISTS` to `adapt-database.sql`. The schema is auto-applied on server start via `db/init.js`.
6. **Test** — Add integration tests in `server/tests/routes/`.

## Adding a New LLM Provider

1. Create a new file in `server/src/services/llm/` (e.g., `anthropic.js`).
2. Export a class with `generate({ system, user, maxTokens })` and `ping()` methods, matching the `OpenRouterProvider` interface.
3. Update `resolveProvider()` in `server/src/services/adaptation.js` to instantiate the new provider based on the `provider` field from `llm_provider_config`.
4. Update the `settings.js` route and frontend Settings page to include the new provider option.

## Data Flow: Lesson Adaptation

1. Client sends `POST /api/adapt` with `lesson_id`, `cluster_id`, `kb_ids`, and `include_student_context`.
2. `adaptations.js` route validates input and delegates to `services/adaptation.js:generate()`.
3. `generate()` resolves the teacher's LLM provider config (or throws if none configured).
4. `buildContextBlocks()` assembles the user prompt from lesson metadata, cluster description, student profiles, and RAG-retrieved KB chunks.
5. `retriever.retrieveForLesson()` embeds the query and retrieves top-k chunks from ChromaDB.
6. `provider.generate()` makes the OpenRouter API call with the system prompt and assembled user context.
7. `coerceToPlanJson()` parses the LLM response into structured JSON.
8. `renderer.renderLessonPlan()` fills the EJS template with the plan data.
9. `versioning.createVersion()` creates an immutable `lesson_plan_version` row with `is_head=1`, demoting the previous head.
10. Client receives `adaptationOut` with head version summary and full version list.

## Database

SQLite via `better-sqlite3`. The database is initialized on server startup:

- `server/src/db/init.js` reads `adapt-database.sql` and creates all tables (idempotent — uses `IF NOT EXISTS`)
- `server/src/db/seed.js` seeds the admin user password hash
- No migration tool — add `ALTER TABLE` or `CREATE TABLE IF NOT EXISTS` statements to `init.js` for schema changes

## Environment Configuration

See [CONFIGURATION.md](CONFIGURATION.md) for the full environment variable reference. Key variables for development:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes (prod) | `dev-secret-change-in-production` | JWT signing secret |
| `ENCRYPTION_KEY` | Yes (prod) | *(empty)* | AES-256-GCM key for LLM API key encryption |
| `OPENROUTER_API_KEY` | No | — | Fallback OpenRouter key for LLM calls |

The SQLite database is created from `adapt-database.sql` automatically on first server start.