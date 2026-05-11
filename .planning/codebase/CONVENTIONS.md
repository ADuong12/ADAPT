# Coding Conventions

**Analysis Date:** 2026-05-11

## Naming Patterns

**Files:**
- Python modules: `snake_case.py` — e.g., `source_editor.py`, `versioning.py`, `adaptation.py`
- Router modules: `snake_case.py` matching route prefix — e.g., `knowledge_bases.py` → `/api/knowledge-bases`
- Service modules: `snake_case.py` — e.g., `renderer.py`, `chunker.py`
- Pydantic schemas: single file `schemas.py` grouping all request/response models
- SQLAlchemy models: single file `models.py` grouping all ORM classes
- Frontend HTML: `kebab-case.html` — e.g., `lesson-library.html`, `kb-browser.html`
- Frontend JS: `camelCase.js` — e.g., `api.js`, `auth.js`
- Jinja2 templates: `snake_case.html.j2` — e.g., `lesson_plan.html.j2`
- Prompt text files: `snake_case.txt` in `backend/prompts/`

**Functions:**
- `snake_case` throughout — e.g., `_build_context_blocks()`, `source_files_for_lesson()`, `head_version()`
- Private helpers: leading underscore `_` — e.g., `_norm()`, `_safe_filename()`, `_kb_specs()`
- FastAPI route handlers: short verb-based names — e.g., `list_lessons()`, `dashboard()`, `adapt()`

**Variables:**
- `snake_case` — e.g., `user_prompt`, `kb_specs`, `chunk_meta`
- Module-level singletons: `snake_case` — e.g., `settings`, `engine`, `SessionLocal`

**Types/Classes:**
- SQLAlchemy models: `PascalCase` — e.g., `AdaptedLesson`, `StudentCluster`, `LessonPlanVersion`
- Pydantic schemas: `PascalCase` with suffix convention:
  - `*Out` for response models — e.g., `TeacherOut`, `LessonOut`, `AdaptationOut`
  - `*In` for request bodies — e.g., `AdaptRequest`, `FeedbackIn`, `LLMConfigIn`
  - `*Base` for shared base — e.g., `_Base` (private internal base)
  - Compound names: `ClusterWithKBs`, `RecentAdaptation`, `VersionSummary`
- Dataclasses: `PascalCase` — e.g., `LLMResult`, `Chunk`, `RetrievedChunk`

**Constants:**
- `UPPER_SNAKE_CASE` for module-level constants — e.g., `ALLOWED_EXTENSIONS`, `_JSON_FENCE`, `KB_FILE_MAP`
- Route prefixes as string literals — e.g., `prefix="/api/clusters"`

## Code Style

**Formatting:**
- No linter or formatter config file detected (no `.eslintrc`, `.prettierrc`, `biome.json`, `pyproject.toml` formatter section)
- Python files consistently use `from __future__ import annotations` as the first import in every module
- Indentation: 4 spaces (Python standard)
- Max line length ~110 characters observed, not strictly enforced
- String quotes: no consistent convention (both single and double quotes appear)

**Type Annotations:**
- Extensive use of Python 3.10+ union syntax: `str | None` (not `Optional[str]`)
- All FastAPI route handlers have return type annotations matching `response_model` parameter
- Service function signatures use keyword-only arguments with `*`: e.g., `def generate(db, *, teacher, lesson_id, ...)`
- SQLAlchemy 2.0 style: `Mapped[int]`, `Mapped[str | None]`, `mapped_column()`

**Key Style Rules:**
1. Every Python file starts with `from __future__ import annotations`
2. FastAPI route handlers specify `response_model=schemas.SomeOut` on decorator
3. Service layer functions accept `db: Session` as first positional arg, rest keyword-only
4. Router helper functions use underscore prefix `_` for non-route utilities — e.g., `_summary()`, `_adaptation_out()`
5. Protocol classes for abstract interfaces — e.g., `LLMProvider` in `backend/llm/base.py`
6. `@lru_cache` used for singleton initialization — e.g., `_env()` in `renderer.py`, `get_model()` in `embedder.py`, `get_client()` in `store.py`

## Import Organization

**Order (observed consistently):**
1. `from __future__ import annotations` — always first
2. Standard library — e.g., `json`, `re`, `time`, `pathlib`
3. Third-party — e.g., `from fastapi import ...`, `from sqlalchemy import ...`, `from pydantic import ...`
4. Local/relative — e.g., `from .. import models, schemas`, `from .config import settings`

**Patterns:**
- Relative imports used exclusively within `backend/` package:
  - `from .. import models, schemas` — imports from `backend/__init__.py` (though it's empty, these resolve to the module files)
  - `from ..db import get_db` — parent package
  - `from ..deps import current_teacher` — parent package
  - `from ..config import settings` — parent package
  - `from ..llm import LLMResult, make_provider` — sibling subpackage
  - `from . import adaptation, versioning` — same-package sibling modules
  - `from .base import LLMResult` — same-package module

- No barrel `__init__.py` re-exports except in `backend/llm/__init__.py` which exports `LLMProvider`, `LLMResult`, `PROVIDERS`, `make_provider`, and provider classes
- `__init__.py` files in `backend/routers/`, `backend/services/`, `backend/rag/` are empty

**Import Conventions for New Modules:**
```python
from __future__ import annotations

import json  # stdlib
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException  # third-party
from sqlalchemy.orm import Session

from .. import models, schemas  # local
from ..db import get_db
```

## Error Handling

**Strategy:** Service layer raises Python built-in exceptions; router layer converts to HTTP status codes.

**Patterns:**

1. **LookupError** for not-found/business-lookup failures:
   ```python
   # In services (backend/services/adaptation.py)
   if not lesson or not cluster:
       raise LookupError("lesson or cluster not found")
   ```
   ```python
   # In routers — caught and converted
   except LookupError as e:
       raise HTTPException(404, str(e)) from e
   ```

2. **RuntimeError** for business logic failures (e.g., no LLM configured, LLM parse failure):
   ```python
   # backend/services/adaptation.py
   raise RuntimeError("No LLM configured. Add an API key in Settings...")
   ```
   ```python
   except RuntimeError as e:
       raise HTTPException(400, str(e)) from e
   ```

3. **HTTPException** directly in routers for auth/authorization:
   ```python
   # backend/deps.py
   raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing X-Teacher-Id header")
   raise HTTPException(status.HTTP_403_FORBIDDEN, "admin only")
   ```

4. **Graceful degradation** in LLM JSON parsing:
   ```python
   # backend/services/adaptation.py — _coerce_to_plan_json()
   try:
       data = json.loads(candidate)
   except json.JSONDecodeError:
       return {"recommendations": [...malformed fallback...], ...}
   ```

5. **Database session management** — `session_scope()` context manager with rollback:
   ```python
   # backend/db.py
   @contextmanager
   def session_scope() -> Iterator[Session]:
       db = SessionLocal()
       try:
           yield db
           db.commit()
       except Exception:
           db.rollback()
           raise
       finally:
           db.close()
   ```
   Note: `session_scope()` exists but most routers use `Depends(get_db)` with explicit `db.commit()` instead.

6. **Path traversal protection** in source editor:
   ```python
   # backend/services/source_editor.py — _resolve_source_path()
   if base not in candidate.parents and candidate != base:
       raise LookupError("source file must be inside Sample Lessons")
   ```

## Logging

**Framework:** No formal logging framework. `print()` is used in scripts only (`scripts/migrate.py`, `scripts/seed_versions.py`, `scripts/ingest_kbs.py`).

**Backend application code:** No logging at all — no `import logging`, no `logger = ...`, no `log.info()` calls. This is a gap.

**Patterns:**
- Scripts use `print()` for progress output
- LLM provider errors propagate as exceptions (no catch-and-log)
- Service layer doesn't log operations

## Comments

**When to Comment:**
- Module-level docstrings: Rare. Only `start_server.py` and `scripts/migrate.py` have them
- Function docstrings: Used for complex service functions — e.g., `_build_context_blocks()` has a docstring: `"""Returns (user_prompt, retrieved_chunks_metadata)."""`
- `backend/services/adaptation.py`'s `_coerce_to_plan_json()` has inline comment explaining LLM fence handling
- Config file `backend/config.py` has inline comments explaining each setting
- Inline comments are sparse; code is generally self-documenting through clear naming

**JSDoc/TSDoc:**
- Frontend JS files (`api.js`, `auth.js`) have a brief comment block at top explaining purpose, no JSDoc on individual functions
- No TypeScript in the project

## Function Design

**Size:** Functions range from small (router handlers ~10 lines) to medium (service helpers ~40 lines). The largest functions are in `backend/services/source_editor.py` (`edit_source_file()` ~70 lines) and `backend/services/adaptation.py` (`generate()` ~90 lines).

**Parameters:**
- Service functions use keyword-only arguments after `db: Session`:
  ```python
  def generate(
      db: Session,
      *,
      teacher: models.Teacher,
      lesson_id: int,
      cluster_id: int,
      ...
  ) -> models.LessonPlanVersion:
  ```
- FastAPI route handlers follow the `Depends()` injection pattern
- Private helpers group related arguments into a typed parameter when there are many

**Return Values:**
- Router handlers return Pydantic schema instances or `dict`
- Service functions return ORM model instances — e.g., `models.LessonPlanVersion`
- Some services return plain `dict` — e.g., `_kb_specs()` returns `list[dict]`
- The `_adaptation_out()` helper in `backend/routers/adaptations.py` returns a constructed Pydantic schema

## Module Design

**Exports:**
- `backend/llm/__init__.py` explicitly defines `__all__` and re-exports:
  ```python
  __all__ = ["LLMProvider", "LLMResult", "GeminiProvider", "OpenRouterProvider", "HuggingFaceProvider", "PROVIDERS", "make_provider"]
  ```
- Other package `__init__.py` files are empty — modules are imported directly
- Schemas are imported from the single `schemas.py` module, not via `__init__.py`

**Barrel Files:**
- Not used as a convention. `backend/routers/__init__.py` and `backend/services/__init__.py` are empty
- All imports reference specific modules: `from ..routers import adaptations, admin, auth, ...`

**Package Structure Convention:**
Each subdomain has its own router module registered in `backend/main.py`:
```python
from .routers import adaptations, admin, auth, clusters, file_edits, knowledge_bases, lessons, settings as settings_router, teachers
app.include_router(adaptations.router)
app.include_router(admin.router)
# ...
```

## API Conventions

**URL Pattern:** `/api/{resource}` with nested resources:
- `GET /api/lessons` — list
- `GET /api/lessons/{id}` — get by ID
- `POST /api/lessons/{id}/edit-source-file` — action on specific resource
- `GET /api/adaptations/{id}/versions` — nested collection
- `POST /api/adaptations/{id}/refine` — action endpoint

**Authentication:** MVP "fakeauth" using `X-Teacher-Id` header, implemented in `backend/deps.py`:
```python
def current_teacher(x_teacher_id: int | None = Header(default=None, alias="X-Teacher-Id"), db = Depends(get_db)):
    ...
```

**Authorization pattern:**
- `_ensure_self_or_admin()` in `backend/routers/teachers.py` — checks identity or admin role
- `_ensure_self()` in `backend/routers/settings.py` — checks identity only (no admin override)
- Ownership checks inline in `backend/routers/adaptations.py` — `if adapted.teacher_id != teacher.teacher_id and teacher.role != "admin"`

**Response Models:**
- All GET endpoints specify `response_model=schemas.SomeOut`
- Mutating endpoints return the updated resource or `dict` with `{"ok": True, ...}`

## Configuration Conventions

**Settings class pattern** (`backend/config.py`):
- Module-level `Settings` class with class attributes
- `load_dotenv()` called at module level for `.env` and `keys.env`
- Singleton instance: `settings = Settings()`
- Path attributes resolve relative to `ROOT = Path(__file__).resolve().parent.parent`
- Environment variables read via `os.getenv()` with defaults

**Secrets:**
- Encrypted at rest using Fernet (`backend/security.py`)
- `.env` and `keys.env` in `.gitignore`
- `.env.example` and `keys.env.example` committed as templates
- Auto-generated `.secret_key` stored for Fernet, also gitignored

## Frontend Conventions

**HTML/JS Prototype** in `adapt-frontend-prototype-echristian-aduong/`:
- Vanilla JavaScript (no framework)
- `api.js` provides a global `ADAPT_API` object with `get`, `post`, `put`, `patch` methods
- `auth.js` uses an IIFE pattern `(function () { ... })()`
- Auth state stored in `localStorage`: `currentTeacherId`, `currentTeacherRole`, `currentTeacherName`
- CSS in single `style.css` file
- Server-side static mount at `/app`

---

*Convention analysis: 2026-05-11*