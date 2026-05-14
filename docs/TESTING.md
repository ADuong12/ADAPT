<!-- generated-by: gsd-doc-writer -->

# Testing

## Test Framework and Setup

ADAPT uses **Vitest 4.1.6** as its test framework with **supertest 7.2.2** for HTTP integration testing. All 129 tests run in-process — no separate server instance is needed.

**Configuration**: `server/vitest.config.js`

- Tests are located in `server/tests/**/*.test.js`
- Setup file: `server/tests/setup.js` (runs before each test suite)
- `fileParallelism: false` — tests run sequentially to avoid SQLite locking issues
- Test timeout: 10 seconds (hook timeout: 15 seconds)

### Key configuration

```js
// vitest.config.js
{
  include: ['tests/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  fileParallelism: false,
  clearMocks: true,
  restoreMocks: true,
}
```

## Running Tests

```bash
# Run all tests
cd server && npm test

# Run with verbose output
cd server && npx vitest run --reporter=verbose

# Run with coverage
cd server && npm run test:coverage

# Watch mode
cd server && npm run test:watch

# Run a single test file
cd server && npx vitest run tests/auth.test.js

# Run a single test by name pattern
cd server && npx vitest run -t "register"
```

**Prerequisites:** None beyond `npm install`. Tests run in-process against the same SQLite database used by the app. The `setup.js` file cleans test tables before each suite to ensure isolation.

## Test Files

| File | Tests | Description |
|------|-------|-------------|
| `tests/auth.test.js` | — | Registration, login, refresh, logout, setup-password, /me |
| `tests/middleware.test.js` | — | JWT requireAuth, requireRole, requireOwnerOrAdmin |
| `tests/crypto.test.js` | — | AES-256-GCM encrypt/decrypt/redact |
| `tests/protected-routes.test.js` | — | Endpoints requiring auth return 401 without token |
| `tests/routes/teachers.test.js` | — | Dashboard, classes, students |
| `tests/routes/lessons.test.js` | — | Lesson CRUD, search, source files |
| `tests/routes/clusters.test.js` | — | Cluster listing, KB assignment |
| `tests/routes/knowledge-bases.test.js` | — | KB listing |
| `tests/routes/settings.test.js` | — | LLM config CRUD, encryption, redaction |
| `tests/routes/admin.test.js` | — | Admin overview, teachers, classes, clusters |
| `tests/routes/adaptations.test.js` | — | Generate, refine, rollback, feedback, versions, print |
| `tests/routes/file-edits.test.js` | — | Source file AI editing |

## Test Helpers

`server/tests/helpers.js` provides utilities for authentication in tests:

```js
import { generateToken, teacherToken, adminToken, wrongTeacherToken, authHeader } from './helpers';

// Generate a JWT for any user
const token = generateToken({ teacher_id: 5, role: 'teacher', institution_id: 2 });

// Pre-made tokens
const teacherAuth = authHeader(teacherToken());   // teacher_id=1, role=teacher
const adminAuth = authHeader(adminToken());        // teacher_id=4, role=admin
const crossTeacherAuth = authHeader(wrongTeacherToken()); // teacher_id=2, role=teacher
```

### Test Authentication

Tests use real JWT tokens created by `helpers.js`:

- **Regular teacher**: `teacher_id=1` (Maria Hernandez), `role=teacher`
- **Admin teacher**: `teacher_id=4` (Robert Chen), `role=admin`
- **Cross-teacher**: `teacher_id=2` (different teacher), for authorization boundary tests
- Omitting the `Authorization` header triggers `401 Unauthorized` responses
- Using the wrong teacher triggers `403 Forbidden` on owner-only resources

### Setup and Teardown

`server/tests/setup.js`:

- Exports `TEST_USER` object for reference
- Exports `MOCK_LLM_RESPONSE` for mocking LLM calls in adaptation tests
- Exports `MOCK_EMBEDDING` for mocking embedding vectors
- Exports `cleanTestTables()` which clears test data from: `adapted_lesson`, `lesson_plan_version`, `lesson_kb_used`, `adaptation_feedback`, `rag_context_log`, `refresh_token`, and test-created teachers
- Called in `beforeEach` or `beforeAll` hooks as needed

## Writing New Tests

### File and naming conventions

- Test files go in `server/tests/` (root) or `server/tests/routes/` (route integration tests)
- Follow the naming pattern `*.test.js`
- Group related tests with `describe()` blocks
- Each `test()` or `it()` name should clearly describe what is being tested

### Example: Route integration test

```js
import request from 'supertest';
import app from '../src/app';
import { teacherToken, authHeader } from './helpers';

describe('GET /api/lessons', () => {
  test('returns all lessons for authenticated user', async () => {
    const res = await request(app)
      .get('/api/lessons')
      .set(authHeader(teacherToken()));
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/lessons');
    expect(res.status).toBe(401);
  });
});
```

### Example: Unit test

```js
import { encrypt, decrypt, redact } from '../src/services/crypto';

describe('crypto', () => {
  test('encrypt then decrypt returns original', () => {
    const original = 'my-secret-api-key';
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  test('redact shows first 3 and last 4 chars', () => {
    expect(redact('sk-1234567890abcdef')).toBe('sk-\u2026cdef');
  });
});
```

### Mocking external services

For tests that hit LLM or RAG endpoints, mock the external calls:

```js
import { vi } from 'vitest';

// Mock OpenRouter LLM service
vi.mock('../src/services/llm/openrouter', () => ({
  OpenRouterProvider: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      text: JSON.stringify({ recommendations: [], plan_steps: [], companion_materials: [] }),
      model: 'test-model',
      provider: 'openrouter',
      tokenCount: 100,
    }),
    ping: vi.fn().mockResolvedValue([true, null]),
  })),
}));
```

### Test data

The database is seeded from `adapt-database.sql` with:

- 3 institutions
- 4 teachers (IDs 1-4, with ID 4 as admin, password `admin123`)
- 7 clusters
- 12 students
- 3 lessons
- 4 adapted lessons
- 16 knowledge bases

Tests should reference specific IDs only when testing ownership/authorization boundaries. For existence-based assertions, use `>=` checks rather than exact counts to remain resilient to seed changes.

## Coverage

```bash
cd server && npm run test:coverage
```

This generates a V8 coverage report. No coverage threshold is currently enforced.

## CI Integration

No CI pipeline is configured. Tests must be run manually (`cd server && npm test`) before merging changes.