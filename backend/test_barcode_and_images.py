"""
End-to-end tests for barcode field and multi-image product features.
"""
import asyncio
import csv
import io
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_barcode_images_run.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pydantic import ValidationError
from sqlalchemy import select

# Import all plugin models so Base.metadata includes them all
from app.core.base_model import Base
from app.core.database import async_engine, AsyncSessionLocal
from app.plugins.products.models import Product, ProductImage
from app.plugins.products.schemas import ProductCreate, ProductUpdate, ProductImageCreate, ProductOut

import app.plugins.auth.models  # noqa
import app.plugins.branding.models  # noqa
import app.plugins.categories.models  # noqa
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

from app.plugins.products import service

PASS = "PASS"
FAIL = "FAIL"
results: list[tuple[str, str, str]] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    suffix = f"  ({detail})" if detail else ""
    print(f"  {status}  {label}{suffix}")


def _csv_safe(value: str) -> str:
    """Copied from router.py — prevent CSV formula injection."""
    s = str(value) if value is not None else ""
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


async def _export_products_to_csv(db) -> str:
    """Replicates the router's export_products_csv logic for use in tests."""
    result = await db.execute(select(Product).order_by(Product.created_at.desc()))
    products = result.scalars().all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "name", "sku", "price", "sale_price", "stock_quantity",
        "is_active", "category_id", "barcode", "created_at",
    ])
    writer.writeheader()
    for p in products:
        writer.writerow({
            "name": _csv_safe(p.name),
            "sku": _csv_safe(p.sku or ""),
            "price": p.price,
            "sale_price": p.sale_price or "",
            "stock_quantity": p.stock_quantity,
            "is_active": p.is_active,
            "category_id": p.category_id or "",
            "barcode": _csv_safe(p.barcode or ""),
            "created_at": p.created_at.isoformat(),
        })
    output.seek(0)
    return output.getvalue()


async def run_tests() -> None:
    # Create all tables fresh
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # ──────────────────────────────────────────────────────────
    # [1] Create product WITH barcode — verify it saves
    # ──────────────────────────────────────────────────────────
    print("\n[1] Create product WITH barcode")
    async with AsyncSessionLocal() as db:
        data = ProductCreate(name="Barcode Product", price="9.99", barcode="5901234123457")
        p1 = await service.create_product(data, db)
        p1_id = p1.id  # UUID set in Python before flush — safe to read
        await db.commit()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Product).where(Product.id == p1_id))
        product1 = result.scalar_one()
    check("barcode saved", product1.barcode == "5901234123457", f"got: {product1.barcode!r}")

    # ──────────────────────────────────────────────────────────
    # [2] Create product WITHOUT barcode — barcode is None
    # ──────────────────────────────────────────────────────────
    print("\n[2] Create product WITHOUT barcode")
    async with AsyncSessionLocal() as db:
        data2 = ProductCreate(name="No Barcode Product", price="5.00")
        p2 = await service.create_product(data2, db)
        p2_id = p2.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Product).where(Product.id == p2_id))
        product2 = result.scalar_one()
    check("barcode defaults to None", product2.barcode is None, f"got: {product2.barcode!r}")

    # ──────────────────────────────────────────────────────────
    # [3] Update barcode on existing product
    # ──────────────────────────────────────────────────────────
    print("\n[3] Update barcode on existing product")
    async with AsyncSessionLocal() as db:
        upd = ProductUpdate(barcode="0012345678905")
        await service.update_product(p2_id, upd, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Product).where(Product.id == p2_id))
        product2_upd = result.scalar_one()
    check("barcode updated", product2_upd.barcode == "0012345678905", f"got: {product2_upd.barcode!r}")

    # ──────────────────────────────────────────────────────────
    # [4] Clear barcode (set to None)
    # ──────────────────────────────────────────────────────────
    print("\n[4] Clear barcode (set to None)")
    # Explicitly pass barcode=None so model_dump(exclude_unset=True) includes it
    async with AsyncSessionLocal() as db:
        upd_clear = ProductUpdate(barcode=None)
        await service.update_product(p1_id, upd_clear, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Product).where(Product.id == p1_id))
        product1_cleared = result.scalar_one()
    check("barcode cleared to None", product1_cleared.barcode is None, f"got: {product1_cleared.barcode!r}")

    # ──────────────────────────────────────────────────────────
    # [5] Barcode max_length validation — >100 chars rejected
    # ──────────────────────────────────────────────────────────
    print("\n[5] Barcode max_length validation")
    try:
        ProductCreate(name="Too Long Barcode", price="1.00", barcode="X" * 101)
        check("barcode >100 chars rejected", False, "no ValidationError raised")
    except ValidationError as exc:
        check("barcode >100 chars rejected", True, f"ValidationError with {exc.error_count()} error(s)")

    # ──────────────────────────────────────────────────────────
    # [6] Add multiple images to a product (4 images)
    # ──────────────────────────────────────────────────────────
    print("\n[6] Add 4 images to product")
    async with AsyncSessionLocal() as db:
        p3 = await service.create_product(ProductCreate(name="Multi Image Product", price="19.99"), db)
        p3_id = p3.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        for i in range(4):
            await service.add_image(
                p3_id,
                ProductImageCreate(url=f"http://test.com/img{i}.jpg", sort_order=i),
                db,
            )
        await db.commit()

    async with AsyncSessionLocal() as db:
        p3_loaded = await service.get_product(p3_id, db)
    check("4 images attached", len(p3_loaded.images) == 4, f"count={len(p3_loaded.images)}")

    # ──────────────────────────────────────────────────────────
    # [7] is_primary flag — exactly one primary
    # ──────────────────────────────────────────────────────────
    print("\n[7] is_primary flag — exactly one primary")
    async with AsyncSessionLocal() as db:
        p4 = await service.create_product(ProductCreate(name="Primary Flag Product", price="29.99"), db)
        p4_id = p4.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        await service.add_image(p4_id, ProductImageCreate(url="http://test.com/a.jpg", is_primary=False), db)
        await service.add_image(p4_id, ProductImageCreate(url="http://test.com/b.jpg", is_primary=True), db)
        await service.add_image(p4_id, ProductImageCreate(url="http://test.com/c.jpg", is_primary=False), db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        p4_loaded = await service.get_product(p4_id, db)
    primary_count = sum(1 for img in p4_loaded.images if img.is_primary)
    check("exactly one primary", primary_count == 1, f"primary_count={primary_count}")

    # ──────────────────────────────────────────────────────────
    # [8] primary_image computed property on ProductOut
    # ──────────────────────────────────────────────────────────
    print("\n[8] primary_image computed property on ProductOut")
    async with AsyncSessionLocal() as db:
        p5 = await service.create_product(ProductCreate(name="Primary Image URL Product", price="39.99"), db)
        p5_id = p5.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        await service.add_image(p5_id, ProductImageCreate(url="http://test.com/primary.jpg", is_primary=True), db)
        await service.add_image(p5_id, ProductImageCreate(url="http://test.com/secondary.jpg", is_primary=False), db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        p5_loaded = await service.get_product(p5_id, db)
    out = ProductOut.model_validate(p5_loaded)
    check(
        "primary_image returns correct URL",
        out.primary_image == "http://test.com/primary.jpg",
        f"primary_image={out.primary_image!r}",
    )

    # ──────────────────────────────────────────────────────────
    # [9] CSV import — barcode column recognised
    # ──────────────────────────────────────────────────────────
    print("\n[9] CSV import — barcode column recognised")
    async with AsyncSessionLocal() as db:
        await service.create_product(ProductCreate(name="CSV Barcode Product", price="15.00"), db)
        await db.commit()

    csv_with_barcode = "\n".join([
        "name,price,barcode",
        "CSV Barcode Product,15.00,9780201379624",
    ])
    async with AsyncSessionLocal() as db:
        import_result = await service.import_from_csv(csv_with_barcode, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.name == "CSV Barcode Product"))
        p_csv = res.scalar_one()
    check(
        "barcode recognised in CSV import",
        p_csv.barcode == "9780201379624",
        f"barcode={p_csv.barcode!r}, result={import_result}",
    )

    # ──────────────────────────────────────────────────────────
    # [10] CSV import — blank barcode cell → barcode stays None
    # ──────────────────────────────────────────────────────────
    print("\n[10] CSV import — blank barcode cell -> barcode stays None")
    async with AsyncSessionLocal() as db:
        await service.create_product(ProductCreate(name="Blank Barcode CSV Product", price="7.50"), db)
        await db.commit()

    csv_blank_barcode = "\n".join([
        "name,price,barcode",
        "Blank Barcode CSV Product,7.50,",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv_blank_barcode, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.name == "Blank Barcode CSV Product"))
        p_blank = res.scalar_one()
    check(
        "blank barcode stays None",
        p_blank.barcode is None,
        f"barcode={p_blank.barcode!r}",
    )

    # ──────────────────────────────────────────────────────────
    # [11] CSV export — barcode column present and correct value
    # ──────────────────────────────────────────────────────────
    print("\n[11] CSV export — barcode column present")
    async with AsyncSessionLocal() as db:
        p_exp = await service.create_product(
            ProductCreate(name="Export Barcode Product", price="25.00", barcode="1234567890123"), db
        )
        await db.commit()

    async with AsyncSessionLocal() as db:
        csv_out = await _export_products_to_csv(db)

    reader = csv.DictReader(io.StringIO(csv_out))
    fields = reader.fieldnames or []
    rows = list(reader)
    check("barcode column in header", "barcode" in fields, f"fields={fields}")
    matching = [r for r in rows if r.get("name") == "Export Barcode Product"]
    check(
        "barcode value correct in export",
        len(matching) == 1 and matching[0].get("barcode") == "1234567890123",
        f"matching_rows={matching}",
    )

    # ──────────────────────────────────────────────────────────
    # [12] CSV injection guard — barcode starting with = is sanitised
    # ──────────────────────────────────────────────────────────
    print("\n[12] CSV injection guard")
    injection_barcode = '=SYSTEM("cmd")'
    async with AsyncSessionLocal() as db:
        await service.create_product(
            ProductCreate(name="Injection Barcode Product", price="1.00", barcode=injection_barcode), db
        )
        await db.commit()

    async with AsyncSessionLocal() as db:
        csv_inj = await _export_products_to_csv(db)

    inj_rows = list(csv.DictReader(io.StringIO(csv_inj)))
    inj_match = [r for r in inj_rows if r.get("name") == "Injection Barcode Product"]
    exported_bc = inj_match[0].get("barcode") if inj_match else None
    check(
        "injection neutralised",
        exported_bc is not None and exported_bc != injection_barcode,
        f"exported_barcode={exported_bc!r}",
    )

    # ──────────────────────────────────────────────────────────
    # [13] Delete image — image count decreases
    # ──────────────────────────────────────────────────────────
    print("\n[13] Delete image — image count decreases")
    async with AsyncSessionLocal() as db:
        p6 = await service.create_product(ProductCreate(name="Delete Image Product", price="12.00"), db)
        p6_id = p6.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        await service.add_image(p6_id, ProductImageCreate(url="http://test.com/del1.jpg"), db)
        img2 = await service.add_image(p6_id, ProductImageCreate(url="http://test.com/del2.jpg"), db)
        await service.add_image(p6_id, ProductImageCreate(url="http://test.com/del3.jpg"), db)
        img2_id = img2.id  # UUID set in Python; safe before commit
        await db.commit()

    async with AsyncSessionLocal() as db:
        await service.remove_image(p6_id, img2_id, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        p6_loaded = await service.get_product(p6_id, db)
    check(
        "image count decreased to 2",
        len(p6_loaded.images) == 2,
        f"count={len(p6_loaded.images)}",
    )

    # ──────────────────────────────────────────────────────────
    # [14] Sort order preserved on fetch
    # ──────────────────────────────────────────────────────────
    print("\n[14] Sort order preserved on fetch")
    async with AsyncSessionLocal() as db:
        p7 = await service.create_product(ProductCreate(name="Sort Order Product", price="8.00"), db)
        p7_id = p7.id
        await db.commit()

    # Add images in shuffled order — DB should return them sorted by sort_order
    async with AsyncSessionLocal() as db:
        await service.add_image(p7_id, ProductImageCreate(url="http://test.com/s2.jpg", sort_order=2), db)
        await service.add_image(p7_id, ProductImageCreate(url="http://test.com/s0.jpg", sort_order=0), db)
        await service.add_image(p7_id, ProductImageCreate(url="http://test.com/s1.jpg", sort_order=1), db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        p7_loaded = await service.get_product(p7_id, db)
    sort_orders = [img.sort_order for img in p7_loaded.images]
    check(
        "images returned in sort order",
        sort_orders == [0, 1, 2],
        f"sort_orders={sort_orders}",
    )

    # ──────────────────────────────────────────────────────────
    # SUMMARY
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 54)
    passed = sum(1 for s, _, _ in results if s == PASS)
    failed = sum(1 for s, _, _ in results if s == FAIL)
    print(f"  {passed} passed   {failed} failed")
    print("=" * 54)

    await async_engine.dispose()
    db_path = "test_barcode_images_run.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
