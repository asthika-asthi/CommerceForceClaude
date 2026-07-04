"""Create the full database schema from the SQLAlchemy models (for a FRESH database).

Why this exists: the Alembic migration chain assumes the product-variant tables already
exist (they were originally added out-of-band via create_all, never in a migration), so
`alembic upgrade head` fails on an empty DB with "no such table: product_variants". The
models are the source of truth, so this builds the current schema directly from them.

Fresh-install flow (run inside the backend container):
    python init_db.py            # create every table from the models
    alembic stamp head           # mark Alembic as up-to-date (no migrations run)
    python seed.py               # superadmin/admin/branding (add --demo for sample data)

create_all is idempotent (existing tables are left untouched), but for a broken/partial
DB start from a clean database.
"""
import asyncio

import app.main  # noqa: F401 — importing the app registers every enabled plugin's models
from app.core.database import async_engine
from app.core.base_model import Base


async def main() -> None:
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Schema created from models.")


if __name__ == "__main__":
    asyncio.run(main())
