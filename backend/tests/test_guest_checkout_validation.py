"""Guest checkout must validate name, email, and postcode — not just require
they're present. See backend/app/plugins/checkout/schemas.py (guest_name /
guest_postcode validators) and service.py's guest-required-fields guard.
"""
from httpx import AsyncClient

from app.core.config import settings
from tests.test_commerce import make_admin


async def _make_product(client: AsyncClient, token: str, name: str, price: str = "20.00") -> str:
    r = await client.post(
        "/api/products",
        json={"name": name, "price": price, "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()["id"]


async def test_guest_checkout_missing_name_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "No Name Widget")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "guest@example.com",
        "guest_postcode": "SW1A 1AA",
    })
    assert r.status_code == 400, r.text
    assert "guest_name" in r.json()["detail"]


async def test_guest_checkout_missing_postcode_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "No Postcode Widget")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "guest@example.com",
        "guest_name": "Test Guest",
    })
    assert r.status_code == 400, r.text
    assert "guest_postcode" in r.json()["detail"]


async def test_guest_checkout_single_word_name_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Single Name Widget")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "guest@example.com",
        "guest_name": "Test",
        "guest_postcode": "SW1A 1AA",
    })
    assert r.status_code == 422, r.text


async def test_guest_checkout_malformed_uk_postcode_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Bad Postcode Widget")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "guest@example.com",
        "guest_name": "Test Guest",
        "guest_postcode": "ZZ",
        "delivery_country": "GB",
    })
    assert r.status_code == 422, r.text


async def test_guest_checkout_valid_uk_postcode_accepted(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Valid Postcode Widget")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "guest@example.com",
        "guest_name": "Test Guest",
        "guest_postcode": "SW1A 1AA",
        "delivery_country": "GB",
    })
    assert r.status_code == 201, r.text


async def test_guest_checkout_undeliverable_email_rejected(client: AsyncClient, db, monkeypatch):
    """.invalid is an IANA-reserved TLD (RFC 2606) guaranteed to never resolve —
    email-validator rejects it at the syntax stage, so this is deterministic and
    makes no real network call despite exercising the deliverability code path."""
    monkeypatch.setattr(settings, "EMAIL_CHECK_DELIVERABILITY", True)
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Undeliverable Email Widget")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "guest@nobody.invalid",
        "guest_name": "Test Guest",
        "guest_postcode": "SW1A 1AA",
        "delivery_country": "GB",
    })
    assert r.status_code == 422, r.text


async def test_guest_checkout_non_uk_generic_postcode_accepted(client: AsyncClient, db):
    """Postcode format is only strictly enforced for GB — other countries fall back
    to a lenient check so the platform's multi-country support isn't broken."""
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "AU Widget")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "guest@example.com",
        "guest_name": "Jamie Rivers",
        "guest_postcode": "4000",
        "delivery_country": "AU",
    })
    assert r.status_code == 201, r.text
