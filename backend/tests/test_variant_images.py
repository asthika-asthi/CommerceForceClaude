"""Tests for variant image assignment: POST image with variant_id, PATCH image to link/unlink."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

_ADMIN_EMAIL = "admin@commerceforce.dev"
_ADMIN_PASSWORD = "Admin1234!"


async def _admin_token(client: AsyncClient, db: AsyncSession) -> str:
    await client.post(
        "/api/auth/register",
        json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD, "first_name": "Admin", "last_name": "User"},
    )
    from sqlalchemy import update
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == _ADMIN_EMAIL).values(role=UserRole.admin))
    await db.flush()
    r = await client.post("/api/auth/login", json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD})
    return r.json()["access_token"]


async def _make_product_with_colour_variants(client: AsyncClient, token: str) -> tuple[dict, dict, dict]:
    """Create product → add Colour option (Red, Blue) → generate variants.
    Returns (product, red_variant, blue_variant).
    """
    r = await client.post(
        "/api/products",
        json={"name": "Colour Shirt", "price": "25.00", "stock_quantity": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    product = r.json()

    r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Colour", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    opt_id = r.json()["id"]

    for label in ("Red", "Blue"):
        r = await client.post(
            f"/api/products/{product['id']}/options/{opt_id}/values",
            json={"label": label, "sort_order": 0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    variants = r.json()
    red = next(v for v in variants if "Red" in v["label"])
    blue = next(v for v in variants if "Blue" in v["label"])
    return product, red, blue


# ── add image with variant_id ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_image_with_variant_id(client: AsyncClient, db: AsyncSession):
    """POST /products/{id}/images with variant_id → image stored with that variant_id."""
    token = await _admin_token(client, db)
    product, red, _ = await _make_product_with_colour_variants(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/red.jpg", "variant_id": red["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    img = r.json()
    assert img["variant_id"] == red["id"]
    assert img["url"] == "http://cdn/red.jpg"


@pytest.mark.asyncio
async def test_add_image_without_variant_id_defaults_null(client: AsyncClient, db: AsyncSession):
    """POST /products/{id}/images without variant_id → variant_id is null in response."""
    token = await _admin_token(client, db)
    product, _, _ = await _make_product_with_colour_variants(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/default.jpg"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["variant_id"] is None


# ── PATCH image to assign variant_id ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_image_assigns_variant(client: AsyncClient, db: AsyncSession):
    """PATCH /products/{id}/images/{image_id} with variant_id → link is saved."""
    token = await _admin_token(client, db)
    product, red, _ = await _make_product_with_colour_variants(client, token)

    # Add an untagged image
    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/red.jpg"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    image_id = r.json()["id"]
    assert r.json()["variant_id"] is None

    # Assign to the Red variant
    r = await client.patch(
        f"/api/products/{product['id']}/images/{image_id}",
        json={"variant_id": red["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["variant_id"] == red["id"]
    assert r.json()["id"] == image_id


@pytest.mark.asyncio
async def test_patch_image_clears_variant(client: AsyncClient, db: AsyncSession):
    """PATCH with variant_id=null removes the variant link."""
    token = await _admin_token(client, db)
    product, red, _ = await _make_product_with_colour_variants(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/red.jpg", "variant_id": red["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    image_id = r.json()["id"]

    # Clear the link
    r = await client.patch(
        f"/api/products/{product['id']}/images/{image_id}",
        json={"variant_id": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["variant_id"] is None


@pytest.mark.asyncio
async def test_patch_image_reassigns_to_different_variant(client: AsyncClient, db: AsyncSession):
    """PATCH can move an image from one variant to another."""
    token = await _admin_token(client, db)
    product, red, blue = await _make_product_with_colour_variants(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/img.jpg", "variant_id": red["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    image_id = r.json()["id"]

    r = await client.patch(
        f"/api/products/{product['id']}/images/{image_id}",
        json={"variant_id": blue["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["variant_id"] == blue["id"]


# ── error cases ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_image_not_found(client: AsyncClient, db: AsyncSession):
    """PATCH with a non-existent image_id returns 404."""
    token = await _admin_token(client, db)
    product, red, _ = await _make_product_with_colour_variants(client, token)

    r = await client.patch(
        f"/api/products/{product['id']}/images/nonexistent-image-id",
        json={"variant_id": red["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_patch_image_requires_admin(client: AsyncClient, db: AsyncSession):
    """PATCH without auth returns 401."""
    token = await _admin_token(client, db)
    product, red, _ = await _make_product_with_colour_variants(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/red.jpg"},
        headers={"Authorization": f"Bearer {token}"},
    )
    image_id = r.json()["id"]

    r = await client.patch(
        f"/api/products/{product['id']}/images/{image_id}",
        json={"variant_id": red["id"]},
    )
    assert r.status_code == 401


# ── product detail responses include variant_id ───────────────────────────────

@pytest.mark.asyncio
async def test_product_detail_images_include_variant_id(client: AsyncClient, db: AsyncSession):
    """GET /products/{id} returns images with variant_id field populated."""
    token = await _admin_token(client, db)
    product, red, _ = await _make_product_with_colour_variants(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/red.jpg", "variant_id": red["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201

    r = await client.get(f"/api/products/{product['id']}")
    assert r.status_code == 200
    images = r.json()["images"]
    tagged = [img for img in images if img.get("variant_id") == red["id"]]
    assert len(tagged) == 1
    assert tagged[0]["url"] == "http://cdn/red.jpg"


@pytest.mark.asyncio
async def test_product_by_slug_images_include_variant_id(client: AsyncClient, db: AsyncSession):
    """GET /products/by-slug/{slug} returns images with variant_id field."""
    token = await _admin_token(client, db)
    product, _, blue = await _make_product_with_colour_variants(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/images",
        json={"url": "http://cdn/blue.jpg", "variant_id": blue["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201

    r = await client.get(f"/api/products/by-slug/{product['slug']}")
    assert r.status_code == 200
    images = r.json()["images"]
    tagged = [img for img in images if img.get("variant_id") == blue["id"]]
    assert len(tagged) == 1
    assert tagged[0]["url"] == "http://cdn/blue.jpg"


@pytest.mark.asyncio
async def test_multiple_images_tagged_to_different_variants(client: AsyncClient, db: AsyncSession):
    """Each variant can have its own image; untagged images return variant_id=None."""
    token = await _admin_token(client, db)
    product, red, blue = await _make_product_with_colour_variants(client, token)

    # Add one image per variant and one untagged
    for url, vid in [
        ("http://cdn/red.jpg", red["id"]),
        ("http://cdn/blue.jpg", blue["id"]),
        ("http://cdn/all.jpg", None),
    ]:
        r = await client.post(
            f"/api/products/{product['id']}/images",
            json={"url": url, **({"variant_id": vid} if vid else {})},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201

    r = await client.get(f"/api/products/{product['id']}")
    images = r.json()["images"]

    by_url = {img["url"]: img for img in images}
    assert by_url["http://cdn/red.jpg"]["variant_id"] == red["id"]
    assert by_url["http://cdn/blue.jpg"]["variant_id"] == blue["id"]
    assert by_url["http://cdn/all.jpg"]["variant_id"] is None
