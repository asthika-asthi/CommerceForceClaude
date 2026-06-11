"""Phase 4 — Marketing integration tests: Coupons, Loyalty, Newsletter."""
import pytest
from httpx import AsyncClient

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

ADMIN_DATA = {"email": "mkt_admin@example.com", "password": "adminpass1", "first_name": "Admin", "last_name": "Mkt"}
CUSTOMER_DATA = {"email": "mkt_cust@example.com", "password": "custpass1", "first_name": "Cust", "last_name": "Mkt"}


async def register_and_token(client: AsyncClient, data: dict) -> str:
    r = await client.post(REGISTER_URL, json=data)
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def make_admin(client: AsyncClient, db) -> str:
    token = await register_and_token(client, ADMIN_DATA)
    from sqlalchemy import update
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == ADMIN_DATA["email"]).values(role=UserRole.admin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": ADMIN_DATA["email"], "password": ADMIN_DATA["password"]})
    return r.json()["access_token"]


async def _create_product(client, admin_token, name="Test Product", price="50.00", stock=100) -> str:
    r = await client.post(
        "/api/products",
        json={"name": name, "price": price, "stock_quantity": stock},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _add_to_cart(client, cust_token, product_id, quantity=1):
    r = await client.post(
        "/api/cart/items",
        json={"product_id": product_id, "quantity": quantity},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code in (200, 201), r.text


# ── COUPONS ───────────────────────────────────────────────────────────────────

async def test_admin_create_percentage_coupon(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/coupons",
        json={"code": "SAVE10", "name": "10% Off", "discount_type": "percentage", "discount_value": "10.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "SAVE10"
    assert body["discount_type"] == "percentage"
    assert float(body["discount_value"]) == 10.0
    assert body["is_active"] is True
    assert body["used_count"] == 0


async def test_admin_create_fixed_coupon(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/coupons",
        json={"code": "FLAT5", "name": "$5 Off", "discount_type": "fixed", "discount_value": "5.00",
              "min_order_value": "20.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "FLAT5"
    assert float(body["min_order_value"]) == 20.0


async def test_admin_list_coupons(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post(
        "/api/coupons",
        json={"code": "LIST1", "name": "List coupon", "discount_type": "fixed", "discount_value": "1.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.get("/api/coupons", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_admin_update_coupon(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/coupons",
        json={"code": "UPDT", "name": "Old Name", "discount_type": "fixed", "discount_value": "3.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    coupon_id = r.json()["id"]
    r2 = await client.put(
        f"/api/coupons/{coupon_id}",
        json={"name": "New Name", "is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    assert r2.json()["name"] == "New Name"
    assert r2.json()["is_active"] is False


async def test_duplicate_coupon_code_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    payload = {"code": "DUP", "name": "Dup", "discount_type": "fixed", "discount_value": "1.00"}
    await client.post("/api/coupons", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    r = await client.post("/api/coupons", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 409


async def test_non_admin_cannot_create_coupon(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/coupons",
        json={"code": "HACK", "name": "Hack", "discount_type": "fixed", "discount_value": "100.00"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_validate_coupon_endpoint_valid(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post(
        "/api/coupons",
        json={"code": "VAL20", "name": "20% Off", "discount_type": "percentage", "discount_value": "20.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.get("/api/coupons/validate?code=VAL20&subtotal=100.00")
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert float(body["discount_value"]) == 20.0


async def test_validate_coupon_endpoint_invalid(client: AsyncClient, db):
    await make_admin(client, db)
    r = await client.get("/api/coupons/validate?code=GHOST&subtotal=100.00")
    assert r.status_code == 200
    assert r.json()["valid"] is False


async def test_checkout_with_percentage_coupon(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    await client.post(
        "/api/coupons",
        json={"code": "PCT10", "name": "10% Off", "discount_type": "percentage", "discount_value": "10.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="100.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "coupon_code": "PCT10"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert float(body["subtotal"]) == 100.0
    assert float(body["discount_amount"]) == 10.0
    assert float(body["total"]) == 90.0


async def test_checkout_with_fixed_coupon(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    await client.post(
        "/api/coupons",
        json={"code": "FIX15", "name": "$15 Off", "discount_type": "fixed", "discount_value": "15.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="80.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "coupon_code": "FIX15"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert float(body["discount_amount"]) == 15.0
    assert float(body["total"]) == 65.0


async def test_checkout_coupon_min_order_not_met(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    await client.post(
        "/api/coupons",
        json={"code": "MINORD", "name": "Min order", "discount_type": "fixed", "discount_value": "5.00",
              "min_order_value": "200.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="10.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "coupon_code": "MINORD"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 400


async def test_checkout_coupon_max_uses_reached(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    await client.post(
        "/api/coupons",
        json={"code": "ONCE", "name": "One use", "discount_type": "fixed", "discount_value": "1.00", "max_uses": 1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="20.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    # First use succeeds
    r1 = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "coupon_code": "ONCE"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r1.status_code == 201

    # Second use fails
    await _add_to_cart(client, cust_token, product_id, quantity=1)
    r2 = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "coupon_code": "ONCE"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r2.status_code == 400


async def test_checkout_expired_coupon_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    await client.post(
        "/api/coupons",
        json={"code": "EXP", "name": "Expired", "discount_type": "fixed", "discount_value": "5.00",
              "expires_at": "2020-01-01T00:00:00Z"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="20.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "coupon_code": "EXP"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 400


# ── LOYALTY ───────────────────────────────────────────────────────────────────

async def test_loyalty_config_default(client: AsyncClient, db):
    r = await client.get("/api/loyalty/config")
    assert r.status_code == 200
    body = r.json()
    assert float(body["points_per_dollar"]) == 1.0
    assert float(body["redemption_rate"]) == 0.01
    assert body["min_redemption"] == 100
    assert body["is_active"] is True


async def test_admin_update_loyalty_config(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/loyalty/config",
        json={"points_per_dollar": "2.0", "redemption_rate": "0.02", "min_redemption": 50},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert float(body["points_per_dollar"]) == 2.0
    assert float(body["redemption_rate"]) == 0.02
    assert body["min_redemption"] == 50


async def test_non_admin_cannot_update_loyalty_config(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.put(
        "/api/loyalty/config",
        json={"points_per_dollar": "100.0"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_loyalty_account_created_on_first_access(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.get("/api/loyalty/me", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["points_balance"] == 0
    assert body["total_earned"] == 0


async def test_loyalty_points_earned_after_checkout(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    product_id = await _create_product(client, admin_token, price="100.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 201

    # Default config: 1 point per dollar → 100 points for $100 order
    r2 = await client.get("/api/loyalty/me", headers={"Authorization": f"Bearer {cust_token}"})
    body = r2.json()
    assert body["points_balance"] == 100
    assert body["total_earned"] == 100


async def test_loyalty_transactions_list(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    product_id = await _create_product(client, admin_token, price="50.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)
    await client.post(
        "/api/checkout",
        json={"payment_method": "cash"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )

    r = await client.get("/api/loyalty/me/transactions", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    txns = r.json()
    assert len(txns) >= 1
    assert txns[0]["transaction_type"] == "earn"
    assert txns[0]["points"] > 0


async def test_checkout_with_loyalty_redemption(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    # Give the customer 1000 points via admin adjust
    await client.post(
        "/api/loyalty/adjust",
        json={"user_id": cust_id, "points": 1000, "description": "Welcome bonus"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    product_id = await _create_product(client, admin_token, price="50.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    # 1000 points * 0.01 redemption_rate = $10 discount
    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "redeem_points": 1000},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert float(body["subtotal"]) == 50.0
    assert float(body["discount_amount"]) == 10.0
    assert float(body["total"]) == 40.0


async def test_loyalty_points_deducted_after_redemption(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    await client.post(
        "/api/loyalty/adjust",
        json={"user_id": cust_id, "points": 500, "description": "Test grant"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    product_id = await _create_product(client, admin_token, price="30.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)
    await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "redeem_points": 200},
        headers={"Authorization": f"Bearer {cust_token}"},
    )

    r = await client.get("/api/loyalty/me", headers={"Authorization": f"Bearer {cust_token}"})
    body = r.json()
    # 500 - 200 redeemed + points earned from the $28 order (30 - 2 discount = 28 total → 28 points)
    expected_balance = 500 - 200 + 28
    assert body["points_balance"] == expected_balance
    assert body["total_redeemed"] == 200


async def test_loyalty_redeem_insufficient_points(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    product_id = await _create_product(client, admin_token, price="50.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    # Customer has 0 points, try to redeem 500
    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "redeem_points": 500},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 400


async def test_loyalty_redeem_below_minimum(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    await client.post(
        "/api/loyalty/adjust",
        json={"user_id": cust_id, "points": 50, "description": "Small grant"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    product_id = await _create_product(client, admin_token, price="50.00", stock=10)
    await _add_to_cart(client, cust_token, product_id, quantity=1)

    # Min redemption is 100 by default; try 50
    r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "redeem_points": 50},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 400


async def test_admin_manual_adjust_add_points(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    r = await client.post(
        "/api/loyalty/adjust",
        json={"user_id": cust_id, "points": 250, "description": "Loyalty bonus"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["points_balance"] == 250
    assert body["total_earned"] == 250


async def test_admin_manual_adjust_negative_balance_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    r = await client.post(
        "/api/loyalty/adjust",
        json={"user_id": cust_id, "points": -100, "description": "Deduct"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 409


# ── NEWSLETTER ────────────────────────────────────────────────────────────────

async def test_newsletter_subscribe(client: AsyncClient, db):
    r = await client.post(
        "/api/newsletter/subscribe",
        json={"email": "user@example.com", "first_name": "Alice"},
    )
    assert r.status_code == 201
    body = r.json()
    assert "unsubscribe_token" in body
    assert body["message"] == "Successfully subscribed to the newsletter"


async def test_newsletter_duplicate_active_rejected(client: AsyncClient, db):
    await client.post("/api/newsletter/subscribe", json={"email": "dup@example.com"})
    r = await client.post("/api/newsletter/subscribe", json={"email": "dup@example.com"})
    assert r.status_code == 409


async def test_newsletter_resubscribe_after_unsubscribe(client: AsyncClient, db):
    r1 = await client.post(
        "/api/newsletter/subscribe",
        json={"email": "resub@example.com"},
    )
    token = r1.json()["unsubscribe_token"]

    await client.post("/api/newsletter/unsubscribe", json={"token": token})

    # Re-subscribe should succeed
    r2 = await client.post(
        "/api/newsletter/subscribe",
        json={"email": "resub@example.com"},
    )
    assert r2.status_code == 201


async def test_newsletter_unsubscribe(client: AsyncClient, db):
    r = await client.post(
        "/api/newsletter/subscribe",
        json={"email": "unsub@example.com"},
    )
    token = r.json()["unsubscribe_token"]

    r2 = await client.post("/api/newsletter/unsubscribe", json={"token": token})
    assert r2.status_code == 200
    assert r2.json()["message"] == "Successfully unsubscribed"


async def test_newsletter_invalid_unsubscribe_token(client: AsyncClient, db):
    r = await client.post("/api/newsletter/unsubscribe", json={"token": "bad-token-xyz"})
    assert r.status_code == 404


async def test_newsletter_admin_list_active(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post("/api/newsletter/subscribe", json={"email": "active1@example.com"})
    r_unsub = await client.post("/api/newsletter/subscribe", json={"email": "inactive1@example.com"})
    token = r_unsub.json()["unsubscribe_token"]
    await client.post("/api/newsletter/unsubscribe", json={"token": token})

    r = await client.get(
        "/api/newsletter/subscribers",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    emails = [s["email"] for s in r.json()]
    assert "active1@example.com" in emails
    assert "inactive1@example.com" not in emails


async def test_newsletter_admin_list_all(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post("/api/newsletter/subscribe", json={"email": "allact@example.com"})
    r_unsub = await client.post("/api/newsletter/subscribe", json={"email": "allinact@example.com"})
    token = r_unsub.json()["unsubscribe_token"]
    await client.post("/api/newsletter/unsubscribe", json={"token": token})

    r = await client.get(
        "/api/newsletter/subscribers?active_only=false",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    emails = [s["email"] for s in r.json()]
    assert "allact@example.com" in emails
    assert "allinact@example.com" in emails


async def test_newsletter_stats(client: AsyncClient, db):
    await client.post("/api/newsletter/subscribe", json={"email": "stats1@example.com"})
    await client.post("/api/newsletter/subscribe", json={"email": "stats2@example.com"})
    r = await client.get("/api/newsletter/stats")
    assert r.status_code == 200
    assert r.json()["active_subscribers"] >= 2


async def test_newsletter_non_admin_cannot_list(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.get(
        "/api/newsletter/subscribers",
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403
