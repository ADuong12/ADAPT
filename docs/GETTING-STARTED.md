<!-- generated-by: gsd-doc-writer -->

# Getting Started

This guide walks you through installing, configuring, and running ADAPT locally for the first time.

## Prerequisites

- **Node.js 18+** — Required runtime for the Express server (`node --version` to verify)
- **npm 9+** — Package manager (bundled with Node.js)
- **Python 3.10+** — Required for the RAG embedding server (optional if not using RAG features)
- **Git** — For cloning the repository
- **An OpenRouter API key** — For LLM-powered lesson adaptation (or configure per-teacher keys in the UI)

Alternatively, **Docker** can run the entire application without installing Node.js or Python locally. See [DOCKER.md](DOCKER.md) for Docker setup.

## Installation Steps

### Option A: Docker (recommended)

The quickest way to get started. No Node.js or Python installation required.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ADAPT.git
cd ADAPT

# 2. Create your environment file
cp .env.docker.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY

# 3. Build and start
docker compose up --build -d
```

Open **http://localhost** in your browser.

To include the RAG pipeline (embedding server + ChromaDB):

```bash
docker compose --profile rag up --build -d
```

See [DOCKER.md](DOCKER.md) for full Docker documentation, including configuration, data persistence, and troubleshooting.

### Option B: Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-org/ADAPT.git
cd ADAPT
```

### 2. Install server dependencies

```bash
cd server
npm install
```

This installs Express 5, better-sqlite3, bcryptjs, jsonwebtoken, Vitest, and all other dependencies.

### 3. Install client dependencies

```bash
cd ../client
npm install
```

This installs React 19, React Router v7, Vite, and related dev dependencies.

### 4. Configure environment variables

```bash
cd ../server
cp .env.example .env
```

Edit `server/.env` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes (prod) | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | Yes (prod) | 64-char hex string for AES-256-GCM. Generate same way as `JWT_SECRET`. |
| `OPENROUTER_API_KEY` | No | Fallback OpenRouter key. Teachers can also configure their own via Settings UI. |
| `PORT` | No | Defaults to `3000`. |
| `CORS_ORIGINS` | No | Defaults to `http://localhost:3000,http://localhost:5173`. |

The dev default `JWT_SECRET` (`dev-secret-change-in-production`) works for local development.

### 5. Initialize the database

The SQLite database is initialized automatically when the server starts. `server/src/db/init.js` reads `adapt-database.sql` from the project root and creates all tables with seed data. No manual migration step is needed.

The admin user (Robert Chen) receives a default password (`admin123`) via the seed step.

### 6. (Optional) Set up the RAG pipeline

If you want to use knowledge base retrieval features:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the ChromaDB server
chroma run --path ./chroma_data --port 8000

# Start the embedding server
python server/src/services/rag/embed_server.py

# Ingest knowledge base documents
python scripts/ingest_kbs.py
```

The RAG pipeline is optional — lesson adaptation works without it (just without KB-retrieved context).

## First Run

### Start the backend

```bash
cd server
npm run dev
```

This starts the Express server with nodemon hot reload on `http://localhost:3000`.

Or for production mode:

```bash
cd server
npm start
```

### Start the frontend

In a separate terminal:

```bash
cd client
npm run dev
```

The React app starts on `http://localhost:5173` and proxies API requests to the backend.

### First-time setup in the UI

1. Open **http://localhost:5173** in your browser.
2. Register a new account or log in with the seeded admin user:
   - Email: `robert.chen@westfield.edu`
   - Password: `admin123`
3. Go to **Settings** and configure your LLM provider:
   - Enter your OpenRouter API key
   - Optionally specify a model (defaults to `meta-llama/llama-3.1-8b-instruct:free`)
4. Go to **Lesson Library** and pick a lesson.
5. Go to **Personalize**, select a student cluster, and click **Generate** to create an adapted lesson plan.

## Common Setup Issues

### "ENCRYPTION_KEY not set" error

This error occurs when trying to save an LLM API key without the encryption key configured. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output to `server/.env` as `ENCRYPTION_KEY=<your-key>`.

### "No LLM configured" error

Either:
- Set `OPENROUTER_API_KEY` in `server/.env` as a fallback, **or**
- Configure an API key in the **Settings** page of the UI.

### Port already in use

If port 3000 or 5173 is already in use:
- Change `PORT` in `server/.env` for the backend
- The Vite dev server will proxy API requests to the backend port automatically

### ChromaDB connection errors

If using RAG features and seeing connection errors:
- Ensure ChromaDB is running: `chroma run --path ./chroma_data --port 8000`
- Ensure the embedding server is running: `python server/src/services/rag/embed_server.py`
- Re-ingest KB documents: `python scripts/ingest_kbs.py`

## Next Steps

- **[Architecture](ARCHITECTURE.md)** — Understand the system design and component layout.
- **[Configuration](CONFIGURATION.md)** — Full reference for all environment variables and config options.
- **[Development](DEVELOPMENT.md)** — Setting up a dev environment, code style, and adding features.
- **[Testing](TESTING.md)** — Running and writing tests.
- **[API Reference](API.md)** — Complete endpoint documentation.