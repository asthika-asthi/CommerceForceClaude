"""B8 + B9 — order lifecycle correctness.

- B8: cancelling an order must reverse coupon usage (decrement used_count + drop the
  CouponUsage row), like it already reverses stock/credit/loyalty.
- B9: update_status must reject illegal transitions — a cancelled (or delivered) order
  is terminal and cannot be moved to shipped/confirmed/etc.
"""
from httpx import AsyncClient
from sqlalchemy import select

from app.plugins.coupons.models import Coupon, CouponUsage

from tests.test_commerce import (
    make_admin,
    register_and_token,
    _create_product_and_variant,
    CUSTOMER_DATA,
)


async def _place_order_with_coupon(client, admin_token, cust_token, coupon_code="REV10"):
    product_id, variant_id = await _create_product_and_variant(client, admin_token, stock=10)
    await client.post(
        "/api/coupons",
        json={"code": coupon_code, "name": coupon_code, "discount_type": "percentage",
              "discount_value": "10", "is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    cust_h = {"Authorization": f"Bearer {cust_token}"}
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1}, headers=cust_h)
    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "coupon_code": coupon_code, "shipping_address": "1 Test St"},
        headers=cust_h,
    )
    return r.json()["order_id"]


async def _place_simple_order(client, admin_token, cust_token):
    product_id, variant_id = await _create_product_and_variant(client, admin_token, stock=10)
    cust_h = {"Authorization": f"Bearer {cust_token}"}
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1}, headers=cust_h)
    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "shipping_address": "1 Test St"},
        headers=cust_h,
    )
    return r.json()["order_id"]


# ── B8 — coupon usage reversed on cancel ────────────────────────────────────────

async def test_customer_cancel_reverses_coupon_usage(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    order_id = await _place_order_with_coupon(client, admin_token, cust_token)

    coupon = (await db.execute(select(Coupon).where(Coupon.code == "REV10"))).scalar_one()
    assert coupon.used_count == 1  # consumed at checkout

    r = await client.post(f"/api/orders/{order_id}/cancel", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200

    db.expire_all()
    coupon = (await db.execute(select(Coupon).where(Coupon.code == "REV10"))).scalar_one()
    assert coupon.used_count == 0, "coupon usage must be reversed on cancel"
    usages = (await db.execute(select(CouponUsage).where(CouponUsage.order_id == order_id))).scalars().all()
    assert list(usages) == [], "CouponUsage row must be removed on cancel"


async def test_admin_cancel_via_status_reverses_coupon_usage(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    order_id = await _place_order_with_coupon(client, admin_token, cust_token, coupon_code="ADM10")

    coupon = (await db.execute(select(Coupon).where(Coupon.code == "ADM10"))).scalar_one()
    assert coupon.used_count == 1

    r = await client.put(
        f"/api/orders/{order_id}/status",
        json={"status": "cancelled"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200

    db.expire_all()
    coupon = (await db.execute(select(Coupon).where(Coupon.code == "ADM10"))).scalar_one()
    assert coupon.used_count == 0


# ── B9 — illegal status transitions rejected ────────────────────────────────────

async def test_cannot_transition_out_of_cancelled(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    order_id = await _place_simple_order(client, admin_token, cust_token)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    assert (await client.put(f"/api/orders/{order_id}/status", json={"status": "cancelled"}, headers=admin_h)).status_code == 200
    # cancelled is terminal — cannot be shipped/confirmed afterwards
    r = await client.put(f"/api/orders/{order_id}/status", json={"status": "shipped"}, headers=admin_h)
    assert r.status_code == 409
    r = await client.put(f"/api/orders/{order_id}/status", json={"status": "confirmed"}, headers=admin_h)
    assert r.status_code == 409


async def test_valid_forward_transition_allowed(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    order_id = await _place_simple_order(client, admin_token, cust_token)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    r = await client.put(f"/api/orders/{order_id}/status", json={"status": "confirmed"}, headers=admin_h)
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"
