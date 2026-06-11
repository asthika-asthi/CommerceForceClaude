"""
End-to-end journey tests — full user lifecycle flows.

Each test is a single narrative that exercises multiple plugins in sequence,
mimicking how a real user would interact with the platform.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.plugins.auth.models import User, UserRole

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _make_admin(client: AsyncClient, db, email="e2e_admin@example.com", password="Admin1234!") -> str:
    """Register a user, promote to admin in DB, return a fresh admin token."""
    r = await client.post(REGISTER_URL, json={
        "email": email, "password": password,
        "first_name": "E2E", "last_name": "Admin",
    })
    assert r.status_code == 201, r.text
    await db.execute(update(User).where(User.email == email).values(role=UserRole.admin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _register_customer(client: AsyncClient, email="e2e_customer@example.com", password="Cust1234!") -> str:
    r = await client.post(REGISTER_URL, json={
        "email": email, "password": password,
        "first_name": "Jane", "last_name": "Customer",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def _create_product(client, admin_token, name="Journey Widget", price="50.00", stock=20) -> dict:
    r = await client.post("/api/products", json={
        "name": name, "price": price, "stock_quantity": stock,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 201, r.text
    return r.json()


async def _add_to_cart(client, token, product_id, quantity=1):
    r = await client.post("/api/cart/items", json={
        "product_id": product_id, "quantity": quantity,
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code in (200, 201), r.text
    return r.json()


# ---------------------------------------------------------------------------
# Journey 1: Full B2C customer lifecycle
# ---------------------------------------------------------------------------

async def test_b2c_full_journey(client: AsyncClient, db):
    """
    Register → browse → cart (2 products) → apply coupon
    → checkout → admin confirms → admin ships → customer cancels
    """

    # — Admin setup —
    admin_token = await _make_admin(client, db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    product_a = await _create_product(client, admin_token, name="Wireless Headphones", price="79.99", stock=10)
    product_b = await _create_product(client, admin_token, name="USB-C Hub", price="34.99", stock=15)

    coupon_r = await client.post("/api/coupons", json={
        "code": "WELCOME20",
        "name": "Welcome 20% off",
        "discount_type": "percentage",
        "discount_value": "20.00",
    }, headers=admin_h)
    assert coupon_r.status_code == 201, coupon_r.text

    # — Customer registration —
    cust_token = await _register_customer(client)
    cust_h = {"Authorization": f"Bearer {cust_token}"}

    # — Browse: categories and products —
    cats_r = await client.get("/api/categories")
    assert cats_r.status_code == 200

    products_r = await client.get("/api/products")
    assert products_r.status_code == 200
    assert products_r.json()["total"] >= 2

    # — Browse: search —
    search_r = await client.get("/api/products?search=Headphones")
    assert search_r.status_code == 200
    assert any("Headphones" in p["name"] for p in search_r.json()["items"])

    # — Browse: product detail —
    detail_r = await client.get(f"/api/products/{product_a['id']}")
    assert detail_r.status_code == 200
    assert detail_r.json()["name"] == "Wireless Headphones"

    # — Validate coupon before checkout (requires subtotal as query param) —
    subtotal = 79.99 + 34.99 * 2  # 1× headphones + 2× hub
    validate_r = await client.get(f"/api/coupons/validate?code=WELCOME20&subtotal={subtotal}")
    assert validate_r.status_code == 200
    assert validate_r.json()["valid"] is True

    # — Cart: add two products —
    cart_after_a = await _add_to_cart(client, cust_token, product_a["id"], quantity=1)
    assert cart_after_a["item_count"] == 1

    cart_after_b = await _add_to_cart(client, cust_token, product_b["id"], quantity=2)
    assert cart_after_b["item_count"] == 3

    # — Cart: view —
    cart_r = await client.get("/api/cart", headers=cust_h)
    assert cart_r.status_code == 200
    assert cart_r.json()["item_count"] == 3

    # — Checkout with coupon —
    checkout_r = await client.post("/api/checkout", json={
        "payment_method": "cash",
        "shipping_address": "42 Commerce Street, Sydney NSW 2000",
        "coupon_code": "WELCOME20",
    }, headers=cust_h)
    assert checkout_r.status_code == 201, checkout_r.text
    order = checkout_r.json()
    assert order["order_number"].startswith("CF-")
    assert order["payment_method"] == "cash"
    assert float(order["discount_amount"]) > 0, "Coupon discount should be applied"
    assert float(order["total"]) < float(order["subtotal"]), "Total should be less than subtotal"
    order_id = order["order_id"]

    # — Cart should be empty after checkout —
    empty_cart_r = await client.get("/api/cart", headers=cust_h)
    assert empty_cart_r.json()["item_count"] == 0

    # — Stock should be reduced —
    updated_a = await client.get(f"/api/products/{product_a['id']}")
    assert updated_a.json()["stock_quantity"] == 9  # bought 1

    updated_b = await client.get(f"/api/products/{product_b['id']}")
    assert updated_b.json()["stock_quantity"] == 13  # bought 2

    # — Customer views their orders —
    orders_r = await client.get("/api/orders", headers=cust_h)
    assert orders_r.status_code == 200
    assert orders_r.json()["total"] == 1

    # — Admin confirms order —
    confirm_r = await client.put(f"/api/orders/{order_id}/status",
                                  json={"status": "confirmed"}, headers=admin_h)
    assert confirm_r.status_code == 200
    assert confirm_r.json()["status"] == "confirmed"

    # — Customer cancels order (only allowed on pending/confirmed) — stock restored —
    cancel_r = await client.post(f"/api/orders/{order_id}/cancel", headers=cust_h)
    assert cancel_r.status_code == 200

    restored_a = await client.get(f"/api/products/{product_a['id']}")
    assert restored_a.json()["stock_quantity"] == 10

    restored_b = await client.get(f"/api/products/{product_b['id']}")
    assert restored_b.json()["stock_quantity"] == 15


# ---------------------------------------------------------------------------
# Journey 2: Loyalty points — earn, check, redeem
# ---------------------------------------------------------------------------

async def test_loyalty_journey(client: AsyncClient, db):
    """
    Place order → earn loyalty points → verify balance
    → place second order redeeming points → verify balance reduced
    """

    admin_token = await _make_admin(client, db, email="loyalty_admin@example.com")
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    # Lower min_redemption so customer can redeem on a small order
    cfg_r = await client.put("/api/loyalty/config", json={"min_redemption": 1}, headers=admin_h)
    assert cfg_r.status_code == 200, cfg_r.text

    product = await _create_product(client, admin_token, name="Loyalty Item", price="40.00", stock=20)

    cust_token = await _register_customer(client, email="loyalty_cust@example.com")
    cust_h = {"Authorization": f"Bearer {cust_token}"}

    # — First order: earns points —
    await _add_to_cart(client, cust_token, product["id"], quantity=1)
    checkout_r = await client.post("/api/checkout", json={"payment_method": "cash"}, headers=cust_h)
    assert checkout_r.status_code == 201, checkout_r.text

    # — Check loyalty balance —
    loyalty_r = await client.get("/api/loyalty/me", headers=cust_h)
    assert loyalty_r.status_code == 200, loyalty_r.text
    earned = loyalty_r.json()["points_balance"]
    assert earned > 0, f"Expected points after $40 order, got {earned}"

    # — Second order: redeem points —
    await _add_to_cart(client, cust_token, product["id"], quantity=1)
    redeem_r = await client.post("/api/checkout", json={
        "payment_method": "cash",
        "redeem_points": earned,
    }, headers=cust_h)
    assert redeem_r.status_code == 201, redeem_r.text

    # — Balance after redemption should be less than what was earned on order 1 —
    loyalty_after_r = await client.get("/api/loyalty/me", headers=cust_h)
    assert loyalty_after_r.status_code == 200
    assert loyalty_after_r.json()["points_balance"] < earned

    # — Loyalty transaction history should show earn + redeem entries —
    history_r = await client.get("/api/loyalty/me/transactions", headers=cust_h)
    assert history_r.status_code == 200
    tx_types = [t["transaction_type"] for t in history_r.json()]
    assert "earn" in tx_types
    assert "redeem" in tx_types


# ---------------------------------------------------------------------------
# Journey 3: Newsletter subscription
# ---------------------------------------------------------------------------

async def test_newsletter_journey(client: AsyncClient, db):
    """
    Customer subscribes to newsletter → admin views subscriber list
    → customer can unsubscribe
    """

    admin_token = await _make_admin(client, db, email="nl_admin@example.com")
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    # — Subscribe (no auth required) —
    sub_r = await client.post("/api/newsletter/subscribe", json={"email": "reader@example.com"})
    assert sub_r.status_code == 201, sub_r.text
    unsub_token = sub_r.json()["unsubscribe_token"]

    # — Duplicate subscribe returns 409 —
    dup_r = await client.post("/api/newsletter/subscribe", json={"email": "reader@example.com"})
    assert dup_r.status_code == 409, dup_r.text

    # — Admin views subscriber list (returns a plain list, not paginated) —
    list_r = await client.get("/api/newsletter/subscribers", headers=admin_h)
    assert list_r.status_code == 200, list_r.text
    emails = [s["email"] for s in list_r.json()]
    assert "reader@example.com" in emails

    # — Unsubscribe using token —
    unsub_r = await client.post("/api/newsletter/unsubscribe", json={"token": unsub_token})
    assert unsub_r.status_code == 200, unsub_r.text


# ---------------------------------------------------------------------------
# Journey 4: B2B RFQ lifecycle
# ---------------------------------------------------------------------------

async def test_b2b_rfq_journey(client: AsyncClient, db):
    """
    Customer submits RFQ → admin provides quote → customer accepts
    → order is created from the quote
    """

    admin_token = await _make_admin(client, db, email="rfq_admin@example.com")
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    product = await _create_product(client, admin_token, name="Bulk Widget", price="100.00", stock=500)

    cust_token = await _register_customer(client, email="rfq_cust@example.com")
    cust_h = {"Authorization": f"Bearer {cust_token}"}

    # — Admin creates a credit account for the customer (required for RFQ accept) —
    from sqlalchemy import select
    from app.plugins.auth.models import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.email == "rfq_cust@example.com"))
    cust_user = result.scalar_one()
    credit_r = await client.post("/api/credit/accounts", json={
        "user_id": cust_user.id,
        "credit_limit": "10000.00",
    }, headers=admin_h)
    assert credit_r.status_code == 201, credit_r.text

    # — Customer creates a draft RFQ —
    rfq_r = await client.post("/api/rfq", json={
        "notes": "Need 50 units for Q3 campaign",
        "items": [
            {"product_id": product["id"], "product_name": product["name"], "requested_quantity": 50},
        ],
    }, headers=cust_h)
    assert rfq_r.status_code == 201, rfq_r.text
    rfq = rfq_r.json()
    assert rfq["rfq_number"].startswith("CF-RFQ-")
    assert rfq["status"] == "draft"
    rfq_id = rfq["id"]
    item_id = rfq["items"][0]["id"]

    # — Customer submits the RFQ —
    submit_r = await client.post(f"/api/rfq/{rfq_id}/submit", headers=cust_h)
    assert submit_r.status_code == 200, submit_r.text
    assert submit_r.json()["status"] == "submitted"

    # — Admin lists all RFQs (same endpoint; admin role sees all) —
    admin_rfq_r = await client.get("/api/rfq", headers=admin_h)
    assert admin_rfq_r.status_code == 200, admin_rfq_r.text
    assert admin_rfq_r.json()["total"] >= 1

    # — Admin provides a quote —
    quote_r = await client.post(f"/api/rfq/{rfq_id}/quote", json={
        "admin_notes": "Bulk rate applied",
        "item_quotes": [{"rfq_item_id": item_id, "quoted_price": "85.00"}],
    }, headers=admin_h)
    assert quote_r.status_code == 200, quote_r.text
    assert quote_r.json()["status"] == "quoted"
    assert float(quote_r.json()["items"][0]["quoted_price"]) == 85.0

    # — Customer views their RFQ (sees quoted price) —
    my_rfq_r = await client.get(f"/api/rfq/{rfq_id}", headers=cust_h)
    assert my_rfq_r.status_code == 200, my_rfq_r.text
    assert my_rfq_r.json()["status"] == "quoted"

    # — Customer accepts the quote → order created —
    accept_r = await client.post(f"/api/rfq/{rfq_id}/accept", headers=cust_h)
    assert accept_r.status_code == 200, accept_r.text
    accepted = accept_r.json()
    assert accepted.get("order_id") is not None
    assert accepted.get("order_number", "").startswith("CF-")

    # — Verify order is visible in customer's order list —
    orders_r = await client.get("/api/orders", headers=cust_h)
    assert orders_r.status_code == 200, orders_r.text
    assert orders_r.json()["total"] >= 1


# ---------------------------------------------------------------------------
# Journey 5: Guest checkout
# ---------------------------------------------------------------------------

async def test_guest_checkout_journey(client: AsyncClient, db):
    """
    Unauthenticated user browses, adds to cart, and checks out with an email.
    """

    admin_token = await _make_admin(client, db, email="guest_admin@example.com")
    product = await _create_product(client, admin_token, name="Guest Product", price="25.00", stock=10)

    # — Guest browses (no token) —
    products_r = await client.get("/api/products")
    assert products_r.status_code == 200

    # — Guest adds to cart —
    cart_r = await client.post("/api/cart/items", json={"product_id": product["id"], "quantity": 1})
    assert cart_r.status_code in (200, 201), cart_r.text
    assert cart_r.json()["item_count"] == 1

    # — Guest checkout without email should fail —
    bad_r = await client.post("/api/checkout", json={"payment_method": "cash"})
    assert bad_r.status_code == 400, bad_r.text

    # — Guest checkout with email should succeed —
    checkout_r = await client.post("/api/checkout", json={
        "payment_method": "cash",
        "guest_email": "guest@example.com",
        "shipping_address": "99 Guest Ave, Brisbane QLD 4000",
    })
    assert checkout_r.status_code == 201, checkout_r.text
    assert checkout_r.json()["order_number"].startswith("CF-")
