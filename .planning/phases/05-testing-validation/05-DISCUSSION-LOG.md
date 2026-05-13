# Phase 5: Testing + Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 5-Testing + Validation
**Areas discussed:** Test Framework & Migration, In-Process Test Setup, RAG/LLM Mocking Strategy, Test Scope & Coverage

---

## Test Framework & Runner

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest | Matches roadmap spec. Already in client package. Compatible with Jest assertions, built-in coverage, ESM-first. | ✓ |
| Jest (current) | Already configured in server. Tests already import Jest-compatible APIs. But roadmap says Vitest. | |
| node:test only | Already used by existing tests. No extra deps. But no Vite integration, limited coverage tooling. | |

**User's choice:** Vitest (Recommended)
**Notes:** User selected the recommended option. Vitest aligns with roadmap and unifies client/server frameworks.

## Test Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace all with new Vitest tests | Delete existing test files, write from scratch. Clean but loses coverage. | |
| Migrate existing + add new | Convert existing tests to Vitest-compatible syntax, preserve coverage. | ✓ |
| Jest for old, Vitest for new | Two frameworks side-by-side. Not ideal long-term. | |

**User's choice:** Migrate existing + add new (Recommended)
**Notes:** Preserves existing test coverage and accelerates reaching comprehensive suite.

## In-Process Test Setup

| Option | Description | Selected |
|--------|-------------|----------|
| supertest | Creates http.Server from Express app internally. No port needed. Most common Express pattern. | ✓ |
| Vitest lifecycle + fetch | Start Express server on random port in beforeAll, use fetch(). | |
| Custom test harness | Manual app.listen() wrapper with lifecycle hooks. Most control, most code. | |

**User's choice:** supertest (Recommended)
**Notes:** Already installed as dev dependency. Satisfies TEST-04 requirement.

## Database Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Shared adapt.db | Use existing DB with seed data. Tests clean up after themselves. Simpler. | ✓ |
| In-memory SQLite per run | Fresh :memory: DB per test run. Full isolation but more setup. | |
| In-memory SQLite per file | Fresh :memory: DB per test file. Maximum isolation but slowest. | |

**User's choice:** Shared adapt.db (Recommended)
**Notes:** Matches existing setup.js cleanTestTables() pattern.

## Test Execution Order

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential | Tests run in defined order. Auth first, then CRUD, then RAG. Faster, matches current pattern. | ✓ |
| Independent per file | Each file fully self-contained. Safer for parallelization but more boilerplate. | |

**User's choice:** Sequential (Recommended)
**Notes:** Matches current test convention where auth tests run first to set up tokens.

## RAG/LLM Mocking

| Option | Description | Selected |
|--------|-------------|----------|
| Mock services | Mock service functions directly. No external deps needed. setup.js already has fixtures. | ✓ |
| Real services in Docker | Run real ChromaDB/embed server in Docker. Slower, requires Docker. | |
| Hybrid: mock + integration | Unit tests mock; integration tests hit real services. Two configs to maintain. | |

**User's choice:** Mock services (Recommended)

## Mock Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Service-layer mocks | Mock adaptation.js, versioning.js, etc. Routes exercise real code until mock layer. Best balance. | ✓ |
| HTTP-level intercepts | Intercept fetch calls to OpenRouter/Python. More realistic but harder to maintain. | |
| DB-level mocks | Mock better-sqlite3 calls. Too low-level, fragile. | |

**User's choice:** Service-layer mocks (Recommended)
**Notes:** Tests route logic + middleware without external dependencies. setup.js MOCK_LLM_RESPONSE and MOCK_EMBEDDING fixtures carry forward.

## Test Scope & Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Core flows + error paths | Auth flows, all CRUD happy + error paths, RAG/LLM with mocks. Covers all 4 TEST requirements. | ✓ |
| Happy paths only | Minimal coverage. Leaves gaps for edge cases. | |
| Exhaustive coverage | Deep coverage: boundaries, concurrency, RBAC matrix per role. Most thorough, most code. | |

**User's choice:** Core flows + error paths (Recommended)

## RBAC Testing

| Option | Description | Selected |
|--------|-------------|----------|
| Per-endpoint auth + RBAC | Test every endpoint for 401/403/admin bypass. Comprehensive. | ✓ |
| Middleware + selective RBAC | Test middleware once, only check RBAC on owner-restricted endpoints. Less redundancy. | |

**User's choice:** Per-endpoint auth + RBAC (Recommended)

---

## the agent's Discretion

- Exact test file organization within server/tests/
- Vitest setup file structure (migrating setup.js)
- Global API vs explicit imports in Vitest
- Specific error-path test cases per endpoint
- Test naming conventions
- Coverage threshold configuration

## Deferred Ideas

None — discussion stayed within phase scope.