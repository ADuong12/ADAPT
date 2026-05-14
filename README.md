<!-- generated-by: gsd-doc-writer -->

# ADAPT

**AI-Driven Personalized Lesson Planning Tool** — a Node.js/Express 5 + React SPA that uses RAG and LLMs (via OpenRouter) to adapt K-12 CS lessons for diverse learner clusters.

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/ADAPT.git
cd ADAPT

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Set up environment variables
cp ../.env.example ../.env
# Edit .env — set JWT_SECRET, ENCRYPTION_KEY, OPENROUTER_API_KEY

# Initialize the database with seed data
cd ../server && npm run seed

# Start backend (port 3000)
cd server && npm run dev

# Start frontend (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173** in your browser.

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Backend | Express 5, better-sqlite3 |
| Frontend | React 18, Vite, React Router v6 |
| Auth | bcryptjs + JWT (access + refresh tokens) |
| Encryption | AES-256-GCM for LLM API keys |
| LLM | OpenRouter (multi-model access) |
| RAG | ChromaDB + sentence-transformers (embedded Python service) |
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
│   │   │   └── seed.js         # Seed data
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
│   │   │   ├── source-editor.js # DOCX/PPTX/PDF AI editing
│   │   │   ├── auth.js         # Token management (access + refresh)
│   │   │   ├── crypto.js       # AES-256-GCM encrypt/decrypt/redact
│   │   │   └── llm/openrouter.js # OpenRouter provider
│   │   ├── rag/
│   │   │   ├── retriever.js    # Semantic KB retrieval
│   │   │   ├── chunker.py      # Document chunking (Python)
│   │   │   ├── embedder.py     # Sentence-transformers embedding (Python)
│   │   │   └── store.py       # ChromaDB vector store (Python)
│   │   ├── errors/index.js     # Custom error classes (NotFoundError, ValidationError)
│   │   └── templates/           # EJS lesson plan template
│   ├── tests/                  # Vitest + supertest tests
│   │   ├── setup.js             # Test DB cleanup
│   │   ├── helpers.js           # generateToken, authHeader utilities
│   │   ├── auth.test.js         # Auth endpoint tests
│   │   ├── middleware.test.js   # JWT + RBAC middleware tests
│   │   ├── crypto.test.js       # Encryption unit tests
│   │   ├── protected-routes.test.js
│   │   └── routes/             # Per-route integration tests
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
│   └── package.json
├── Knowledge Bases/             # Source KB documents for RAG
├── Sample Lessons/              # Sample .docx/.pptx/.pdf lesson files
└── .env.example                # Environment variable template
```

## API Overview

All routes are prefixed with `/api`. Authentication uses JWT Bearer tokens.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get access + refresh tokens |
| PUT | `/api/auth/setup-password` | Set password for seeded teacher |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke tokens |
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/teachers/:id/dashboard` | Teacher dashboard with metrics |
| GET | `/api/teachers/:id/classes` | Classes with nested students |
| PATCH | `/api/teachers/:id/students/:sid` | Update student cluster |
| GET/PUT | `/api/teachers/:id/llm-config` | LLM provider configuration |
| GET | `/api/lessons` | List/search lessons |
| GET | `/api/clusters` | List clusters with counts |
| PUT | `/api/clusters/:id/kbs` | Update cluster-KB assignments |
| GET | `/api/knowledge-bases` | List KBs |
| POST | `/api/adapt` | Generate adapted lesson plan |
| GET/POST | `/api/adaptations/:id/*` | Get, refine, rollback, feedback, print, export |
| POST | `/api/file-edits` | AI-edit a source file |
| GET | `/api/institutions/:id/*` | Admin overview, teacher list |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes* | `dev-secret-change-in-production` | Secret for signing JWT tokens |
| `ENCRYPTION_KEY` | Yes* | — | AES-256-GCM key for encrypting stored LLM API keys |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key for LLM calls |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |

*Required for production. Dev defaults work for local development.

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

No license file detected — see repository for license information.