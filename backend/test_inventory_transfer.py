"""
End-to-end tests for warehouse-to-warehouse stock transfers.
"""
import asyncio
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_inventory_transfer_run.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.base_model import Base
from app.core.database import async_engine, AsyncSessionLocal
from app.plugins.inventory.models import Warehouse, WarehouseStock
from app.plugins.products.models import Product, ProductVariant

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

from app.plugins.inventory import service as inv_svc
from app.plugins.inventory.schemas import StockTransferRequest
from sqlalchemy import select
from fastapi import HTTPException
from pydantic import ValidationError

PASS = "PASS"
FAIL = "FAIL"
results: list[tuple[str, str, str]] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    suffix = f"  ({detail})" if detail else ""
    print(f"  {status}  {label}{suffix}")


async def make_warehouse(db, name: str, code: str, is_default: bool = False) -> Warehouse:
    w = Warehouse(name=name, code=code, is_default=is_default)
    db.add(w)
    await db.flush()
    return w


async def make_variant(db, product_name: str, sku: str) -> ProductVariant:
    p = Product(
        name=product_name,
        sku=f"PROD-{sku}",
        slug=f"prod-{sku.lower()}",
        price=10.00,
        description="test",
        stock_quantity=0,
    )
    db.add(p)
    await db.flush()
    v = ProductVariant(product_id=p.id, sku=sku, is_default=False, is_active=True)
    db.add(v)
    await db.flush()
    return v


async def set_stock(db, warehouse_id: str, variant_id: str, quantity: int, reserved: int = 0, threshold: int = 10) -> WarehouseStock:
    s = WarehouseStock(
        warehouse_id=warehouse_id,
        variant_id=variant_id,
        quantity=quantity,
        reserved_quantity=reserved,
        low_stock_threshold=threshold,
    )
    db.add(s)
    await db.flush()
    return s


async def run_tests() -> None:
    # Create all tables fresh
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # ──────────────────────────────────────────────────────────
    # Set up shared fixtures: WH_A, WH_B, V1
    # ──────────────────────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        wh_a = await make_warehouse(db, "Warehouse A", "WH_A", is_default=True)
        wh_b = await make_warehouse(db, "Warehouse B", "WH_B")
        v1 = await make_variant(db, "Product One", "V1-SKU")
        await set_stock(db, wh_a.id, v1.id, quantity=20)
        await set_stock(db, wh_b.id, v1.id, quantity=5)
        wh_a_id = wh_a.id
        wh_b_id = wh_b.id
        v1_id = v1.id
        await db.commit()

    # ──────────────────────────────────────────────────────────
    # [1] Happy path — transfer 5 units WH_A to WH_B
    # ──────────────────────────────────────────────────────────
    print("\n[1] Happy path — transfer 5 units WH_A to WH_B")
    async with AsyncSessionLocal() as db:
        req = StockTransferRequest(
            from_warehouse_id=wh_a_id,
            to_warehouse_id=wh_b_id,
            variant_id=v1_id,
            quantity=5,
        )
        source, dest = await inv_svc.transfer_stock(req, db)
        from_qty = source.quantity
        to_qty = dest.quantity
        await db.commit()

    check("[1] from_stock.quantity == 15", from_qty == 15, f"qty={from_qty}")
    check("[1] to_stock.quantity == 10", to_qty == 10, f"qty={to_qty}")

    # Verify net total in DB
    async with AsyncSessionLocal() as db:
        from sqlalchemy import func
        total = (await db.execute(
            select(func.sum(WarehouseStock.quantity)).where(WarehouseStock.variant_id == v1_id)
        )).scalar()
    check("[1] net total unchanged (25)", total == 25, f"sum={total}")

    # ──────────────────────────────────────────────────────────
    # [2] Transfer creates destination record if it doesn't exist
    # ──────────────────────────────────────────────────────────
    print("\n[2] Transfer creates dest record if missing")
    async with AsyncSessionLocal() as db:
        wh_c = await make_warehouse(db, "Warehouse C", "WH_C")
        wh_c_id = wh_c.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        req = StockTransferRequest(
            from_warehouse_id=wh_a_id,
            to_warehouse_id=wh_c_id,
            variant_id=v1_id,
            quantity=3,
        )
        source, dest = await inv_svc.transfer_stock(req, db)
        from_qty = source.quantity
        to_qty = dest.quantity
        to_wh_id = dest.warehouse_id
        await db.commit()

    check("[2] from_stock.quantity == 12", from_qty == 12, f"qty={from_qty}")
    check("[2] to_stock.quantity == 3 (new record)", to_qty == 3, f"qty={to_qty}")
    check("[2] to_stock.warehouse_id == WH_C", to_wh_id == wh_c_id, f"wh_id={to_wh_id}")

    # ──────────────────────────────────────────────────────────
    # [3] Transfer entire available stock (exactly available_quantity)
    # ──────────────────────────────────────────────────────────
    print("\n[3] Transfer entire available stock")
    async with AsyncSessionLocal() as db:
        wh_d = await make_warehouse(db, "Warehouse D", "WH_D")
        v2 = await make_variant(db, "Product Two", "V2-SKU")
        await set_stock(db, wh_d.id, v2.id, quantity=8, reserved=3)
        wh_d_id = wh_d.id
        v2_id = v2.id
        await db.commit()

    raised = None
    from_qty = None
    try:
        async with AsyncSessionLocal() as db:
            req = StockTransferRequest(
                from_warehouse_id=wh_d_id,
                to_warehouse_id=wh_b_id,
                variant_id=v2_id,
                quantity=5,  # available_quantity = 8 - 3 = 5
            )
            source, dest = await inv_svc.transfer_stock(req, db)
            from_qty = source.quantity
            await db.commit()
    except HTTPException as e:
        raised = e

    check("[3] transfer succeeds (no exception)", raised is None, str(raised))
    check("[3] from_stock.quantity == 3", from_qty == 3, f"qty={from_qty}")

    # ──────────────────────────────────────────────────────────
    # [4] Insufficient stock -> 409
    # ──────────────────────────────────────────────────────────
    print("\n[4] Insufficient stock -> 409")
    # WH_D V2 now has quantity=3, reserved=3, available=0
    raised = None
    try:
        async with AsyncSessionLocal() as db:
            req = StockTransferRequest(
                from_warehouse_id=wh_d_id,
                to_warehouse_id=wh_b_id,
                variant_id=v2_id,
                quantity=6,
            )
            await inv_svc.transfer_stock(req, db)
            await db.commit()
    except HTTPException as e:
        raised = e

    check("[4] HTTPException 409 raised", raised is not None and raised.status_code == 409, str(raised))

    # Verify WH_D stock unchanged
    async with AsyncSessionLocal() as db:
        stock = (await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.warehouse_id == wh_d_id,
                WarehouseStock.variant_id == v2_id,
            )
        )).scalar_one()
    check("[4] WH_D stock still quantity=3", stock.quantity == 3, f"qty={stock.quantity}")

    # ──────────────────────────────────────────────────────────
    # [5] from == to -> 400
    # ──────────────────────────────────────────────────────────
    print("\n[5] from == to -> 400")
    raised = None
    try:
        async with AsyncSessionLocal() as db:
            req = StockTransferRequest(
                from_warehouse_id=wh_a_id,
                to_warehouse_id=wh_a_id,
                variant_id=v1_id,
                quantity=1,
            )
            await inv_svc.transfer_stock(req, db)
            await db.commit()
    except HTTPException as e:
        raised = e

    check("[5] HTTPException 400 raised", raised is not None and raised.status_code == 400, str(raised))

    # ──────────────────────────────────────────────────────────
    # [6] quantity <= 0 -> rejected (Pydantic schema validates gt=0)
    # ──────────────────────────────────────────────────────────
    print("\n[6] quantity <= 0 -> rejected")
    for bad_qty in [0, -5]:
        raised = None
        try:
            async with AsyncSessionLocal() as db:
                req = StockTransferRequest(
                    from_warehouse_id=wh_a_id,
                    to_warehouse_id=wh_b_id,
                    variant_id=v1_id,
                    quantity=bad_qty,
                )
                await inv_svc.transfer_stock(req, db)
                await db.commit()
        except (HTTPException, ValidationError) as e:
            raised = e
        check(
            f"[6] quantity={bad_qty} -> rejected (HTTPException 400 or ValidationError)",
            raised is not None and (
                (isinstance(raised, HTTPException) and raised.status_code == 400)
                or isinstance(raised, ValidationError)
            ),
            type(raised).__name__,
        )

    # ──────────────────────────────────────────────────────────
    # [7] Source record not found -> 404
    # ──────────────────────────────────────────────────────────
    print("\n[7] Source record not found -> 404")
    async with AsyncSessionLocal() as db:
        wh_e = await make_warehouse(db, "Warehouse E", "WH_E")
        wh_e_id = wh_e.id
        await db.commit()

    raised = None
    try:
        async with AsyncSessionLocal() as db:
            req = StockTransferRequest(
                from_warehouse_id=wh_e_id,
                to_warehouse_id=wh_b_id,
                variant_id=v1_id,
                quantity=1,
            )
            await inv_svc.transfer_stock(req, db)
            await db.commit()
    except HTTPException as e:
        raised = e

    check("[7] HTTPException 404 raised", raised is not None and raised.status_code == 404, str(raised))

    # ──────────────────────────────────────────────────────────
    # [8] Reserved stock not transferable
    # ──────────────────────────────────────────────────────────
    print("\n[8] Reserved stock not transferable")
    async with AsyncSessionLocal() as db:
        v3 = await make_variant(db, "Product Three", "V3-SKU")
        await set_stock(db, wh_a_id, v3.id, quantity=10, reserved=7)
        v3_id = v3.id
        await db.commit()

    # Transfer exactly the available amount (3)
    raised = None
    try:
        async with AsyncSessionLocal() as db:
            req = StockTransferRequest(
                from_warehouse_id=wh_a_id,
                to_warehouse_id=wh_b_id,
                variant_id=v3_id,
                quantity=3,
            )
            source, dest = await inv_svc.transfer_stock(req, db)
            from_qty_after_first = source.quantity
            await db.commit()
    except HTTPException as e:
        raised = e

    check("[8] First transfer succeeds", raised is None, str(raised))
    # WH_A V3: quantity=7, reserved=7, available=0

    # Now try to transfer 1 more (available=0) -> 409
    raised = None
    try:
        async with AsyncSessionLocal() as db:
            req = StockTransferRequest(
                from_warehouse_id=wh_a_id,
                to_warehouse_id=wh_b_id,
                variant_id=v3_id,
                quantity=1,
            )
            await inv_svc.transfer_stock(req, db)
            await db.commit()
    except HTTPException as e:
        raised = e

    check("[8] Second transfer (0 available) -> 409", raised is not None and raised.status_code == 409, str(raised))

    # ──────────────────────────────────────────────────────────
    # [9] New destination record inherits low_stock_threshold from source
    # ──────────────────────────────────────────────────────────
    print("\n[9] New dest record inherits low_stock_threshold from source")
    async with AsyncSessionLocal() as db:
        v4 = await make_variant(db, "Product Four", "V4-SKU")
        await set_stock(db, wh_a_id, v4.id, quantity=20, threshold=15)
        v4_id = v4.id
        await db.commit()

    async with AsyncSessionLocal() as db:
        req = StockTransferRequest(
            from_warehouse_id=wh_a_id,
            to_warehouse_id=wh_c_id,
            variant_id=v4_id,
            quantity=5,
        )
        source, dest = await inv_svc.transfer_stock(req, db)
        await db.commit()

    async with AsyncSessionLocal() as db:
        dest_record = (await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.warehouse_id == wh_c_id,
                WarehouseStock.variant_id == v4_id,
            )
        )).scalar_one_or_none()

    check("[9] dest record exists for V4 in WH_C", dest_record is not None)
    check("[9] dest.low_stock_threshold == 15", dest_record is not None and dest_record.low_stock_threshold == 15, f"threshold={dest_record.low_stock_threshold if dest_record else 'N/A'}")

    # ──────────────────────────────────────────────────────────
    # [10] Two sequential transfers reduce from_stock cumulatively
    # ──────────────────────────────────────────────────────────
    print("\n[10] Two sequential transfers reduce from_stock cumulatively")
    async with AsyncSessionLocal() as db:
        v5 = await make_variant(db, "Product Five", "V5-SKU")
        await set_stock(db, wh_a_id, v5.id, quantity=30)
        v5_id = v5.id
        await db.commit()

    # First transfer: 10 from WH_A to WH_B
    async with AsyncSessionLocal() as db:
        req = StockTransferRequest(
            from_warehouse_id=wh_a_id,
            to_warehouse_id=wh_b_id,
            variant_id=v5_id,
            quantity=10,
        )
        source, dest = await inv_svc.transfer_stock(req, db)
        qty_a_after_first = source.quantity
        await db.commit()

    check("[10] after first transfer: WH_A qty == 20", qty_a_after_first == 20, f"qty={qty_a_after_first}")

    # Second transfer: 8 more from WH_A to WH_B
    async with AsyncSessionLocal() as db:
        req = StockTransferRequest(
            from_warehouse_id=wh_a_id,
            to_warehouse_id=wh_b_id,
            variant_id=v5_id,
            quantity=8,
        )
        source, dest = await inv_svc.transfer_stock(req, db)
        qty_a_after_second = source.quantity
        qty_b_after_second = dest.quantity
        await db.commit()

    check("[10] after second transfer: WH_A qty == 12", qty_a_after_second == 12, f"qty={qty_a_after_second}")
    check("[10] after second transfer: WH_B qty == 18", qty_b_after_second == 18, f"qty={qty_b_after_second}")

    # ──────────────────────────────────────────────────────────
    # SUMMARY
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 54)
    passed = sum(1 for s, _, _ in results if s == PASS)
    failed = sum(1 for s, _, _ in results if s == FAIL)
    print(f"  {passed} passed   {failed} failed")
    print("=" * 54)

    await async_engine.dispose()
    if os.path.exists("test_inventory_transfer_run.db"):
        os.remove("test_inventory_transfer_run.db")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
