# Phase 2: Core Data API - Research

**Researched:** 2026-05-11
**Domain:** Express 5 REST API port from FastAPI/Python, better-sqlite3 raw SQL
**Confidence:** HIGH

## Summary

This phase ports all CRUD data endpoints from the Python/FastAPI backend (`backend/routers/`) to Express 5 with `better-sqlite3`. Phase 1 already provides the foundation: auth middleware (`requireAuth`), RBAC (`requireRole`, `requireOwnerOrAdmin`), error classes (`NotFoundError`, `ValidationError`), crypto service (AES-256-GCM encrypt/decrypt/redact), and DB layer. The Python code serves as the canonical reference for endpoint URLs, query logic, and response shapes.

**Primary recommendation:** One route file per resource (`lessons.js`, `clusters.js`, `knowledge-bases.js`, `settings.js`, `admin.js`), expand existing `teachers.js` to full Python parity, register all in `server/src/routes/index.js`. Use raw SQL with `db.prepare().get/all/run()` and manual row-to-object mapping per D-01/D-02.

**Critical finding:** The Python backend uses Fernet encryption for API keys, while the Express crypto service uses raw AES-256-GCM with a different format (`iv:tag:ciphertext`). Existing encrypted keys in the database are unreadable by the Express service. SEC-05 (Fernet migration) is marked Phase 1 Complete, but the Express crypto service was built with AES-256-GCM, not Fernet. This means the settings endpoints (SETT-01 through SETT-04) will fail to decrypt any pre-existing keys. The planner must decide whether to (a) switch Express crypto to Fernet, or (b) run a migration to re-encrypt. See Pitfall 1.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lesson CRUD (list, get, source files) | API / Backend | Database / Storage | Read-only queries against `lesson`, `lesson_file` tables |
| Cluster CRUD + KB assignment | API / Backend | Database / Storage | JOINs across `student_cluster`, `cluster_kb`, `knowledge_base` |
| Knowledge base listing | API / Backend | Database / Storage | Simple SELECT from `knowledge_base` |
| Teacher dashboard (metrics, roster, recent) | API / Backend | Database / Storage | Aggregation queries with JOINs across 5+ tables |
| Teacher classes + students | API / Backend | Database / Storage | JOINs: `class` → `enrollment` → `student` → `student_cluster` |
| Student cluster assignment update | API / Backend | Database / Storage | PATCH with ownership check |
| LLM settings (CRUD + test) | API / Backend | Database / Storage | Encrypted key storage, LLM ping test (Phase 3 dependency) |
| Admin institution overview | API / Backend | Database / Storage | Aggregation scoped to `institution_id`, admin-only |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use raw SQL with `better-sqlite3` `db.prepare()` — continue Phase 1 pattern. No ORM or query builder.
- **D-02:** Manual row-to-object mapping in each route handler. No mapper functions or abstraction layer. Keep it explicit and simple.
- **D-03:** Return raw JSON objects/arrays directly from Express. No `{ data: ... }` envelope. `res.json(lessons)` for lists, `res.json({ teacher, metrics })` for compound responses.
- **D-04:** Offset-based pagination for list endpoints. Query params: `?page=1&limit=20`. Response includes `total`, `page`, `limit` alongside the data array. Apply to LESS-01 (lessons list) and any other list endpoint that could grow.
- **D-05:** Mirror Python URL paths exactly: `/api/lessons`, `/api/clusters`, `/api/knowledge-bases`, `/api/teachers/:id/dashboard`, `/api/teachers/:id/classes`, `/api/teachers/:id/llm-config`, `/api/institutions/:id/overview`. Keeps API compatible with existing frontend.

### the agent's Discretion
- File structure within `server/src/routes/` (one file per resource vs grouped)
- Whether to add a generic `paginate(query, page, limit)` helper or inline pagination logic
- How to handle the `requireOwnerOrAdmin` pattern for teacher-specific endpoints (param naming: `:id` vs `:teacherId`)
- Whether admin endpoints need a separate router file or go in an existing one

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LESS-01 | User can list all lessons with pagination | Python: `GET /api/lessons` → `list[schemas.LessonOut]`. Express: needs pagination wrapper (D-04). |
| LESS-02 | User can view a single lesson by ID | Python: `GET /api/lessons/{lesson_id}` → `schemas.LessonOut`. Direct port. |
| LESS-03 | User can browse lesson source files | Python: `GET /api/lessons/{lesson_id}/source-files` → `list[schemas.LessonSourceFileOut]`. Depends on filesystem + `source_editor.py`. **Phase 3 dependency** — requires RAG + LLM. |
| LESS-04 | User can search/filter lessons | **NOT in Python reference.** New requirement. Needs `WHERE` clause building on `title`, `grade_level`, `cs_topic`. |
| CLUS-01 | User can list all learner clusters | Python: `GET /api/clusters` → `list[schemas.ClusterWithKBs]`. Complex query with subqueries for KB count and student count. |
| CLUS-02 | User can view cluster details with student list | Python: `GET /api/clusters/{cluster_id}/kbs` → `list[schemas.KnowledgeBaseOut]`. JOIN on `cluster_kb`. |
| CLUS-03 | User can manage cluster-KB assignments | Python: `PUT /api/clusters/{cluster_id}/kbs` → replace all KBs. DELETE + INSERT pattern. |
| CLUS-04 | User can update cluster assignments | Maps to TEACH-03 (student cluster assignment). `PATCH /api/teachers/{teacher_id}/students/{student_id}`. |
| TEACH-01 | Teacher can view their dashboard with metrics | Python: `GET /api/teachers/{teacher_id}/dashboard` → `schemas.DashboardOut`. 5+ queries. **Existing partial port in `teachers.js`** — needs full rewrite to match Python response shape. |
| TEACH-02 | Teacher can view their classes and students | Python: `GET /api/teachers/{teacher_id}/classes` → `list[schemas.ClassOut]` with nested students. |
| TEACH-03 | Teacher can update student cluster assignments | Python: `PATCH /api/teachers/{teacher_id}/students/{student_id}` → `schemas.StudentOut`. Ownership check required. |
| TEACH-04 | Teacher can view and edit their profile | **NOT in Python reference.** New requirement. Needs GET + PUT for teacher profile fields. |
| TEACH-05 | Teacher can manage their own classes | **Partially in Python.** Only `GET /{teacher_id}/classes` exists. POST/PUT/DELETE for classes are new. |
| SETT-01 | Teacher can configure LLM provider settings | Python: `GET + PUT /api/teachers/{teacher_id}/llm-config`. Encryption required. |
| SETT-02 | Teacher can store encrypted API keys | Python: `encrypt()` on PUT. Express crypto uses AES-256-GCM, not Fernet. **Crypto mismatch** (see Pitfall 1). |
| SETT-03 | Teacher can test LLM connection | Python: `POST /api/teachers/{teacher_id}/llm-config/test` → calls `provider.ping()`. **Phase 3 dependency** — needs LLM provider adapter. |
| SETT-04 | Teacher can select preferred LLM model | Handled by SETT-01 PUT endpoint (model field in body). |
| SETT-05 | Settings persist across sessions | Database persistence via `llm_provider_config` table. No special handling needed. |
| ADMIN-01 | Admin can view institution-level overview | Python: `GET /api/institutions/{institution_id}/overview` → dict with metrics. `require_admin` middleware. |
| ADMIN-02 | Admin can view teacher list | Python: `GET /api/institutions/{institution_id}/teachers` → list with class/student/adaptation counts. |
| ADMIN-03 | Admin can view classes and clusters | Python: `GET /api/institutions/{institution_id}/classes` and `/clusters`. |
| ADMIN-04 | Admin can manage system-wide settings | **NOT in Python reference.** Only GET endpoints exist. Management (PUT/POST/DELETE) is new. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP framework | Already in use, Phase 1 foundation |
| better-sqlite3 | 12.9.0 | SQLite driver | Already in use, synchronous API fits raw SQL pattern |
| jsonwebtoken | 9.0.3 | JWT verification | Already in use, Phase 1 auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.4.3 | Request body validation | For SETT-01 (LLM config PUT body), TEACH-03 (student PATCH body), LESS-04 (search params) |
| bcryptjs | 3.0.3 | Password hashing | Already installed, Phase 1 — not needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual row mapping | `better-sqlite3` with custom mapper | D-02 explicitly forbids abstraction layer |
| Inline pagination | `paginate(query, page, limit)` helper | D-04 discretion — helper is cleaner for multiple paginated endpoints |
| No validation | `joi` or `yup` | Zod is lighter, has better TypeScript inference (future-proof) |

**Installation:**
```bash
cd server && npm install zod
```

**Version verification:**
```
express: 5.2.1 (published 2025-12-18) [VERIFIED: npm registry]
better-sqlite3: 12.9.0 (published 2025-04-15) [VERIFIED: npm registry]
zod: 4.4.3 (published 2025-05-08) [VERIFIED: npm registry]
```

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────┐
│  Express App (app.js)               │
│  ├── CORS middleware                │
│  ├── express.json() body parser     │
│  └── Routes (index.js mounts all)   │
└─────────────────────────────────────┘
    │
    ├── /api/lessons        → lessons.js
    ├── /api/clusters       → clusters.js
    ├── /api/knowledge-bases→ knowledge-bases.js
    ├── /api/teachers/:id/* → teachers.js
    ├── /api/institutions/* → admin.js
    └── /api/auth/*         → auth.js (Phase 1)
    │
    ▼
┌─────────────────────────────────────┐
│  Per-Route Middleware Stack         │
│  1. requireAuth (JWT verify)        │
│  2. requireOwnerOrAdmin OR          │
│     requireRole('admin')            │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Route Handler                      │
│  1. Parse params/body               │
│  2. Validate input (zod)            │
│  3. db.prepare().get/all/run()      │
│  4. Manual row → object mapping     │
│  5. res.json(result)                │
│  6. throw NotFoundError on miss     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  better-sqlite3 (sync)              │
│  adapt.db (WAL mode, FK ON)         │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  errorHandler middleware            │
│  Catches thrown AppError subclasses │
│  Returns { error, status, detail }  │
└─────────────────────────────────────┘
```

### Recommended Project Structure

```
server/src/
├── routes/
│   ├── index.js              # Mounts all routers (existing, needs expansion)
│   ├── auth.js               # Phase 1 — no changes needed
│   ├── teachers.js           # Phase 1 partial — EXPAND to full Python parity
│   ├── lessons.js            # NEW — LESS-01, LESS-02, LESS-03, LESS-04
│   ├── clusters.js           # NEW — CLUS-01, CLUS-02, CLUS-03
│   ├── knowledge-bases.js    # NEW — KB listing (CLUS-02 dependency)
│   ├── settings.js           # NEW — SETT-01 through SETT-05
│   └── admin.js              # NEW — ADMIN-01 through ADMIN-04
├── middleware/
│   ├── auth.js               # Phase 1 — requireAuth
│   ├── rbac.js               # Phase 1 — requireRole, requireOwnerOrAdmin
│   └── errorHandler.js       # Phase 1
├── services/
│   ├── auth.js               # Phase 1
│   └── crypto.js             # Phase 1 — ⚠️ Fernet mismatch (see Pitfall 1)
├── errors/
│   └── index.js              # Phase 1 — AppError subclasses
├── db/
│   └── index.js              # Phase 1 — better-sqlite3 instance
├── config/
│   └── index.js              # Phase 1
└── app.js                    # Phase 1 — needs route registration updates
```

### Pattern 1: Auth-Protected List Endpoint with Pagination

**What:** Standard pattern for list endpoints that need JWT auth and offset-based pagination (D-04).

**When to use:** LESS-01 (lessons list) and any other list endpoint that could grow.

**Example:**
```javascript
// Source: Adapted from Python backend/routers/lessons.py + D-04 decision
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');

router.get('', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  // Count total for pagination metadata
  const { total } = db.prepare('SELECT COUNT(*) as total FROM lesson').get();

  // Fetch paginated rows
  const rows = db.prepare(
    'SELECT lesson_id, title, grade_level, cs_topic, cs_standard, objectives FROM lesson ORDER BY lesson_id LIMIT ? OFFSET ?'
  ).all(limit, offset);

  res.json({
    lessons: rows,
    total,
    page,
    limit
  });
});
```

### Pattern 2: Owner-or-Admin Protected Single Resource

**What:** Endpoint where only the resource owner (teacher) or an admin can access.

**When to use:** TEACH-01 (dashboard), TEACH-02 (classes), SETT-01 (LLM config).

**Example:**
```javascript
// Source: Python backend/routers/teachers.py _ensure_self_or_admin + Express rbac.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { requireOwnerOrAdmin } = require('../middleware/rbac');
const { NotFoundError } = require('../errors');

// GET /api/teachers/:id/dashboard
router.get('/:id/dashboard', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  const teacher = db.prepare(
    'SELECT teacher_id, first_name, last_name, email, institution_id, role FROM teacher WHERE teacher_id = ?'
  ).get(teacherId);

  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  // ... aggregation queries ...
  res.json({ teacher, metrics, ... });
});
```

### Pattern 3: Replace-All Junction Table (Cluster-KB Assignment)

**What:** DELETE all existing junction rows, then INSERT new ones. Transactional.

**When to use:** CLUS-03 (update cluster KBs).

**Example:**
```javascript
// Source: Python backend/routers/clusters.py update_cluster_kbs
router.put('/:id/kbs', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const clusterId = parseInt(req.params.id);
  const { kb_ids } = req.body; // array of integers

  // Verify cluster exists
  const cluster = db.prepare('SELECT cluster_id FROM student_cluster WHERE cluster_id = ?').get(clusterId);
  if (!cluster) throw new NotFoundError('Cluster');

  // Verify all KB IDs exist
  if (kb_ids && kb_ids.length > 0) {
    const placeholders = kb_ids.map(() => '?').join(',');
    const found = db.prepare(
      `SELECT kb_id FROM knowledge_base WHERE kb_id IN (${placeholders})`
    ).all(...kb_ids);
    if (found.length !== kb_ids.length) {
      throw new NotFoundError('One or more knowledge base IDs not found');
    }
  }

  // Replace all: delete then insert
  db.prepare('DELETE FROM cluster_kb WHERE cluster_id = ?').run(clusterId);
  const insert = db.prepare('INSERT INTO cluster_kb (cluster_id, kb_id) VALUES (?, ?)');
  const insertMany = db.transaction((kbIds) => {
    for (const kbId of kbIds) {
      insert.run(clusterId, kbId);
    }
  });
  insertMany(kb_ids || []);

  // Return updated KBs
  const kbs = db.prepare(
    'SELECT kb_id, kb_name, category, description, source_url FROM knowledge_base kb JOIN cluster_kb ck ON kb.kb_id = ck.kb_id WHERE ck.cluster_id = ? ORDER BY kb.category, kb.kb_name'
  ).all(clusterId);

  res.json(kbs);
});
```

### Pattern 4: Admin-Only Institution-Scoped Endpoint

**What:** Endpoint requiring admin role, scoped to an institution ID.

**When to use:** ADMIN-01 through ADMIN-04.

**Example:**
```javascript
// Source: Python backend/routers/admin.py overview
const { requireRole } = require('../middleware/rbac');

router.get('/:id/overview', requireAuth, requireRole('admin'), (req, res) => {
  const institutionId = parseInt(req.params.id);

  const inst = db.prepare(
    'SELECT institution_id, name, type, district FROM institution WHERE institution_id = ?'
  ).get(institutionId);
  if (!inst) throw new NotFoundError('Institution');

  const { teacher_count } = db.prepare(
    'SELECT COUNT(*) as teacher_count FROM teacher WHERE institution_id = ? AND role = ?'
  ).get(institutionId, 'teacher');

  // ... more counts ...
  res.json({
    institution: inst,
    metrics: { teachers: teacher_count, ... }
  });
});
```

### Anti-Patterns to Avoid

- **N+1 queries in classes endpoint:** The Python code loops through classes and runs a query per class for students. In Express with better-sqlite3 (sync), this is less painful but still inefficient. Use a single JOIN query and group results in JavaScript instead.
- **Returning raw SQLite rows:** SQLite returns columns as-is. Always map to the expected response shape (e.g., `cluster_name` from JOIN, not just `cluster_id`).
- **Not validating `kb_ids` array before INSERT:** The Python code validates that all KB IDs exist before inserting. Skip this and you get silent FK constraint failures or partial inserts.
- **Using `req.params.teacherId` instead of `req.params.id`:** The `requireOwnerOrAdmin` middleware reads `req.params.id`. Changing the param name to `:teacherId` will break the middleware. Use `:id` consistently for teacher-scoped routes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request body validation | Manual `if (!body.field)` checks | zod schemas | Edge cases: type coercion, nested objects, array validation, min/max constraints |
| Pagination logic per endpoint | Copy-paste offset calculation | Single `paginate(query, countQuery, page, limit)` helper | DRY, consistent response shape, prevents off-by-one errors |
| API key encryption | Custom crypto | Phase 1 `crypto.js` (but fix Fernet mismatch first) | AES-256-GCM already implemented, but format differs from Python Fernet |
| Error responses | `res.status(404).json({ ... })` inline | `throw new NotFoundError('Resource')` | Phase 1 errorHandler middleware provides consistent envelope |
| Auth checks | Manual JWT parsing in each route | `requireAuth` middleware | Already handles token expiry, missing header, invalid signature |

**Key insight:** The Phase 1 foundation already provides auth, RBAC, error handling, and crypto. The only "new" concern for this phase is input validation (zod) and pagination helper. Everything else is direct SQL + mapping.

## Runtime State Inventory

> This is a port phase but not a rename/refactor phase. The Runtime State Inventory is not applicable.

## Common Pitfalls

### Pitfall 1: Fernet vs AES-256-GCM Crypto Mismatch
**What goes wrong:** The Python backend encrypts API keys with Fernet (`cryptography.fernet`). The Express `crypto.js` uses raw AES-256-GCM with format `iv:tag:ciphertext`. These are incompatible — Express `decrypt()` will fail on Fernet-encrypted data.
**Why it happens:** Phase 1 crypto service was written independently of the Python Fernet implementation. SEC-05 (Fernet migration) is marked Phase 1 Complete but the Express crypto uses a different algorithm.
**How to avoid:** Two options: (a) Replace Express `crypto.js` with a Fernet-compatible implementation (npm `fernet` package), or (b) Write a migration that decrypts all existing keys with Fernet and re-encrypts with AES-256-GCM. Option (a) is safer — no data loss risk.
**Warning signs:** `SETT-01` GET returns 500 error when trying to decrypt existing `llm_provider_config.api_key_encrypted` values.

### Pitfall 2: better-sqlite3 is Synchronous
**What goes wrong:** Developer writes `await db.prepare(...).get()` or wraps queries in `Promise`, introducing unnecessary async overhead.
**Why it happens:** Express developers are conditioned to async database calls. better-sqlite3 is intentionally synchronous.
**How to avoid:** All `db.prepare().get/all/run()` calls are synchronous. Do NOT use `async/await` with them. Route handlers can remain synchronous `(req, res) => { ... }`.
**Warning signs:** `await` before `db.prepare()` — works but adds microtask overhead.

### Pitfall 3: `requireOwnerOrAdmin` Reads `req.params.id`
**What goes wrong:** Developer names route param `:teacherId` instead of `:id`, causing `requireOwnerOrAdmin` to read `undefined` and always return 403.
**Why it happens:** The middleware is hardcoded to `req.params.id` (see `server/src/middleware/rbac.js` line 17).
**How to avoid:** Always use `:id` for teacher-scoped routes: `/api/teachers/:id/dashboard`, `/api/teachers/:id/classes`, `/api/teachers/:id/llm-config`. Inside the handler, use `const teacherId = parseInt(req.params.id)`.
**Warning signs:** All teacher-specific endpoints return 403 even for the owning teacher.

### Pitfall 4: SQLite `COUNT(*)` Returns Integer, Not BigInt
**What goes wrong:** In some Node.js SQLite drivers, `COUNT(*)` returns a BigInt. better-sqlite3 returns a regular JavaScript number, but developers may defensively call `Number()` or `parseInt()` unnecessarily.
**Why it happens:** Confusion with other SQLite drivers (e.g., `node-sqlite3`, `@vscode/sqlite3`).
**How to avoid:** With better-sqlite3, `COUNT(*)` returns a plain number. No conversion needed. However, `parseInt()` is harmless and defensive for `req.params` and `req.query` values (which are always strings).
**Warning signs:** None — this is a non-issue with better-sqlite3 specifically.

### Pitfall 5: Missing `updated_at` on `llm_provider_config`
**What goes wrong:** The SQL schema defines `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` but has no `ON UPDATE` trigger. The Python code doesn't set it explicitly either. New Express rows will have stale `updated_at` values.
**Why it happens:** SQLite doesn't auto-update `DEFAULT` columns on UPDATE.
**How to avoid:** Either (a) add `updated_at = CURRENT_TIMESTAMP` to the UPDATE query, or (b) add a SQLite trigger. Option (a) is simpler and matches the Python pattern (which also doesn't set it).
**Warning signs:** `updated_at` never changes after initial INSERT, breaking any "most recently updated" ordering.

### Pitfall 6: Source File Endpoints (LESS-03) Are Phase 3 Dependencies
**What goes wrong:** Developer tries to implement `GET /api/lessons/{id}/source-files` and `POST /api/lessons/{id}/edit-source-file` in Phase 2.
**Why it happens:** These endpoints exist in the Python `lessons.py` router. But `source_editor.py` depends on RAG retrieval (`retriever.retrieve_for_lesson`), LLM provider calls, and file system operations (docx/pptx/pdf parsing) — all Phase 3.
**How to avoid:** Defer LESS-03 to Phase 3. In Phase 2, either (a) skip the endpoint entirely, or (b) return a stub `[]` with a note. The planner should flag this as a Phase 3 dependency.
**Warning signs:** Import errors for `pdfplumber`, `docx`, `pptx` — these are Python packages with no direct Express equivalent in the current project.

### Pitfall 7: LLM Test Endpoint (SETT-03) Is Phase 3 Dependency
**What goes wrong:** Developer tries to implement `POST /api/teachers/{id}/llm-config/test` which calls `provider.ping()`.
**Why it happens:** The Python `settings.py` test endpoint uses `make_provider(cfg.provider, ...)` from `backend/llm/` — the LLM adapter layer is Phase 3.
**How to avoid:** Defer SETT-03 to Phase 3. In Phase 2, implement GET/PUT for llm-config but return `501 Not Implemented` for the test endpoint, or skip it entirely.

## Code Examples

### Lessons List with Pagination (LESS-01)
```javascript
// Source: Python backend/routers/lessons.py list_lessons + D-04 pagination
router.get('', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const { total } = db.prepare('SELECT COUNT(*) as total FROM lesson').get();
  const rows = db.prepare(
    'SELECT lesson_id, title, grade_level, cs_topic, cs_standard, objectives FROM lesson ORDER BY lesson_id LIMIT ? OFFSET ?'
  ).all(limit, offset);

  res.json({ lessons: rows, total, page, limit });
});
```

### Single Lesson by ID (LESS-02)
```javascript
// Source: Python backend/routers/lessons.py get_lesson
router.get('/:id', requireAuth, (req, res) => {
  const lessonId = parseInt(req.params.id);
  const lesson = db.prepare(
    'SELECT lesson_id, title, grade_level, cs_topic, cs_standard, objectives FROM lesson WHERE lesson_id = ?'
  ).get(lessonId);

  if (!lesson) throw new NotFoundError('Lesson');
  res.json(lesson);
});
```

### Cluster List with Aggregated Counts (CLUS-01)
```javascript
// Source: Python backend/routers/clusters.py list_clusters
// Python uses subqueries for kb_count and student_count.
// Express equivalent: single query with LEFT JOINs and GROUP BY.
router.get('', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT
      sc.cluster_id,
      sc.cluster_name,
      sc.cluster_description,
      COUNT(DISTINCT ck.kb_id) as kb_count,
      COUNT(DISTINCT s.student_id) as student_count
    FROM student_cluster sc
    LEFT JOIN cluster_kb ck ON sc.cluster_id = ck.cluster_id
    LEFT JOIN student s ON sc.cluster_id = s.cluster_id
    GROUP BY sc.cluster_id
    ORDER BY sc.cluster_id
  `).all();

  res.json(rows);
});
```

### Dashboard with Nested Queries (TEACH-01)
```javascript
// Source: Python backend/routers/teachers.py dashboard
// Python runs 7+ separate queries. Express can do the same with better-sqlite3 (sync, no penalty).
router.get('/:id/dashboard', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  const teacher = db.prepare(
    'SELECT teacher_id, first_name, last_name, email, institution_id, role FROM teacher WHERE teacher_id = ?'
  ).get(teacherId);
  if (!teacher) throw new NotFoundError('Teacher');

  const institution = teacher.institution_id
    ? db.prepare('SELECT institution_id, name, type, district FROM institution WHERE institution_id = ?').get(teacher.institution_id)
    : null;

  const { student_count } = db.prepare(
    'SELECT COUNT(DISTINCT e.student_id) as student_count FROM enrollment e JOIN class c ON e.class_id = c.class_id WHERE c.teacher_id = ?'
  ).get(teacherId);

  const { cluster_count } = db.prepare(
    'SELECT COUNT(DISTINCT s.cluster_id) as cluster_count FROM student s JOIN enrollment e ON s.student_id = e.student_id JOIN class c ON e.class_id = c.class_id WHERE c.teacher_id = ?'
  ).get(teacherId);

  const { adaptation_count } = db.prepare(
    'SELECT COUNT(*) as adaptation_count FROM adapted_lesson WHERE teacher_id = ?'
  ).get(teacherId);

  const { kb_count } = db.prepare('SELECT COUNT(*) as kb_count FROM knowledge_base').get();

  // Recent adaptations (Python joins lesson_plan_version for head version)
  const recentRows = db.prepare(`
    SELECT al.adapted_id, l.title as lesson_title, l.grade_level, l.cs_topic,
           sc.cluster_name, al.generated_at
    FROM adapted_lesson al
    JOIN lesson l ON al.lesson_id = l.lesson_id
    JOIN student_cluster sc ON sc.cluster_id = al.cluster_id
    WHERE al.teacher_id = ?
    ORDER BY al.generated_at DESC
    LIMIT 6
  `).all(teacherId);

  // Roster
  const rosterRows = db.prepare(`
    SELECT s.student_id, s.first_name, s.last_name,
           sc.cluster_name, c.class_name
    FROM student s
    JOIN enrollment e ON s.student_id = e.student_id
    JOIN class c ON e.class_id = c.class_id
    LEFT JOIN student_cluster sc ON s.cluster_id = sc.cluster_id
    WHERE c.teacher_id = ?
    ORDER BY c.class_name, s.last_name
  `).all(teacherId);

  const roster = rosterRows.map(r => ({
    student_id: r.student_id,
    student_name: `${r.first_name} ${r.last_name}`,
    cluster_name: r.cluster_name,
    class_name: r.class_name
  }));

  res.json({
    teacher,
    institution,
    metrics: {
      students: student_count,
      clusters: cluster_count,
      adaptations: adaptation_count,
      knowledge_bases: kb_count,
      classes: [...new Set(rosterRows.map(r => r.class_name))].length
    },
    recent_adaptations: recentRows,
    roster
  });
});
```

### LLM Config GET with Key Redaction (SETT-01)
```javascript
// Source: Python backend/routers/settings.py get_llm_config
const { decrypt, redact } = require('../services/crypto');

router.get('/:id/llm-config', requireAuth, requireOwnerOrAdmin, (req, res) => {
  const teacherId = parseInt(req.params.id);

  const cfg = db.prepare(
    'SELECT provider, model, api_key_encrypted, is_active FROM llm_provider_config WHERE teacher_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1'
  ).get(teacherId);

  if (!cfg) return res.json(null);

  // ⚠️ WARNING: If api_key_encrypted was encrypted with Python Fernet,
  // this decrypt() call will throw. See Pitfall 1.
  const decrypted = decrypt(cfg.api_key_encrypted);

  res.json({
    provider: cfg.provider,
    model: cfg.model,
    api_key_redacted: redact(decrypted),
    is_active: Boolean(cfg.is_active)
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FastAPI + SQLAlchemy ORM | Express 5 + better-sqlite3 raw SQL | Project decision (2026-05-11) | Manual SQL + mapping instead of ORM auto-mapping |
| Fernet encryption (Python) | AES-256-GCM raw crypto (Express) | Phase 1 implementation | **Incompatible formats** — existing encrypted keys unreadable |
| Pydantic response schemas | Manual object construction | Project decision | No automatic response validation; must manually ensure shape |
| FastAPI `Depends()` DI | Express middleware chain | Framework difference | `requireAuth` + `requireOwnerOrAdmin` as middleware stack |
| SQLAlchemy subqueries | SQLite CTEs or JOINs | Driver difference | Subqueries work in SQLite but JOINs are cleaner for simple aggregations |

**Deprecated/outdated:**
- **Python `source_editor.py` endpoints (LESS-03):** Cannot be ported until Phase 3 (RAG + LLM adapters + file parsing libraries)
- **Python `test_llm_config` endpoint (SETT-03):** Cannot be ported until Phase 3 (LLM provider adapter with `ping()` method)
- **Python `current_teacher` dependency:** Replaced by Express `requireAuth` middleware (JWT-based vs header-based fakeauth)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | LESS-03 (source files) and SETT-03 (LLM test) are Phase 3 dependencies | Pitfalls 6, 7 | If planner includes them, implementation will fail due to missing RAG/LLM infrastructure |
| A2 | TEACH-04 (profile edit) and TEACH-05 (class management) are new requirements not in Python | Phase Requirements table | Planner may look for Python reference that doesn't exist |
| A3 | ADMIN-04 (system-wide settings management) has no Python reference | Phase Requirements table | Same as A2 |
| A4 | The `llm_provider_config.updated_at` column is not auto-updated by SQLite | Pitfall 5 | If a trigger exists that I missed, manual update is redundant but harmless |
| A5 | Python Fernet-encrypted keys exist in the database from prior Python usage | Pitfall 1 | If no keys exist yet (fresh DB), the mismatch is moot |

## Open Questions

1. **LESS-04 (search/filter lessons): What fields should be searchable?**
   - What we know: Python has no search endpoint. Requirements say "search/filter lessons."
   - What's unclear: Which fields? `title`, `cs_topic`, `grade_level`? Full-text search or simple LIKE?
   - Recommendation: Implement `?q=` query param that searches `title` and `cs_topic` with `LIKE '%?%'`. Add `?grade_level=` filter. This covers the most common use cases.

2. **TEACH-04 (profile edit): What fields are editable?**
   - What we know: Python has no profile edit endpoint.
   - What's unclear: Which fields? `first_name`, `last_name`, `email`? Password change?
   - Recommendation: Allow `first_name`, `last_name` via PUT. Email change requires additional verification (defer). Password change belongs in auth routes, not data API.

3. **TEACH-05 (class management): What CRUD operations?**
   - What we know: Python only has `GET /{teacher_id}/classes`.
   - What's unclear: Should Phase 2 include POST/PUT/DELETE for classes?
   - Recommendation: Implement GET only (matches Python). POST/PUT/DELETE for classes is a Phase 4 (frontend) dependency — defer until the UI needs it.

4. **ADMIN-04 (system-wide settings management): What settings?**
   - What we know: Python admin has only GET endpoints.
   - What's unclear: What "system-wide settings" exist? Institution name? Global defaults?
   - Recommendation: Defer to Phase 4 or clarify with user. No Python reference exists.

5. **Fernet migration: Should Express crypto switch to Fernet or migrate data?**
   - What we know: Python uses Fernet, Express uses AES-256-GCM. Formats are incompatible.
   - What's unclear: Are there existing encrypted keys in the database?
   - Recommendation: Switch Express `crypto.js` to use Fernet (npm `fernet` package). This is the safest path — no data migration needed, maintains compatibility with any Python-generated keys.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Express server runtime | ✓ | (check with `node --version`) | — |
| npm | Package management | ✓ | (check with `npm --version`) | — |
| better-sqlite3 | All data endpoints | ✓ (installed) | 12.9.0 | — |
| express | HTTP server | ✓ (installed) | 5.2.1 | — |
| zod | Input validation (SETT-01, TEACH-03, LESS-04) | ✗ | — | Manual validation (not recommended) |
| fernet (npm) | API key decryption compatibility | ✗ | — | Manual migration script (risky) |

**Missing dependencies with fallback:**
- `zod` — install with `npm install zod`. Fallback: manual `if` checks (error-prone, inconsistent).
- `fernet` (npm package) — install if switching crypto to Fernet. Fallback: write migration script to re-encrypt all keys.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — see Wave 0 |
| Quick run command | `cd server && node --test tests/` |
| Full suite command | `cd server && node --test tests/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LESS-01 | List lessons with pagination | integration | `node --test tests/routes/lessons.test.js` | ❌ Wave 0 |
| LESS-02 | Get single lesson by ID | integration | `node --test tests/routes/lessons.test.js` | ❌ Wave 0 |
| LESS-04 | Search/filter lessons | integration | `node --test tests/routes/lessons.test.js` | ❌ Wave 0 |
| CLUS-01 | List clusters with counts | integration | `node --test tests/routes/clusters.test.js` | ❌ Wave 0 |
| CLUS-02 | Get cluster KBs | integration | `node --test tests/routes/clusters.test.js` | ❌ Wave 0 |
| CLUS-03 | Update cluster KBs | integration | `node --test tests/routes/clusters.test.js` | ❌ Wave 0 |
| TEACH-01 | Dashboard with metrics | integration | `node --test tests/routes/teachers.test.js` | ❌ Wave 0 |
| TEACH-02 | Classes with students | integration | `node --test tests/routes/teachers.test.js` | ❌ Wave 0 |
| TEACH-03 | Update student cluster | integration | `node --test tests/routes/teachers.test.js` | ❌ Wave 0 |
| SETT-01 | Get LLM config | integration | `node --test tests/routes/settings.test.js` | ❌ Wave 0 |
| SETT-02 | Save encrypted API key | integration | `node --test tests/routes/settings.test.js` | ❌ Wave 0 |
| ADMIN-01 | Institution overview | integration | `node --test tests/routes/admin.test.js` | ❌ Wave 0 |
| ADMIN-02 | Teacher list | integration | `node --test tests/routes/admin.test.js` | ❌ Wave 0 |
| AUTH-04 | JWT enforcement on all routes | integration | `node --test tests/middleware/auth.test.js` | ❌ Wave 0 |
| AUTH-05 | Tenant isolation | integration | `node --test tests/middleware/rbac.test.js` | ❌ Wave 0 |
| AUTH-06 | Admin cross-tenant access | integration | `node --test tests/middleware/rbac.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && node --test tests/`
- **Per wave merge:** `cd server && node --test tests/`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/lessons.test.js` — covers LESS-01, LESS-02, LESS-04
- [ ] `tests/routes/clusters.test.js` — covers CLUS-01, CLUS-02, CLUS-03
- [ ] `tests/routes/teachers.test.js` — covers TEACH-01, TEACH-02, TEACH-03 (extend existing partial)
- [ ] `tests/routes/settings.test.js` — covers SETT-01, SETT-02
- [ ] `tests/routes/admin.test.js` — covers ADMIN-01, ADMIN-02
- [ ] `tests/helpers/db-seed.js` — shared fixture for seeding test database
- [ ] `tests/helpers/auth.js` — shared fixture for generating test JWTs
- [ ] Framework: `node:test` is built-in, no install needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT via `requireAuth` middleware (Phase 1) |
| V3 Session Management | yes | JWT stateless sessions (Phase 1) |
| V4 Access Control | yes | RBAC via `requireRole`, `requireOwnerOrAdmin` (Phase 1) |
| V5 Input Validation | yes | zod for request bodies, `parseInt` for params |
| V6 Cryptography | yes | AES-256-GCM via `crypto.js` (Phase 1) — Fernet mismatch needs resolution |

### Known Threat Patterns for Express + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Parameterized queries via `db.prepare().get/all/run(?)` — never string concatenation |
| IDOR (Insecure Direct Object Reference) | Elevation of privilege | `requireOwnerOrAdmin` middleware on all teacher-scoped routes |
| Privilege escalation | Elevation of privilege | `requireRole('admin')` on all admin routes |
| API key exposure | Information disclosure | `redact()` on all responses containing decrypted keys |
| Mass assignment | Tampering | Explicit column selection in UPDATE queries, zod body validation |

## Sources

### Primary (HIGH confidence)
- Python `backend/routers/lessons.py` — endpoint contracts, query patterns [VERIFIED: codebase read]
- Python `backend/routers/clusters.py` — subquery patterns, junction table operations [VERIFIED: codebase read]
- Python `backend/routers/teachers.py` — dashboard query complexity, roster construction [VERIFIED: codebase read]
- Python `backend/routers/settings.py` — LLM config CRUD, encryption flow [VERIFIED: codebase read]
- Python `backend/routers/admin.py` — institution-scoped aggregation queries [VERIFIED: codebase read]
- Python `backend/schemas.py` — response shape definitions [VERIFIED: codebase read]
- Python `backend/models.py` — SQLAlchemy ORM models, column definitions [VERIFIED: codebase read]
- Express `server/src/routes/teachers.js` — existing partial port [VERIFIED: codebase read]
- Express `server/src/middleware/rbac.js` — `requireOwnerOrAdmin` param reading [VERIFIED: codebase read]
- Express `server/src/services/crypto.js` — AES-256-GCM implementation [VERIFIED: codebase read]
- Python `backend/security.py` — Fernet implementation [VERIFIED: codebase read]
- `adapt-database.sql` — full DDL, sample data, demo queries [VERIFIED: codebase read]
- npm registry: express 5.2.1, better-sqlite3 12.9.0, zod 4.4.3 [VERIFIED: npm view]

### Secondary (MEDIUM confidence)
- Python `backend/services/source_editor.py` — source file editing depends on RAG/LLM [VERIFIED: codebase read]
- Python `backend/config.py` — default_models dict, settings paths [VERIFIED: codebase read]
- Python `backend/deps.py` — fakeauth via X-Teacher-Id header [VERIFIED: codebase read]

### Tertiary (LOW confidence)
- npm `fernet` package availability and API compatibility with Python Fernet — needs verification before use [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry and codebase inspection
- Architecture: HIGH — direct port from verified Python reference implementation
- Pitfalls: HIGH — crypto mismatch verified by comparing Python `security.py` and Express `crypto.js`
- Phase 3 dependencies: MEDIUM — inferred from source_editor.py imports (RAG, LLM), not explicitly documented as Phase 3

**Research date:** 2026-05-11
**Valid until:** 30 days (stable domain — Express 5, better-sqlite3, SQLite are mature)
