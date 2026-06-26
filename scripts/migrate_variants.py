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

from app.core.database import engine
from app.core.base_model import Base


async def run():
    # 1. Create all new tables (idempotent with checkfirst=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("[migrate] New tables created (if not already present)")

    # 2. Work through all products and create default variants where missing
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select, text
    from app.plugins.products.models import Product, ProductVariant

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
                if existing.scalar_one_or_none():
                    continue  # already has a variant — skip
                variant = ProductVariant(
                    product_id=product.id,
                    sku=product.sku,
                    is_default=True,
                    is_active=True,
                )
                db.add(variant)
                await db.flush()

                # Update warehouse_stock rows that reference this product
                # These raw SQL updates work because the new columns were added via create_all above
                await db.execute(
                    text("UPDATE warehouse_stock SET variant_id = :vid WHERE product_id = :pid"),
                    {"vid": variant.id, "pid": product.id},
                )
                # Update cart_items similarly
                await db.execute(
                    text("UPDATE cart_items SET variant_id = :vid WHERE product_id = :pid"),
                    {"vid": variant.id, "pid": product.id},
                )
                migrated_products += 1

        print(f"[migrate] Created default variants for {migrated_products} products")
        print("[migrate] Done. Verify with: SELECT COUNT(*) FROM product_variants;")


if __name__ == "__main__":
    asyncio.run(run())
