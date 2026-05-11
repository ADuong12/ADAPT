<!-- generated-by: gsd-doc-writer -->

# Testing

## Test Framework and Setup

ADAPT uses **pytest** as its test framework with the **requests** library for HTTP-based integration testing. All tests are integration-level and require a live server running with a seeded database.

**Prerequisites:**

- Python 3.10+ with project dependencies installed (`pip install -r requirements.txt`)
- The `adapt.db` SQLite database file must exist with seeded data (from `adapt-database.sql`)
- The uvicorn server must be running before executing tests

Install test dependencies:

```bash
pip install pytest requests
```

> **Note:** `requests` is already listed in `requirements.txt` as a project dependency. `pytest` must be installed separately for running the test suite.

## Running Tests

### Start the server first

All tests are integration tests that issue real HTTP requests against a running server. Start the server before running tests:

```bash
python start_server.py
```

This launches uvicorn on `http://127.0.0.1:8000` in the background. You can verify it's running:

```bash
python start_server.py --status
```

Stop the server after testing:

```bash
python start_server.py --stop
```

### Run the full test suite

```bash
pytest
```

### Run with verbose output

```bash
pytest tests/test_api.py -v
```

### Run a single test class

```bash
pytest tests/test_api.py::TestLessons -v
```

### Run a single test

```bash
pytest tests/test_api.py::TestLessons::test_get_lesson -v
```

> **Important:** If the server is not running, the `live_server` session-scoped fixture will fail immediately with a clear error message, preventing false negatives from connection issues.

## Writing New Tests

### File and class conventions

- Test files live in `tests/` and follow the naming pattern `test_*.py`
- Group related endpoint tests into classes (e.g., `TestLessons`, `TestAuth`, `TestAdmin`)
- Each test method name should clearly describe what is being tested (e.g., `test_list_lessons_requires_auth`)

### Available fixtures

The shared fixtures are defined in `tests/conftest.py`:

| Fixture | Scope | Description |
|---|---|---|
| `base_url` | session | Returns `"http://127.0.0.1:8000"` — the server base URL |
| `h` | function | Teacher auth headers: `{"X-Teacher-Id": "1"}` (Maria Hernandez) |
| `admin_h` | function | Admin auth headers: `{"X-Teacher-Id": "4"}` (Robert Chen) |
| `live_server` | session | Health-checks the server at `/api/health`; fails the session if unreachable |

### Helper function

`test_api.py` provides an `api()` helper for making requests:

```python
def api(base_url: str, path: str, headers: dict | None = None,
        method: str = "GET", body: dict | None = None):
```

### Authentication

Tests use a simplified fake-auth mechanism via the `X-Teacher-Id` header:

- **Regular teacher:** `X-Teacher-Id: 1` (Maria Hernandez) — used via the `h` fixture
- **Admin teacher:** `X-Teacher-Id: 4` (Robert Chen) — used via the `admin_h` fixture
- Omitting the header triggers `401 Unauthorized` responses on protected endpoints
- Using the wrong teacher ID triggers `403 Forbidden` on cross-teacher resources

### Example test

```python
class TestMyFeature:
    def test_something(self, base_url, live_server, h):
        r = api(base_url, "/api/my-endpoint", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "expected_key" in data
```

### Test data

The database is seeded from `adapt-database.sql` with:

- 3 institutions
- 4 teachers (IDs 1–4, with ID 4 as admin)
- 7 clusters
- 12 students
- 3 lessons
- 4 adapted lessons
- 16 knowledge bases

Tests should reference specific IDs only when testing ownership/authorization boundaries (e.g., teacher 1 cannot access teacher 2's adaptations). For existence-based assertions, use `>=` checks rather than exact counts to remain resilient to seed changes.

## Coverage Requirements

No coverage threshold is configured. There is no `pytest.ini`, `pyproject.toml`, or `setup.cfg` defining coverage settings for this project.

To run tests with coverage (optional):

```bash
pip install pytest-cov
pytest --cov=backend tests/
```

## CI Integration

No CI pipeline is configured. There are no `.github/workflows/` files or other CI configuration files in the repository. Tests must be run manually before merging changes.

## Manual Testing

A step-by-step manual browser walkthrough is available at `tests/manual-walkthrough.md`. It covers:

1. **Login** — Selecting a seeded teacher at `http://localhost:8000/app/login.html`
2. **Dashboard** — Verifying metrics, recent adaptations, and sidebar navigation
3. **My Classes** — Viewing student rosters and cluster assignments
4. **Lesson Library** — Browsing seeded lessons and source files
5. **Knowledge Bases** — Browsing KB entries
6. **Lesson Planning** — Creating a new adaptation via the multi-step wizard
7. **Adaptation Results** — Reviewing, printing, exporting, and providing feedback
8. **Settings** — Configuring LLM provider, model, and API key
9. **Admin Panel** — Viewing institution-wide overview (admin teachers only)

To use the manual walkthrough:

```bash
python start_server.py
# Open http://localhost:8000/app/login.html in a browser
# Follow steps in tests/manual-walkthrough.md
```