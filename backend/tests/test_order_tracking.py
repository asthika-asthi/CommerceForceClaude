"""Guest order tracking — POST /api/orders/track.

Public, enumeration-safe (never reveals whether the order number or the
email was wrong) and rate-limited.
"""
from httpx import AsyncClient

from tests.test_commerce import make_admin


async def _make_product(client: AsyncClient, token: str, name: str, price: str = "25.00") -> str:
    r = await client.post(
        "/api/products",
        json={"name": name, "price": price, "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()["id"]


async def _place_guest_order(client: AsyncClient, admin_token: str, email: str = "guest@example.com") -> str:
    product_id = await _make_product(client, admin_token, "Trackable Widget")
    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": email,
        "shipping_address": "1 Test St",
    })
    assert r.status_code == 201, r.text
    return r.json()["order_number"]


async def test_track_order_matches_order_number_and_email(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    order_number = await _place_guest_order(client, admin_token, "guest@example.com")

    r = await client.post("/api/orders/track", json={"order_number": order_number, "email": "guest@example.com"})
    assert r.status_code == 200, r.text
    assert r.json()["order_number"] == order_number


async def test_track_order_is_case_insensitive(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    order_number = await _place_guest_order(client, admin_token, "Guest@Example.com")

    r = await client.post("/api/orders/track", json={
        "order_number": order_number.lower(), "email": "GUEST@example.COM",
    })
    assert r.status_code == 200, r.text


async def test_track_order_wrong_email_generic_404(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    order_number = await _place_guest_order(client, admin_token, "guest@example.com")

    r = await client.post("/api/orders/track", json={"order_number": order_number, "email": "wrong@example.com"})
    assert r.status_code == 404
    assert r.json()["detail"] == "No matching order found"


async def test_track_order_wrong_number_generic_404(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await _place_guest_order(client, admin_token, "guest@example.com")

    r = await client.post("/api/orders/track", json={"order_number": "CF-20260101-NOPE99", "email": "guest@example.com"})
    assert r.status_code == 404
    assert r.json()["detail"] == "No matching order found"


async def test_track_order_same_error_for_both_mismatch_types(client: AsyncClient, db):
    """Enumeration-safety: wrong-email and wrong-number responses must be identical."""
    admin_token = await make_admin(client, db)
    order_number = await _place_guest_order(client, admin_token, "guest@example.com")

    wrong_email = await client.post("/api/orders/track", json={"order_number": order_number, "email": "wrong@example.com"})
    wrong_number = await client.post("/api/orders/track", json={"order_number": "CF-20260101-NOPE99", "email": "guest@example.com"})
    assert wrong_email.status_code == wrong_number.status_code == 404
    assert wrong_email.json() == wrong_number.json()


async def test_track_order_works_for_registered_customer_by_account_email(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Account Widget")

    reg = await client.post("/api/auth/register", json={
        "email": "tracker@example.com", "password": "Passw0rd!", "first_name": "Tracy", "last_name": "Tracker",
    })
    customer_token = reg.json()["access_token"]

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "shipping_address": "1 Test St",
    }, headers={"Authorization": f"Bearer {customer_token}"})
    assert r.status_code == 201, r.text
    order_number = r.json()["order_number"]

    track = await client.post("/api/orders/track", json={"order_number": order_number, "email": "tracker@example.com"})
    assert track.status_code == 200, track.text


async def test_track_order_is_rate_limited(client: AsyncClient, db, reset_rate_limiter):
    # 5/minute — the 6th request in a window must be throttled with 429.
    statuses = []
    for _ in range(6):
        r = await client.post("/api/orders/track", json={"order_number": "CF-NOPE", "email": "nobody@example.com"})
        statuses.append(r.status_code)

    assert 429 in statuses, f"order tracking should be rate limited, got {statuses}"
    assert statuses[:5] == [404, 404, 404, 404, 404], f"first 5 should each 404 normally, got {statuses}"
