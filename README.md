<!-- generated-by: gsd-doc-writer -->

# ADAPT

**AI-Driven Personalized Lesson Planning Tool** — a Node.js/Express 5 + React SPA that uses RAG and LLMs (via OpenRouter) to adapt K-12 CS lessons for diverse learner clusters.

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/your-org/ADAPT.git
cd ADAPT

# Configure secrets
cp .env.docker.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY

# Build and start
docker compose up --build -d
```

Open **http://localhost** in your browser. See [docs/DOCKER.md](docs/DOCKER.md) for full details, including RAG pipeline setup.

### Local Development

```bash
# Clone and install
git clone https://github.com/your-org/ADAPT.git
cd ADAPT

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Set up environment variables
cp server/.env.example server/.env
# Edit server/.env — set JWT_SECRET and ENCRYPTION_KEY

# Start backend (port 3000)
cd server && npm run dev

# Start frontend (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173** in your browser.

The database schema and seed data are initialized automatically on first server startup.

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Backend | Express 5, better-sqlite3 |
| Frontend | React 19, Vite, React Router v7 |
| Auth | bcryptjs + JWT (access + refresh tokens) |
| Encryption | AES-256-GCM for LLM API keys |
| LLM | OpenRouter (multi-model access via a single provider) |
| RAG | ChromaDB + sentence-transformers (Python embedding service) |
| Docker | Docker Compose (nginx, server, embed-server, chromadb) |
| Templates | EJS for lesson plan rendering |
| Testing | Vitest + supertest (129 in-process tests) |

## Project Structure

```
ADAPT/
├── server/                      # Express 5 API server
│   ├── src/
│   │   ├── app.js              # Express app + middleware
│   │   ├── server.js           # HTTP server entry point
│   │   ├── config/index.js     # Environment config (JWT_SECRET, etc.)
│   │   ├── db/
│   │   │   ├── index.js        # better-sqlite3 connection
│   │   │   ├── init.js         # Schema initialization
│   │   │   └── seed.js         # Admin password seeding
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT requireAuth middleware
│   │   │   ├── rbac.js         # requireRole, requireOwnerOrAdmin
│   │   │   └── errorHandler.js # Centralized error handling
│   │   ├── routes/
│   │   │   ├── auth.js         # /api/auth — register, login, refresh, logout, /me
│   │   │   ├── teachers.js     # /api/teachers — dashboard, profile, classes, students
│   │   │   ├── lessons.js      # /api/lessons — CRUD, search, source files
│   │   │   ├── clusters.js     # /api/clusters — listing, KB assignment
│   │   │   ├── knowledge-bases.js # /api/knowledge-bases — KB listing
│   │   │   ├── settings.js     # /api/teachers/:id/llm-config — LLM provider config
│   │   │   ├── admin.js        # /api/institutions — admin overview, teachers, classes
│   │   │   ├── adaptations.js  # /api/adapt, /api/adaptations/* — generate, refine, version, feedback
│   │   │   └── file-edits.js   # /api/file-edits — source file AI editing
│   │   ├── services/
│   │   │   ├── adaptation.js   # Generate/refine orchestration
│   │   │   ├── versioning.js   # Immutable version management
│   │   │   ├── renderer.js     # EJS → HTML rendering
│   │   │   ├── plan-exporter.js # DOCX/PDF/print/export generation
│   │   │   ├── source-editor.js # DOCX/PPTX/PDF AI editing
│   │   │   ├── auth.js         # Token management (access + refresh)
│   │   │   ├── crypto.js       # AES-256-GCM encrypt/decrypt/redact
│   │   │   └── llm/openrouter.js # OpenRouter provider
│   │   ├── rag/
│   │   │   ├── retriever.js    # Semantic KB retrieval
│   │   │   ├── chunker.js      # Document chunking
│   │   │   ├── embedder.js     # Embedding service client
│   │   │   ├── store.js        # ChromaDB vector store client
│   │   │   └── embed_server.py # Python embedding server (Flask)
│   │   ├── prompts/             # System prompts for LLM generation
│   │   ├── errors/index.js     # Custom error classes (NotFoundError, ValidationError)
│   │   └── templates/           # EJS lesson plan template
│   ├── tests/                  # Vitest + supertest tests
│   ├── Dockerfile              # Server Docker image
│   ├── docker-entrypoint.sh    # Server container startup script
│   ├── vitest.config.js
│   └── package.json
├── client/                      # React SPA (Vite)
│   ├── src/
│   │   ├── App.jsx              # Router + layout
│   │   ├── main.jsx             # React entry point
│   │   ├── App.css              # Global styles
│   │   ├── api/useApi.js        # Fetch wrapper with JWT refresh
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx  # JWT context provider
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── AdminRoute.jsx
│   │   ├── layouts/AppLayout.jsx # Sidebar + outlet
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── SetupPasswordPage.jsx
│   │       ├── DashboardPage.jsx
│   │       ├── MyClassesPage.jsx
│   │       ├── KBBrowserPage.jsx
│   │       ├── LessonLibraryPage.jsx
│   │       ├── SettingsPage.jsx
│   │       ├── PersonalizePage.jsx   # 4-step stepper wizard
│   │       ├── WorkspacePage.jsx     # 3-column workspace
│   │       ├── PrintPage.jsx
│   │       ├── AdminDashboardPage.jsx
│   │       ├── AdminTeachersPage.jsx
│   │       └── AdminClassesPage.jsx
│   ├── Dockerfile              # Client + nginx Docker image
│   ├── nginx.default.conf      # Nginx reverse proxy config
│   └── package.json
├── embed-server/                # Python embedding service Docker image
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml          # Multi-service orchestration
├── .env.docker.example         # Docker environment variable template
├── .dockerignore               # Docker build exclusions
├── scripts/                     # Utility scripts (KB ingestion, data seeding)
├── uploads/                     # Uploaded lesson files and edits
├── Knowledge Bases/             # Source KB documents for RAG
├── Sample Lessons/              # Sample .docx/.pptx/.pdf lesson files
└── docs/                        # Project documentation
```

## API Overview

All routes are prefixed with `/api`. Authentication uses JWT Bearer tokens.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get access + refresh tokens |
| PUT | `/api/auth/setup-password` | Set password for seeded teacher |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke tokens |
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/teachers/:id/dashboard` | Teacher dashboard with metrics |
| GET | `/api/teachers/:id/classes` | Classes with nested students |
| GET | `/api/teachers/:id/profile` | Teacher profile |
| PUT | `/api/teachers/:id/profile` | Update teacher profile |
| PATCH | `/api/teachers/:id/students/:sid` | Update student cluster |
| GET/PUT | `/api/teachers/:id/llm-config` | LLM provider configuration |
| GET | `/api/lessons` | List/search lessons |
| GET | `/api/clusters` | List clusters with counts |
| PUT | `/api/clusters/:id/kbs` | Update cluster-KB assignments |
| GET | `/api/knowledge-bases` | List KBs |
| POST | `/api/adapt` | Generate adapted lesson plan |
| GET | `/api/adaptations/:id` | Get adaptation with head version |
| GET | `/api/adaptations/:id/versions` | List all versions |
| GET | `/api/adaptations/:id/versions/:vid` | Get version detail |
| POST | `/api/adaptations/:id/refine` | Refine with feedback |
| POST | `/api/adaptations/:id/rollback` | Rollback to a previous version |
| POST | `/api/adaptations/:id/feedback` | Submit feedback for an adaptation |
| GET | `/api/adaptations/:id/versions/:vid/print` | Print-friendly HTML |
| GET | `/api/adaptations/:id/versions/:vid/export.html` | Export as HTML |
| GET | `/api/adaptations/:id/versions/:vid/export-docx` | Export as DOCX |
| GET | `/api/adaptations/:id/versions/:vid/export-pdf` | Export as PDF |
| POST | `/api/file-edits` | AI-edit a source file |
| GET | `/api/file-edits/lessons/:id/sources` | List available source files |
| GET | `/api/lesson-file-edits/:filename` | Download an edited file |
| GET | `/api/institutions/:id/*` | Admin overview, teacher list |

**Note on LLM providers:** The settings UI allows teachers to save configurations for `openrouter`, `openai`, `anthropic`, or `gemini`. The adaptation engine currently routes all generation through the OpenRouter provider, using the configured API key and model.

## Environment Variables

Server variables are loaded from `server/.env` in local development, or from the root `.env` file in Docker.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes* | `dev-secret-change-in-production` | Secret for signing JWT tokens |
| `ENCRYPTION_KEY` | Yes* | — | 64-char hex string for AES-256-GCM encryption of stored LLM API keys |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |
| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB server URL for vector storage |
| `EMBED_SERVER_URL` | No | `http://127.0.0.1:9876/embed` | Python embedding server URL |

*Required for production. Dev defaults work for local development.

**Docker-only variables** (set in `.env.docker.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADAPT_PORT` | No | `80` | Host port exposed by the nginx container |
| `ADAPT_EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | Sentence-transformers model for embeddings |
| `ADAPT_GEMINI_API_KEY` | No | — | Not currently used by the server |
| `ADAPT_SECRET_KEY` | No | auto | Not currently used by the server |

## Running Tests

```bash
cd server && npm test
```

129 tests across 12 files using Vitest + supertest. Tests run in-process (no separate server needed).

```bash
# Run with verbose output
cd server && npx vitest run --reporter=verbose

# Run with coverage
cd server && npm run test:coverage

# Watch mode
cd server && npm run test:watch
```

## License

Licensed under ISC (see `server/package.json`).
