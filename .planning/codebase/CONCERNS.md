# Codebase Concerns

**Analysis Date:** 2026-05-11

## Tech Debt

**Fake Authentication System:**
- Issue: Auth is explicitly labeled "MVP fakeauth" — it trusts the `X-Teacher-Id` header with no password, token, or session validation. Any client can impersonate any teacher by changing one HTTP header.
- Files: `backend/deps.py` (lines 10-20), `backend/routers/auth.py` (lines 15-38)
- Impact: Complete authorization bypass. A malicious actor can access/modify any teacher's data, settings, and LLM API keys. Admin-only endpoints (institution overview, teacher list) are trivially accessible.
- Fix approach: Replace with real authentication (JWT, OAuth2, or session-based). The `current_teacher` dependency in `backend/deps.py` should be swapped to decode a real token rather than reading a header.

**No Database Migrations:**
- Issue: Schema changes use a raw SQL script (`adapt-database.sql`) applied by `scripts/migrate.py` with no version tracking beyond `IF NOT EXISTS`. There is no migration history table, no rollback capability, and no integration with the app startup.
- Files: `scripts/migrate.py`, `adapt-database.sql`
- Impact: Schema drift across environments. Parallel developers may have different DB states. No way to apply incremental changes safely.
- Fix approach: Introduce Alembic (SQLAlchemy's migration tool). Create an `alembic/` directory, auto-generate initial migration from `backend/models.py`, and add a startup check in `backend/main.py` that warns if migrations are pending.

**LLM Response Parsing Fragility:**
- Issue: `_coerce_to_plan_json()` in `backend/services/adaptation.py` and `_parse_items()` in `backend/services/source_editor.py` both use permissive heuristics to extract JSON from LLM output. When parsing fails, `_coerce_to_plan_json` silently returns a stub with `"Model returned malformed JSON"` rather than surfacing the error to the user.
- Files: `backend/services/adaptation.py` (lines 113-146), `backend/services/source_editor.py` (lines 173-187)
- Impact: Users may receive a lesson plan rendered from stub data without realizing the LLM failed. No metric tracks failure rates.
- Fix approach: Return a structured error from the adaptation flow when JSON parsing fails, storing the raw LLM output for debugging. Add a `parsing_failed` flag to `LessonPlanVersion` or the response payload. Consider using structured output / JSON mode from LLM providers that support it.

**Hard-Coded KB File Map in Ingestion Script:**
- Issue: `scripts/ingest_kbs.py` hard-codes a `KB_FILE_MAP` dictionary mapping database IDs to filenames. If the database is re-seeded or new KBs are added, this script breaks silently (files are skipped, not errored).
- Files: `scripts/ingest_kbs.py` (lines 24-29)
- Impact: Knowledge base ingestion diverges from DB state over time. New KBs added to the DB but not to the map are silently skipped.
- Fix approach: Read the KB-to-file mapping from a config file or from the database itself. Add an `ingest_source` column to `KnowledgeBase` and populate it during seeding.

**No Pagination on List Endpoints:**
- Issue: Every list endpoint returns the full result set (lessons, clusters, KBs, teachers, versions, roster). The dashboard endpoint loads students, adaptations, and class metadata in a single request with no limit.
- Files: `backend/routers/lessons.py`, `backend/routers/clusters.py`, `backend/routers/knowledge_bases.py`, `backend/routers/teachers.py`
- Impact: Performance degrades linearly as data grows. A teacher with hundreds of students will face slow dashboard loads.
- Fix approach: Add `skip`/`limit` query parameters to all list endpoints. For the dashboard, consider lazy-loading the roster.

## Known Bugs

**Feedback Endpoint Authorization Inconsistency:**
- Symptoms: `POST /api/adaptations/{adapted_id}/feedback` checks `adapted.teacher_id != teacher.teacher_id` without allowing admin override, while all other adapted-lesson endpoints allow admins to view/modify any adaptation.
- Files: `backend/routers/adaptations.py` (lines 165-180)
- Trigger: An admin user (role="admin") attempts to submit feedback on a different teacher's adaptation. The endpoint returns 403.
- Workaround: None currently. The admin override check (`teacher.role != "admin"`) used in the read endpoints is simply missing from the feedback handler.

**`session_scope` Doesn't Roll Back on Explicit Commit:**
- Symptoms: If `session_scope()` is used and the `db.commit()` on line 38 succeeds but a subsequent operation raises before `db.close()`, the transaction is committed but the caller may not realize the state is incomplete.
- Files: `backend/db.py` (lines 33-42)
- Trigger: Multiple write operations wrapped in a single `session_scope` where a mid-sequence error occurs after commit.
- Workaround: Most routes use `Depends(get_db)` (session-per-request) rather than `session_scope`, so this is not currently hit in practice.

**Versioning Race Condition:**
- Symptoms: If two adaptation/refine requests for the same `adapted_id` arrive concurrently, `next_version_number()` could return the same number for both, causing a `UniqueConstraint` violation on `(adapted_id, version_number)`.
- Files: `backend/services/versioning.py` (lines 32-34)
- Trigger: Concurrent HTTP requests to `/api/adapt` or `/api/adaptations/{id}/refine` for the same lesson.
- Workaround: SQLite serializes writes, so this is unlikely under single-server deployment, but it will surface under concurrent load or if switching to PostgreSQL.

**`os.chmod` No-Op on Windows:**
- Symptoms: On Windows, `os.chmod(_KEY_FILE, 0o600)` silently does nothing. The `.secret_key` file containing the Fernet encryption key is left with default permissions, meaning any user on the system can read it.
- Files: `backend/security.py` (line 23)
- Trigger: Running ADAPT on Windows. The `.secret_key` file is world-readable.
- Workaround: Manually set file permissions or restrict directory permissions.

## Security Considerations

**Header-Based Authentication:**
- Risk: An attacker who can observe HTTP traffic or inject headers can impersonate any teacher. Combined with CORS `allow_origins=["*"]`, this means any website can make requests as any teacher.
- Files: `backend/deps.py`, `backend/config.py` (line 36: `cors_origins: list[str] = ["*"]`)
- Current mitigation: The system is intended for "MVP" / local network use.
- Recommendations: (1) Replace fake auth with real auth. (2) Restrict `cors_origins` to the actual frontend origin. (3) Add CSRF protection if using cookie-based auth.

**CORS Wildcard:**
- Risk: `allow_origins=["*"]` combined with `allow_credentials=True` is rejected by browsers for credentialed requests, but the intent is still insecure. Without real auth, any origin can read all API data.
- Files: `backend/config.py` (line 36), `backend/main.py` (lines 14-20)
- Current mitigation: None.
- Recommendations: Set `cors_origins` to `["http://localhost:8000"]` for development and the production domain for deployment. If multi-origin is needed, use a list of specific origins.

**LLM API Keys Stored Encrypted but Decrypted from DB:**
- Risk: API keys are encrypted at rest with Fernet, but they are decrypted in memory on every LLM request. If an attacker gains read access to the database, they still can't use the keys directly (good), but application logs or error traces could leak decrypted keys.
- Files: `backend/security.py`, `backend/services/adaptation.py` (line 32: `decrypt(cfg.api_key_encrypted)`)
- Current mitigation: Keys are not logged. Fernet provides symmetric encryption at rest.
- Recommendations: (1) Ensure no logging of LLM request bodies. (2) Consider using environment-sealed vaults (HashiCorp Vault, AWS Secrets Manager) for production. (3) Add a `.env`-driven flag to redact keys in any debug logs.

**Secret Key Auto-Generation with Weak File Permissions:**
- Risk: On first run, a Fernet key is generated and written to `.secret_key` in the project root. On Unix, `os.chmod(0o600)` restricts read to owner. On Windows (primary platform per `start_server.py`), the file is world-readable.
- Files: `backend/security.py` (lines 13-25)
- Current mitigation: `.secret_key` is listed in `.gitignore`.
- Recommendations: Use platform-appropriate ACLs on Windows (`icacls`). Better yet, require `ADAPT_SECRET_KEY` env var in production rather than falling back to file storage.

**No Rate Limiting on LLM-Calling Endpoints:**
- Risk: Endpoints `/api/adapt`, `/api/adaptations/{id}/refine`, and `/api/lessons/{id}/edit-source-file` call external LLM APIs that cost money per token. Without rate limiting, a single user (or attacker) can rack up significant API costs.
- Files: `backend/routers/adaptations.py`, `backend/routers/lessons.py`, `backend/services/adaptation.py`
- Current mitigation: None.
- Recommendations: Add per-teacher rate limiting (e.g., `slowapi` middleware) limiting adaptation requests to N/hour. Consider a per-teacher token budget tracked in the DB.

**No HTTPS Enforcement:**
- Risk: `start_server.py` starts uvicorn on `0.0.0.0:8000` with no TLS. All data — including LLM API keys in settings requests — is transmitted in plaintext.
- Files: `start_server.py` (line 34)
- Current mitigation: Intended for local development only.
- Recommendations: In production, use a reverse proxy (nginx/Caddy) with TLS termination. Add an `ADAPT_BASE_URL` config and redirect HTTP to HTTPS.

**Path Traversal Mitigation in Source Editor — Incomplete:**
- Risk: `_resolve_source_path` checks that `base` is in `candidate.parents`, but the download endpoint in `file_edits.py` calls `source_editor.edited_file_path()` which checks `EDIT_DIR.resolve() not in path.parents`. The check `path.parents` does not include `path` itself, so `EDIT_DIR / "file.docx"` would have `EDIT_DIR` in its parents correctly. However, symlinks and case-insensitive paths on Windows could bypass this check.
- Files: `backend/services/source_editor.py` (lines 39-46, 372-376), `backend/routers/file_edits.py` (lines 12-17)
- Current mitigation: Basic path resolution is present.
- Recommendations: Use `is_relative_to()` (Python 3.9+) instead of parent-set membership for clearer semantics. Validate exact suffixes. On Windows, normalize case before comparison.

## Performance Bottlenecks

**Full Filesystem Walk on Source File Listing:**
- Problem: `source_files_for_lesson()` calls `settings.sample_lessons_dir.rglob("*")` on every request, scanning the entire `Sample Lessons/` directory tree. No caching, no indexing.
- Files: `backend/services/source_editor.py` (lines 49-72)
- Cause: Each `GET /api/lessons/{id}/source-files` triggers a full directory walk. With many lesson files, this grows linearly.
- Improvement path: Cache the file listing (e.g., in-memory with TTL or on startup). Store source-to-lesson mappings in the DB rather than relying on filename token matching.

**N+1 Queries on Dashboard and Class Endpoints:**
- Problem: `GET /api/teachers/{id}/classes` executes one query per class to load students, leading to 1+N queries. The dashboard endpoint at `backend/routers/teachers.py` executes 5+ separate queries and loads the entire roster.
- Files: `backend/routers/teachers.py` (lines 127-163), `backend/routers/teachers.py` (lines 27-124)
- Cause: ORM relationship loading is done manually with separate queries per entity. No eager loading (`selectinload` / `joinedload`) is used.
- Improvement path: Rewrite with joined queries or use SQLAlchemy's `selectinload` to batch-load relationships. For the dashboard, combine the count queries into a single query with multiple CTEs.

**Synchronous LLM Calls Block the Worker:**
- Problem: All LLM provider calls (`generate()`) are synchronous HTTP/blocking calls. During adaptation, the entire worker thread is blocked waiting for the LLM response (which can take 10-120 seconds depending on the provider and prompt size).
- Files: `backend/llm/gemini.py`, `backend/llm/openrouter.py`, `backend/llm/huggingface.py`
- Cause: No `async`/`await` pattern. FastAPI defaults to a threadpool, but with only a few workers, long LLM calls can exhaust them.
- Improvement path: (1) Convert LLM calls to `async` using `httpx.AsyncClient` and `asyncio`. (2) Use `run_in_threadpool` for the synchronous `google.generativeai` SDK. (3) Add configurable timeout per provider.

**Embedding Model Load on First Request:**
- Problem: `embedder.get_model()` uses `@lru_cache(maxsize=1)`, meaning the first RAG retrieval request incurs a cold-start penalty of downloading and loading the `all-MiniLM-L6-v2` model (~80MB). Subsequent calls are fast.
- Files: `backend/rag/embedder.py` (lines 8-11)
- Cause: Lazy initialization. On first request after server start, the user sees a long delay.
- Improvement path: Add a startup event in `backend/main.py` that calls `embedder.get_model()` to warm the cache before accepting requests. Show a loading indicator in the frontend.

**No Database Connection Pooling Configuration:**
- Problem: SQLAlchemy uses default pool settings for SQLite. The `connect_args={"check_same_thread": False}` allows cross-thread usage but disables SQLite's built-in thread safety.
- Files: `backend/db.py` (lines 16-20)
- Cause: SQLite with `check_same_thread=False` is a known compromise for ASGI frameworks. Under concurrent writes, SQLite may throw `OperationalError: database is locked`.
- Improvement path: For production, migrate to PostgreSQL with proper connection pooling. For SQLite, consider `StaticPool` or switching to `aiosqlite`.

## Fragile Areas

**LLM Output Format Dependency:**
- Files: `backend/services/adaptation.py` (lines 113-146), `backend/services/source_editor.py` (lines 173-187), `backend/prompts/system.txt`
- Why fragile: The entire adaptation pipeline depends on LLMs returning valid JSON matching a specific schema. LLMs frequently wrap JSON in markdown fences, add prose, or truncate output. The fallback in `_coerce_to_plan_json` silently creates stub data. If the LLM provider changes its output pattern, the pipeline breaks silently.
- Safe modification: If modifying `system.txt` prompt formatting or adding new LLM providers, always test with real outputs. Add integration tests that mock LLM responses and verify the parsing pipeline. Consider adding `response_format={"type": "json_object"}` for providers that support it.
- Test coverage: No unit tests exist for `_coerce_to_plan_json` or `_parse_items`.

**Version Create / Rollback Logic:**
- Files: `backend/services/versioning.py`
- Why fragile: `create_version` reads all existing versions to find the next number and to demote the current head. If two requests interleave, the `is_head` flag or version number can be corrupted. `rollback_to` also iterates all versions to reset `is_head`, with no DB-level advisory lock.
- Safe modification: Any change to version creation should wrap the read-max-insert cycle in a single DB transaction with `SELECT ... FOR UPDATE` (PostgreSQL) or a table-level lock (SQLite). Consider using a DB sequence for version numbers instead of max+1.
- Test coverage: The integration test in `tests/test_api.py` tests rollback only sequentially.

**Teacher Authorization Checks:**
- Files: `backend/routers/adaptations.py`, `backend/routers/teachers.py`, `backend/routers/settings.py`
- Why fragile: Authorization is hand-coded in each endpoint with slightly different patterns. Some use `_ensure_self_or_admin`, some use `_ensure_self`, some inline the check. The adaptation endpoints have a consistent pattern (`if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin"`) but the feedback endpoint omits the admin override.
- Safe modification: Extract a shared `can_access_adaptation(teacher, adapted)` function. Standardize admin override semantics across all endpoints.
- Test coverage: Only the most basic auth checks are tested (wrong teacher returns 403). Edge cases (admin accessing another teacher's feedback) are not tested.

**Frontend-Backend Auth Contract:**
- Files: `adapt-frontend-prototype-echristian-aduong/api.js`, `adapt-frontend-prototype-echristian-aduong/auth.js`
- Why fragile: The frontend stores `currentTeacherId` in `localStorage` and sends it as the `X-Teacher-Id` header on every request. There is no session expiry, no token verification, and no server-issued auth token. If `localStorage` is modified (trivial in any browser DevTools), the user becomes a different teacher.
- Safe modification: When replacing the auth system, both `api.js` and `auth.js` must be updated simultaneously. Any change to the header name or auth mechanism requires a coordinated deploy.
- Test coverage: Frontend code has no tests at all.

**Source File Editing Pipeline:**
- Files: `backend/services/source_editor.py`
- Why fragile: The file editing pipeline reads source files from `Sample Lessons/`, splits them into text blocks, sends each block through the LLM for rewriting, and writes the result to a new file in `uploads/lesson_edits/`. The LLM is expected to return a JSON object with `{items: [{id, text}]}`. If it doesn't, the entire batch fails with a generic `RuntimeError`. PDF editing is lossy — it regenerates the entire document as text with reportlab, losing original formatting.
- Safe modification: When adding new file types, ensure the `_blocks` extraction and `_rewrite_texts` roundtrip work correctly. Test with real .docx and .pptx files that have unusual structures (tables, embedded objects, images).
- Test coverage: No unit tests for source file editing.

## Scaling Limits

**SQLite Write Throughput:**
- Current capacity: Suitable for ~10 concurrent users on a single server.
- Limit: SQLite serializes writes. Under concurrent LLM-call durations (10-120s), writes accumulate and eventually hit `database is locked` errors.
- Scaling path: Migrate to PostgreSQL. The SQLAlchemy ORM layer makes this straightforward — change `backend/db.py` connection string and add PostgreSQL to deployment.

**ChromaDB Embedded Mode:**
- Current capacity: Single-process, local disk storage for vector embeddings.
- Limit: ChromaDB in embedded mode (`chromadb.PersistentClient`) is not designed for concurrent access from multiple processes. If the server is deployed with multiple workers, each worker may corrupt the ChromaDB data.
- Scaling path: Use `chromadb.HttpClient` with a standalone ChromaDB server, or switch to a managed vector database (Pinecone, Weaviate, pgvector).

**LLM Provider Rate Limits:**
- Current capacity: Depends on provider API tier. Free-tier OpenRouter (Llama 3.1 8B) has a 20 RPM / 1000 RPD limit.
- Limit: No rate limiting on the ADAPT side means a single rapid-fire user can exhaust the provider's quota, blocking all other users.
- Scaling path: Implement per-teacher rate limiting. Add a `daily_token_budget` column to `Teacher` or `LLMProviderConfig`. Display remaining quota in the frontend.

**No Background Task Processing:**
- Current capacity: Adaptations are processed synchronously in the request handler.
- Limit: An adaptation request that calls the LLM can take 5-120 seconds. The HTTP connection stays open the entire time. If the client disconnects, the LLM call may still execute and charge tokens.
- Scaling path: Move LLM calls to a background task queue (Celery + Redis, or Python's `asyncio.create_task`). Return a `202 Accepted` immediately and provide a polling/WebSocket endpoint for status updates.

## Dependencies at Risk

**sentence-transformers Heavy Dependency:**
- Risk: `sentence-transformers` pulls in PyTorch (~2GB), which is the largest dependency by far. Cold-start time for embedding is 5-15 seconds on a typical laptop. On resource-constrained environments (Raspberry Pi, cloud free tiers), this may be prohibitive.
- Impact: First RAG request after server start is extremely slow. Entire application is heavier than necessary for users who don't need RAG.
- Migration plan: Consider using a hosted embedding API (OpenAI `text-embedding-3-small`, or a lightweight ONNX runtime model). Make the sentence-transformers dependency optional and add a config flag for remote embeddings.

**PyPDF2 is Deprecated:**
- Risk: `PyPDF2` (registered in `requirements.txt`) is a deprecated fork. The maintained successor is `pypdf` (no "2"). `pdfplumber` is already a dependency and is used as the primary PDF extractor in `chunker.py`; PyPDF2 is only used as a fallback.
- Impact: PyPDF2 won't receive security patches. Future Python versions may break it.
- Migration plan: Replace `PyPDF2` with `pypdf` in `requirements.txt`. The only usage is in `backend/rag/chunker.py` (line 33-36) as a fallback; just remove it and rely on `pdfplumber`.

**No Version Pinning on google-generativeai:**
- Risk: `google-generativeai==0.8.3` is pinned, but the SDK is under active development and the API surface (model names, `GenerativeModel` constructor, `usage_metadata`) may change between minor versions.
- Impact: A `pip install` that upgrades past the pinned version could break LLM integration silently.
- Migration plan: Pin to a tested major.minor range (e.g., `google-generativeai>=0.8,<0.10`) and test on each minor release.

## Missing Critical Features

**No Real Authentication:**
- Problem: The `X-Teacher-Id` header auth is explicitly temporary. No password, session, JWT, or OAuth flow exists.
- Blocks: Production deployment. Data isolation between teachers is not enforceable.

**No LLM Error Recovery or Retry:**
- Problem: If the LLM call fails (network timeout, rate limit, malformed response), the entire adaptation request fails with a 400 error. No retry logic, no fallback provider, no partial result storage.
- Blocks: Reliable teacher experience during LLM provider outages.

**No Automated Test Suite for Backend Logic:**
- Problem: The test suite in `tests/test_api.py` is an integration test that requires a running server and seeded database. There are no unit tests for services, routing logic, or data transformations.
- Blocks: Safe refactoring. Catching regressions before they hit the integration level.

**No Logging Framework:**
- Problem: The application has no structured logging. `print()` is used in `scripts/migrate.py` and `scripts/ingest_kbs.py`. The backend uses FastAPI's default uvicorn access logs but has no application-level request logging, error context, or audit trail.
- Blocks: Debugging production issues. Tracking LLM call durations, token usage, and failure rates.

**No Database Seeding from Application Startup:**
- Problem: Database initialization requires running `scripts/migrate.py` and `scripts/seed_versions.py` separately. If the server starts before seeding, it will serve empty data.
- Blocks: Smooth onboarding for new developers or clean deployments.

**No Admin UI for Managing Lessons, KBs, or Users:**
- Problem: There are admin endpoints for read-only institution statistics (`/api/institutions/{id}/overview|teachers|classes|clusters`), but no CRUD for lessons, knowledge bases, students, or teacher management. All data must be seeded via SQL.
- Blocks: Teachers cannot add their own lessons or manage their class rosters through the app.

## Test Coverage Gaps

**No Unit Tests for Services:**
- What's not tested: `backend/services/adaptation.py`, `backend/services/versioning.py`, `backend/services/source_editor.py`, `backend/services/renderer.py`
- Files: All service-layer files have zero test coverage.
- Risk: Core business logic (LLM prompt construction, JSON coercion, version management, file editing) can regress silently.
- Priority: High — these contain the most complex logic and the most fragile LLM-parsing code.

**No Unit Tests for RAG Pipeline:**
- What's not tested: `backend/rag/retriever.py`, `backend/rag/chunker.py`, `backend/rag/embedder.py`
- Files: RAG module has zero test coverage.
- Risk: Chunking logic bugs, embedding failures, and retrieval accuracy regressions go undetected.
- Priority: Medium — chunker has non-trivial regex-based heading detection; edge cases deserve tests.

**No Unit Tests for Security:**
- What's not tested: `backend/security.py` (Fernet encryption/decryption, redaction).
- Files: `backend/security.py` has zero test coverage.
- Risk: A bug in `encrypt()` or `decrypt()` could corrupt stored API keys with no recovery path.
- Priority: High — encryption correctness is critical.

**No Authorization Edge Case Tests:**
- What's not tested: Admin accessing other teacher's feedback, cross-teacher data leakage, header manipulation.
- Files: `tests/test_api.py` tests basic auth (401 without header, 403 wrong teacher) but not admin overrides on all endpoints.
- Risk: Broken admin access goes undetected.
- Priority: Medium.

**No Frontend Tests:**
- What's not tested: All HTML/JS files in `adapt-frontend-prototype-echristian-aduong/` (12 HTML files + 2 JS files).
- Files: Zero frontend test coverage.
- Risk: UI regressions and auth flow breakage are purely manual.
- Priority: Low for MVP, but should be addressed before production.

---

*Concerns audit: 2026-05-11*