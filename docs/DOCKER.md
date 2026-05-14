# Docker Setup

ADAPT can be run entirely with Docker and Docker Compose, no local Node.js or Python required.

## Architecture

```
Host :80
  └── nginx (React SPA + reverse proxy)
        ├── /       → React static files
        ├── /api/   → server:3000 (Express API)
        └── /uploads/ → server:3000 (file downloads)

server:3000 (Express API + SQLite)
embed-server:9876 (sentence-transformers)  [optional, --profile rag]
chromadb:8000   (vector store)              [optional, --profile rag]
```

All services communicate on an internal Docker network. Only the nginx container exposes a port to the host.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+, included with Docker Desktop)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/<org>/ADAPT.git
cd ADAPT

# 2. Create your .env file with secrets
cp .env.docker.example .env
# Edit .env — at minimum, set JWT_SECRET and ENCRYPTION_KEY:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate two separate hex strings — one for `JWT_SECRET` and one for `ENCRYPTION_KEY` — then paste them into `.env`:

```bash
# Example .env
JWT_SECRET=a1b2c3d4e5f6...your-64-char-hex-string
ENCRYPTION_KEY=f6e5d4c3b2a1...your-64-char-hex-string
```

```bash
# 3. Build and start (core app only, no RAG)
docker compose up --build -d

# 4. Open http://localhost in your browser
```

Log in with the seeded admin account:

- **Email**: `robert.chen@westfield.edu`
- **Password**: `admin123`

## With RAG Pipeline

To enable knowledge base retrieval features, start with the `rag` profile:

```bash
docker compose --profile rag up --build -d
```

This adds two extra containers:

| Service | Image | Purpose |
|---------|-------|---------|
| `embed-server` | Custom (Python + sentence-transformers) | Embeds text via HTTP on port 9876 |
| `chromadb` | `chromadb/chroma:latest` | Vector store on port 8000 |

The first build downloads and caches the sentence-transformers model (~80 MB), which takes a few minutes.

> **Note:** Ingesting knowledge base documents into ChromaDB must still be done manually after the rag stack is running. See [GETTING-STARTED.md](GETTING-STARTED.md) for ingestion instructions.

## Ports

| Service | Container Port | Host Port | Default |
|---------|---------------|-----------|---------|
| nginx | 80 | `ADAPT_PORT` env var | 80 |
| server | 3000 | (internal only) | — |
| embed-server | 9876 | (internal only) | — |
| chromadb | 8000 | (internal only) | — |

To run on a different host port (e.g., 8080):

```bash
ADAPT_PORT=8080 docker compose up --build -d
```

## Data Persistence

Docker named volumes store persistent data:

| Volume | Mount Point | Contents |
|--------|------------|----------|
| `server-data` | `/app/data` | SQLite database (`adapt.db`), uploads, secret key |
| `chroma-data` | `/app/data` | ChromaDB vector data (rag profile only) |

Volumes survive `docker compose down`. To delete all data:

```bash
docker compose down -v
```

## Commands Reference

```bash
# Start in detached mode
docker compose up -d

# Start with build (after code changes)
docker compose up --build -d

# Start with RAG
docker compose --profile rag up --build -d

# View logs
docker compose logs -f

# View server logs only
docker compose logs -f server

# Stop all containers
docker compose down

# Stop and remove volumes (deletes database)
docker compose down -v

# Rebuild a single service
docker compose build server
docker compose up -d server
```

## Environment Variables

See [`.env.docker.example`](../.env.docker.example) for the full list. Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | — | Secret for signing JWT tokens |
| `ENCRYPTION_KEY` | **Yes** | — | 64-char hex string for AES-256-GCM encryption |
| `ADAPT_GEMINI_API_KEY` | No | — | Fallback LLM API key |
| `ADAPT_SECRET_KEY` | No | auto | Fernet key for stored LLM keys (auto-generated if empty) |
| `ADAPT_PORT` | No | `80` | Host port for the nginx container |
| `ADAPT_EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | sentence-transformers model (rag profile only) |

In Docker, the following are set automatically and should not be changed:

| Variable | Docker Value | Notes |
|----------|-------------|-------|
| `NODE_ENV` | `production` | Set in docker-compose.yml |
| `PORT` | `3000` | Internal server port |
| `CHROMA_URL` | `http://chromadb:8000` | Internal DNS |
| `EMBED_SERVER_URL` | `http://embed-server:9876/embed` | Internal DNS |

## Troubleshooting

### Port 80 already in use

Change the host port:

```bash
ADAPT_PORT=8080 docker compose up -d
```

### Container health check failing

```bash
docker compose logs server
```

The server health check hits `GET /api` every 15 seconds. Check that `JWT_SECRET` and `ENCRYPTION_KEY` are set in `.env`.

### Database reset

To start fresh with seed data:

```bash
docker compose down -v
docker compose up --build -d
```

### RAG services not responding

If using `--profile rag`, check that the embed-server has finished loading the model (it logs `Model loaded` on startup):

```bash
docker compose logs embed-server
```

### Rebuilding after code changes

```bash
docker compose up --build -d
```

Docker caches layers — only changed layers are rebuilt.