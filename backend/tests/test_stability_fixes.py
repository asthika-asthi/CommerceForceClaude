"""Regression tests for the VPS admin stability fixes.

- SQLite is opened in WAL mode with a busy timeout (prevents the concurrent-access hang).
- The admin category list can include empty categories (so imports are visible pre-products).
- The refresh cookie's Secure flag follows COOKIE_SECURE (so HTTP deployments can work).
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings

from tests.test_commerce import make_admin, CUSTOMER_DATA


async def test_sqlite_opened_in_wal_with_busy_timeout():
    """The app engine must apply WAL + busy_timeout on SQLite connections."""
    from app.core.database import async_engine, _IS_SQLITE
    if not _IS_SQLITE:
        pytest.skip("Not a SQLite deployment")
    async with async_engine.connect() as conn:
        journal_mode = (await conn.execute(text("PRAGMA journal_mode"))).scalar()
        busy_timeout = (await conn.execute(text("PRAGMA busy_timeout"))).scalar()
    await async_engine.dispose()
    assert str(journal_mode).lower() == "wal"
    assert int(busy_timeout) >= 30000


async def test_admin_category_list_includes_empty(client: AsyncClient, db):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post("/api/categories", json={"name": "Freshly Imported"}, headers=headers)
    assert r.status_code == 201

    # Storefront default hides categories with no products.
    default = await client.get("/api/categories")
    assert not any(c["name"] == "Freshly Imported" for c in default.json())

    # Admin include_empty shows it, so imports are visible before products exist.
    admin = await client.get("/api/categories?include_empty=true", headers=headers)
    assert any(c["name"] == "Freshly Imported" for c in admin.json())


def _refresh_cookie_header(response) -> str:
    for c in response.headers.get_list("set-cookie"):
        if c.startswith("refresh_token="):
            return c
    return ""


async def test_refresh_cookie_secure_when_enabled(client: AsyncClient, db, monkeypatch):
    monkeypatch.setattr(settings, "COOKIE_SECURE", True)
    r = await client.post("/api/auth/register", json={**CUSTOMER_DATA, "email": "sec@example.com"})
    cookie = _refresh_cookie_header(r)
    assert cookie and "Secure" in cookie


async def test_refresh_cookie_not_secure_when_disabled(client: AsyncClient, db):
    # Test env sets COOKIE_SECURE=false so the HTTP test client can send the cookie.
    r = await client.post("/api/auth/register", json={**CUSTOMER_DATA, "email": "insec@example.com"})
    cookie = _refresh_cookie_header(r)
    assert cookie and "Secure" not in cookie
