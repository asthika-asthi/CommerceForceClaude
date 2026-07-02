"""
End-to-end tests for variant CSV import/export.
"""
import asyncio
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_variant_csv_run.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select

# Import all plugin models so Base.metadata includes them all
from app.core.base_model import Base
from app.core.database import async_engine, AsyncSessionLocal
from app.plugins.products.models import Product, ProductVariant
from app.plugins.inventory.models import Warehouse, WarehouseStock

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

import app.plugins.products.variant_csv_service as svc

PASS = "PASS"
FAIL = "FAIL"
results: list[tuple[str, str, str]] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    suffix = f"  ({detail})" if detail else ""
    print(f"  {status}  {label}{suffix}")


async def create_product(db, name: str, sku: str) -> Product:
    from app.plugins.products.models import Product as ProductModel
    p = ProductModel(
        name=name, sku=sku, slug=sku.lower(),
        price=10.00, description="test", stock_quantity=0,
    )
    db.add(p)
    await db.flush()
    return p


async def create_warehouse(db, name: str, code: str, is_default: bool = False) -> Warehouse:
    w = Warehouse(name=name, code=code, is_default=is_default)
    db.add(w)
    await db.flush()
    return w


async def run_tests() -> None:
    # Create all tables fresh
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # ──────────────────────────────────────────────────────────
    # [1] Export on empty DB
    # ──────────────────────────────────────────────────────────
    print("\n[1] Export on empty DB")
    async with AsyncSessionLocal() as db:
        csv_out = await svc.export_variants_to_csv(db)
    lines = [l for l in csv_out.strip().splitlines() if l]
    check("Header row present", len(lines) == 1)
    check("Header contains required columns",
          "product_sku" in lines[0] and "variant_sku" in lines[0] and "option1_name" in lines[0])

    # ──────────────────────────────────────────────────────────
    # [2] Missing required columns → immediate error
    # ──────────────────────────────────────────────────────────
    print("\n[2] Missing required columns")
    async with AsyncSessionLocal() as db:
        r = await svc.import_variants_from_csv("option1_name,option1_value\nred,small", db, "set")
        await db.commit()
    check("rows_processed == 0", r.rows_processed == 0, str(r))
    check("error on field=headers", len(r.errors) == 1 and r.errors[0].field == "headers", str(r.errors))

    # ──────────────────────────────────────────────────────────
    # [3] Row limit exceeded → immediate rejection
    # ──────────────────────────────────────────────────────────
    print("\n[3] Row limit (10,001 rows)")
    header = "product_sku,variant_sku,option1_name,option1_value,price_adjustment,is_active"
    big_csv = header + "\n" + "\n".join(f"P,V-{i},Size,S,,true" for i in range(10_001))
    async with AsyncSessionLocal() as db:
        r = await svc.import_variants_from_csv(big_csv, db, "set")
        await db.commit()
    check("Rejected immediately", r.rows_processed == 0, str(r))
    check("Error on field=file", len(r.errors) == 1 and r.errors[0].field == "file", str(r.errors))

    # ──────────────────────────────────────────────────────────
    # [4] Happy path — create 3 variants across 2 products, 2 warehouses
    # ──────────────────────────────────────────────────────────
    print("\n[4] Happy path — create variants")
    async with AsyncSessionLocal() as db:
        await create_product(db, "T-Shirt", "TSHIRT")
        await create_product(db, "Hoodie", "HOODIE")
        await create_warehouse(db, "Main", "MAIN", is_default=True)
        await create_warehouse(db, "London", "LONDON")
        await db.commit()

    csv_in = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,price_adjustment,is_active,stock_MAIN,stock_LONDON",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,,,,true,10,5",
        "TSHIRT,TSHIRT-M-RED,Size,M,Colour,Red,,,,true,8,",
        "HOODIE,HOODIE-BLK,Colour,Black,,,,,,true,20,15",
    ])
    async with AsyncSessionLocal() as db:
        r = await svc.import_variants_from_csv(csv_in, db, "set")
        await db.commit()

    check("variants_created == 3", r.variants_created == 3, str(r))
    check("variants_updated == 0", r.variants_updated == 0, str(r))
    check("stock_records_set == 5", r.stock_records_set == 5, str(r))
    check("errors == []", r.errors == [], str(r.errors))

    # Verify DB state
    async with AsyncSessionLocal() as db:
        variants = (await db.execute(
            select(ProductVariant).where(ProductVariant.is_default == False)
        )).scalars().all()
        stock_rows = (await db.execute(select(WarehouseStock))).scalars().all()
    check("3 non-default variants in DB", len(variants) == 3, f"found {len(variants)}")
    check("5 stock records in DB", len(stock_rows) == 5, f"found {len(stock_rows)}")

    # ──────────────────────────────────────────────────────────
    # [5] Idempotency — re-import same CSV
    # ──────────────────────────────────────────────────────────
    print("\n[5] Idempotency — re-import")
    async with AsyncSessionLocal() as db:
        r2 = await svc.import_variants_from_csv(csv_in, db, "set")
        await db.commit()
    check("variants_created == 0", r2.variants_created == 0, str(r2))
    check("variants_updated == 3", r2.variants_updated == 3, str(r2))
    check("errors == []", r2.errors == [], str(r2.errors))

    async with AsyncSessionLocal() as db:
        variants2 = (await db.execute(
            select(ProductVariant).where(ProductVariant.is_default == False)
        )).scalars().all()
    check("Still only 3 variants (no duplicates)", len(variants2) == 3, f"found {len(variants2)}")

    # ──────────────────────────────────────────────────────────
    # [6] Unknown warehouse column → warning, import continues
    # ──────────────────────────────────────────────────────────
    print("\n[6] Unknown warehouse column")
    csv_ghost = csv_in.replace(
        "stock_MAIN,stock_LONDON",
        "stock_MAIN,stock_LONDON,stock_GHOST"
    ).replace(
        "10,5", "10,5,"
    ).replace(
        "8,", "8,,"
    ).replace(
        "20,15", "20,15,"
    )
    async with AsyncSessionLocal() as db:
        r3 = await svc.import_variants_from_csv(csv_ghost, db, "set")
        await db.commit()
    check("Warning about GHOST column", any("GHOST" in w for w in r3.warnings), str(r3.warnings))
    check("Import still processed rows", r3.variants_updated == 3, str(r3))
    check("No errors from ghost column", r3.errors == [], str(r3.errors))

    # ──────────────────────────────────────────────────────────
    # [7] Unknown product_sku → error logged, other rows processed
    # ──────────────────────────────────────────────────────────
    print("\n[7] Unknown product_sku")
    # TSHIRT-S-RED was created with Size=S, Colour=Red — include both options
    csv_bad_prod = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active,stock_MAIN",
        "NONEXISTENT,V-999,Size,S,,,,true,5",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,,true,10",
    ])
    async with AsyncSessionLocal() as db:
        r4 = await svc.import_variants_from_csv(csv_bad_prod, db, "set")
        await db.commit()
    check("1 error for unknown product", len(r4.errors) == 1, str(r4.errors))
    check("Error field is product_sku", r4.errors[0].field == "product_sku", str(r4.errors))
    check("Valid row still processed", r4.variants_updated >= 1, str(r4))

    # ──────────────────────────────────────────────────────────
    # [8] Duplicate variant_sku in CSV → second row errors
    # ──────────────────────────────────────────────────────────
    print("\n[8] Duplicate variant_sku in file")
    # Include full option combo so first occurrence processes cleanly
    csv_dup = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,,true",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,,true",
    ])
    async with AsyncSessionLocal() as db:
        r5 = await svc.import_variants_from_csv(csv_dup, db, "set")
        await db.commit()
    check("1 error for duplicate SKU", len(r5.errors) == 1, str(r5.errors))
    check("Error field is variant_sku", r5.errors[0].field == "variant_sku", str(r5.errors))
    check("First occurrence still processed", r5.variants_updated >= 1 or r5.variants_created >= 1, str(r5))

    # ──────────────────────────────────────────────────────────
    # [9] Option combination change on existing variant → error
    # ──────────────────────────────────────────────────────────
    print("\n[9] Option combination change blocked")
    csv_opt_change = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Blue,,true",  # Was Red, now Blue
    ])
    async with AsyncSessionLocal() as db:
        r6 = await svc.import_variants_from_csv(csv_opt_change, db, "set")
        await db.commit()
    check("1 error for option combo change", len(r6.errors) == 1, str(r6.errors))
    check("Error field is options", r6.errors[0].field == "options", str(r6.errors))

    # ──────────────────────────────────────────────────────────
    # [10] stock_mode=add → increments existing stock
    # ──────────────────────────────────────────────────────────
    print("\n[10] stock_mode=add")
    # TSHIRT-S-RED currently has qty=10 in MAIN from test 4/5
    csv_add = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active,stock_MAIN",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,,true,5",
    ])
    async with AsyncSessionLocal() as db:
        r7 = await svc.import_variants_from_csv(csv_add, db, "add")
        await db.commit()
    check("stock_records_incremented == 1", r7.stock_records_incremented == 1, str(r7))

    async with AsyncSessionLocal() as db:
        v = (await db.execute(
            select(ProductVariant).where(ProductVariant.sku == "TSHIRT-S-RED")
        )).scalar_one()
        wh = (await db.execute(select(Warehouse).where(Warehouse.code == "MAIN"))).scalar_one()
        stock = (await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.variant_id == v.id,
                WarehouseStock.warehouse_id == wh.id
            )
        )).scalar_one()
    check("Stock qty is 15 (10+5)", stock.quantity == 15, f"qty={stock.quantity}")

    # ──────────────────────────────────────────────────────────
    # [11] stock_mode=set → overwrites to exact value
    # ──────────────────────────────────────────────────────────
    print("\n[11] stock_mode=set")
    csv_set = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active,stock_MAIN",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,,true,100",
    ])
    async with AsyncSessionLocal() as db:
        r8 = await svc.import_variants_from_csv(csv_set, db, "set")
        await db.commit()
    check("stock_records_set == 1", r8.stock_records_set == 1, str(r8))

    async with AsyncSessionLocal() as db:
        v = (await db.execute(select(ProductVariant).where(ProductVariant.sku == "TSHIRT-S-RED"))).scalar_one()
        wh = (await db.execute(select(Warehouse).where(Warehouse.code == "MAIN"))).scalar_one()
        stock = (await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.variant_id == v.id,
                WarehouseStock.warehouse_id == wh.id
            )
        )).scalar_one()
    check("Stock qty is exactly 100", stock.quantity == 100, f"qty={stock.quantity}")

    # ──────────────────────────────────────────────────────────
    # [12] Default variant deactivated after import
    # ──────────────────────────────────────────────────────────
    print("\n[12] Default variant deactivated")
    async with AsyncSessionLocal() as db:
        default_variants = (await db.execute(
            select(ProductVariant).where(
                ProductVariant.is_default == True,
                ProductVariant.is_active == True
            )
        )).scalars().all()
    check("No active default variants remain for imported products",
          len(default_variants) == 0, f"found {len(default_variants)} active defaults")

    # ──────────────────────────────────────────────────────────
    # [13] Export round-trip
    # ──────────────────────────────────────────────────────────
    print("\n[13] Export round-trip")
    async with AsyncSessionLocal() as db:
        exported = await svc.export_variants_to_csv(db)

    exp_lines = exported.strip().splitlines()
    check("Export has header + data rows", len(exp_lines) > 1, f"{len(exp_lines)} lines")
    check("stock_MAIN column in export", "stock_MAIN" in exp_lines[0], exp_lines[0])
    check("stock_LONDON column in export", "stock_LONDON" in exp_lines[0], exp_lines[0])

    async with AsyncSessionLocal() as db:
        r9 = await svc.import_variants_from_csv(exported, db, "set")
        await db.commit()
    check("Round-trip: variants_created == 0", r9.variants_created == 0, str(r9))
    check("Round-trip: errors == []", r9.errors == [], str(r9.errors))

    # ──────────────────────────────────────────────────────────
    # [14] Blank is_active → warning + defaults to true
    # ──────────────────────────────────────────────────────────
    print("\n[14] Blank is_active -> warning")
    async with AsyncSessionLocal() as db:
        _ = (await db.execute(select(Product).where(Product.sku == "TSHIRT"))).scalar_one()

    csv_blank_active = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active",
        "TSHIRT,TSHIRT-XL-GRN,Size,XL,Colour,Green,,",
    ])
    async with AsyncSessionLocal() as db:
        r10 = await svc.import_variants_from_csv(csv_blank_active, db, "set")
        await db.commit()
    check("Warning about blank is_active", any("is_active" in w for w in r10.warnings), str(r10.warnings))

    async with AsyncSessionLocal() as db:
        v = (await db.execute(select(ProductVariant).where(ProductVariant.sku == "TSHIRT-XL-GRN"))).scalar_one_or_none()
    check("Variant created", v is not None)
    check("is_active defaults to True", v is not None and v.is_active == True, str(v.is_active if v else None))

    # ──────────────────────────────────────────────────────────
    # [15] Negative stock value → row error, no stock written
    # ──────────────────────────────────────────────────────────
    print("\n[15] Negative stock value")
    csv_neg = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active,stock_MAIN",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,,true,-1",
    ])
    async with AsyncSessionLocal() as db:
        r11 = await svc.import_variants_from_csv(csv_neg, db, "set")
        await db.commit()
    check("Error for negative stock", len(r11.errors) == 1, str(r11.errors))
    check("Error field is stock_MAIN", r11.errors[0].field == "stock_MAIN", str(r11.errors))
    check("stock_records_set == 0", r11.stock_records_set == 0, str(r11))

    # ──────────────────────────────────────────────────────────
    # [16] Invalid price_adjustment → row skipped
    # ──────────────────────────────────────────────────────────
    print("\n[16] Invalid price_adjustment")
    csv_bad_price = "\n".join([
        "product_sku,variant_sku,option1_name,option1_value,option2_name,option2_value,price_adjustment,is_active",
        "TSHIRT,TSHIRT-S-RED,Size,S,Colour,Red,notanumber,true",
    ])
    async with AsyncSessionLocal() as db:
        r12 = await svc.import_variants_from_csv(csv_bad_price, db, "set")
        await db.commit()
    check("Error for invalid price_adjustment", len(r12.errors) == 1, str(r12.errors))
    check("Error field is price_adjustment", r12.errors[0].field == "price_adjustment", str(r12.errors))
    check("variants_created == 0 (row skipped)", r12.variants_created == 0, str(r12))

    # ──────────────────────────────────────────────────────────
    # SUMMARY
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 54)
    passed = sum(1 for s, _, _ in results if s == PASS)
    failed = sum(1 for s, _, _ in results if s == FAIL)
    print(f"  {passed} passed   {failed} failed")
    print("=" * 54)

    await async_engine.dispose()
    if os.path.exists("test_variant_csv_run.db"):
        os.remove("test_variant_csv_run.db")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
