# Testing Patterns

**Analysis Date:** 2026-05-11

## Test Framework

**Runner:**
- pytest (listed in `requirements.txt` implicitly — not pinned but assumed)
- No `pytest.ini`, `pyproject.toml`, or `setup.cfg` configuration file
- No custom pytest plugins or markers

**Assertion Library:**
- Standard pytest assertions (`assert` statements)
- `requests` library for HTTP calls against live server

**Run Commands:**
```bash
pytest tests/                    # Run all tests (requires live server)
pytest tests/test_api.py         # Run API tests only
pytest tests/test_api.py::TestHealth  # Run a specific test class
pytest tests/test_api.py::TestHealth::test_health  # Run a specific test
```

**Note:** No `pytest.ini` or `pyproject.toml` configuration is present. All pytest behavior uses defaults.

## Test File Organization

**Location:**
- Separate `tests/` directory at project root (not co-located with source)
- No per-module test files within `backend/`
- Only one test module: `tests/test_api.py`

**Naming:**
- Test files: `test_*.py`
- Test classes: `Test*` grouping by domain — e.g., `TestHealth`, `TestLessons`, `TestClusters`, `TestAuth`
- Test methods: `test_*` descriptive names — e.g., `test_list_lessons`, `test_get_lesson_not_found`

**Structure:**
```
tests/
├── __init__.py          # Empty
├── conftest.py          # Shared fixtures
├── test_api.py          # All integration tests (472 lines)
└── manual-walkthrough.md  # Manual browser testing guide
```

## Test Structure

**Suite Organization:**
```python
# tests/test_api.py — Class-based grouping by domain
class TestHealth:
    def test_health(self, base_url, live_server):
        r = api(base_url, "/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True

class TestLessons:
    def test_list_lessons(self, base_url, h):
        ...

class TestAdaptations:
    def test_get_adaptation(self, base_url, h):
        ...
```

**Test class taxonomy** (9 classes in `test_api.py`):
| Class | Lines | Domain |
|-------|-------|--------|
| `TestHealth` | 22-35 | Health check & root endpoint |
| `TestLessons` | 39-79 | Lesson CRUD & source files |
| `TestClusters` | 84-118 | Cluster listing & KB mapping |
| `TestKnowledgeBases` | 122-133 | KB listing |
| `TestTeachers` | 137-191 | Dashboard, classes, student update |
| `TestAuth` | 195-232 | Auth endpoints & fake login |
| `TestSettings` | 237-282 | LLM config CRUD & test connection |
| `TestAdmin` | 286-313 | Admin-only endpoints |
| `TestAdaptations` | 318-413 | Adaptation lifecycle, versions, feedback |
| `TestFrontend` | 417-472 | Static HTML/JS serving |

**Helper function** defined at module level:
```python
def api(base_url: str, path: str, headers: dict | None = None, method: str = "GET", body: dict | None = None):
    url = f"{base_url}{path}"
    kwargs = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    r = requests.request(method, url, timeout=10, **kwargs)
    return r
```

## Fixtures

**`conftest.py`** provides 4 fixtures:

```python
BASE = "http://127.0.0.1:8000"
TEACHER_HEADERS = {"X-Teacher-Id": "1"}
ADMIN_HEADERS = {"X-Teacher-Id": "4"}

@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE

@pytest.fixture
def h() -> dict:
    return dict(TEACHER_HEADERS)

@pytest.fixture
def admin_h() -> dict:
    return dict(ADMIN_HEADERS)

@pytest.fixture(scope="session")
def live_server(base_url: str) -> bool:
    try:
        r = requests.get(f"{base_url}/api/health", timeout=5)
        assert r.status_code == 200
        return True
    except Exception as e:
        pytest.fail(f"Server not reachable at {base_url}: {e}")
```

**Key fixture details:**
- `base_url` — session-scoped, returns hardcoded `http://127.0.0.1:8000`
- `h` — function-scoped, returns copy of `TEACHER_HEADERS` (teacher ID 1 = "Maria Hernandez")
- `admin_h` — function-scoped, returns copy of `ADMIN_HEADERS` (teacher ID 4 = "Robert Chen")
- `live_server` — session-scoped, pre-flight checks server is running; fails entire session if not reachable

## Mocking

**Framework:** No mocking framework used. All tests hit a real running server with a real database.

**No mocks are employed for:**
- Database queries
- LLM API calls (the `TestSettings::test_test_connection` test hits the real API with a test key, expecting failure)
- ChromaDB/RAG operations

**What this means for new tests:**
- Tests are integration tests by nature — they exercise the full stack
- Tests are order-dependent — mutating operations (e.g., `test_put_config`, `test_rollback`) change shared database state
- No isolation between test classes or methods

## Fixtures and Factories

**Test Data:** No test data factories. Tests rely on the seeded `adapt.db` database with:
- 4 teachers (IDs 1-4)
- 7 clusters
- 12 students
- 16 knowledge bases
- 3 base lessons
- 4 pre-seeded adapted lessons

**Seed data reference** (from `tests/manual-walkthrough.md`):
| Entity | Count | Notes |
|--------|-------|-------|
| Institutions | 3 | Lincoln Elementary, Riverside Academy, Maplewood K-8 |
| Teachers | 4 | Maria, James, Priya, Robert |
| Learner profiles | 7 | Below/On/Above Grade, Spanish MLL, etc. |
| Students | 12 | Distributed across seeded classes |
| KBs | 16 | Personalization + Pedagogy |
| Base lessons | 3 | Agent Lion, Acorn, Sharing Culture |
| Adapted lessons | 4 | Pre-seeded with v1 versions |

**Seeding tools** (not test fixtures, but relevant):
- `scripts/migrate.py` — applies DDL from `adapt-database.sql`
- `scripts/seed_versions.py` — creates v1 lesson plan versions from adapted_lesson data
- `scripts/ingest_kbs.py` — loads KB documents into ChromaDB

## Coverage

**Requirements:** No coverage enforcement. No coverage configuration or minimum threshold.

**View Coverage:**
```bash
pytest --cov=backend tests/    # Requires pytest-cov (not in requirements.txt)
```

**Current coverage gaps — untested modules:**
| Module | Has Tests? | Notes |
|--------|-----------|-------|
| `backend/routers/adaptations.py` | Partial | Tested via `TestAdaptations` HTTP calls |
| `backend/routers/auth.py` | Yes | `TestAuth` |
| `backend/routers/lessons.py` | Yes | `TestLessons` |
| `backend/routers/clusters.py` | Yes | `TestClusters` |
| `backend/routers/knowledge_bases.py` | Yes | `TestKnowledgeBases` |
| `backend/routers/teachers.py` | Yes | `TestTeachers` |
| `backend/routers/settings.py` | Yes | `TestSettings` |
| `backend/routers/admin.py` | Yes | `TestAdmin` |
| `backend/routers/file_edits.py` | Minimal | Only 404 test for missing file |
| `backend/services/adaptation.py` | Indirect | Tested through adaptation endpoints |
| `backend/services/versioning.py` | Indirect | Tested through version endpoints |
| `backend/services/renderer.py` | Indirect | Tested through adaptation output |
| `backend/services/source_editor.py` | Minimal | Only missing-file 404 case |
| `backend/llm/*` | None | No unit tests for LLM providers |
| `backend/rag/*` | None | No unit tests for RAG pipeline |
| `backend/security.py` | None | No unit tests for encrypt/decrypt |
| `backend/models.py` | None | No model-level validation tests |
| `backend/schemas.py` | None | No Pydantic validation edge-case tests |
| `backend/db.py` | None | No unit tests for session management |
| `backend/config.py` | None | No config tests |

## Test Types

**Unit Tests:**
- None. The project has zero unit tests. All service functions, utilities, and helpers are untested in isolation.

**Integration Tests:**
- `tests/test_api.py` — HTTP-level integration tests requiring a running server
- Tests exercise the full FastAPI + SQLAlchemy + SQLite stack
- Auth flow tested with `X-Teacher-Id` header

**E2E Tests:**
- Not formally automated
- `tests/manual-walkthrough.md` — detailed manual testing guide for browser-based flows
- Frontend HTML serving is tested via HTTP status checks in `TestFrontend`

**Missing test categories:**
- No unit tests for service-layer logic (adaptation generation, versioning, source editing)
- No tests for LLM provider abstraction (`backend/llm/`)
- No tests for RAG pipeline (`backend/rag/`)
- No tests for security module (encryption/redaction)
- No negative edge-case tests for schema validation beyond one 422 test
- No concurrency or performance tests

## Common Patterns

**HTTP Request Testing:**
```python
def test_list_lessons(self, base_url, h):
    r = api(base_url, "/api/lessons", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    for lesson in data:
        assert "lesson_id" in lesson
        assert "title" in lesson
```

**Authentication Testing:**
```python
def test_list_lessons_requires_auth(self, base_url):
    r = api(base_url, "/api/lessons")  # No headers
    assert r.status_code == 401
```

**Authorization Testing:**
```python
def test_dashboard_other_teacher_forbidden(self, base_url, h):
    r = api(base_url, "/api/teachers/2/dashboard", headers=h)
    assert r.status_code == 403

def test_dashboard_admin_can_see_any(self, base_url, admin_h):
    r = api(base_url, "/api/teachers/2/dashboard", headers=admin_h)
    assert r.status_code == 200
```

**Mutation Testing:**
```python
def test_put_config(self, base_url, h):
    r = api(base_url, "/api/teachers/1/llm-config", method="PUT", headers=h, body={
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "api_key": "sk-test-key-12345",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "gemini"
    assert data["api_key_redacted"] != "sk-test-key-12345"
```

**Error Testing:**
```python
def test_get_lesson_not_found(self, base_url, h):
    r = api(base_url, "/api/lessons/999", headers=h)
    assert r.status_code == 404

def test_feedback_bad_rating(self, base_url, h):
    r = api(base_url, "/api/adaptations/1/feedback", method="POST", headers=h, body={
        "rating": 99,
    })
    assert r.status_code == 422  # validation error
```

**Async Testing:**
- No async tests. All requests are synchronous `requests.request()` calls with a 10-second timeout.

## Adding New Tests

**Where to add:**
- All integration tests: `tests/test_api.py` (or new `tests/test_{domain}.py` files)
- Unit tests should go in: `tests/test_{module}.py` mirroring `backend/{module}.py`

**Pattern for new API endpoint test:**
```python
class TestNewFeature:
    def test_new_endpoint_happy_path(self, base_url, h):
        r = api(base_url, "/api/new-endpoint", headers=h)
        assert r.status_code == 200
    
    def test_new_endpoint_requires_auth(self, base_url):
        r = api(base_url, "/api/new-endpoint")
        assert r.status_code == 401
```

**Pattern for new unit test (recommended but not yet established):**
```python
# tests/test_versioning.py
import pytest
from backend.services import versioning
from backend.db import SessionLocal

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()

class TestVersioning:
    def test_next_version_number_empty(self, db):
        # ... unit test logic
        pass
```

## Key Limitations

1. **Live server required** — All tests require `python start_server.py` to be running first. No in-process test client (`TestClient`) is used.
2. **Shared mutable state** — Tests mutate the same database. Test order matters. Running `test_put_config` changes state that `test_get_config_after_put` relies on.
3. **No test database isolation** — No fixtures create/roll back transactions. Tests commit to the real `adapt.db`.
4. **No unit tests** — Service functions, LLM providers, RAG pipeline, and security module have zero isolated tests.
5. **No CI configuration** — No GitHub Actions, Makefile, or tox configuration for running tests.
6. **Hardcoded URLs** — `BASE = "http://127.0.0.1:8000"` is hardcoded in `conftest.py`.

---

*Testing analysis: 2026-05-11*