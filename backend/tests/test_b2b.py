"""Phase 3 — B2B Layer integration tests: RFQ, Credit, Inventory."""
import pytest
from httpx import AsyncClient

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

ADMIN_DATA = {"email": "b2b_admin@example.com", "password": "adminpass1", "first_name": "Admin", "last_name": "B2B"}
CUSTOMER_DATA = {"email": "b2b_cust@example.com", "password": "custpass1", "first_name": "Cust", "last_name": "B2B"}


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


async def _create_product(client, admin_token, name="B2B Widget", price="100.00", stock=50) -> str:
    r = await client.post(
        "/api/products",
        json={"name": name, "price": price, "stock_quantity": stock},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _get_default_variant_id(client, product_id: str, admin_token: str) -> str:
    """Return the default variant_id for a product."""
    r = await client.get(
        f"/api/products/{product_id}/variants",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, r.text
    variants = r.json()
    default = next((v for v in variants if v["is_default"]), variants[0])
    return default["id"]


# ── RFQ ────────────────────────────────────────────────────────────────────────

async def test_create_rfq(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/rfq",
        json={"notes": "Bulk order", "items": [{"product_name": "Widget X", "requested_quantity": 50}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["rfq_number"].startswith("CF-RFQ-")
    assert body["status"] == "draft"
    assert len(body["items"]) == 1


async def test_submit_rfq(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/rfq",
        json={"items": [{"product_name": "Widget Y", "requested_quantity": 10}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    rfq_id = r.json()["id"]
    r2 = await client.post(f"/api/rfq/{rfq_id}/submit", headers={"Authorization": f"Bearer {cust_token}"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "submitted"


async def test_admin_quote_rfq(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/rfq",
        json={"items": [{"product_name": "Widget Z", "requested_quantity": 5}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    rfq = r.json()
    rfq_id = rfq["id"]
    item_id = rfq["items"][0]["id"]

    await client.post(f"/api/rfq/{rfq_id}/submit", headers={"Authorization": f"Bearer {cust_token}"})
    r2 = await client.post(
        f"/api/rfq/{rfq_id}/quote",
        json={"admin_notes": "Special price for you", "item_quotes": [{"rfq_item_id": item_id, "quoted_price": "80.00"}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["status"] == "quoted"
    assert body["items"][0]["quoted_price"] == "80.00"


async def test_accept_rfq_creates_order(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    # Get customer user_id from token
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    # Create and fund credit account for customer
    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "10000.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    r = await client.post(
        "/api/rfq",
        json={"items": [{"product_name": "Bulk Item", "requested_quantity": 20}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    rfq = r.json()
    rfq_id = rfq["id"]
    item_id = rfq["items"][0]["id"]

    await client.post(f"/api/rfq/{rfq_id}/submit", headers={"Authorization": f"Bearer {cust_token}"})
    await client.post(
        f"/api/rfq/{rfq_id}/quote",
        json={"item_quotes": [{"rfq_item_id": item_id, "quoted_price": "50.00"}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r3 = await client.post(f"/api/rfq/{rfq_id}/accept", headers={"Authorization": f"Bearer {cust_token}"})
    assert r3.status_code == 200
    body = r3.json()
    assert "order_id" in body
    assert body["order_number"].startswith("CF-")


async def test_reject_rfq(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/rfq",
        json={"items": [{"product_name": "Reject Me", "requested_quantity": 1}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    rfq_id = r.json()["id"]
    await client.post(f"/api/rfq/{rfq_id}/submit", headers={"Authorization": f"Bearer {cust_token}"})
    r2 = await client.post(f"/api/rfq/{rfq_id}/reject", headers={"Authorization": f"Bearer {admin_token}"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "rejected"


async def test_rfq_list_customer_sees_own(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    await client.post(
        "/api/rfq",
        json={"items": [{"product_name": "My RFQ", "requested_quantity": 1}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    r = await client.get("/api/rfq", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    assert r.json()["total"] >= 1

    # Admin sees all
    r2 = await client.get("/api/rfq", headers={"Authorization": f"Bearer {admin_token}"})
    assert r2.status_code == 200


# ── CREDIT ─────────────────────────────────────────────────────────────────────

async def test_create_credit_account(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    r = await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "5000.00", "notes": "Trusted B2B customer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert float(body["credit_limit"]) == 5000.00
    assert float(body["used_credit"]) == 0
    assert float(body["available_credit"]) == 5000.00


async def test_credit_me_endpoint(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]
    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "1000.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.get("/api/credit/me", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    assert float(r.json()["available_credit"]) == 1000.00


async def test_checkout_with_credit(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "5000.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="100.00", stock=10)
    variant_id = await _get_default_variant_id(client, product_id, admin_token)
    await client.post(
        "/api/cart/items",
        json={"variant_id": variant_id, "quantity": 2},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    r = await client.post(
        "/api/checkout",
        json={"payment_method": "credit_limit"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 201
    assert r.json()["payment_status"] == "paid"


async def test_credit_balance_deducted_after_checkout(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "5000.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="200.00", stock=10)
    variant_id = await _get_default_variant_id(client, product_id, admin_token)
    await client.post(
        "/api/cart/items",
        json={"variant_id": variant_id, "quantity": 1},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    await client.post(
        "/api/checkout",
        json={"payment_method": "credit_limit"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    r = await client.get("/api/credit/me", headers={"Authorization": f"Bearer {cust_token}"})
    body = r.json()
    assert float(body["used_credit"]) == 200.00
    assert float(body["available_credit"]) == 4800.00


async def test_credit_insufficient_blocks_checkout(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "10.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = await _create_product(client, admin_token, price="500.00", stock=10)
    variant_id = await _get_default_variant_id(client, product_id, admin_token)
    await client.post(
        "/api/cart/items",
        json={"variant_id": variant_id, "quantity": 1},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    r = await client.post(
        "/api/checkout",
        json={"payment_method": "credit_limit"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 402


async def test_credit_update_limit(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "1000.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.put(
        f"/api/credit/accounts/{cust_id}",
        json={"credit_limit": "2000.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert float(r.json()["credit_limit"]) == 2000.00


# ── INVENTORY ──────────────────────────────────────────────────────────────────

async def test_create_warehouse(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/inventory/warehouses",
        json={"name": "Main Warehouse", "code": "MAIN", "is_default": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "MAIN"
    assert body["is_default"] is True


async def test_list_warehouses(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post(
        "/api/inventory/warehouses",
        json={"name": "North WH", "code": "NORTH"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.get("/api/inventory/warehouses")
    assert r.status_code == 200
    assert len(r.json()) >= 1


async def test_set_warehouse_stock(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _create_product(client, admin_token, name="Stock Item")
    variant_id = await _get_default_variant_id(client, product_id, admin_token)
    wh_r = await client.post(
        "/api/inventory/warehouses",
        json={"name": "Storage WH", "code": "STORE"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    wh_id = wh_r.json()["id"]

    r = await client.post(
        f"/api/inventory/warehouses/{wh_id}/stock",
        json={"variant_id": variant_id, "quantity": 150, "low_stock_threshold": 20},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["quantity"] == 150
    assert r.json()["available_quantity"] == 150


async def test_adjust_warehouse_stock(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _create_product(client, admin_token, name="Adjust Item")
    variant_id = await _get_default_variant_id(client, product_id, admin_token)
    wh_r = await client.post(
        "/api/inventory/warehouses",
        json={"name": "Adjust WH", "code": "ADJ"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    wh_id = wh_r.json()["id"]
    await client.post(
        f"/api/inventory/warehouses/{wh_id}/stock",
        json={"variant_id": variant_id, "quantity": 100},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.post(
        f"/api/inventory/warehouses/{wh_id}/stock/adjust",
        json={"variant_id": variant_id, "delta": -30},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["quantity"] == 70


async def test_get_variant_stock_summary(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _create_product(client, admin_token, name="Multi-WH Item")
    variant_id = await _get_default_variant_id(client, product_id, admin_token)

    for code, qty in [("WH-A", 50), ("WH-B", 30)]:
        wh_r = await client.post(
            "/api/inventory/warehouses",
            json={"name": code, "code": code},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        await client.post(
            f"/api/inventory/warehouses/{wh_r.json()['id']}/stock",
            json={"variant_id": variant_id, "quantity": qty},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

    r = await client.get(f"/api/inventory/variants/{variant_id}/stock")
    assert r.status_code == 200
    body = r.json()
    assert body["total_quantity"] == 80
    assert len(body["warehouses"]) == 2


async def test_accept_rfq_deducts_credit(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    # Get customer user_id
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    # Grant credit
    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "500.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Create product with stock
    product_id = await _create_product(client, admin_token, name="RFQ Credit Product", price="80.00", stock=10)

    # Customer submits RFQ
    rfq_r = await client.post(
        "/api/rfq",
        json={"items": [{"product_id": product_id, "product_name": "RFQ Credit Product", "requested_quantity": 2}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    rfq_id = rfq_r.json()["id"]
    item_id = rfq_r.json()["items"][0]["id"]

    # Customer submits, then admin quotes
    await client.post(f"/api/rfq/{rfq_id}/submit", headers={"Authorization": f"Bearer {cust_token}"})
    await client.post(
        f"/api/rfq/{rfq_id}/quote",
        json={"item_quotes": [{"rfq_item_id": item_id, "quoted_price": "80.00"}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Customer accepts
    accept_r = await client.post(f"/api/rfq/{rfq_id}/accept", headers={"Authorization": f"Bearer {cust_token}"})
    assert accept_r.status_code == 200

    # Credit should be deducted: 2 × $80 = $160
    acct_r = await client.get("/api/credit/me", headers={"Authorization": f"Bearer {cust_token}"})
    assert acct_r.status_code == 200, acct_r.text
    assert float(acct_r.json()["used_credit"]) == 160.0


async def test_warehouse_duplicate_code_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post(
        "/api/inventory/warehouses",
        json={"name": "First", "code": "DUP"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.post(
        "/api/inventory/warehouses",
        json={"name": "Second", "code": "DUP"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 409


async def test_accept_rfq_insufficient_credit(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)

    # Get customer user_id
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    cust_id = me.json()["id"]

    # Grant credit of $100 only
    await client.post(
        "/api/credit/accounts",
        json={"user_id": cust_id, "credit_limit": "100.00"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Create a product priced at $60 each
    product_id = await _create_product(client, admin_token, name="Expensive RFQ Widget", price="60.00", stock=10)

    # Customer submits an RFQ for 2 units (total quoted value will be $120, exceeding $100 limit)
    rfq_r = await client.post(
        "/api/rfq",
        json={"items": [{"product_id": product_id, "product_name": "Expensive RFQ Widget", "requested_quantity": 2}]},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert rfq_r.status_code == 201, rfq_r.text
    rfq_id = rfq_r.json()["id"]
    item_id = rfq_r.json()["items"][0]["id"]

    # Customer submits the RFQ
    await client.post(f"/api/rfq/{rfq_id}/submit", headers={"Authorization": f"Bearer {cust_token}"})

    # Admin quotes a price of $60/unit (total $120 > $100 credit)
    await client.post(
        f"/api/rfq/{rfq_id}/quote",
        json={"item_quotes": [{"rfq_item_id": item_id, "quoted_price": "60.00"}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Customer tries to accept — should fail with 4xx due to insufficient credit
    accept_r = await client.post(f"/api/rfq/{rfq_id}/accept", headers={"Authorization": f"Bearer {cust_token}"})
    assert 400 <= accept_r.status_code < 500, (
        f"Expected 4xx but got {accept_r.status_code}: {accept_r.text}"
    )

    # Verify the RFQ was NOT transitioned to accepted status (credit failure prevented it)
    rfq_detail_r = await client.get(f"/api/rfq/{rfq_id}", headers={"Authorization": f"Bearer {cust_token}"})
    assert rfq_detail_r.status_code == 200, rfq_detail_r.text
    assert rfq_detail_r.json()["status"] == "quoted", (
        f"RFQ should remain 'quoted' after failed accept, but got: {rfq_detail_r.json()['status']}"
    )
