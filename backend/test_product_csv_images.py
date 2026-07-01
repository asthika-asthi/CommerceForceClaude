"""
End-to-end tests for image_url_1..5 product CSV import/export feature.
"""
import asyncio
import csv
import io
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_csv_images_run.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Import all plugin models so Base.metadata includes them all
from app.core.base_model import Base
from app.core.database import async_engine, AsyncSessionLocal
from app.plugins.products.models import Product, ProductImage
from app.plugins.products.schemas import ProductCreate, ProductImageCreate

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
    """Prevent CSV formula injection by prefixing dangerous leading characters."""
    s = str(value) if value is not None else ""
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


async def _export_products_to_csv(db) -> str:
    """Replicates the router's export_products_csv logic, including image columns."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .order_by(Product.created_at.desc())
    )
    products = result.scalars().all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "name", "sku", "price", "sale_price", "stock_quantity",
        "is_active", "category_id", "barcode", "created_at",
        "image_url_1", "image_url_2", "image_url_3", "image_url_4", "image_url_5",
    ])
    writer.writeheader()
    for p in products:
        sorted_imgs = sorted(p.images, key=lambda img: img.sort_order)
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
            "image_url_1": _csv_safe(sorted_imgs[0].url if len(sorted_imgs) > 0 else ""),
            "image_url_2": _csv_safe(sorted_imgs[1].url if len(sorted_imgs) > 1 else ""),
            "image_url_3": _csv_safe(sorted_imgs[2].url if len(sorted_imgs) > 2 else ""),
            "image_url_4": _csv_safe(sorted_imgs[3].url if len(sorted_imgs) > 3 else ""),
            "image_url_5": _csv_safe(sorted_imgs[4].url if len(sorted_imgs) > 4 else ""),
        })
    output.seek(0)
    return output.getvalue()


async def _get_images(product_id, db) -> list:
    """Load product images sorted by sort_order."""
    result = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.sort_order)
    )
    return list(result.scalars().all())


async def run_tests() -> None:
    # Create all tables fresh
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # ──────────────────────────────────────────────────────────
    # [1] Import with image_url_1 only → 1 image, is_primary=True
    # ──────────────────────────────────────────────────────────
    print("\n[1] Import with image_url_1 only -> 1 image, is_primary=True")
    csv1 = "\n".join([
        "name,price,image_url_1,image_url_2,image_url_3,image_url_4,image_url_5",
        "CSV Img Product 1,10.00,/uploads/products/front.jpg,,,,",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv1, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.name == "CSV Img Product 1"))
        p1 = res.scalar_one()
        images1 = await _get_images(p1.id, db)
    check("1 image created", len(images1) == 1, f"count={len(images1)}")
    check("is_primary=True", images1[0].is_primary is True, f"is_primary={images1[0].is_primary!r}")
    check("sort_order=0", images1[0].sort_order == 0, f"sort_order={images1[0].sort_order}")

    # ──────────────────────────────────────────────────────────
    # [2] Import with image_url_1 + image_url_2 + image_url_3 → 3 images in order
    # ──────────────────────────────────────────────────────────
    print("\n[2] Import with 3 image columns -> 3 images in order")
    csv2 = "\n".join([
        "name,price,image_url_1,image_url_2,image_url_3,image_url_4,image_url_5",
        "CSV Img Product 2,20.00,/img/front.jpg,/img/side.jpg,/img/back.jpg,,",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv2, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.name == "CSV Img Product 2"))
        p2 = res.scalar_one()
        images2 = await _get_images(p2.id, db)
    check("3 images created", len(images2) == 3, f"count={len(images2)}")
    check("image_url_1 is primary", images2[0].is_primary is True, f"is_primary={images2[0].is_primary!r}")
    check("image_url_2 not primary", images2[1].is_primary is False, f"img2.is_primary={images2[1].is_primary!r}")
    check(
        "sort_orders are [0,1,2]",
        [img.sort_order for img in images2] == [0, 1, 2],
        f"sort_orders={[img.sort_order for img in images2]}",
    )

    # ──────────────────────────────────────────────────────────
    # [3] Re-import replaces existing images
    # ──────────────────────────────────────────────────────────
    print("\n[3] Re-import replaces existing images")
    csv3a = "\n".join([
        "name,price,image_url_1",
        "CSV Img Product 3,30.00,/img/front.jpg",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv3a, db)
        await db.commit()

    csv3b = "\n".join([
        "name,price,image_url_1,image_url_2",
        "CSV Img Product 3,30.00,/img/new-front.jpg,/img/side.jpg",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv3b, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.name == "CSV Img Product 3"))
        p3 = res.scalar_one()
        images3 = await _get_images(p3.id, db)
    check("now 2 images after re-import", len(images3) == 2, f"count={len(images3)}")
    urls3 = [img.url for img in images3]
    check("old front.jpg gone", "/img/front.jpg" not in urls3, f"urls={urls3}")
    check(
        "new primary is new-front.jpg",
        images3[0].url == "/img/new-front.jpg",
        f"primary_url={images3[0].url!r}",
    )

    # ──────────────────────────────────────────────────────────
    # [4] All image columns blank → existing images untouched
    # ──────────────────────────────────────────────────────────
    print("\n[4] All image columns blank -> existing images untouched")
    csv4a = "\n".join([
        "name,price,image_url_1",
        "CSV Img Product 4,40.00,/uploads/products/front.jpg",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv4a, db)
        await db.commit()

    # Re-import same product but without any image columns
    csv4b = "\n".join([
        "name,price",
        "CSV Img Product 4,40.00",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv4b, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.name == "CSV Img Product 4"))
        p4 = res.scalar_one()
        images4 = await _get_images(p4.id, db)
    check("still 1 image after blank re-import", len(images4) == 1, f"count={len(images4)}")
    check(
        "image url unchanged",
        images4[0].url == "/uploads/products/front.jpg",
        f"url={images4[0].url!r}",
    )

    # ──────────────────────────────────────────────────────────
    # [5] Export: image columns populated from sorted images
    # ──────────────────────────────────────────────────────────
    print("\n[5] Export: image columns populated from sorted images")
    async with AsyncSessionLocal() as db:
        p5 = await service.create_product(ProductCreate(name="CSV Img Product 5", price="50.00"), db)
        p5_id = p5.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        await service.add_image(p5_id, ProductImageCreate(url="/img/p5-a.jpg", sort_order=0, is_primary=True), db)
        await service.add_image(p5_id, ProductImageCreate(url="/img/p5-b.jpg", sort_order=1), db)
        await service.add_image(p5_id, ProductImageCreate(url="/img/p5-c.jpg", sort_order=2), db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        csv_out5 = await _export_products_to_csv(db)

    reader5 = csv.DictReader(io.StringIO(csv_out5))
    fields5 = list(reader5.fieldnames or [])
    rows5 = list(reader5)
    row5 = next((r for r in rows5 if r.get("name") == "CSV Img Product 5"), None)
    check("image_url_1 in header", "image_url_1" in fields5, f"fields={fields5}")
    check(
        "image_url_1 value correct",
        row5 is not None and row5.get("image_url_1") == "/img/p5-a.jpg",
        f"image_url_1={row5.get('image_url_1') if row5 else 'NO ROW'}",
    )
    check(
        "image_url_2 value correct",
        row5 is not None and row5.get("image_url_2") == "/img/p5-b.jpg",
        f"image_url_2={row5.get('image_url_2') if row5 else 'NO ROW'}",
    )
    check(
        "image_url_4 blank",
        row5 is not None and row5.get("image_url_4") == "",
        f"image_url_4={row5.get('image_url_4') if row5 else 'NO ROW'}",
    )
    check(
        "image_url_5 blank",
        row5 is not None and row5.get("image_url_5") == "",
        f"image_url_5={row5.get('image_url_5') if row5 else 'NO ROW'}",
    )

    # ──────────────────────────────────────────────────────────
    # [6] Round-trip: export then re-import → same images
    # ──────────────────────────────────────────────────────────
    print("\n[6] Round-trip: export then re-import")
    async with AsyncSessionLocal() as db:
        p6 = await service.create_product(ProductCreate(name="CSV Img Product 6", price="60.00"), db)
        p6_id = p6.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        await service.add_image(p6_id, ProductImageCreate(url="/img/p6-1.jpg", sort_order=0, is_primary=True), db)
        await service.add_image(p6_id, ProductImageCreate(url="/img/p6-2.jpg", sort_order=1), db)
        await db.commit()

    # Export all products, extract the row for product 6
    async with AsyncSessionLocal() as db:
        csv_rt = await _export_products_to_csv(db)

    rt_rows = list(csv.DictReader(io.StringIO(csv_rt)))
    rt_row = next((r for r in rt_rows if r.get("name") == "CSV Img Product 6"), None)

    # Build a slim CSV containing only name, price and image columns for re-import
    rt_fields = ["name", "price", "image_url_1", "image_url_2", "image_url_3", "image_url_4", "image_url_5"]
    rt_buf = io.StringIO()
    rt_writer = csv.DictWriter(rt_buf, fieldnames=rt_fields, extrasaction="ignore")
    rt_writer.writeheader()
    rt_writer.writerow(rt_row)
    csv6b = rt_buf.getvalue()

    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv6b, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        images6 = await _get_images(p6_id, db)
    check("2 images after round-trip", len(images6) == 2, f"count={len(images6)}")
    check(
        "primary preserved after round-trip",
        images6[0].is_primary is True,
        f"is_primary={images6[0].is_primary!r}",
    )
    check(
        "round-trip url_1 correct",
        images6[0].url == "/img/p6-1.jpg",
        f"url={images6[0].url!r}",
    )
    check(
        "round-trip url_2 correct",
        images6[1].url == "/img/p6-2.jpg",
        f"url={images6[1].url!r}",
    )

    # ──────────────────────────────────────────────────────────
    # [7] All 5 image columns populated → 5 images created
    # ──────────────────────────────────────────────────────────
    print("\n[7] All 5 image columns populated -> 5 images created")
    csv7 = "\n".join([
        "name,price,image_url_1,image_url_2,image_url_3,image_url_4,image_url_5",
        "CSV Img Product 7,70.00,/img/p7-1.jpg,/img/p7-2.jpg,/img/p7-3.jpg,/img/p7-4.jpg,/img/p7-5.jpg",
    ])
    async with AsyncSessionLocal() as db:
        await service.import_from_csv(csv7, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.name == "CSV Img Product 7"))
        p7 = res.scalar_one()
        images7 = await _get_images(p7.id, db)
    check("5 images created", len(images7) == 5, f"count={len(images7)}")
    primary_count7 = sum(1 for img in images7 if img.is_primary)
    check("only 1 image is primary", primary_count7 == 1, f"primary_count={primary_count7}")
    check(
        "image_url_1 is primary",
        images7[0].is_primary is True,
        f"images7[0].is_primary={images7[0].is_primary!r}",
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
    db_path = "test_csv_images_run.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
