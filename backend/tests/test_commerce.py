"""Phase 2 — Commerce Engine integration tests."""
import pytest
from httpx import AsyncClient

# --- helpers ---
REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

ADMIN_DATA = {"email": "admin@example.com", "password": "adminpass1", "first_name": "Admin", "last_name": "User"}
CUSTOMER_DATA = {"email": "cust@example.com", "password": "custpass1", "first_name": "Cust", "last_name": "User"}


async def register_and_token(client: AsyncClient, data: dict) -> str:
    r = await client.post(REGISTER_URL, json=data)
    return r.json()["access_token"]


async def make_admin(client: AsyncClient, db) -> str:
    """Register a user then promote them to admin directly via DB."""
    token = await register_and_token(client, ADMIN_DATA)
    from sqlalchemy import select, update
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == ADMIN_DATA["email"]).values(role=UserRole.admin))
    await db.flush()
    # Re-login to get fresh token with admin role
    r = await client.post(LOGIN_URL, json={"email": ADMIN_DATA["email"], "password": ADMIN_DATA["password"]})
    return r.json()["access_token"]


# ── CATEGORIES ─────────────────────────────────────────────────────────────────

async def test_create_category(client: AsyncClient, db):
    token = await make_admin(client, db)
    r = await client.post("/api/categories", json={"name": "Electronics"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Electronics"
    assert body["slug"] == "electronics"


async def test_create_category_requires_admin(client: AsyncClient):
    token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post("/api/categories", json={"name": "Phones"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


async def test_list_categories_public(client: AsyncClient, db):
    token = await make_admin(client, db)
    await client.post("/api/categories", json={"name": "Clothing"}, headers={"Authorization": f"Bearer {token}"})
    r = await client.get("/api/categories")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_hierarchical_categories(client: AsyncClient, db):
    token = await make_admin(client, db)
    parent = await client.post("/api/categories", json={"name": "Electronics"}, headers={"Authorization": f"Bearer {token}"})
    parent_id = parent.json()["id"]
    child = await client.post("/api/categories", json={"name": "Phones", "parent_id": parent_id}, headers={"Authorization": f"Bearer {token}"})
    assert child.status_code == 201
    assert child.json()["parent_id"] == parent_id
    # Parent should list child in children array
    r = await client.get(f"/api/categories/{parent_id}")
    assert any(c["name"] == "Phones" for c in r.json()["children"])


# ── PRODUCTS ───────────────────────────────────────────────────────────────────

PRODUCT_DATA = {"name": "Test Widget", "price": "19.99", "stock_quantity": 100}


async def test_create_product(client: AsyncClient, db):
    token = await make_admin(client, db)
    r = await client.post("/api/products", json=PRODUCT_DATA, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Test Widget"
    assert body["slug"] == "test-widget"
    assert body["sku"]
    assert body["effective_price"] == "19.99"


async def test_list_products_public(client: AsyncClient, db):
    token = await make_admin(client, db)
    await client.post("/api/products", json=PRODUCT_DATA, headers={"Authorization": f"Bearer {token}"})
    r = await client.get("/api/products")
    assert r.status_code == 200
    assert r.json()["total"] >= 1


async def test_product_search(client: AsyncClient, db):
    token = await make_admin(client, db)
    await client.post("/api/products", json={"name": "Red Umbrella", "price": "9.99", "stock_quantity": 5}, headers={"Authorization": f"Bearer {token}"})
    r = await client.get("/api/products?search=Umbrella")
    assert r.status_code == 200
    assert any("Umbrella" in i["name"] for i in r.json()["items"])


async def test_product_sale_price(client: AsyncClient, db):
    token = await make_admin(client, db)
    r = await client.post("/api/products", json={"name": "On Sale Item", "price": "50.00", "sale_price": "35.00", "is_on_sale": True, "stock_quantity": 10}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201
    assert r.json()["effective_price"] == "35.00"


# ── CART ───────────────────────────────────────────────────────────────────────

async def _create_product(client, token, name="Widget", price="10.00", stock=50) -> str:
    r = await client.post("/api/products", json={"name": name, "price": price, "stock_quantity": stock}, headers={"Authorization": f"Bearer {token}"})
    return r.json()["id"]


async def test_cart_add_item_authenticated(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token)
    r = await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 2}, headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    assert r.json()["item_count"] == 2


async def test_cart_add_item_guest(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _create_product(client, admin_token, name="Guest Item")
    r = await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 1})
    assert r.status_code == 200
    assert r.json()["item_count"] == 1


async def test_cart_update_quantity(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 1}, headers={"Authorization": f"Bearer {cust_token}"})
    r = await client.put(f"/api/cart/items/{product_id}", json={"quantity": 5}, headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    assert r.json()["item_count"] == 5


async def test_cart_remove_item(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 3}, headers={"Authorization": f"Bearer {cust_token}"})
    r = await client.delete(f"/api/cart/items/{product_id}", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    assert r.json()["item_count"] == 0


# ── CHECKOUT ───────────────────────────────────────────────────────────────────

async def test_checkout_cash(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token, stock=20)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 2}, headers={"Authorization": f"Bearer {cust_token}"})
    r = await client.post("/api/checkout", json={"payment_method": "cash"}, headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 201
    body = r.json()
    assert body["payment_method"] == "cash"
    assert body["order_number"].startswith("CF-")


async def test_checkout_deducts_stock(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token, stock=10)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 3}, headers={"Authorization": f"Bearer {cust_token}"})
    await client.post("/api/checkout", json={"payment_method": "cash"}, headers={"Authorization": f"Bearer {cust_token}"})
    r = await client.get(f"/api/products/{product_id}")
    assert r.json()["stock_quantity"] == 7


async def test_checkout_clears_cart(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token, stock=10)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 1}, headers={"Authorization": f"Bearer {cust_token}"})
    await client.post("/api/checkout", json={"payment_method": "cash"}, headers={"Authorization": f"Bearer {cust_token}"})
    r = await client.get("/api/cart", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.json()["item_count"] == 0


async def test_checkout_guest_requires_email(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _create_product(client, admin_token, name="GuestProd", stock=5)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 1})
    r = await client.post("/api/checkout", json={"payment_method": "cash"})
    assert r.status_code == 400


async def test_payment_methods_endpoint(client: AsyncClient):
    r = await client.get("/api/checkout/payment-methods")
    assert r.status_code == 200
    keys = [m["key"] for m in r.json()]
    assert "cash" in keys


# ── ORDERS ─────────────────────────────────────────────────────────────────────

async def test_order_appears_after_checkout(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token, stock=10)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 1}, headers={"Authorization": f"Bearer {cust_token}"})
    await client.post("/api/checkout", json={"payment_method": "cash"}, headers={"Authorization": f"Bearer {cust_token}"})
    r = await client.get("/api/orders", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    assert r.json()["total"] >= 1


async def test_admin_update_order_status(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id = await _create_product(client, admin_token, stock=10)
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 1}, headers={"Authorization": f"Bearer {cust_token}"})
    checkout_r = await client.post("/api/checkout", json={"payment_method": "cash"}, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = checkout_r.json()["order_id"]
    r = await client.put(f"/api/orders/{order_id}/status", json={"status": "confirmed"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"


async def test_cancel_order_restores_stock(client: AsyncClient, db):
    # Register customer
    reg = await client.post("/api/auth/register", json={
        "email": "cancel_stock@test.com", "password": "Test1234!",
        "first_name": "A", "last_name": "B",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Admin creates a product with known stock
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    prod = await client.post("/api/products", json={
        "name": "Cancel Stock Test", "price": "10.00", "stock_quantity": 5,
    }, headers=admin_headers)
    product_id = prod.json()["id"]

    # Customer places order consuming 2 units
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 2}, headers=headers)
    order_r = await client.post("/api/checkout", json={
        "shipping_address": "1 Test St", "use_cart": True, "payment_method": "cash",
    }, headers=headers)
    assert order_r.status_code == 201
    order_id = order_r.json()["order_id"]

    # Stock should be 3
    assert (await client.get(f"/api/products/{product_id}")).json()["stock_quantity"] == 3

    # Cancel
    cancel_r = await client.post(f"/api/orders/{order_id}/cancel", headers=headers)
    assert cancel_r.status_code == 200

    # Stock should be restored to 5
    assert (await client.get(f"/api/products/{product_id}")).json()["stock_quantity"] == 5


async def test_cancel_order_reverses_loyalty_points(client: AsyncClient, db):
    # Register a unique customer for this test
    reg = await client.post("/api/auth/register", json={
        "email": "loyalty_cancel@test.com", "password": "Test1234!",
        "first_name": "L", "last_name": "Cancel",
    })
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Admin creates a product with a price that will earn points (1 point per dollar by default)
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    prod = await client.post("/api/products", json={
        "name": "Loyalty Cancel Product", "price": "20.00", "stock_quantity": 10,
    }, headers=admin_headers)
    assert prod.status_code == 201, prod.text
    product_id = prod.json()["id"]

    # Customer adds product to cart and places an order via cash payment
    await client.post("/api/cart/items", json={"product_id": product_id, "quantity": 1}, headers=headers)
    order_r = await client.post("/api/checkout", json={"payment_method": "cash"}, headers=headers)
    assert order_r.status_code == 201, order_r.text
    order_id = order_r.json()["order_id"]

    # Verify loyalty points were earned (default: 1 point per $1, so $20 order -> 20 points)
    acct_r = await client.get("/api/loyalty/me", headers=headers)
    assert acct_r.status_code == 200, acct_r.text
    assert acct_r.json()["points_balance"] > 0

    # Customer cancels the order
    cancel_r = await client.post(f"/api/orders/{order_id}/cancel", headers=headers)
    assert cancel_r.status_code == 200, cancel_r.text

    # Verify loyalty points are reversed back to 0
    acct_after_r = await client.get("/api/loyalty/me", headers=headers)
    assert acct_after_r.status_code == 200, acct_after_r.text
    assert acct_after_r.json()["points_balance"] == 0


async def test_cancel_order_no_negative_balance(client: AsyncClient, db):
    """Earn points on order A, redeem them all on order B, then cancel order A.
    The balance must not go negative."""
    # Register a unique customer for this test
    reg = await client.post("/api/auth/register", json={
        "email": "loyalty_no_neg@test.com", "password": "Test1234!",
        "first_name": "No", "last_name": "Neg",
    })
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Admin creates two products and lowers min_redemption so 20 pts can be redeemed
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    cfg_r = await client.put("/api/loyalty/config", json={"min_redemption": 1}, headers=admin_headers)
    assert cfg_r.status_code == 200, cfg_r.text

    prod_a = await client.post("/api/products", json={
        "name": "Earn Product", "price": "20.00", "stock_quantity": 10,
    }, headers=admin_headers)
    assert prod_a.status_code == 201, prod_a.text
    product_a_id = prod_a.json()["id"]

    prod_b = await client.post("/api/products", json={
        "name": "Redeem Product", "price": "5.00", "stock_quantity": 10,
    }, headers=admin_headers)
    assert prod_b.status_code == 201, prod_b.text
    product_b_id = prod_b.json()["id"]

    # Step 1: Place order A — earns 20 points (default 1 pt per $1, $20 order)
    await client.post("/api/cart/items", json={"product_id": product_a_id, "quantity": 1}, headers=headers)
    order_a_r = await client.post("/api/checkout", json={"payment_method": "cash"}, headers=headers)
    assert order_a_r.status_code == 201, order_a_r.text
    order_a_id = order_a_r.json()["order_id"]

    # Confirm we have points
    acct_r = await client.get("/api/loyalty/me", headers=headers)
    assert acct_r.status_code == 200, acct_r.text
    earned_points = acct_r.json()["points_balance"]
    assert earned_points > 0, "Expected positive points balance after order A"

    # Step 2: Place order B, redeeming all earned points — balance drops to 0
    await client.post("/api/cart/items", json={"product_id": product_b_id, "quantity": 1}, headers=headers)
    order_b_r = await client.post(
        "/api/checkout",
        json={"payment_method": "cash", "redeem_points": earned_points},
        headers=headers,
    )
    assert order_b_r.status_code == 201, order_b_r.text

    # Confirm that the redemption was applied (balance decreased below what was earned on order A)
    # Note: order B itself may also earn a small number of points, so we just confirm
    # that the redeemed points were consumed (balance < earned_points).
    acct_r2 = await client.get("/api/loyalty/me", headers=headers)
    assert acct_r2.status_code == 200, acct_r2.text
    balance_after_redeem = acct_r2.json()["points_balance"]
    assert balance_after_redeem < earned_points, (
        f"Redemption should have reduced balance below {earned_points}, got {balance_after_redeem}"
    )

    # Step 3: Cancel order A — reverse_order_points subtracts earned_points from a 0 balance
    cancel_r = await client.post(f"/api/orders/{order_a_id}/cancel", headers=headers)
    assert cancel_r.status_code == 200, cancel_r.text

    # Assert balance is not negative
    acct_final_r = await client.get("/api/loyalty/me", headers=headers)
    assert acct_final_r.status_code == 200, acct_final_r.text
    final_balance = acct_final_r.json()["points_balance"]
    assert final_balance >= 0, f"points_balance must not be negative after earn-redeem-cancel, got {final_balance}"
