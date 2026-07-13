"""
One-off reconciliation for the per-variant-stock feature: find products that have
real (option-linked) variants where Product.stock_quantity has drifted from the sum
of those variants' stock_quantity, and recompute it.

This is expected to matter exactly once, for products that already had real variants
generated *before* the stock_quantity column existed (their product-level number is
a stale leftover, not something to guess a replacement for — every affected variant's
stock_quantity is legitimately 0 until an admin sets it, so reconciling here makes the
product-level total honestly reflect that instead of showing a phantom availability).
Every code path added by this feature (update_variant, generate_variants, etc.) keeps
the two in sync going forward, so this script should never need to report anything on
a second run.

Run from the backend/ directory:
    .venv\\Scripts\\python.exe reconcile_variant_stock.py            (report only)
    .venv\\Scripts\\python.exe reconcile_variant_stock.py --apply    (recompute the drifted totals)
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.plugins.products.models import Product, ProductVariant
from app.plugins.products import variant_service as vs

apply = "--apply" in sys.argv


async def main() -> None:
    async with AsyncSessionLocal() as db:
        products = (await db.execute(select(Product))).scalars().all()

        drifted: list[tuple[Product, int, int]] = []
        for product in products:
            variants = (await db.execute(
                select(ProductVariant).where(ProductVariant.product_id == product.id)
            )).scalars().all()
            real_variants = [v for v in variants if v.option_links]
            if not real_variants:
                continue
            correct_total = sum(v.stock_quantity for v in real_variants if v.is_active)
            if correct_total != product.stock_quantity:
                drifted.append((product, product.stock_quantity, correct_total))

        if not drifted:
            print("No drifted products found — every product's stock_quantity already matches its variants.")
            return

        print(f"Found {len(drifted)} product(s) where stock_quantity has drifted from its variants:\n")
        for product, current, correct in drifted:
            print(f"  '{product.name}' ({product.sku})  current={current}  should be={correct}  product_id={product.id}")

        if not apply:
            print("\nDry run - no changes made. Re-run with --apply to recompute these totals.")
            return

        confirm = input(f"\nRecompute stock_quantity for these {len(drifted)} product(s)? Type 'yes' to confirm: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

        for product, _current, _correct in drifted:
            await vs.recalc_product_stock(product.id, db)
        await db.commit()
        print(f"Recomputed stock_quantity for {len(drifted)} product(s).")


if __name__ == "__main__":
    asyncio.run(main())
