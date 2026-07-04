"""Regression tests for the storefront/admin fixes (bugs-log F8, F9, F15 + branding).

Covers the new backend code paths that previously had no coverage:
- F8: add-to-cart by product_id resolves the product's default variant
- F15: ProductListOut now exposes `description`
- Branding: social_links accepts empty/JSON/invalid strings (was 422 on every save)
- F9 dependencies: coupon-validate discount amount + loyalty-config redemption rate
"""
from httpx import AsyncClient

from tests.test_commerce import (
    make_admin,
    register_and_token,
    _create_product,
    _get_default_variant_id,
    CUSTOMER_DATA,
)


# ── F8 — add to cart from a listing (product_id → default variant) ──────────────

async def test_add_to_cart_by_product_id_resolves_default_variant(client: AsyncClient, db):
    """Quick-add from a listing sends product_id only; the cart must resolve the
    product's default variant (the F8 bug added nothing and 404'd)."""
    admin_token = await make_admin(client, db)
    product_id = await _create_product(client, admin_token, name="Listing Widget", stock=10)
    default_variant_id = await _get_default_variant_id(client, product_id, admin_token)

    r = await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 2})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["item_count"] == 2
    # The resolved line must point at the product's default variant.
    assert len(body["items"]) == 1
    assert body["items"][0]["variant_id"] == default_variant_id


async def test_add_to_cart_by_product_id_authenticated(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token, name="Auth Listing Widget", stock=5)

    r = await client.post(
        "/api/cart/items",
        json={"product_id": product_id, "quantity": 1},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["item_count"] == 1


async def test_add_to_cart_requires_variant_or_product_id(client: AsyncClient, db):
    """Sending neither id must be rejected, not silently accepted."""
    await make_admin(client, db)
    r = await client.post("/api/cart/items", json={"quantity": 1})
    assert r.status_code == 422


async def test_add_to_cart_variant_id_still_works(client: AsyncClient, db):
    """The detail-page path (explicit variant_id) must remain unchanged."""
    admin_token = await make_admin(client, db)
    product_id = await _create_product(client, admin_token, name="Variant Path Widget", stock=8)
    variant_id = await _get_default_variant_id(client, product_id, admin_token)

    r = await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 3})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["item_count"] == 3
    assert body["items"][0]["variant_id"] == variant_id


# ── F15 — product list response includes description ────────────────────────────

async def test_product_list_includes_description(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post(
        "/api/products",
        json={"name": "Described Widget", "price": "12.00", "stock_quantity": 3,
              "description": "A very useful widget for testing."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.get("/api/products")
    assert r.status_code == 200
    item = next(p for p in r.json()["items"] if p["name"] == "Described Widget")
    assert item["description"] == "A very useful widget for testing."


# ── Branding — social_links string handling (was 422 on every save) ─────────────

async def test_branding_social_links_empty_string(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {admin_token}"}

    r = await client.put("/api/branding", json={"store_name": "Shop A", "social_links": ""}, headers=headers)
    assert r.status_code == 200, r.text

    g = await client.get("/api/branding")
    assert g.json()["store_name"] == "Shop A"
    assert g.json()["social_links"] is None


async def test_branding_social_links_valid_json_string(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {admin_token}"}

    r = await client.put(
        "/api/branding",
        json={"social_links": '{"twitter": "https://twitter.com/x"}'},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    g = await client.get("/api/branding")
    assert g.json()["social_links"] == {"twitter": "https://twitter.com/x"}


async def test_branding_social_links_invalid_string_is_ignored(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {admin_token}"}

    r = await client.put("/api/branding", json={"social_links": "not json at all"}, headers=headers)
    assert r.status_code == 200, r.text

    g = await client.get("/api/branding")
    assert g.json()["social_links"] is None


# ── F9 dependencies — coupon validate amount + loyalty config rate ──────────────

async def test_coupon_validate_returns_discount_amount(client: AsyncClient, db):
    """The checkout summary reads discount_value from this endpoint."""
    admin_token = await make_admin(client, db)
    await client.post(
        "/api/coupons",
        json={"code": "SAVE10", "name": "Save 10", "discount_type": "percentage",
              "discount_value": "10", "is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    r = await client.get("/api/coupons/validate", params={"code": "SAVE10", "subtotal": "100"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["valid"] is True
    assert float(body["discount_value"]) == 10.0


async def test_coupon_validate_invalid_code(client: AsyncClient, db):
    await make_admin(client, db)
    r = await client.get("/api/coupons/validate", params={"code": "NOPE", "subtotal": "50"})
    assert r.status_code == 200
    assert r.json()["valid"] is False


async def test_loyalty_config_exposes_redemption_rate(client: AsyncClient, db):
    """The checkout summary computes the loyalty discount from redemption_rate."""
    r = await client.get("/api/loyalty/config")
    assert r.status_code == 200
    body = r.json()
    assert "redemption_rate" in body
    assert "min_redemption" in body
    assert "is_active" in body
