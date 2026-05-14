<!-- generated-by: gsd-doc-writer -->

# Deployment

ADAPT is designed to be deployed as a multi-container Docker Compose application. It is not currently configured for serverless platforms or Kubernetes.

## Deployment Targets

### Docker Compose (Recommended)

The primary deployment target is Docker Compose. The stack consists of four services defined in [`docker-compose.yml`](../docker-compose.yml):

| Service | Dockerfile / Image | Purpose | Exposed Port |
|---------|-------------------|---------|-------------|
| `nginx` | [`client/Dockerfile`](../client/Dockerfile) | Serves the React SPA and reverse-proxies API requests | `ADAPT_PORT` (default `80`) |
| `server` | [`server/Dockerfile`](../server/Dockerfile) | Express 5 API server + SQLite database | Internal only (`3000`) |
| `embed-server` | [`embed-server/Dockerfile`](../embed-server/Dockerfile) | Python sentence-transformers embedding service | Internal only (`9876`) |
| `chromadb` | `chromadb/chroma:latest` | Vector store for RAG retrieval | Internal only (`8000`) |

Only the `nginx` container exposes a port to the host. All other services communicate over an internal Docker network.

**RAG services (`embed-server` and `chromadb`) are optional.** They are gated behind the `rag` Compose profile and only started when you explicitly request them. See [DOCKER.md](DOCKER.md) for details on running with the RAG pipeline.

### Manual / VPS Deployment

You can also deploy the server and client manually on a VPS or bare-metal server:

1. Build the client static files (`npm run build` in `client/`)
2. Serve `client/dist/` with nginx or any static file server
3. Run `server/src/server.js` with Node.js 22+ (`npm install && npm start` in `server/`)
4. Configure nginx to reverse-proxy `/api/` and `/uploads/` to the backend

No automation scripts are provided for this path. You must manage process supervision (e.g., `pm2`, `systemd`) and SSL termination yourself.

## Build Pipeline

No CI/CD pipeline is detected in the repository. The project does not include GitHub Actions, GitLab CI, or other automated deployment workflows.

### Local Build Steps

To produce the deployment artifact locally:

1. **Configure secrets**
   ```bash
   cp .env.docker.example .env
   # Edit .env — set JWT_SECRET and ENCRYPTION_KEY
   ```

2. **Build images**
   ```bash
   docker compose build
   ```

3. **Start services**
   ```bash
   docker compose up -d
   ```

The Docker build process uses multi-stage builds for both the client and server to keep final images small:

- **Client**: Node 22 slim → builds the React SPA → copies `dist/` into an nginx 1.27 slim image
- **Server**: Node 22 slim → installs dependencies → copies only runtime artifacts into a fresh Node 22 slim image
- **Embed Server**: Python 3.12 slim → installs PyTorch CPU + sentence-transformers → caches the model weights at build time

## Environment Setup

Before deploying, you must set the required secrets. See [CONFIGURATION.md](CONFIGURATION.md) for the complete environment variable reference.

### Required Secrets

| Variable | How to Generate | Used By |
|----------|----------------|---------|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Server — signs JWT access tokens |
| `ENCRYPTION_KEY` | Same command as above | Server — AES-256-GCM encryption of stored LLM API keys |

These values **must** be set in the `.env` file at the project root before running `docker compose up`. The application will fail to start if `JWT_SECRET` or `ENCRYPTION_KEY` are missing in production.

### Optional Overrides

| Variable | Default | When to Change |
|----------|---------|----------------|
| `ADAPT_PORT` | `80` | If port 80 is already in use on the host |
| `ADAPT_EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | If you want a different sentence-transformers model |

### Docker-Internal Variables

The following are hard-coded in `docker-compose.yml` and should not be changed:

| Variable | Value | Reason |
|----------|-------|--------|
| `NODE_ENV` | `production` | Required for production optimizations |
| `PORT` | `3000` | Internal server port inside the container |
| `CHROMA_URL` | `http://chromadb:8000` | Internal Docker DNS name |
| `EMBED_SERVER_URL` | `http://embed-server:9876/embed` | Internal Docker DNS name |

## Rollback Procedure

No automated rollback mechanism is configured. To revert a deployment:

1. **Stop the current stack**
   ```bash
   docker compose down
   ```

2. **Check out the previous commit**
   ```bash
   git checkout <previous-tag-or-commit>
   ```

3. **Rebuild and restart**
   ```bash
   docker compose up --build -d
   ```

4. **Preserve data** — The SQLite database and uploads live in the `server-data` Docker volume, which survives `docker compose down`. Rollbacks do not affect persisted data unless you explicitly delete the volume with `docker compose down -v`.

If you need to roll back the database schema as well, restore from a backup of the `server-data` volume or the `adapt.db` file.

## Monitoring

No application performance monitoring (APM) or error tracking is configured in the codebase. The following libraries were **not** detected in `package.json` dependencies:

- Sentry (`@sentry/*`)
- Datadog (`dd-trace`)
- New Relic (`newrelic`)
- OpenTelemetry (`@opentelemetry/*`)

### Available Observability Hooks

- **Server health check**: The `server` container exposes a Docker health check that polls `GET /api` every 15 seconds. You can monitor container health via `docker compose ps`.
- **Logs**: All services log to stdout/stderr. View them with:
  ```bash
  docker compose logs -f server
  docker compose logs -f nginx
  ```
- **SQLite**: The database file is stored in the `server-data` volume. You can inspect it by mounting the volume or copying the file out of the container.

If you add monitoring in production, instrument the Express server in `server/src/server.js` and the React client in `client/src/main.jsx`.

## SSL / HTTPS

The provided `docker-compose.yml` and nginx configuration do **not** include SSL/TLS termination. For production deployments:

- Place a reverse proxy (e.g., nginx, Traefik, Caddy) in front of the `nginx` container with SSL termination
- Or use a cloud load balancer (AWS ALB, GCP HTTPS LB, etc.) in front of the host port
- Update `CORS_ORIGINS` in `.env` to reflect your HTTPS domain

<!-- VERIFY: SSL configuration must be added by the deployer — no certificates or HTTPS config is included in the repository -->
