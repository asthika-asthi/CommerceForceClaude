"""GDPR data export (self-service, immediate) and account deletion
(self-service request, admin approve/reject) — auth/service.py.
"""
from httpx import AsyncClient
from sqlalchemy import select

from app.plugins.auth.models import User
from app.plugins.reviews.models import Review

from tests.test_commerce import make_admin, register_and_token, _create_product_and_variant, CUSTOMER_DATA


# ── export ───────────────────────────────────────────────────────────────────

async def test_export_data_returns_account_without_password_hash(client: AsyncClient, db):
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.get("/api/auth/me/export-data", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    assert r.headers["content-disposition"] == 'attachment; filename="my-data.json"'
    body = r.json()
    assert body["account"]["email"] == CUSTOMER_DATA["email"]
    assert "hashed_password" not in body["account"]
    assert "email_verification_token" not in body["account"]


async def test_export_data_includes_own_orders(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    pid, variant_id = await _create_product_and_variant(client, admin_token, name="Export Widget")
    await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": pid, "variant_id": variant_id, "quantity": 1}],
        "payment_method": "cash",
        "shipping_address": "1 Test St",
    }, headers={"Authorization": f"Bearer {cust_token}"})

    r = await client.get("/api/auth/me/export-data", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["orders"]) == 1
    assert body["orders"][0]["items"][0]["product_name"] == "Export Widget"


async def test_export_data_requires_auth(client: AsyncClient):
    r = await client.get("/api/auth/me/export-data")
    assert r.status_code == 401


# ── deletion request lifecycle ──────────────────────────────────────────────

async def test_request_deletion_creates_pending(client: AsyncClient, db):
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post("/api/auth/me/deletion-request", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "pending"
    assert body["user_email_snapshot"] == CUSTOMER_DATA["email"]


async def test_request_deletion_rejects_second_pending(client: AsyncClient, db):
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    headers = {"Authorization": f"Bearer {cust_token}"}
    r1 = await client.post("/api/auth/me/deletion-request", headers=headers)
    assert r1.status_code == 201
    r2 = await client.post("/api/auth/me/deletion-request", headers=headers)
    assert r2.status_code == 409


async def test_my_deletion_request_shows_latest_status(client: AsyncClient, db):
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    headers = {"Authorization": f"Bearer {cust_token}"}
    r = await client.get("/api/auth/me/deletion-request", headers=headers)
    assert r.status_code == 200
    assert r.json() is None

    await client.post("/api/auth/me/deletion-request", headers=headers)
    r2 = await client.get("/api/auth/me/deletion-request", headers=headers)
    assert r2.json()["status"] == "pending"


async def test_non_admin_cannot_list_or_approve(client: AsyncClient, db):
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    headers = {"Authorization": f"Bearer {cust_token}"}
    req = await client.post("/api/auth/me/deletion-request", headers=headers)
    request_id = req.json()["id"]

    assert (await client.get("/api/auth/deletion-requests", headers=headers)).status_code == 403
    assert (await client.post(f"/api/auth/deletion-requests/{request_id}/approve", headers=headers)).status_code == 403


async def test_admin_reject_sets_status_and_notes(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    req = await client.post("/api/auth/me/deletion-request", headers={"Authorization": f"Bearer {cust_token}"})
    request_id = req.json()["id"]

    r = await client.post(
        f"/api/auth/deletion-requests/{request_id}/reject",
        json={"admin_notes": "Open order in progress"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "rejected"
    assert body["admin_notes"] == "Open order in progress"

    # The account must be untouched — still able to log in normally.
    login = await client.post("/api/auth/login", json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert login.status_code == 200


async def test_cannot_review_an_already_reviewed_request(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    req = await client.post("/api/auth/me/deletion-request", headers={"Authorization": f"Bearer {cust_token}"})
    request_id = req.json()["id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    await client.post(f"/api/auth/deletion-requests/{request_id}/reject", json={"admin_notes": "no"}, headers=admin_headers)
    r = await client.post(f"/api/auth/deletion-requests/{request_id}/approve", headers=admin_headers)
    assert r.status_code == 409


# ── approve → anonymize ──────────────────────────────────────────────────────

async def test_approve_anonymizes_account_and_blocks_login(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    req = await client.post("/api/auth/me/deletion-request", headers={"Authorization": f"Bearer {cust_token}"})
    request_id = req.json()["id"]

    r = await client.post(f"/api/auth/deletion-requests/{request_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "completed"

    login = await client.post("/api/auth/login", json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert login.status_code in (401, 403)

    db.expire_all()
    original_id = (await db.execute(
        select(User.id).where(User.email == f"deleted-user-{req.json()['user_id']}@deleted.local")
    )).scalar_one_or_none()
    assert original_id is not None, "user row should be scrubbed, not deleted"


async def test_approve_redacts_order_pii_but_keeps_the_order(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    pid, variant_id = await _create_product_and_variant(client, admin_token, name="Redact Widget")
    checkout = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": pid, "variant_id": variant_id, "quantity": 1}],
        "payment_method": "cash",
        "shipping_address": "123 Secret Lane",
        "notes": "Leave by the shed",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = checkout.json()["order_id"]

    req = await client.post("/api/auth/me/deletion-request", headers={"Authorization": f"Bearer {cust_token}"})
    request_id = req.json()["id"]
    await client.post(f"/api/auth/deletion-requests/{request_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    order = await client.get(f"/api/orders/{order_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert order.status_code == 200
    body = order.json()
    assert body["id"] == order_id, "order record itself must survive (retention policy)"
    assert body["shipping_address"] == "[redacted]"
    assert body["notes"] == "[redacted]"


async def test_approve_unlinks_review_but_keeps_its_text(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id, variant_id = await _create_product_and_variant(client, admin_token, name="Reviewed Widget")

    checkout = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "variant_id": variant_id, "quantity": 1}],
        "payment_method": "cash",
        "shipping_address": "1 Test St",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    order_id = checkout.json()["order_id"]
    await client.put(f"/api/orders/{order_id}/status", json={"status": "delivered"}, headers={"Authorization": f"Bearer {admin_token}"})

    review = await client.post("/api/reviews", json={
        "product_id": product_id, "rating": 5, "title": "Great", "body": "Loved it",
    }, headers={"Authorization": f"Bearer {cust_token}"})
    assert review.status_code == 201, review.text
    review_id = review.json()["id"]

    req = await client.post("/api/auth/me/deletion-request", headers={"Authorization": f"Bearer {cust_token}"})
    request_id = req.json()["id"]
    await client.post(f"/api/auth/deletion-requests/{request_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    db.expire_all()
    stored = (await db.execute(select(Review).where(Review.id == review_id))).scalar_one()
    assert stored.user_id is None
    assert stored.body == "Loved it", "review text must survive unlinking"


async def test_approve_deletes_addresses_and_wishlist_items(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    headers = {"Authorization": f"Bearer {cust_token}"}
    _pid, _vid = await _create_product_and_variant(client, admin_token, name="Wishlisted Widget")

    await client.post("/api/addresses", json={
        "line1": "1 Test St", "city": "Testville", "postcode": "T3 5TT",
    }, headers=headers)
    await client.post(f"/api/wishlist/{_pid}", headers=headers)

    req = await client.post("/api/auth/me/deletion-request", headers=headers)
    request_id = req.json()["id"]
    await client.post(f"/api/auth/deletion-requests/{request_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

    from app.plugins.addresses.models import Address
    from app.plugins.wishlist.models import WishlistItem
    user_id = req.json()["user_id"]
    db.expire_all()
    addresses = (await db.execute(select(Address).where(Address.user_id == user_id))).scalars().all()
    wishlist = (await db.execute(select(WishlistItem).where(WishlistItem.user_id == user_id))).scalars().all()
    assert addresses == []
    assert wishlist == []
