# CommerceForce Backend — Code Rules

## Python Async — Critical

### Always `await` SQLAlchemy async methods

`AsyncSession` methods (`delete`, `add`, `flush`, `commit`, `refresh`, `execute`) are all coroutines. Calling them without `await` creates a coroutine object that is silently discarded — no error, no warning, nothing happens. This bug has appeared 3 times in this project. Deletes appeared to succeed (API returned 204) but the database record was never touched.

```python
# WRONG — silent no-op, nothing is deleted
db.delete(obj)

# CORRECT
await db.delete(obj)
```

Same rule applies to every `db.*` method: `add`, `flush`, `commit`, `refresh`, `execute`.

### Audit all instances when you find one

If you find a missing `await` on any `db.*` call, immediately search all service files for the same pattern before fixing just one instance. Same bug in one place means same bug in other places.

---

## Running the Linter

Before committing, run from `backend/`:

```powershell
.venv\Scripts\ruff.exe check .       # async patterns + general style
.venv\Scripts\mypy.exe app/          # catches unawaited coroutines
```

Both are configured in `pyproject.toml`. The key mypy setting is `warn_unused_coroutines = true` — this flags exactly the missing-`await` pattern by detecting when a coroutine return value is discarded without being awaited.

---

## Plugin structure

Each plugin lives in `app/plugins/<name>/` with:
- `manifest.py` — name, menu items, permissions, dependencies
- `router.py` — FastAPI routes
- `models.py` — SQLAlchemy models
- `schemas.py` — Pydantic schemas (note: list endpoints use `*ListOut` schemas with a `primary_image: str` field; detail endpoints use `*Out` schemas with full `images: List[*ImageOut]` arrays — these are different shapes)
- `service.py` — business logic (async functions, must `await` all db calls)

## Development Commands

```powershell
# From backend/
.venv\Scripts\python.exe -m pytest -q        # run all 200 tests
.venv\Scripts\ruff.exe check .               # lint
.venv\Scripts\mypy.exe app/                  # type check
.venv\Scripts\python.exe -m uvicorn app.main:app --reload  # start API on :8000
```
