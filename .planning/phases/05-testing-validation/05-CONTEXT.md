# Phase 5: Testing + Validation - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a comprehensive automated test suite covering all backend endpoints and auth flows. Tests must run in-process without a separately started server (TEST-04). Covers auth flows (register, login, JWT, RBAC), all CRUD endpoint tests, RAG pipeline tests with mocked services, and error handling/edge case coverage. Migrates existing test infrastructure from Jest to Vitest.

</domain>

<decisions>
## Implementation Decisions

### Test Framework & Migration
- **D-01:** Use Vitest as the test framework for the server test suite. Matches roadmap spec, aligns with client package (vitest@4.1.6 already installed), and provides built-in coverage, watch mode, and ESM support.
- **D-02:** Migrate existing 10 test files to Vitest-compatible syntax (import/assert style changes) and add new tests alongside them. Preserves existing test coverage while consolidating on one framework. The existing `node:test` imports (`{ describe, it, before, after }` from `node:test`) will be replaced with Vitest's global or import-based API.

### In-Process Test Setup
- **D-03:** Use supertest (already installed as dev dependency) to create an http.Server from the Express app internally. Each test file imports the Express app and uses `request(app).get('/api/...')` pattern. No separate server process needed — satisfies TEST-04.
- **D-04:** Use the shared `adapt.db` with existing seed data. Tests clean up after themselves using the existing `cleanTestTables()` pattern from setup.js. No in-memory DB or per-file DB isolation — simpler and matches current test conventions.
- **D-05:** Tests run in a defined sequential order — auth tests first (to obtain tokens), then CRUD endpoint tests, then RAG/adaptation integration tests. This matches the existing test pattern and avoids redundant token acquisition per file.

### RAG/LLM Mocking Strategy
- **D-06:** Mock the service-layer functions (adaptation.js, versioning.js, renderer.js, source-editor.js) for RAG and LLM tests. No real external services needed. The existing `MOCK_LLM_RESPONSE` and `MOCK_EMBEDDING` fixtures in setup.js carry forward as mock return values.
- **D-07:** Mocks intercept at the service-module level using Vitest's `vi.mock()` or `vi.spyOn()`. Routes exercise real middleware and route-handling code — only the service functions that call Python/ChromaDB/OpenRouter are mocked. This tests route logic + auth/RBAC enforcement without external dependencies.

### Test Scope & Coverage
- **D-08:** Test scope: core flows (happy paths) for all endpoints + error paths (401, 403, 404, 400 validation). Covers all 4 TEST requirements (TEST-01 through TEST-04) without exhaustive edge-case explosion.
- **D-09:** RBAC testing: every endpoint tested for (1) unauthenticated returns 401, (2) wrong-role/wrong-owner returns 403 where applicable, (3) admin bypass works. Per-endpoint auth enforcement, not just middleware-level.

### the agent's Discretion
- Exact test file organization within `server/tests/` (group by route, by feature, or keep current flat structure)
- How to structure the Vitest setup file (migrate setup.js to Vitest-compatible setup)
- Whether to use Vitest's global API or explicit imports
- Specific test cases within each endpoint's error-path coverage
- Naming conventions for test files and describe blocks
- Whether to add a coverage threshold configuration or leave it advisory

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Test Files (migration targets)
- `server/tests/setup.js` — Test fixtures (TEST_USER, MOCK_LLM_RESPONSE, MOCK_EMBEDDING) and cleanTestTables helper
- `server/tests/auth.test.js` — Auth endpoint tests: register, login, setup-password, refresh, logout
- `server/tests/middleware.test.js` — Auth/RBAC middleware unit tests: requireAuth, requireRole, requireOwnerOrAdmin
- `server/tests/protected-routes.test.js` — Protected route integration tests: 401/403 enforcement
- `server/tests/crypto.test.js` — Crypto service unit tests: encrypt, decrypt, redact
- `server/tests/routes/settings.test.js` — Settings/LLM config endpoint tests
- `server/tests/routes/teachers.test.js` — Teacher endpoint tests
- `server/tests/routes/admin.test.js` — Admin endpoint tests
- `server/tests/routes/lessons.test.js` — Lesson endpoint tests
- `server/tests/routes/clusters.test.js` — Cluster endpoint tests
- `server/tests/routes/knowledge-bases.test.js` — Knowledge base endpoint tests

### Server Route Files (test targets)
- `server/src/routes/index.js` — Route registration (all /api/* endpoints)
- `server/src/routes/auth.js` — Auth routes: register, login, refresh, logout, setup-password, me
- `server/src/routes/adaptations.js` — Adaptation routes: /adapt, /refine, /versions, /rollback, /feedback, /print, /export
- `server/src/routes/file-edits.js` — Source file editing routes
- `server/src/routes/lessons.js` — Lesson CRUD routes
- `server/src/routes/clusters.js` — Cluster CRUD routes
- `server/src/routes/knowledge-bases.js` — Knowledge base routes
- `server/src/routes/teachers.js` — Teacher dashboard/classes/profile routes
- `server/src/routes/settings.js` — LLM config routes
- `server/src/routes/admin.js` — Admin overview/teachers/classes/clusters routes

### Server Middleware & Services (test infrastructure)
- `server/src/middleware/auth.js` — JWT requireAuth middleware
- `server/src/middleware/rbac.js` — requireRole and requireOwnerOrAdmin middleware
- `server/src/services/adaptation.js` — Adaptation service (generate + refine — mock target)
- `server/src/services/versioning.js` — Versioning service (head pointer, rollback — mock target)
- `server/src/services/renderer.js` — EJS rendering service (mock target)
- `server/src/services/source-editor.js` — Source file editor (mock target)
- `server/src/services/crypto.js` — AES-256-GCM encrypt/decrypt/redact
- `server/src/db/index.js` — better-sqlite3 database instance
- `server/src/config/index.js` — Configuration (jwtSecret, etc.)

### Database Schema
- `adapt-database.sql` — Full DDL for all tables

### Test Configuration
- `server/jest.config.js` — Current Jest config (to be replaced with Vitest config)
- `server/package.json` — Contains jest@30.4.2, supertest@7.2.2 dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/tests/setup.js` — Test fixtures (TEST_USER, MOCK_LLM_RESPONSE, MOCK_EMBEDDING) and cleanTestTables() helper. Carry forward into Vitest setup.
- `server/src/middleware/auth.js` — requireAuth middleware; already unit-tested in middleware.test.js
- `server/src/middleware/rbac.js` — requireRole and requireOwnerOrAdmin; already unit-tested in middleware.test.js
- `server/src/services/crypto.js` — encrypt/decrypt/redact; already unit-tested in crypto.test.js
- `supertest` — Already installed as dev dependency; used for in-process HTTP testing without a running server

### Established Patterns
- Tests import Express app and make HTTP requests via `fetch()` to `localhost:3000` — this needs to change to `supertest` in-process pattern (D-03)
- Tests use `const { describe, it, before, after } = require('node:test')` — will change to Vitest imports
- Tests use `const assert = require('node:assert/strict')` — will change to Vitest's `expect()` assertions
- JWT tokens generated via `jwt.sign()` with config.jwtSecret for test auth headers
- `cleanTestTables()` utility for DB cleanup (deletes from adapted_lesson, lesson_plan_version, etc.)
- Current test pattern: sequential test suites that build on each other (register → login → use tokens)

### Integration Points
- Vitest config needs to point to `server/tests/` directory with ESM/CommonJS compatibility
- Test setup must initialize/clean DB before test suites
- Service mocks need Vitest's `vi.mock()` or `vi.spyOn()` to intercept adaptation.js, versioning.js, renderer.js, source-editor.js
- All adaptation routes require auth tokens + owner checks — test suite must obtain tokens first

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the decisions captured above — standard Vitest + supertest testing approach following existing project patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Testing + Validation*
*Context gathered: 2026-05-13*