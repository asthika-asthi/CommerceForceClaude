"""
End-to-end tests for:
  1. Category CSV export (empty DB → headers only)
  2. Category CSV import (create flat + hierarchy)
  3. Category CSV import idempotency (re-import updates, no duplicates)
  4. Category CSV import — parent not found → error, not crash
  5. Category CSV export round-trip (exported rows match what was imported)
  6. Product CSV import auto-creates missing category
"""
import asyncio
import os
import sys

# Must set env vars BEFORE any app imports so settings picks them up
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_csv_run.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.core.base_model import Base
from app.core.database import async_engine, AsyncSessionLocal
from app.plugins.categories.models import Category
from app.plugins.products.models import Product, ProductVariant

# Import all models so Base.metadata includes them all
import app.plugins.auth.models  # noqa
import app.plugins.branding.models  # noqa
import app.plugins.products.models  # noqa
import app.plugins.orders.models  # noqa
import app.plugins.cart.models  # noqa
import app.plugins.coupons  # noqa
import app.plugins.loyalty.models  # noqa
import app.plugins.newsletter.models  # noqa
import app.plugins.landing_page  # noqa
import app.plugins.rfq.models  # noqa
import app.plugins.credit.models  # noqa
import app.plugins.inventory.models  # noqa
import app.plugins.contact  # noqa
import app.plugins.addresses  # noqa
import app.plugins.wishlist  # noqa
import app.plugins.reviews  # noqa
import app.plugins.discount_rules  # noqa
import app.shared.email  # noqa

import app.plugins.categories.service as cat_svc
import app.plugins.products.service as prod_svc
import app.plugins.products.variant_service as variant_svc
from app.plugins.products.schemas import OptionTypeCreate, OptionValueCreate, ProductCreate

PASS = "PASS"
FAIL = "FAIL"
results: list[tuple[str, str, str]] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    suffix = f"  ({detail})" if detail else ""
    print(f"  {status}  {label}{suffix}")


async def run_tests() -> None:
    # Create all tables fresh
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # ──────────────────────────────────────────────────────────
    # TEST 1: Export on empty DB → headers only
    # ──────────────────────────────────────────────────────────
    print("\n[1] Category CSV export — empty database")
    async with AsyncSessionLocal() as db:
        csv_content = await cat_svc.export_to_csv(db)
    lines = [l for l in csv_content.strip().splitlines() if l]
    check("Header row is correct",
          lines[0] == "name,description,parent,sort_order,is_active,image_url", lines[0])
    check("No data rows on empty DB", len(lines) == 1, f"{len(lines)} lines")

    # ──────────────────────────────────────────────────────────
    # TEST 2: Import flat + hierarchy
    # ──────────────────────────────────────────────────────────
    print("\n[2] Category CSV import — flat + child categories")
    csv_in = "\n".join([
        "name,description,parent,sort_order,is_active,image_url",
        "Tarpaulins,Heavy duty covers,,0,true,",
        "Ground Sheets,Ground protection,,1,true,",
        "Heavy Duty,Industrial grade,Tarpaulins,0,true,",
        "Standard,Everyday use,Tarpaulins,1,true,",
    ])
    async with AsyncSessionLocal() as db:
        r = await cat_svc.import_from_csv(csv_in, db)
        await db.commit()

    check("4 categories created", r["created"] == 4, str(r))
    check("0 errors", r["errors"] == [], str(r["errors"]))

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Category))).scalars().all()
    check("4 categories in DB", len(rows) == 4, f"found {len(rows)}")

    tarp = next((c for c in rows if c.name == "Tarpaulins"), None)
    heavy = next((c for c in rows if c.name == "Heavy Duty"), None)
    check("'Tarpaulins' is root (no parent_id)", tarp is not None and tarp.parent_id is None)
    check("'Heavy Duty' is child of Tarpaulins",
          heavy is not None and tarp is not None and heavy.parent_id == tarp.id)

    # ──────────────────────────────────────────────────────────
    # TEST 3: Re-import same CSV → update, not duplicate
    # ──────────────────────────────────────────────────────────
    print("\n[3] Category CSV import — idempotency")
    csv_updated = "\n".join([
        "name,description,parent,sort_order,is_active,image_url",
        "Tarpaulins,UPDATED description,,0,true,",
        "Ground Sheets,Ground protection,,1,true,",
        "Heavy Duty,Industrial grade,Tarpaulins,0,true,",
        "Standard,Everyday use,Tarpaulins,1,true,",
    ])
    async with AsyncSessionLocal() as db:
        r2 = await cat_svc.import_from_csv(csv_updated, db)
        await db.commit()

    check("0 new created on re-import", r2["created"] == 0, str(r2))
    check("4 updated on re-import", r2["updated"] == 4, str(r2))

    async with AsyncSessionLocal() as db:
        rows2 = (await db.execute(select(Category))).scalars().all()
    check("Still exactly 4 categories (no duplicates)", len(rows2) == 4, f"found {len(rows2)}")

    tarp2 = next((c for c in rows2 if c.name == "Tarpaulins"), None)
    check("Description updated", tarp2 is not None and tarp2.description == "UPDATED description",
          tarp2.description if tarp2 else "not found")

    # ──────────────────────────────────────────────────────────
    # TEST 4: Parent not found → error row, not crash
    # ──────────────────────────────────────────────────────────
    print("\n[4] Category CSV import — missing parent returns error")
    csv_bad = "name,description,parent,sort_order,is_active,image_url\nOrphan,,NonExistentParent,0,true,"
    async with AsyncSessionLocal() as db:
        r3 = await cat_svc.import_from_csv(csv_bad, db)
        await db.commit()

    check("1 error for missing parent", len(r3["errors"]) == 1, str(r3["errors"]))
    check("0 categories created for bad row", r3["created"] == 0)

    async with AsyncSessionLocal() as db:
        count = len((await db.execute(select(Category))).scalars().all())
    check("DB unchanged after bad import (still 4)", count == 4, f"found {count}")

    # ──────────────────────────────────────────────────────────
    # TEST 5: Export round-trip
    # ──────────────────────────────────────────────────────────
    print("\n[5] Category CSV export — round-trip")
    async with AsyncSessionLocal() as db:
        exported = await cat_svc.export_to_csv(db)

    exp_lines = exported.strip().splitlines()
    check("Export has 5 lines (1 header + 4 data)", len(exp_lines) == 5, f"{len(exp_lines)}")
    check("Tarpaulins present in export", any("Tarpaulins" in l for l in exp_lines))
    check("Heavy Duty row has parent=Tarpaulins",
          any("Heavy Duty" in l and "Tarpaulins" in l for l in exp_lines))
    check("Parents appear before children (Tarpaulins before Heavy Duty)",
          next(i for i, l in enumerate(exp_lines) if "Tarpaulins" in l and "," in l)
          < next(i for i, l in enumerate(exp_lines) if "Heavy Duty" in l))

    # ──────────────────────────────────────────────────────────
    # TEST 6: Product CSV auto-creates missing category
    # ──────────────────────────────────────────────────────────
    print("\n[6] Product CSV import — auto-creates missing category")
    async with AsyncSessionLocal() as db:
        cat_count_before = len((await db.execute(select(Category))).scalars().all())

    product_csv = "\n".join([
        "name,price,description,stock_quantity,category,is_featured",
        "Product A,19.99,In existing category,10,Tarpaulins,false",
        "Product B,29.99,In brand new category,5,Brand New Category,true",
    ])
    async with AsyncSessionLocal() as db:
        pr = await prod_svc.import_from_csv(product_csv, db)
        await db.commit()

    check("2 products created", pr["created"] == 2, str(pr))
    check("0 product import errors", pr["errors"] == [], str(pr["errors"]))

    async with AsyncSessionLocal() as db:
        cat_count_after = len((await db.execute(select(Category))).scalars().all())
        prods = (await db.execute(select(Product))).scalars().all()
        tarp_row = (await db.execute(
            select(Category).where(Category.name == "Tarpaulins")
        )).scalar_one_or_none()
        new_cat = (await db.execute(
            select(Category).where(Category.name == "Brand New Category")
        )).scalar_one_or_none()

    check("1 new category auto-created",
          cat_count_after == cat_count_before + 1,
          f"before={cat_count_before} after={cat_count_after}")
    check("'Brand New Category' exists in DB", new_cat is not None)

    prod_a = next((p for p in prods if p.name == "Product A"), None)
    prod_b = next((p for p in prods if p.name == "Product B"), None)
    check("Product A linked to existing Tarpaulins",
          prod_a is not None and tarp_row is not None and prod_a.category_id == tarp_row.id)
    check("Product B linked to auto-created category",
          prod_b is not None and new_cat is not None and prod_b.category_id == new_cat.id)

    # ──────────────────────────────────────────────────────────
    # TEST 7: Product CSV import ignores stock_quantity for a variant product
    # ──────────────────────────────────────────────────────────
    print("\n[7] Product CSV import ignores stock_quantity when real variants exist")
    # Separate session per step (matching this file's convention elsewhere) — reusing one
    # session across create_option_type / add_option_value / generate_variants without an
    # expire in between leaves the option type's `.values` collection stale in the identity
    # map, silently yielding zero combinations. The pytest HTTP-based tests avoid this only
    # because conftest.py's client fixture calls db.expire_all() before every request.
    async with AsyncSessionLocal() as db:
        product = await prod_svc.create_product(
            ProductCreate(name="Variant Widget", price="15.00", stock_quantity=0), db,
        )
        product_id = product.id
        await db.commit()
    async with AsyncSessionLocal() as db:
        opt = await variant_svc.create_option_type(product_id, OptionTypeCreate(name="Size"), db)
        opt_id = opt.id
        await db.commit()
    async with AsyncSessionLocal() as db:
        await variant_svc.add_option_value(product_id, opt_id, OptionValueCreate(label="S"), db)
        await db.commit()
    async with AsyncSessionLocal() as db:
        await variant_svc.add_option_value(product_id, opt_id, OptionValueCreate(label="M"), db)
        await db.commit()
    async with AsyncSessionLocal() as db:
        variants = await variant_svc.generate_variants(product_id, db)
        variant_ids = [v.id for v in variants]
        await db.commit()
    async with AsyncSessionLocal() as db:
        for vid in variant_ids:
            v = (await db.execute(select(ProductVariant).where(ProductVariant.id == vid))).scalar_one()
            v.stock_quantity = 4
        await db.flush()
        await variant_svc.recalc_product_stock(product_id, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        before = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
        stock_before = before.stock_quantity
    check("Derived stock is sum of variants before CSV re-import", stock_before == 8, f"stock={stock_before}")

    variant_product_csv = "\n".join([
        "name,price,stock_quantity",
        "Variant Widget,15.00,999",
    ])
    async with AsyncSessionLocal() as db:
        pr2 = await prod_svc.import_from_csv(variant_product_csv, db)
        await db.commit()

    check("CSV import produced a warning, not a silent overwrite",
          len(pr2["warnings"]) == 1, str(pr2))

    async with AsyncSessionLocal() as db:
        after = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    check("stock_quantity unchanged by CSV (still the derived sum, not 999)",
          after.stock_quantity == 8, f"stock={after.stock_quantity}")

    # ──────────────────────────────────────────────────────────
    # SUMMARY
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 54)
    passed = sum(1 for s, _, _ in results if s == PASS)
    failed = sum(1 for s, _, _ in results if s == FAIL)
    print(f"  {passed} passed   {failed} failed")
    print("=" * 54)

    await async_engine.dispose()
    if os.path.exists("test_csv_run.db"):
        os.remove("test_csv_run.db")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
