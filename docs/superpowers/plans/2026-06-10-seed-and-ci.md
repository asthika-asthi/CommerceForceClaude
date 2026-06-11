# Seed Data + CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the store with realistic demo data so the storefront isn't empty, and add a GitHub Actions CI pipeline that runs backend tests + both frontend builds on every push.

**Architecture:** Two independent tasks. Seed data extends the existing `backend/seed.py` script using service functions (they handle slug/SKU generation). CI uses three parallel jobs (backend pytest, frontend-admin build, frontend-starter build) triggered on every push and PR. Backend uses `pyproject.toml` with hatch; install with `pip install -e ".[dev]"`.

**Tech Stack:** Python/FastAPI/SQLAlchemy (seed), GitHub Actions (CI), Next.js 16 (frontend builds).

**Working directory:** `D:\Projects\20260609_Commerceforce`

---

## File Structure

| Task | Files Created/Modified |
|------|----------------------|
| 1 | `backend/seed.py` (modify — add branding, categories, products) |
| 2 | `.github/workflows/ci.yml` (create) |

---

### Task 1: Seed Demo Data

**Context:** `backend/seed.py` currently only creates one admin user. The storefront shows empty product listings and default branding ("My Store") because no demo data exists. This task extends the script to also create: store branding, 4 top-level categories, and 13 products spread across them.

The seed script uses `AsyncSessionLocal` directly. Service functions use `db.flush()` internally; the seed script calls `await db.commit()` after each section to persist. The script is idempotent — each section checks for existing data before inserting.

Service functions to call:
- `app.plugins.branding.service.get_config` / `update_config` — singleton branding record
- `app.plugins.categories.service.create_category` — takes `CategoryCreate`, returns `Category`
- `app.plugins.categories.service.list_root_categories` — to check if categories exist
- `app.plugins.products.service.create_product` — takes `ProductCreate`, returns `Product` (handles slug + SKU)

**Files:**
- Modify: `backend/seed.py`

- [ ] **Step 1: Replace seed.py with the full seeding script**

Replace the entire contents of `backend/seed.py`:

```python
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.plugins.auth.models import User, UserRole
from app.plugins.auth.service import get_password_hash
from sqlalchemy import select


# ---------------------------------------------------------------------------
# Admin user
# ---------------------------------------------------------------------------

async def seed_admin(db) -> None:
    result = await db.execute(select(User).where(User.email == "admin@commerceforce.dev"))
    if result.scalar_one_or_none():
        print("  Admin already exists — skipping.")
        return
    admin = User(
        email="admin@commerceforce.dev",
        hashed_password=get_password_hash("Admin1234!"),
        first_name="Admin",
        last_name="User",
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    print("  Created admin: admin@commerceforce.dev / Admin1234!")


# ---------------------------------------------------------------------------
# Branding
# ---------------------------------------------------------------------------

async def seed_branding(db) -> None:
    from app.plugins.branding.service import get_config, update_config
    from app.plugins.branding.schemas import BrandingConfigUpdate

    config = await get_config(db)
    if config.store_name != "My Store":
        print("  Branding already customised — skipping.")
        return

    await update_config(
        BrandingConfigUpdate(
            store_name="CommerceForce Demo",
            tagline="Quality products, delivered fast",
            primary_color="#2563EB",
            secondary_color="#1E40AF",
            contact_email="support@commerceforce.dev",
        ),
        db,
    )
    await db.commit()
    print("  Branding configured: CommerceForce Demo")


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

_CATEGORIES = [
    {"name": "Electronics", "description": "Gadgets, accessories, and tech essentials"},
    {"name": "Clothing",    "description": "Everyday wear for every occasion"},
    {"name": "Home & Garden", "description": "Everything for your home and outdoor space"},
    {"name": "Sports & Outdoors", "description": "Gear for an active lifestyle"},
]


async def seed_categories(db) -> dict[str, str]:
    """Return mapping of category name -> id."""
    from app.plugins.categories.service import create_category, list_root_categories
    from app.plugins.categories.schemas import CategoryCreate

    existing = await list_root_categories(db)
    if existing:
        print(f"  Categories already exist ({len(existing)}) — skipping.")
        return {c.name: str(c.id) for c in existing}

    ids: dict[str, str] = {}
    for i, data in enumerate(_CATEGORIES):
        cat = await create_category(
            CategoryCreate(name=data["name"], description=data["description"], sort_order=i),
            db,
        )
        ids[data["name"]] = str(cat.id)

    await db.commit()
    print(f"  Created {len(ids)} categories.")
    return ids


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

def _products(cat: dict[str, str]) -> list[dict]:
    from decimal import Decimal
    return [
        # Electronics
        dict(name="Wireless Noise-Cancelling Headphones", category_id=cat["Electronics"],
             price=Decimal("79.99"), stock_quantity=50, is_featured=True,
             description="Premium over-ear headphones with active noise cancellation and 30-hour battery life.",
             tags="audio,wireless,headphones"),
        dict(name="7-in-1 USB-C Hub", category_id=cat["Electronics"],
             price=Decimal("34.99"), stock_quantity=100,
             description="Expands one USB-C port into HDMI, 3× USB-A, SD, microSD, and 100W PD charging.",
             tags="usb-c,hub,adapter"),
        dict(name="Compact Mechanical Keyboard", category_id=cat["Electronics"],
             price=Decimal("129.99"), stock_quantity=30,
             description="TKL layout with Cherry MX Brown switches, RGB backlight, and PBT keycaps.",
             tags="keyboard,mechanical,rgb"),
        dict(name="Adjustable Laptop Stand", category_id=cat["Electronics"],
             price=Decimal("44.99"), stock_quantity=80,
             description="Aluminium folding stand with 6 height levels. Compatible with 10\"–17\" laptops.",
             tags="laptop,stand,desk"),

        # Clothing
        dict(name="Classic Cotton T-Shirt", category_id=cat["Clothing"],
             price=Decimal("19.99"), stock_quantity=200,
             description="100% organic cotton, pre-shrunk, available in 8 colours.",
             tags="tshirt,cotton,basics"),
        dict(name="Slim-Fit Chinos", category_id=cat["Clothing"],
             price=Decimal("49.99"), stock_quantity=80, is_featured=True,
             description="Stretch cotton-blend chinos with tapered leg. Smart-casual versatility.",
             tags="chinos,pants,smart"),
        dict(name="Zip-Up Hoodie", category_id=cat["Clothing"],
             price=Decimal("59.99"), sale_price=Decimal("44.99"), is_on_sale=True, stock_quantity=60,
             description="Mid-weight brushed fleece with kangaroo pocket and YKK zip.",
             tags="hoodie,fleece,outerwear"),

        # Home & Garden
        dict(name="Ceramic Plant Pot Set (3 pcs)", category_id=cat["Home & Garden"],
             price=Decimal("24.99"), stock_quantity=80,
             description="Matte white ceramic pots in three graduated sizes (10 cm, 15 cm, 20 cm) with drainage holes.",
             tags="plants,pots,ceramic,garden"),
        dict(name="LED Architect Desk Lamp", category_id=cat["Home & Garden"],
             price=Decimal("39.99"), stock_quantity=60,
             description="5-colour-temperature LED with USB-A charging port and flexible gooseneck arm.",
             tags="lamp,led,desk,lighting"),
        dict(name="Bamboo Chopping Board Set", category_id=cat["Home & Garden"],
             price=Decimal("22.99"), stock_quantity=120,
             description="Set of 3 FSC-certified bamboo boards in small, medium, and large.",
             tags="kitchen,bamboo,cutting-board"),

        # Sports & Outdoors
        dict(name="Eco Yoga Mat 6 mm", category_id=cat["Sports & Outdoors"],
             price=Decimal("29.99"), stock_quantity=90, is_featured=True,
             description="Natural rubber non-slip mat with alignment lines. Includes carry strap.",
             tags="yoga,mat,fitness,eco"),
        dict(name="Insulated Stainless Water Bottle 1 L", category_id=cat["Sports & Outdoors"],
             price=Decimal("24.99"), stock_quantity=150,
             description="Double-wall vacuum insulation keeps drinks cold 24 h / hot 12 h. Leak-proof lid.",
             tags="bottle,hydration,insulated"),
        dict(name="Resistance Bands Set (5 levels)", category_id=cat["Sports & Outdoors"],
             price=Decimal("22.99"), stock_quantity=110,
             description="Five latex-free loop bands from extra-light to extra-heavy with carrying pouch.",
             tags="resistance,bands,fitness,gym"),
    ]


async def seed_products(cat: dict[str, str], db) -> None:
    from app.plugins.products.service import create_product, list_products
    from app.plugins.products.schemas import ProductCreate

    _, total = await list_products(db, active_only=False, page_size=1)
    if total > 0:
        print(f"  Products already exist ({total}) — skipping.")
        return

    count = 0
    for p in _products(cat):
        await create_product(ProductCreate(**p), db)
        count += 1

    await db.commit()
    print(f"  Created {count} products.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def seed() -> None:
    print("Seeding database…")
    async with AsyncSessionLocal() as db:
        await seed_admin(db)

    async with AsyncSessionLocal() as db:
        await seed_branding(db)

    async with AsyncSessionLocal() as db:
        cat_ids = await seed_categories(db)

    async with AsyncSessionLocal() as db:
        await seed_products(cat_ids, db)

    print("Done.")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Run the seed script**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe seed.py
```

Expected output:
```
Seeding database…
  Admin already exists — skipping.
  Branding configured: CommerceForce Demo
  Created 4 categories.
  Created 13 products.
Done.
```

(Admin may already exist from a previous run — that's fine.)

- [ ] **Step 3: Verify via API**

```powershell
# Check categories
$r = Invoke-WebRequest -Uri "http://localhost:8000/api/categories" -UseBasicParsing
($r.Content | ConvertFrom-Json).Count

# Check products
$r = Invoke-WebRequest -Uri "http://localhost:8000/api/products?page_size=20" -UseBasicParsing
($r.Content | ConvertFrom-Json).total

# Check branding
$r = Invoke-WebRequest -Uri "http://localhost:8000/api/branding" -UseBasicParsing
($r.Content | ConvertFrom-Json).store_name
```

Expected: 4 categories, 13 products total, `"CommerceForce Demo"` store name.

- [ ] **Step 4: Run the script a second time to verify idempotency**

```powershell
.venv\Scripts\python.exe seed.py
```

Expected: all four sections print "already exists / skipping" — no duplicates created.

- [ ] **Step 5: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add backend/seed.py
git commit -m "feat: seed demo branding, 4 categories, and 13 products"
```

---

### Task 2: GitHub Actions CI Pipeline

**Context:** No CI exists. The repo has `backend/pyproject.toml` (hatch build system, `pip install -e ".[dev]"` installs main + dev deps), `frontend-admin/package.json`, and `frontend-starter/package.json`. The backend test suite needs `ENABLED_PLUGINS` set to all 15 plugins (otherwise config.py defaults to just `auth`). Frontend builds need Node 20.

Three parallel jobs:
- **backend** — `pip install -e ".[dev]"` → `pytest`
- **frontend-admin** — `npm ci` → `npm run build`
- **frontend-starter** — `npm ci` → `npm run build`

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflows directory and CI file**

Create `D:\Projects\20260609_Commerceforce\.github\workflows\ci.yml`:

```yaml
name: CI

on:
  push:
    branches: ["master", "main"]
  pull_request:

jobs:
  backend:
    name: Backend tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    env:
      SECRET_KEY: ci-test-secret-key-not-for-production
      DATABASE_URL: sqlite+aiosqlite:///./test_ci.db
      ENABLED_PLUGINS: auth,categories,products,cart,orders,checkout,coupons,loyalty,newsletter,branding,landing_page,ai_chat,rfq,credit,inventory
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: backend/pyproject.toml

      - name: Install dependencies
        run: pip install -e ".[dev]"

      - name: Run tests
        run: python -m pytest --tb=short -q

  frontend-admin:
    name: Admin frontend build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend-admin
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend-admin/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

  frontend-starter:
    name: Storefront build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend-starter
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend-starter/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Verify the YAML is valid**

```powershell
# Check file was created
Get-Content D:\Projects\20260609_Commerceforce\.github\workflows\ci.yml | Measure-Object -Line
```

Expected: 70+ lines.

- [ ] **Step 3: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add .github/
git commit -m "ci: add GitHub Actions pipeline for backend tests and frontend builds"
```

- [ ] **Step 4: Verify CI runs (after pushing to GitHub)**

If the repo has a GitHub remote, push and check:
```powershell
git remote -v
```

If a remote exists:
```powershell
git push
```

Then open GitHub → Actions tab and confirm all 3 jobs turn green. If no remote exists yet, the CI will run automatically the first time you push to GitHub.

---

## Verification Checklist

- [ ] `python seed.py` creates 4 categories and 13 products; running it twice produces no duplicates
- [ ] `GET /api/products?page_size=20` returns `total: 13`
- [ ] `GET /api/categories` returns 4 root categories
- [ ] `GET /api/branding` returns `store_name: "CommerceForce Demo"`
- [ ] Storefront at `localhost:3000/products` shows product grid (not empty)
- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] On GitHub, all 3 CI jobs pass (or confirmed valid locally)
