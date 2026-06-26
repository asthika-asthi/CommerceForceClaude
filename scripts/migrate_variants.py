#!/usr/bin/env python
"""
One-time migration: introduces the product variant schema and migrates
existing warehouse_stock and cart_items rows to reference variant_id.

Run once against the production database:
    python scripts/migrate_variants.py

Safe to run multiple times (idempotent).
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./backend/commerceforce.db")
os.environ.setdefault(
    "ENABLED_PLUGINS",
    "auth,categories,products,cart,orders,checkout,rfq,credit,inventory,coupons,"
    "loyalty,newsletter,branding,landing_page,ai_chat,contact,shipping",
)
os.environ.setdefault("SECRET_KEY", "migration-run")

from app.core.database import async_engine as engine
from app.core.base_model import Base

# Import ALL models so they register with Base.metadata before create_all runs
from app.plugins.products.models import Product, ProductImage, ProductOptionType, ProductOptionValue, ProductVariant, ProductVariantOption  # noqa
from app.plugins.cart.models import Cart, CartItem  # noqa
from app.plugins.inventory.models import Warehouse, WarehouseStock  # noqa
from app.plugins.orders.models import Order, OrderItem  # noqa


async def _add_column_if_missing(conn, table: str, column: str, col_def: str):
    from sqlalchemy import text
    result = await conn.execute(text(f"PRAGMA table_info({table})"))
    existing = {row[1] for row in result.fetchall()}
    if column not in existing:
        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
        print(f"[migrate] Added {table}.{column}")
    else:
        print(f"[migrate] {table}.{column} already exists — skipping")


async def _is_column_not_null(conn, table: str, column: str) -> bool:
    from sqlalchemy import text
    result = await conn.execute(text(f"PRAGMA table_info({table})"))
    for row in result.fetchall():
        if row[1] == column:
            return bool(row[3])  # notnull flag
    return False


async def _recreate_warehouse_stock(conn):
    """Recreate warehouse_stock to swap product_id for variant_id (SQLite can't ALTER NOT NULL)."""
    from sqlalchemy import text
    if not await _is_column_not_null(conn, "warehouse_stock", "product_id"):
        print("[migrate] warehouse_stock already has correct schema — skipping recreation")
        return

    print("[migrate] Recreating warehouse_stock with variant_id schema...")
    await conn.execute(text("PRAGMA foreign_keys = OFF"))
    await conn.execute(text("""
        CREATE TABLE warehouse_stock_new (
            warehouse_id VARCHAR(36) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
            variant_id VARCHAR(36) NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 0,
            reserved_quantity INTEGER NOT NULL DEFAULT 0,
            low_stock_threshold INTEGER NOT NULL DEFAULT 0,
            id VARCHAR(36) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT uq_warehouse_variant UNIQUE (warehouse_id, variant_id)
        )
    """))
    await conn.execute(text("""
        INSERT INTO warehouse_stock_new
            (warehouse_id, variant_id, quantity, reserved_quantity, low_stock_threshold, id, created_at, updated_at)
        SELECT warehouse_id, variant_id, quantity, reserved_quantity, low_stock_threshold, id, created_at, updated_at
        FROM warehouse_stock
        WHERE variant_id IS NOT NULL
    """))
    await conn.execute(text("DROP TABLE warehouse_stock"))
    await conn.execute(text("ALTER TABLE warehouse_stock_new RENAME TO warehouse_stock"))
    await conn.execute(text("PRAGMA foreign_keys = ON"))
    print("[migrate] warehouse_stock recreated with variant_id schema")


async def _recreate_cart_items(conn):
    """Recreate cart_items to swap product_id for variant_id (SQLite can't ALTER NOT NULL)."""
    from sqlalchemy import text
    if not await _is_column_not_null(conn, "cart_items", "product_id"):
        print("[migrate] cart_items already has correct schema — skipping recreation")
        return

    print("[migrate] Recreating cart_items with variant_id schema...")
    await conn.execute(text("PRAGMA foreign_keys = OFF"))
    await conn.execute(text("""
        CREATE TABLE cart_items_new (
            cart_id VARCHAR(36) NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
            variant_id VARCHAR(36) NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1,
            id VARCHAR(36) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT uq_cart_variant UNIQUE (cart_id, variant_id)
        )
    """))
    await conn.execute(text("""
        INSERT INTO cart_items_new
            (cart_id, variant_id, quantity, id, created_at, updated_at)
        SELECT cart_id, variant_id, quantity, id, created_at, updated_at
        FROM cart_items
        WHERE variant_id IS NOT NULL
    """))
    await conn.execute(text("DROP TABLE cart_items"))
    await conn.execute(text("ALTER TABLE cart_items_new RENAME TO cart_items"))
    await conn.execute(text("PRAGMA foreign_keys = ON"))
    print("[migrate] cart_items recreated with variant_id schema")


async def run():
    from sqlalchemy import select, text

    # 1. Create all new tables (idempotent with checkfirst=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("[migrate] New tables created (if not already present)")

    # 2. Add new columns to existing tables (idempotent via PRAGMA check)
    async with engine.begin() as conn:
        await _add_column_if_missing(conn, "warehouse_stock", "variant_id",
                                     "VARCHAR(36) REFERENCES product_variants(id)")
        await _add_column_if_missing(conn, "cart_items", "variant_id",
                                     "VARCHAR(36) REFERENCES product_variants(id)")
        await _add_column_if_missing(conn, "order_items", "variant_id",
                                     "VARCHAR(36) REFERENCES product_variants(id)")
        await _add_column_if_missing(conn, "order_items", "variant_label",
                                     "VARCHAR(500)")
    print("[migrate] Column additions complete")

    # 3. Create default variants for all products without one (idempotent)
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker

    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        async with db.begin():
            products_result = await db.execute(select(Product))
            products = list(products_result.scalars().all())

            migrated_products = 0
            for product in products:
                existing = await db.execute(
                    select(ProductVariant).where(ProductVariant.product_id == product.id)
                )
                if existing.scalars().first():
                    continue  # already has a variant — skip
                variant = ProductVariant(
                    product_id=product.id,
                    sku=product.sku,
                    is_default=True,
                    is_active=True,
                )
                db.add(variant)
                await db.flush()

                await db.execute(
                    text("UPDATE warehouse_stock SET variant_id = :vid WHERE product_id = :pid"),
                    {"vid": variant.id, "pid": product.id},
                )
                await db.execute(
                    text("UPDATE cart_items SET variant_id = :vid WHERE product_id = :pid"),
                    {"vid": variant.id, "pid": product.id},
                )
                migrated_products += 1

    print(f"[migrate] Created default variants for {migrated_products} products")

    # 4. Recreate warehouse_stock and cart_items with correct schema (drops old product_id NOT NULL)
    async with engine.begin() as conn:
        await _recreate_warehouse_stock(conn)
        await _recreate_cart_items(conn)

    print("[migrate] Done. Verify with: SELECT COUNT(*) FROM product_variants;")


if __name__ == "__main__":
    asyncio.run(run())
