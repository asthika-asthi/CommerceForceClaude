import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


# ── helpers ──────────────────────────────────────────────────────────────────

_ADMIN_EMAIL = "admin@commerceforce.dev"
_ADMIN_PASSWORD = "Admin1234!"


async def _admin_token(client: AsyncClient, db: AsyncSession) -> str:
    """Register admin user, promote to admin role, return access token."""
    await client.post(
        "/api/auth/register",
        json={
            "email": _ADMIN_EMAIL,
            "password": _ADMIN_PASSWORD,
            "first_name": "Admin",
            "last_name": "User",
        },
    )
    from sqlalchemy import update
    from app.plugins.auth.models import User, UserRole
    await db.execute(
        update(User).where(User.email == _ADMIN_EMAIL).values(role=UserRole.admin)
    )
    await db.flush()
    r = await client.post("/api/auth/login", json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD})
    return r.json()["access_token"]


async def _make_product(client: AsyncClient, token: str) -> dict:
    r = await client.post(
        "/api/products",
        json={"name": "Test Shirt", "price": "19.99", "stock_quantity": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── option type CRUD ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_option_type(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Size"
    assert data["values"] == []


@pytest.mark.asyncio
async def test_add_option_value(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]

    r = await client.post(
        f"/api/products/{product['id']}/options/{opt_id}/values",
        json={"label": "M", "sort_order": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    assert r.json()["label"] == "M"


# ── variant generation ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_variants_single_axis(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    for label in ["S", "M", "L"]:
        await client.post(
            f"/api/products/{product['id']}/options/{opt_id}/values",
            json={"label": label},
            headers={"Authorization": f"Bearer {token}"},
        )

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 3
    labels = {v["label"] for v in variants}
    assert labels == {"Size: S", "Size: M", "Size: L"}


@pytest.mark.asyncio
async def test_generate_variants_two_axes(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    for axis_name, values in [("Size", ["S", "M"]), ("Colour", ["Red", "Blue"])]:
        opt_r = await client.post(
            f"/api/products/{product['id']}/options",
            json={"name": axis_name},
            headers={"Authorization": f"Bearer {token}"},
        )
        opt_id = opt_r.json()["id"]
        for label in values:
            await client.post(
                f"/api/products/{product['id']}/options/{opt_id}/values",
                json={"label": label},
                headers={"Authorization": f"Bearer {token}"},
            )

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 4  # S/Red, S/Blue, M/Red, M/Blue


@pytest.mark.asyncio
async def test_default_variant_exists_on_new_product(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    r = await client.get(f"/api/products/{product['id']}/variants")
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 1
    assert variants[0]["is_default"] is True


@pytest.mark.asyncio
async def test_update_variant_sku(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    variants_r = await client.get(f"/api/products/{product['id']}/variants")
    variant_id = variants_r.json()[0]["id"]

    r = await client.patch(
        f"/api/products/{product['id']}/variants/{variant_id}",
        json={"sku": "MYSKU-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["sku"] == "MYSKU-001"


@pytest.mark.asyncio
async def test_delete_option_type_deactivates_variants(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    await client.post(
        f"/api/products/{product['id']}/options/{opt_id}/values",
        json={"label": "M"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    del_r = await client.delete(
        f"/api/products/{product['id']}/options/{opt_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_r.status_code == 204

    variants_r = await client.get(f"/api/products/{product['id']}/variants")
    active = [v for v in variants_r.json() if v["is_active"]]
    assert len(active) == 0


# ── product detail includes variants ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_product_detail_includes_variants(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    r = await client.get(f"/api/products/{product['id']}")
    assert r.status_code == 200
    data = r.json()
    assert "variants" in data
    assert len(data["variants"]) >= 1
    assert "option_types" in data
