import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.plugins.auth.models import User, UserRole
from app.plugins.auth.service import get_password_hash
from sqlalchemy import select


def _require_env(key: str) -> str:
    val = os.getenv(key, "").strip()
    if not val:
        print(f"ERROR: {key} is not set in the environment. Aborting.")
        sys.exit(1)
    return val


# ---------------------------------------------------------------------------
# Superadmin user (agency — same across all client deployments)
# ---------------------------------------------------------------------------

async def seed_superadmin(db) -> None:
    email = _require_env("SUPERADMIN_EMAIL")
    password = _require_env("SUPERADMIN_PASSWORD")

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        print(f"  Superadmin already exists ({email}) — skipping.")
        return
    superadmin = User(
        email=email,
        hashed_password=get_password_hash(password),
        first_name="Super",
        last_name="Admin",
        role=UserRole.superadmin,
        is_active=True,
    )
    db.add(superadmin)
    await db.commit()
    print(f"  Created superadmin: {email}")


# ---------------------------------------------------------------------------
# Admin user (per-client — client resets password via Forgot Password)
# ---------------------------------------------------------------------------

async def seed_admin(db) -> None:
    email = _require_env("ADMIN_EMAIL")
    password = _require_env("ADMIN_TEMP_PASSWORD")

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        print(f"  Admin already exists ({email}) — skipping.")
        return
    admin = User(
        email=email,
        hashed_password=get_password_hash(password),
        first_name="Admin",
        last_name="User",
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    print(f"  Created admin: {email} (client should reset password via Forgot Password)")


# ---------------------------------------------------------------------------
# Branding (per-client)
# ---------------------------------------------------------------------------

async def seed_branding(db) -> None:
    store_name = _require_env("STORE_NAME")
    tagline = os.getenv("STORE_TAGLINE", "").strip()
    contact_email = os.getenv("CONTACT_EMAIL", "").strip()

    from app.plugins.branding.service import get_config, update_config
    from app.plugins.branding.schemas import BrandingConfigUpdate

    config = await get_config(db)
    if config.store_name != "My Store":
        print(f"  Branding already customised ({config.store_name}) — skipping.")
        return

    await update_config(
        BrandingConfigUpdate(
            store_name=store_name,
            tagline=tagline or None,
            contact_email=contact_email or None,
        ),
        db,
    )
    await db.commit()
    print(f"  Branding configured: {store_name}")


# ---------------------------------------------------------------------------
# Demo data — categories and products (--demo flag only)
# ---------------------------------------------------------------------------

_CATEGORIES = [
    {"name": "Electronics", "description": "Gadgets, accessories, and tech essentials"},
    {"name": "Clothing",    "description": "Everyday wear for every occasion"},
    {"name": "Home & Garden", "description": "Everything for your home and outdoor space"},
    {"name": "Sports & Outdoors", "description": "Gear for an active lifestyle"},
]


async def seed_categories(db) -> dict[str, str]:
    from app.plugins.categories.service import create_category, list_root_categories
    from app.plugins.categories.schemas import CategoryCreate

    existing = await list_root_categories(db)
    existing_map: dict[str, str] = {c.name: str(c.id) for c in existing}

    missing = [d for d in _CATEGORIES if d["name"] not in existing_map]
    if not missing:
        print(f"  Categories already exist ({len(existing)}) — skipping.")
        return existing_map

    for data in missing:
        sort_order = next(i for i, d in enumerate(_CATEGORIES) if d["name"] == data["name"])
        cat = await create_category(
            CategoryCreate(name=data["name"], description=data["description"], sort_order=sort_order),
            db,
        )
        existing_map[data["name"]] = str(cat.id)

    await db.commit()
    print(f"  Created {len(missing)} categories (total: {len(existing_map)}).")
    return existing_map


def _products(cat: dict[str, str]) -> list[dict]:
    from decimal import Decimal
    return [
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
        dict(name="Ceramic Plant Pot Set (3 pcs)", category_id=cat["Home & Garden"],
             price=Decimal("24.99"), stock_quantity=80,
             description="Matte white ceramic pots in three graduated sizes with drainage holes.",
             tags="plants,pots,ceramic,garden"),
        dict(name="LED Architect Desk Lamp", category_id=cat["Home & Garden"],
             price=Decimal("39.99"), stock_quantity=60,
             description="5-colour-temperature LED with USB-A charging port and flexible gooseneck arm.",
             tags="lamp,led,desk,lighting"),
        dict(name="Bamboo Chopping Board Set", category_id=cat["Home & Garden"],
             price=Decimal("22.99"), stock_quantity=120,
             description="Set of 3 FSC-certified bamboo boards in small, medium, and large.",
             tags="kitchen,bamboo,cutting-board"),
        dict(name="Eco Yoga Mat 6 mm", category_id=cat["Sports & Outdoors"],
             price=Decimal("29.99"), stock_quantity=90, is_featured=True,
             description="Natural rubber non-slip mat with alignment lines. Includes carry strap.",
             tags="yoga,mat,fitness,eco"),
        dict(name="Insulated Stainless Water Bottle 1 L", category_id=cat["Sports & Outdoors"],
             price=Decimal("24.99"), stock_quantity=150,
             description="Double-wall vacuum insulation keeps drinks cold 24 h / hot 12 h.",
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

async def seed(demo: bool = False) -> None:
    print("Seeding database…")

    async with AsyncSessionLocal() as db:
        await seed_superadmin(db)

    async with AsyncSessionLocal() as db:
        await seed_admin(db)

    async with AsyncSessionLocal() as db:
        await seed_branding(db)

    if demo:
        print("  [demo mode] Seeding categories and products…")
        async with AsyncSessionLocal() as db:
            cat_ids = await seed_categories(db)

        async with AsyncSessionLocal() as db:
            await seed_products(cat_ids, db)
    else:
        print("  Skipping demo products (run with --demo to include them).")

    print("Done.")


if __name__ == "__main__":
    run_demo = "--demo" in sys.argv
    asyncio.run(seed(demo=run_demo))
