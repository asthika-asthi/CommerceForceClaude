"""
Find (and optionally fix) "ghost" default variants that were mistakenly given a
price adjustment. A default variant (is_default=True) with no linked option
values is a system row auto-created for bare product-level cart adds — it should
never carry a price_adjustment. If it does, every "quick add" for that product has
been silently charging that stray amount with no variant ever chosen.

Run from the backend/ directory:
    .venv\\Scripts\\python.exe find_orphan_priced_variants.py            (report only)
    .venv\\Scripts\\python.exe find_orphan_priced_variants.py --apply    (null the stray values)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text, bindparam
from app.core.database import sync_engine

FIND_SQL = """
    SELECT v.id, v.sku, v.price_adjustment, p.id AS product_id, p.name, p.sku AS product_sku
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    LEFT JOIN product_variant_options o ON o.variant_id = v.id
    WHERE v.is_default = TRUE
      AND v.price_adjustment IS NOT NULL
    GROUP BY v.id, v.sku, v.price_adjustment, p.id, p.name, p.sku
    HAVING COUNT(o.id) = 0
"""

apply = "--apply" in sys.argv

with sync_engine.connect() as conn:
    rows = conn.execute(text(FIND_SQL)).fetchall()

    if not rows:
        print("No orphan-priced default variants found.")
        sys.exit(0)

    print(f"Found {len(rows)} default variant(s) with a stray price adjustment:\n")
    for r in rows:
        print(f"  product '{r.name}' ({r.product_sku})  variant sku={r.sku}  "
              f"price_adjustment={r.price_adjustment}  variant_id={r.id}")

    if not apply:
        print("\nDry run - no changes made. Re-run with --apply to null these price adjustments.")
        sys.exit(0)

    confirm = input(f"\nNull price_adjustment on these {len(rows)} variant(s)? Type 'yes' to confirm: ")
    if confirm.strip().lower() != "yes":
        print("Aborted.")
        sys.exit(0)

    ids = [r.id for r in rows]
    update_stmt = text(
        "UPDATE product_variants SET price_adjustment = NULL WHERE id IN :ids"
    ).bindparams(bindparam("ids", expanding=True))
    conn.execute(update_stmt, {"ids": ids})
    conn.commit()
    print(f"Cleared price_adjustment on {len(rows)} variant(s).")
