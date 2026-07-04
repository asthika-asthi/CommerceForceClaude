"""
Delete all products (and their images) from the database.
Run from the backend/ directory:
    .venv\Scripts\python.exe delete_products.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.core.database import sync_engine

with sync_engine.connect() as conn:
    result = conn.execute(text("SELECT COUNT(*) FROM products"))
    count = result.scalar()
    print(f"Found {count} product(s).")

    if count == 0:
        print("Nothing to delete.")
        sys.exit(0)

    confirm = input(f"Delete all {count} products and their images? Type 'yes' to confirm: ")
    if confirm.strip().lower() != "yes":
        print("Aborted.")
        sys.exit(0)

    # product_images has ON DELETE CASCADE so deleting products removes images automatically
    conn.execute(text("DELETE FROM products"))
    conn.commit()
    print(f"Deleted {count} product(s) and all associated images.")
