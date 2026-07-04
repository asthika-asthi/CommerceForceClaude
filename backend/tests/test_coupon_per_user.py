"""B6 — a coupon is one redemption per customer.

`validate_coupon` must reject a coupon the authenticated user has already used. Guests
(no identity) are still allowed, capped only by the global `max_uses`.
"""
from httpx import AsyncClient

from tests.test_commerce import (
    make_admin,
    register_and_token,
    _create_product_and_variant,
    CUSTOMER_DATA,
)


async def _make_coupon(client, admin_token, code):
    await client.post(
        "/api/coupons",
        json={"code": code, "name": code, "discount_type": "percentage", "discount_value": "10", "is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )


async def _checkout_with_coupon(client, cust_token, variant_id, code):
    cust_h = {"Authorization": f"Bearer {cust_token}"}
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1}, headers=cust_h)
    return await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "coupon_code": code, "shipping_address": "1 Test St"},
        headers=cust_h,
    )


async def test_coupon_rejected_for_same_customer_second_time(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    _, variant_id = await _create_product_and_variant(client, admin_token, stock=10)
    _, variant2_id = await _create_product_and_variant(client, admin_token, name="Second", stock=10)
    await _make_coupon(client, admin_token, "ONCE")

    first = await _checkout_with_coupon(client, cust_token, variant_id, "ONCE")
    assert first.status_code == 201, first.text

    second = await _checkout_with_coupon(client, cust_token, variant2_id, "ONCE")
    assert second.status_code == 400, "same customer must not reuse the coupon"


async def test_coupon_validate_endpoint_reflects_prior_use(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    _, variant_id = await _create_product_and_variant(client, admin_token, stock=10)
    await _make_coupon(client, admin_token, "PREVIEW")

    assert (await _checkout_with_coupon(client, cust_token, variant_id, "PREVIEW")).status_code == 201

    r = await client.get(
        "/api/coupons/validate",
        params={"code": "PREVIEW", "subtotal": "50"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False


async def test_guest_can_use_coupon(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id, variant_id = await _create_product_and_variant(client, admin_token, stock=10)
    await _make_coupon(client, admin_token, "GUESTOK")

    # Guest explicit-items checkout with the coupon (no auth) — allowed.
    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "coupon_code": "GUESTOK",
        "guest_email": "guest@example.com",
        "shipping_address": "1 Test St",
    })
    assert r.status_code == 201, r.text
