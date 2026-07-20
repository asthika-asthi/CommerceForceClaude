# Page Content Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead admin "Landing Page Sections" screen with a working "Page Content" editor — shop-admins can edit text/image/link content on superadmin-designated homepage sections, live, with no redeploy.

**Architecture:** Shop-admin edits are stored as a JSON overrides blob per section in a new `landing_content_overrides` table, keyed by a superadmin-chosen `section_key`. The backend is the single source of truth: it reads `frontend-starter/landing-page.config.json` directly (no copy, no separate schema file) to know which sections are editable (`adminEditable: true`) and which named fields on them are (`adminEditableFields: [...]`), infers each field's input type (text/image/link) from the field's own name, and enforces the allow-list on save. The storefront merges saved overrides on top of the config's own values at render time — empty overrides table = today's site, unchanged.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic (backend), Next.js 16 App Router + TanStack Query (frontend-admin), Next.js 16 Server Components (frontend-starter storefront), pytest + Playwright for tests.

---

## Before you start

Confirm you're on branch `feat/page-content-editor` (already created, has the approved spec committed at `docs/superpowers/specs/2026-07-20-page-content-editor-design.md`). Read that spec before starting — this plan implements it section by section.

```
git branch --show-current
```
Expected output: `feat/page-content-editor`

---

### Task 1: Backend — settings + config-reading helper

**Files:**
- Modify: `backend/app/core/config.py`
- Create: `backend/app/core/landing_config.py`
- Test: `backend/tests/test_landing_config_helper.py`
- Create: `backend/tests/fixtures/test_landing_config.json`

- [ ] **Step 1: Create the test fixture config file**

Create `backend/tests/fixtures/test_landing_config.json`:

```json
{
  "sections": [
    { "__block": "landing-hero", "title": "Not editable at all" },
    {
      "__block": "landing-trust-strip",
      "adminEditable": true,
      "adminSectionKey": "trust-strip",
      "adminEditableFields": ["title"],
      "title": "Free delivery on all orders"
    },
    {
      "__block": "landing-product-grid",
      "adminEditable": true,
      "adminSectionKey": "hero",
      "adminEditableFields": ["title", "titleHighlight", "bgImageSrc", "missingField"],
      "title": "Original Title",
      "titleHighlight": "our range",
      "bgImageSrc": "/images/hero-bg.jpg"
    }
  ]
}
```

This fixture deliberately covers: a section with no editable flag at all (must be excluded), a section with one editable text field, and a section with two text fields, one image-shaped field, and one field name (`missingField`) that doesn't exist on the section (must be silently skipped, per the spec's error handling).

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_landing_config_helper.py`:

```python
import json
import os

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "test_landing_config.json")


def test_read_landing_sections_returns_all_sections():
    from app.core.landing_config import read_landing_sections
    os.environ["LANDING_CONFIG_PATH"] = FIXTURE_PATH
    from app.core.config import get_settings
    get_settings.cache_clear()

    sections = read_landing_sections()
    assert len(sections) == 3
    assert sections[0]["__block"] == "landing-hero"


def test_get_editable_section_defs_filters_and_extracts():
    from app.core.landing_config import get_editable_section_defs
    os.environ["LANDING_CONFIG_PATH"] = FIXTURE_PATH
    from app.core.config import get_settings
    get_settings.cache_clear()

    defs = get_editable_section_defs()
    keys = {d["section_key"] for d in defs}
    assert keys == {"trust-strip", "hero"}

    hero_def = next(d for d in defs if d["section_key"] == "hero")
    assert hero_def["editable_fields"] == ["title", "titleHighlight", "bgImageSrc", "missingField"]
    assert hero_def["section"]["title"] == "Original Title"
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `backend/`): `.venv\Scripts\python.exe -m pytest tests/test_landing_config_helper.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.landing_config'`

- [ ] **Step 4: Add the setting**

In `backend/app/core/config.py`, add this field inside the `Settings` class, right after the `DATABASE_URL` field:

```python
    # Path to the storefront's landing-page.config.json — read directly by
    # the landing_page plugin so admin-editable sections/fields are defined
    # once, in the file the superadmin already maintains, never duplicated.
    LANDING_CONFIG_PATH: str = "../frontend-starter/landing-page.config.json"
```

- [ ] **Step 5: Create the config-reading helper**

Create `backend/app/core/landing_config.py`:

```python
import json
from pathlib import Path
from typing import Any
from app.core.config import get_settings


def read_landing_sections() -> list[dict[str, Any]]:
    """Read the storefront's landing-page.config.json fresh from disk every call.

    No caching: this file only changes when a superadmin edits and redeploys
    it, and a stale cache would silently show shop-admins the wrong editable
    fields until a backend restart. A disk read is cheap enough not to need one.
    """
    path = Path(get_settings().LANDING_CONFIG_PATH)
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    return data.get("sections", [])


def get_editable_section_defs() -> list[dict[str, Any]]:
    """Sections flagged adminEditable=true, with their key + allow-listed fields."""
    defs = []
    for section in read_landing_sections():
        if section.get("adminEditable") is not True:
            continue
        key = section.get("adminSectionKey")
        fields = section.get("adminEditableFields")
        if not key or not isinstance(fields, list):
            continue
        defs.append({"section_key": key, "editable_fields": fields, "section": section})
    return defs
```

- [ ] **Step 6: Run test to verify it passes**

Run: `.venv\Scripts\python.exe -m pytest tests/test_landing_config_helper.py -v`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```
git add backend/app/core/config.py backend/app/core/landing_config.py backend/tests/test_landing_config_helper.py backend/tests/fixtures/test_landing_config.json
git commit -m "feat(landing_page): add config-reading helper for admin-editable sections"
```

---

### Task 2: Backend — model + migration

**Files:**
- Modify: `backend/app/plugins/landing_page/models.py`
- Modify: `backend/tests/conftest.py:46`
- Create: `backend/alembic/versions/a7f1c3e9b2d4_replace_landing_sections.py`

- [ ] **Step 1: Replace the model**

Replace the entire contents of `backend/app/plugins/landing_page/models.py`:

```python
from typing import Any
from sqlalchemy import String, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class LandingContentOverride(BaseModel):
    __tablename__ = "landing_content_overrides"

    section_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    overrides: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

- [ ] **Step 2: Fix the now-broken import in conftest.py**

In `backend/tests/conftest.py`, line 46 currently reads:

```python
    from app.plugins.landing_page.models import LandingSection  # noqa
```

Change it to:

```python
    from app.plugins.landing_page.models import LandingContentOverride  # noqa
```

- [ ] **Step 3: Run the full test suite to confirm the import fix alone doesn't break collection**

Run (from `backend/`): `.venv\Scripts\python.exe -m pytest tests/ --collect-only -q`
Expected: collection succeeds with errors only in `test_content.py` (the old landing-page tests reference endpoints that still exist for now — Task 5 removes them). If collection itself fails with an `ImportError` unrelated to `test_content.py`, stop and fix before continuing.

- [ ] **Step 4: Write the migration**

Create `backend/alembic/versions/a7f1c3e9b2d4_replace_landing_sections.py`:

```python
"""replace landing_sections with landing_content_overrides

Revision ID: a7f1c3e9b2d4
Revises: e5f6a7b8c9d0
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'a7f1c3e9b2d4'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('landing_sections')
    op.create_table(
        'landing_content_overrides',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('section_key', sa.String(length=100), nullable=False),
        sa.Column('overrides', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('section_key'),
    )


def downgrade():
    op.drop_table('landing_content_overrides')
    op.create_table(
        'landing_sections',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('section_type', sa.String(length=20), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('subtitle', sa.String(length=1000), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=2048), nullable=True),
        sa.Column('cta_text', sa.String(length=200), nullable=True),
        sa.Column('cta_url', sa.String(length=2048), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('background_color', sa.String(length=20), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
```

- [ ] **Step 5: Verify the migration runs cleanly on a fresh database**

Run (from `backend/`):
```
.venv\Scripts\python.exe -c "import os; os.remove('commerceforce_migration_check.db') if os.path.exists('commerceforce_migration_check.db') else None"
set DATABASE_URL=sqlite+aiosqlite:///./commerceforce_migration_check.db
.venv\Scripts\python.exe -m alembic upgrade head
```
Expected: completes with no errors, last line mentions revision `a7f1c3e9b2d4`.

Then clean up the throwaway database: `del commerceforce_migration_check.db`

- [ ] **Step 6: Commit**

```
git add backend/app/plugins/landing_page/models.py backend/tests/conftest.py backend/alembic/versions/a7f1c3e9b2d4_replace_landing_sections.py
git commit -m "feat(landing_page): replace landing_sections table with landing_content_overrides"
```

---

### Task 3: Backend — schemas

**Files:**
- Modify: `backend/app/plugins/landing_page/schemas.py`

- [ ] **Step 1: Replace the schemas**

Replace the entire contents of `backend/app/plugins/landing_page/schemas.py`:

```python
from typing import Literal
from pydantic import BaseModel


class EditableFieldOut(BaseModel):
    name: str
    label: str
    type: Literal["text", "image", "link"]
    value: str


class EditableSectionOut(BaseModel):
    section_key: str
    is_hidden: bool
    fields: list[EditableFieldOut]


class ContentOverrideSave(BaseModel):
    overrides: dict[str, str]
    is_hidden: bool = False


class ContentOverrideEntryOut(BaseModel):
    overrides: dict[str, str]
    is_hidden: bool
```

- [ ] **Step 2: Verify it imports cleanly**

Run (from `backend/`): `.venv\Scripts\python.exe -c "from app.plugins.landing_page import schemas; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```
git add backend/app/plugins/landing_page/schemas.py
git commit -m "feat(landing_page): replace schemas for editable-section API shape"
```

---

### Task 4: Backend — service layer

**Files:**
- Modify: `backend/app/plugins/landing_page/service.py`

- [ ] **Step 1: Replace the service module**

Replace the entire contents of `backend/app/plugins/landing_page/service.py`:

```python
import re
from typing import Any
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.landing_config import get_editable_section_defs
from app.plugins.landing_page.models import LandingContentOverride


def humanize_field_name(name: str) -> str:
    """'bgImageSrc' -> 'Bg Image Src'. No hand-maintained label list to drift."""
    spaced = re.sub(r"(?<!^)(?=[A-Z])", " ", name)
    spaced = spaced.replace("_", " ")
    return spaced.strip().title()


def infer_field_type(field_name: str) -> str:
    lname = field_name.lower()
    if any(token in lname for token in ("image", "logo", "photo", "avatar", "icon")) or lname.endswith("src"):
        return "image"
    if lname.endswith("url") or lname.endswith("href"):
        return "link"
    return "text"


async def get_editable_sections(db: AsyncSession) -> list[dict[str, Any]]:
    defs = get_editable_section_defs()
    result = await db.execute(select(LandingContentOverride))
    override_rows = {row.section_key: row for row in result.scalars().all()}

    sections_out = []
    for d in defs:
        section = d["section"]
        override_row = override_rows.get(d["section_key"])
        saved_overrides = override_row.overrides if override_row else {}
        is_hidden = override_row.is_hidden if override_row else False

        fields_out = []
        for field_name in d["editable_fields"]:
            base_value = section.get(field_name)
            if not isinstance(base_value, str):
                continue  # unknown/non-text field named in the config — skip silently
            current_value = saved_overrides.get(field_name, base_value)
            fields_out.append({
                "name": field_name,
                "label": humanize_field_name(field_name),
                "type": infer_field_type(field_name),
                "value": current_value,
            })

        sections_out.append({
            "section_key": d["section_key"],
            "is_hidden": is_hidden,
            "fields": fields_out,
        })
    return sections_out


async def get_override_map(db: AsyncSession) -> dict[str, dict[str, Any]]:
    result = await db.execute(select(LandingContentOverride))
    return {
        row.section_key: {"overrides": row.overrides, "is_hidden": row.is_hidden}
        for row in result.scalars().all()
    }


async def save_override(
    db: AsyncSession, section_key: str, overrides: dict[str, str], is_hidden: bool
) -> LandingContentOverride:
    defs = {d["section_key"]: d["editable_fields"] for d in get_editable_section_defs()}
    if section_key not in defs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section is not editable")

    allowed_fields = set(defs[section_key])
    unknown = set(overrides.keys()) - allowed_fields
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field(s) not editable on this section: {', '.join(sorted(unknown))}",
        )

    result = await db.execute(
        select(LandingContentOverride).where(LandingContentOverride.section_key == section_key)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = LandingContentOverride(section_key=section_key, overrides=overrides, is_hidden=is_hidden)
        db.add(row)
    else:
        row.overrides = overrides
        row.is_hidden = is_hidden
    await db.commit()
    await db.refresh(row)
    return row
```

- [ ] **Step 2: Verify it imports cleanly**

Run (from `backend/`): `.venv\Scripts\python.exe -c "from app.plugins.landing_page import service; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```
git add backend/app/plugins/landing_page/service.py
git commit -m "feat(landing_page): service layer for editable sections, save, and overrides map"
```

---

### Task 5: Backend — router, manifest, and removing the old admin screen's tests

**Files:**
- Modify: `backend/app/plugins/landing_page/router.py`
- Modify: `backend/app/plugins/landing_page/manifest.py`
- Modify: `backend/tests/test_content.py:217-379`

- [ ] **Step 1: Replace the router**

Replace the entire contents of `backend/app/plugins/landing_page/router.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.landing_page.schemas import EditableSectionOut, ContentOverrideSave, ContentOverrideEntryOut
from app.plugins.landing_page import service

router = APIRouter()


# Static paths declared before /{section_key} — same ordering rule as every
# other plugin router in this codebase (dynamic path segments must come last).

@router.get("/editable", response_model=list[EditableSectionOut], dependencies=[Depends(require_admin())])
async def list_editable_sections(db: AsyncSession = Depends(get_db)):
    return await service.get_editable_sections(db)


@router.get("/overrides", response_model=dict[str, ContentOverrideEntryOut])
async def list_overrides(db: AsyncSession = Depends(get_db)):
    return await service.get_override_map(db)


@router.put("/{section_key}", response_model=EditableSectionOut, dependencies=[Depends(require_admin())])
async def save_section_content(section_key: str, data: ContentOverrideSave, db: AsyncSession = Depends(get_db)):
    await service.save_override(db, section_key, data.overrides, data.is_hidden)
    sections = await service.get_editable_sections(db)
    for s in sections:
        if s["section_key"] == section_key:
            return s
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section is not editable")
```

- [ ] **Step 2: Update the manifest label**

In `backend/app/plugins/landing_page/manifest.py`, change:

```python
    "admin_menu": [
        {"label": "Page Sections", "path": "/admin/landing-page"},
    ],
```

to:

```python
    "admin_menu": [
        {"label": "Page Content", "path": "/admin/landing-page"},
    ],
```

- [ ] **Step 3: Remove the old landing-page tests**

In `backend/tests/test_content.py`, delete the entire block starting at the `# ── LANDING PAGE ──` comment (line 217) up to (not including) the `# ── AI CHAT ───` comment (line 381) — that is, everything through the end of the `test_landing_page_public_list` function body (line 378) plus the blank lines after it (379-380). That's every test between those two section markers — they exercise the `POST /api/landing_page`, `PUT /api/landing_page/{id}`, `DELETE /api/landing_page/{id}`, and `POST /api/landing_page/reorder` endpoints, all of which no longer exist. Replacement tests for the new endpoints are written in Task 6.

- [ ] **Step 4: Run the full backend test suite**

Run (from `backend/`): `.venv\Scripts\python.exe -m pytest tests/ -q`
Expected: all tests pass (the deleted block is gone, nothing else references the old endpoints — confirm with a quick check below).

- [ ] **Step 5: Confirm nothing else references the removed endpoints**

Run (from `backend/`): `findstr /s /m /c:"api/landing_page/reorder" tests\*.py`
Expected: no output (no matches). If there is output, remove those references too before continuing.

- [ ] **Step 6: Commit**

```
git add backend/app/plugins/landing_page/router.py backend/app/plugins/landing_page/manifest.py backend/tests/test_content.py
git commit -m "feat(landing_page): new editable/overrides/save endpoints, remove dead CRUD endpoints"
```

---

### Task 6: Backend — full test coverage for the new endpoints

**Files:**
- Create: `backend/tests/test_landing_content.py`

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_landing_content.py`:

```python
"""Page Content Editor — editable sections, save, and the public overrides map."""
import os
from httpx import AsyncClient

ADMIN_DATA = {"email": "content2_admin@example.com", "password": "adminpass1", "first_name": "Admin", "last_name": "Two"}
CUSTOMER_DATA = {"email": "content2_cust@example.com", "password": "custpass1", "first_name": "Cust", "last_name": "Two"}

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "test_landing_config.json")


async def register_and_token(client: AsyncClient, data: dict) -> str:
    r = await client.post("/api/auth/register", json=data)
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def make_admin(client: AsyncClient, db) -> str:
    await register_and_token(client, ADMIN_DATA)
    from sqlalchemy import update
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == ADMIN_DATA["email"]).values(role=UserRole.admin))
    await db.flush()
    r = await client.post("/api/auth/login", json={"email": ADMIN_DATA["email"], "password": ADMIN_DATA["password"]})
    return r.json()["access_token"]


def set_fixture_config():
    os.environ["LANDING_CONFIG_PATH"] = FIXTURE_PATH
    from app.core.config import get_settings
    get_settings.cache_clear()


async def test_editable_sections_only_returns_flagged_sections(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    r = await client.get("/api/landing_page/editable", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    keys = {s["section_key"] for s in r.json()}
    assert keys == {"trust-strip", "hero"}


async def test_editable_sections_infers_field_types_and_labels(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    r = await client.get("/api/landing_page/editable", headers={"Authorization": f"Bearer {admin_token}"})
    hero = next(s for s in r.json() if s["section_key"] == "hero")
    by_name = {f["name"]: f for f in hero["fields"]}
    assert by_name["title"]["type"] == "text"
    assert by_name["title"]["label"] == "Title"
    assert by_name["titleHighlight"]["label"] == "Title Highlight"
    assert by_name["bgImageSrc"]["type"] == "image"
    assert by_name["bgImageSrc"]["label"] == "Bg Image Src"


async def test_editable_sections_skips_unknown_field_name(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    r = await client.get("/api/landing_page/editable", headers={"Authorization": f"Bearer {admin_token}"})
    hero = next(s for s in r.json() if s["section_key"] == "hero")
    names = {f["name"] for f in hero["fields"]}
    assert "missingField" not in names
    assert names == {"title", "titleHighlight", "bgImageSrc"}


async def test_editable_sections_requires_admin(client: AsyncClient, db):
    set_fixture_config()
    r = await client.get("/api/landing_page/editable")
    assert r.status_code == 401


async def test_non_admin_cannot_list_editable_sections(client: AsyncClient, db):
    set_fixture_config()
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.get("/api/landing_page/editable", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 403


async def test_save_override_updates_value(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {admin_token}"}

    r = await client.put(
        "/api/landing_page/hero",
        json={"overrides": {"title": "New Headline"}, "is_hidden": False},
        headers=headers,
    )
    assert r.status_code == 200
    by_name = {f["name"]: f["value"] for f in r.json()["fields"]}
    assert by_name["title"] == "New Headline"
    # titleHighlight wasn't part of this save — falls back to the config's own value
    assert by_name["titleHighlight"] == "our range"


async def test_save_override_rejects_unknown_field(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/landing_page/hero",
        json={"overrides": {"notAllowed": "hack"}, "is_hidden": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


async def test_save_override_rejects_unknown_section(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/landing_page/does-not-exist",
        json={"overrides": {}, "is_hidden": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


async def test_non_admin_cannot_save(client: AsyncClient, db):
    set_fixture_config()
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.put(
        "/api/landing_page/hero",
        json={"overrides": {"title": "Hack"}, "is_hidden": False},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_public_overrides_empty_when_nothing_saved(client: AsyncClient, db):
    set_fixture_config()
    r = await client.get("/api/landing_page/overrides")
    assert r.status_code == 200
    assert r.json() == {}


async def test_public_overrides_reflects_saved_value_no_auth_needed(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    await client.put(
        "/api/landing_page/trust-strip",
        json={"overrides": {"title": "New trust copy"}, "is_hidden": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.get("/api/landing_page/overrides")
    assert r.status_code == 200
    assert r.json()["trust-strip"]["overrides"]["title"] == "New trust copy"
    assert r.json()["trust-strip"]["is_hidden"] is False


async def test_hide_section_via_save(client: AsyncClient, db):
    set_fixture_config()
    admin_token = await make_admin(client, db)
    await client.put(
        "/api/landing_page/trust-strip",
        json={"overrides": {}, "is_hidden": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.get("/api/landing_page/overrides")
    assert r.json()["trust-strip"]["is_hidden"] is True
```

- [ ] **Step 2: Run the new tests**

Run (from `backend/`): `.venv\Scripts\python.exe -m pytest tests/test_landing_content.py -v`
Expected: all 12 tests PASS

- [ ] **Step 3: Run the entire backend suite to confirm nothing else broke**

Run (from `backend/`): `.venv\Scripts\python.exe -m pytest tests/ -q`
Expected: all tests pass

- [ ] **Step 4: Run the linter and type checker**

Run (from `backend/`):
```
.venv\Scripts\ruff.exe check .
.venv\Scripts\mypy.exe app/
```
Expected: no errors from either.

- [ ] **Step 5: Commit**

```
git add backend/tests/test_landing_content.py
git commit -m "test(landing_page): cover editable sections, save validation, and public overrides"
```

---

### Task 7: Docker Compose — give the backend read access to the config file

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add the volume mount and env var**

In `docker-compose.yml`, under the `backend` service, change:

```yaml
    volumes:
      - cf_data:/app/data
      - ./uploads:/app/uploads
```

to:

```yaml
    volumes:
      - cf_data:/app/data
      - ./uploads:/app/uploads
      - ./frontend-starter/landing-page.config.json:/app/landing-page.config.json:ro
```

And under the same service's `environment:` block, add one line (after `CURRENCY_CODE`):

```yaml
      LANDING_CONFIG_PATH: "/app/landing-page.config.json"
```

- [ ] **Step 2: Verify the compose file still parses**

Run (from repo root): `docker compose config --quiet`
Expected: no output, exit code 0. (If Docker isn't available in this environment, skip this step — the change is a plain YAML edit reviewed by inspection.)

- [ ] **Step 3: Commit**

```
git add docker-compose.yml
git commit -m "chore(docker): mount landing-page.config.json read-only into the backend"
```

---

### Task 8: Config file — flag a real section as editable

**Files:**
- Modify: `frontend-starter/landing-page.config.json`

This is the one section we're actually turning on for Tri Star, matching the spec's worked example. We deliberately picked `landing-product-grid` (the "More from our range" grid), not `landing-hero`, because `landing-hero`'s headline is hardcoded directly in `components/landing/hero.tsx` and doesn't read any props at all — flagging it editable would produce fields that silently do nothing. `landing-product-grid`'s `title`/`titleHighlight` genuinely flow through to the rendered page (`components/blocks/landing/legacy-landing-blocks.tsx:55-69`).

- [ ] **Step 1: Edit the section**

In `frontend-starter/landing-page.config.json`, find this entry in the `sections` array (the second `landing-product-grid`, titled "More from our range"):

```json
    {
      "__block": "landing-product-grid",
      "title": "More from",
      "titleHighlight": "our range",
      "viewAllHref": "/products",
      "viewAllLabel": "See all products →",
      "sliceStart": 4,
      "sliceEnd": 8
    },
```

Change it to:

```json
    {
      "__block": "landing-product-grid",
      "adminEditable": true,
      "adminSectionKey": "product-grid-more",
      "adminEditableFields": ["title", "titleHighlight"],
      "title": "More from",
      "titleHighlight": "our range",
      "viewAllHref": "/products",
      "viewAllLabel": "See all products →",
      "sliceStart": 4,
      "sliceEnd": 8
    },
```

- [ ] **Step 2: Verify the file is still valid JSON**

Run (from `frontend-starter/`): `node -e "JSON.parse(require('fs').readFileSync('landing-page.config.json', 'utf-8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```
git add frontend-starter/landing-page.config.json
git commit -m "feat(config): flag the 'More from our range' product grid as shop-admin editable"
```

---

### Task 9: Storefront — types and the override-merge function

**Files:**
- Modify: `frontend-starter/lib/landing-config.ts`

- [ ] **Step 1: Add the section-metadata fields to the existing interface**

In `frontend-starter/lib/landing-config.ts`, change:

```typescript
export interface LandingConfigSection {
  __block: string
  requiredPlugin?: string
  [key: string]: unknown
}
```

to:

```typescript
export interface LandingConfigSection {
  __block: string
  requiredPlugin?: string
  /** Superadmin opt-in: shop-admin can edit this section's content at all. */
  adminEditable?: boolean
  /** Stable identifier a shop-admin edit is stored/looked up against. */
  adminSectionKey?: string
  /** Which named fields on this section are shop-admin editable. */
  adminEditableFields?: string[]
  [key: string]: unknown
}
```

- [ ] **Step 2: Add the overrides types and merge function**

At the end of `frontend-starter/lib/landing-config.ts`, add:

```typescript
export interface ContentOverrideEntry {
  overrides: Record<string, string>
  is_hidden: boolean
}

export type ContentOverrideMap = Record<string, ContentOverrideEntry>

/**
 * Layers saved shop-admin edits on top of the config file's own section
 * props. A section with no matching override (or no adminSectionKey at all)
 * passes through unchanged — this is what makes an empty overrides table
 * indistinguishable from "no system present."
 */
export function mergeContentOverrides(
  sections: LandingConfigSection[],
  overridesMap: ContentOverrideMap
): LandingConfigSection[] {
  const merged: LandingConfigSection[] = []
  for (const section of sections) {
    const key = typeof section.adminSectionKey === "string" ? section.adminSectionKey : undefined
    const entry = key ? overridesMap[key] : undefined
    if (!entry) {
      merged.push(section)
      continue
    }
    if (entry.is_hidden) continue
    merged.push({ ...section, ...entry.overrides })
  }
  return merged
}
```

- [ ] **Step 2: Verify it type-checks**

Run (from `frontend-starter/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add frontend-starter/lib/landing-config.ts
git commit -m "feat(landing-config): add content-override types and merge function"
```

---

### Task 10: Storefront — wire the merge into the homepage

**Files:**
- Modify: `frontend-starter/app/page.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `frontend-starter/app/page.tsx`:

```tsx
import { serverFetch } from "@/lib/api"
import { getFilteredSections, getHomepageConfig, mergeContentOverrides, type ContentOverrideMap } from "@/lib/landing-config"
import type { Category, LandingRuntimeData, LandingSection, PaginatedResponse, Product } from "@/lib/types"
import { LandingSectionRenderer } from "@/components/shop/landing-section"

export default async function HomePage() {
  const [featuredRes, categories, overridesMap] = await Promise.all([
    serverFetch<PaginatedResponse<Product>>("/api/products?featured_only=true&page_size=8"),
    serverFetch<Category[]>("/api/categories").catch(() => [] as Category[]),
    serverFetch<ContentOverrideMap>("/api/landing_page/overrides"),
  ])

  const products = [...(featuredRes?.items ?? [])]

  // Top up to 8 with other active products so both homepage grids stay populated
  // even when fewer than 8 products are marked as featured.
  if (products.length < 8) {
    const fillRes = await serverFetch<PaginatedResponse<Product>>("/api/products?page_size=16")
    const seen = new Set(products.map(p => p.id))
    for (const p of fillRes?.items ?? []) {
      if (products.length >= 8) break
      if (!seen.has(p.id)) { products.push(p); seen.add(p.id) }
    }
  }

  const data: LandingRuntimeData = {
    products,
    categories: (categories ?? []).filter(c => c.is_active),
    showBestSellersCard: getHomepageConfig().showBestSellersCard !== false,
  }

  const sections = mergeContentOverrides(getFilteredSections(), overridesMap ?? {})

  return (
    <div className="bg-bg" data-landing-source="config-pipeline">
      {sections.map((section, i) => (
        <LandingSectionRenderer
          key={`${section.__block}-${i}`}
          section={section as unknown as LandingSection}
          data={data}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify it type-checks and builds**

Run (from `frontend-starter/`):
```
npx tsc --noEmit
npm run build
```
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```
git add frontend-starter/app/page.tsx
git commit -m "feat(homepage): merge saved content overrides into the rendered sections"
```

---

### Task 11: Storefront — end-to-end test

**Files:**
- Create: `frontend-starter/e2e/page-content-override.spec.ts`

This test needs an admin login. Confirmed against the existing pattern in
`frontend-starter/e2e/theme-colors.spec.ts:12-24` — a hardcoded `API` base
URL constant, a plain `{email, password}` admin object, a direct
`request.post` to `/api/auth/login`, and a `test.skip` guard if the seeded
admin login isn't available (keeps the suite from failing hard in an
environment where the seed hasn't run). The test below mirrors that exactly.

- [ ] **Step 1: Write the test**

Create `frontend-starter/e2e/page-content-override.spec.ts`:

```typescript
/**
 * Page Content override E2E — verifies a shop-admin content edit reaches the
 * live homepage, and that clearing it reverts to the config-authored value.
 *
 * Prerequisites: backend on :8000, storefront on :3000, seeded admin user.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000'
const ADMIN = { email: 'admin@commerceforce.dev', password: 'Admin1234!' }

test.describe('Page Content override', () => {
  test('saved content override renders on the homepage, then reverts when cleared', async ({ page, request }) => {
    // serverFetch caches for 60s (same as branding) — this test allows for that.
    test.setTimeout(150_000)

    const login = await request.post(`${API}/api/auth/login`, { data: ADMIN })
    test.skip(!login.ok(), 'seeded admin login unavailable')
    const { access_token } = await login.json()
    const headers = { Authorization: `Bearer ${access_token}` }

    // Confirm the section starts at its config-authored value
    await page.goto('/')
    await expect(page.getByText('More from', { exact: false })).toBeVisible()

    // Save an override
    const saveRes = await request.put(`${API}/api/landing_page/product-grid-more`, {
      headers,
      data: { overrides: { title: 'E2E Override Title' }, is_hidden: false },
    })
    expect(saveRes.ok()).toBeTruthy()

    // Homepage reflects it — poll to absorb the 60s server-side cache window
    await expect(async () => {
      await page.goto('/')
      await expect(page.getByText('E2E Override Title')).toBeVisible()
    }).toPass({ timeout: 90_000, intervals: [5_000] })

    // Clear the override back to the config's own value
    const clearRes = await request.put(`${API}/api/landing_page/product-grid-more`, {
      headers,
      data: { overrides: {}, is_hidden: false },
    })
    expect(clearRes.ok()).toBeTruthy()

    await expect(async () => {
      await page.goto('/')
      await expect(page.getByText('More from', { exact: false })).toBeVisible()
      await expect(page.getByText('E2E Override Title')).not.toBeVisible()
    }).toPass({ timeout: 90_000, intervals: [5_000] })
  })
})
```

- [ ] **Step 2: Run the test**

Run (from `frontend-starter/`, backend + storefront dev servers running): `npx playwright test e2e/page-content-override.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add frontend-starter/e2e/page-content-override.spec.ts
git commit -m "test(e2e): saved page-content override renders and reverts on the homepage"
```

---

### Task 12: Admin panel — types

**Files:**
- Modify: `frontend-admin/lib/types.ts:330-345`

- [ ] **Step 1: Replace the Landing Page types block**

In `frontend-admin/lib/types.ts`, find and replace this block:

```typescript
// ── Landing Page ──────────────────────────────────────────────────────────────
export type SectionType = "hero" | "features" | "testimonials" | "cta" | "html" | "products" | "block"

export interface LandingSection {
  id: string
  section_type: SectionType
  title?: string
  subtitle?: string
  content?: string
  image_url?: string
  cta_text?: string
  cta_url?: string
  sort_order: number
  is_active: boolean
  background_color?: string
}
```

with:

```typescript
// ── Page Content ──────────────────────────────────────────────────────────────
export interface EditableField {
  name: string
  label: string
  type: "text" | "image" | "link"
  value: string
}

export interface EditableSection {
  section_key: string
  is_hidden: boolean
  fields: EditableField[]
}
```

- [ ] **Step 2: Find and update any other usages of the removed types**

Run (from `frontend-admin/`): `findstr /s /m /c:"SectionType" /c:"LandingSection" lib\*.ts app\*.tsx app\**\*.tsx`

If any file other than `app/(dashboard)/landing-page/page.tsx` references these, note it — Task 13 rewrites that page; any other reference needs its own fix before Step 3 below will pass.

- [ ] **Step 3: Verify type-check** (will still fail until Task 13 rewrites the page — that's expected here)

Run (from `frontend-admin/`): `npx tsc --noEmit`
Expected: errors only in `app/(dashboard)/landing-page/page.tsx` (undefined `LandingSection`/`SectionType`/`BLOCK_DEFAULTS` usage) — this is resolved by Task 13, not this task.

- [ ] **Step 4: Commit**

```
git add frontend-admin/lib/types.ts
git commit -m "feat(types): replace LandingSection/SectionType with EditableSection shape"
```

---

### Task 13: Admin panel — rewrite the Page Content screen

**Files:**
- Modify: `frontend-admin/app/(dashboard)/landing-page/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `frontend-admin/app/(dashboard)/landing-page/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { EditableSection } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { ImageUpload } from "@/components/ui/image-upload"

type FormState = Record<string, { overrides: Record<string, string>; is_hidden: boolean }>

export default function LandingPagePage() {
  const qc = useQueryClient()
  const { data: sections = [], isLoading } = useQuery<EditableSection[]>({
    queryKey: ["editable-sections"],
    queryFn: () => api.get("/api/landing_page/editable"),
  })

  const [form, setForm] = useState<FormState>({})

  // Seed local form state from the fetched sections, once per fetch.
  useEffect(() => {
    if (sections.length === 0) return
    setForm((prev) => {
      const next: FormState = { ...prev }
      for (const s of sections) {
        if (next[s.section_key]) continue
        next[s.section_key] = {
          overrides: Object.fromEntries(s.fields.map((f) => [f.name, f.value])),
          is_hidden: s.is_hidden,
        }
      }
      return next
    })
  }, [sections])

  const save = useMutation({
    mutationFn: ({ section_key, overrides, is_hidden }: { section_key: string; overrides: Record<string, string>; is_hidden: boolean }) =>
      api.put(`/api/landing_page/${section_key}`, { overrides, is_hidden }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["editable-sections"] }),
  })

  function updateField(sectionKey: string, fieldName: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        overrides: { ...prev[sectionKey].overrides, [fieldName]: value },
      },
    }))
  }

  function toggleHidden(sectionKey: string) {
    setForm((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], is_hidden: !prev[sectionKey].is_hidden },
    }))
  }

  return (
    <div>
      <PageHeader
        title="Page Content"
        description="Edit text, images, and links on the homepage sections your agency has made editable."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sections.length === 0 ? (
        <p className="text-center py-10 text-slate-400">
          No sections are editable yet. Your agency controls which sections appear here.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => {
            const local = form[s.section_key]
            if (!local) return null
            return (
              <div key={s.section_key} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 capitalize">
                    {s.section_key.replace(/-/g, " ")}
                  </h3>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={!local.is_hidden}
                      onChange={() => toggleHidden(s.section_key)}
                    />
                    Visible on homepage
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {s.fields.map((f) => (
                    <div key={f.name}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      {f.type === "image" ? (
                        <ImageUpload
                          value={local.overrides[f.name]}
                          onUpload={(url) => updateField(s.section_key, f.name, url)}
                        />
                      ) : (
                        <input
                          value={local.overrides[f.name] ?? ""}
                          onChange={(e) => updateField(s.section_key, f.name, e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() =>
                      save.mutate({
                        section_key: s.section_key,
                        overrides: local.overrides,
                        is_hidden: local.is_hidden,
                      })
                    }
                    disabled={save.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                  >
                    {save.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run (from `frontend-admin/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the build**

Run (from `frontend-admin/`): `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Manual smoke check**

Run (from `frontend-admin/`): `npm run dev`, then (with the backend running) log in at `http://localhost:3001` as `admin@commerceforce.dev / Admin1234!` and open Page Content in the sidebar. Confirm:
- The "product-grid-more" section (labelled "Product Grid More") appears with two text fields, "Title" and "Title Highlight", pre-filled with "More from" / "our range".
- Editing "Title" and clicking Save succeeds with no error.
- Refreshing the storefront homepage (may take up to 60 seconds — `serverFetch`'s cache window) shows the new title.

- [ ] **Step 5: Commit**

```
git add "frontend-admin/app/(dashboard)/landing-page/page.tsx"
git commit -m "feat(admin): rewrite Page Content screen against the new editable-sections API"
```

---

### Task 14: Promo-banner redirect to the announcements plugin

**Files:**
- Modify: `frontend-starter/landing-page.config.json`
- Modify: `backend/seed.py` (or note for manual entry — see Step 2)

`announcement-bar` (`frontend-starter/components/blocks/layout/announcement-bar.tsx`) is already fully built — it fetches `GET /api/announcements/active` and renders it, or renders nothing if there's no active announcement. This task only swaps which block Tri Star uses and seeds the equivalent content as a real announcement; it does not require writing any new component code.

Accepted trade-off, worth knowing before you do this: `announcement-bar` shows **one** message at a time. The current `landing-promo-banner` shows **two** (the despatch-time promo and the trade-account promo) side by side. This redirect keeps the despatch-time message (closer to a live "time-sensitive" fit for the announcements plugin) and drops the second from the top banner — the trade-account message isn't time-sensitive and doesn't need this mechanism at all.

- [ ] **Step 1: Swap the block in the config**

In `frontend-starter/landing-page.config.json`, change:

```json
    { "__block": "landing-promo-banner" },
```

to:

```json
    { "__block": "announcement-bar" },
```

- [ ] **Step 2: Seed the announcement**

Check whether `backend/seed.py` has an existing `_seed_announcements()`-style function (search for `Announcement` in that file). If one exists, add an entry there with `text="Order before 2pm for same-day despatch — free delivery on orders over £75"`, `is_active=True`. If no such seeding function exists yet for this plugin, don't add one for this single row — instead, create it once through the admin panel's Announcements screen after this change ships (same manual step any shop-admin would use going forward), and note that in the PR description.

- [ ] **Step 3: Verify the JSON is still valid**

Run (from `frontend-starter/`): `node -e "JSON.parse(require('fs').readFileSync('landing-page.config.json', 'utf-8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 4: Manual verification**

With backend + storefront running and the announcement seeded/created active: load the homepage, confirm the top banner shows the despatch message with the same red/brand styling as before (announcement-bar already uses `bg-brand text-fg`, matching the site's theme, not the old banner's own gradient — visually similar, not pixel-identical, which is expected and fine since this is new functionality, not a restyle).

- [ ] **Step 5: Commit**

```
git add frontend-starter/landing-page.config.json backend/seed.py
git commit -m "feat(homepage): redirect promo banner to the announcements plugin"
```

(Drop `backend/seed.py` from the `git add` if Step 2 concluded no seed function exists and you're leaving it to a manual admin step instead.)

---

### Task 15: Final verification pass and backlog update

**Files:**
- Modify: `docs/backlog.md`

- [ ] **Step 1: Run every automated check one more time, end to end**

From `backend/`:
```
.venv\Scripts\python.exe -m pytest tests/ -q
.venv\Scripts\ruff.exe check .
.venv\Scripts\mypy.exe app/
```

From `frontend-starter/`:
```
npx tsc --noEmit
npm run build
npx playwright test e2e/page-content-override.spec.ts
```

From `frontend-admin/`:
```
npx tsc --noEmit
npm run build
```

Expected: everything passes.

- [ ] **Step 2: Walk the spec's §10 verification list by hand**

With backend, storefront, and admin all running:
1. Confirm the live Tri Star homepage looks identical to before this branch, **except** the top banner now shows the announcement instead of the two-message promo strip (Task 14's accepted trade-off) — this is the one intentional visual change; everything else must be pixel-identical.
2. In admin's Page Content screen, confirm only "Product Grid More" appears (nothing else is flagged editable yet).
3. Edit its title, save, confirm it updates on the homepage (allow up to 60 seconds).
4. Toggle "Visible on homepage" off, save, confirm the section disappears from the homepage.
5. Toggle it back on, confirm it reappears with the previously-saved title (not reset to the config's original).
6. Using a REST client or `curl`, attempt `PUT /api/landing_page/product-grid-more` with a field name not in its allow-list (e.g. `sliceStart`) and confirm a 400 response.

- [ ] **Step 3: Update the backlog**

In `docs/backlog.md`, find item **W** (search for `| W |`) and replace its entire row content with:

```
| W | Landing-page sections wiring (Phase 2 of the 2026-07-09 theme work) | **DONE 2026-07-20.** The dead admin "Landing Page Sections" screen (wrote to a `landing_sections` table the storefront never read) is replaced by a working "Page Content" editor. Design: `docs/superpowers/specs/2026-07-20-page-content-editor-design.md`. Shop-admin edits are stored as JSON overrides per section (`landing_content_overrides` table), layered on top of `landing-page.config.json` at render time — same pattern as brand-colour overrides, empty = unchanged. No separate content schema file: the backend reads the config file directly to know which sections/fields are editable (`adminEditable` + `adminSectionKey` + `adminEditableFields` per section), avoiding a third hand-duplicated file alongside the already-known `theme-colors.ts`/`block-defaults.ts` drift risk (backlog item T). One section is live today: the "More from our range" product grid (`product-grid-more`). `landing-promo-banner` was redirected to the `announcements` plugin (`announcement-bar` block) as part of this work — a deliberate scope trim, not part of the content-editor system itself. |
```

- [ ] **Step 4: Commit**

```
git add docs/backlog.md
git commit -m "docs(backlog): mark item W done — Page Content editor shipped"
```
