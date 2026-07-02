"""Tests for admin new-order email notification (Sprint 1C)."""
import pytest
from unittest.mock import patch
from httpx import AsyncClient
from sqlalchemy import update
from app.plugins.auth.models import User, UserRole
from app.plugins.branding.models import BrandingConfig

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
ADMIN_DATA = {"email": "admin@shop.com", "password": "Admin1234!", "first_name": "Admin", "last_name": "User"}
CUSTOMER_DATA = {"email": "cust@shop.com", "password": "Cust1234!", "first_name": "Cust", "last_name": "User"}


async def make_admin_token(client: AsyncClient, db) -> str:
    await client.post(REGISTER_URL, json=ADMIN_DATA)
    await db.execute(update(User).where(User.email == ADMIN_DATA["email"]).values(role=UserRole.admin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": ADMIN_DATA["email"], "password": ADMIN_DATA["password"]})
    return r.json()["access_token"]


async def make_product_and_cart(client: AsyncClient, admin_token: str, cust_token: str) -> str:
    cat = await client.post("/api/categories", json={"name": "Widgets"},
                            headers={"Authorization": f"Bearer {admin_token}"})
    prod = await client.post("/api/products", json={"name": "Widget A", "price": "9.99", "stock_quantity": 50,
                                                     "category_id": cat.json()["id"]},
                             headers={"Authorization": f"Bearer {admin_token}"})
    product_id = prod.json()["id"]
    # Get default variant for this product
    variants_r = await client.get(f"/api/products/{product_id}/variants",
                                   headers={"Authorization": f"Bearer {admin_token}"})
    variants = variants_r.json()
    variant_id = next((v["id"] for v in variants if v["is_default"]), variants[0]["id"])
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1},
                      headers={"Authorization": f"Bearer {cust_token}"})
    return product_id


async def setup_branding_contact(db, contact_email: str):
    db.add(BrandingConfig(
        store_name="Test Shop",
        contact_email=contact_email,
    ))
    await db.flush()


@pytest.mark.asyncio
async def test_admin_email_sent_on_order(client: AsyncClient, db):
    admin_token = await make_admin_token(client, db)
    r = await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    cust_token = r.json()["access_token"]

    await setup_branding_contact(db, "admin@shop.com")
    await make_product_and_cart(client, admin_token, cust_token)

    sent_to = []

    async def mock_send_email(recipient, subject, body, session=None):
        sent_to.append(recipient)
        return True

    with patch("app.plugins.checkout.service.send_email", side_effect=mock_send_email):
        resp = await client.post("/api/checkout",
                                 json={"payment_method": "cash", "use_cart": True},
                                 headers={"Authorization": f"Bearer {cust_token}"})

    assert resp.status_code == 201
    assert "cust@shop.com" in sent_to, "Customer confirmation email not sent"
    assert "admin@shop.com" in sent_to, "Admin notification email not sent"


@pytest.mark.asyncio
async def test_admin_email_not_sent_when_no_contact_email(client: AsyncClient, db):
    admin_token = await make_admin_token(client, db)
    r = await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    cust_token = r.json()["access_token"]

    # No branding record -> no admin email, no crash
    await make_product_and_cart(client, admin_token, cust_token)

    sent_to = []

    async def mock_send_email(recipient, subject, body, session=None):
        sent_to.append(recipient)
        return True

    with patch("app.plugins.checkout.service.send_email", side_effect=mock_send_email):
        resp = await client.post("/api/checkout",
                                 json={"payment_method": "cash", "use_cart": True},
                                 headers={"Authorization": f"Bearer {cust_token}"})

    assert resp.status_code == 201
    # Only customer email (no admin_email configured)
    assert all("cust@" in addr or "admin@" not in addr for addr in sent_to)


@pytest.mark.asyncio
async def test_smtp_failure_does_not_block_order(client: AsyncClient, db):
    admin_token = await make_admin_token(client, db)
    r = await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    cust_token = r.json()["access_token"]

    await setup_branding_contact(db, "admin@shop.com")
    await make_product_and_cart(client, admin_token, cust_token)

    async def failing_send_email(recipient, subject, body, session=None):
        raise ConnectionRefusedError("SMTP server not available")

    with patch("app.plugins.checkout.service.send_email", side_effect=failing_send_email):
        resp = await client.post("/api/checkout",
                                 json={"payment_method": "cash", "use_cart": True},
                                 headers={"Authorization": f"Bearer {cust_token}"})

    # Order must complete even when email fails
    assert resp.status_code == 201
    assert resp.json()["order_number"].startswith("CF-")


@pytest.mark.asyncio
async def test_guest_checkout_sends_admin_notification(client: AsyncClient, db):
    admin_token = await make_admin_token(client, db)
    await setup_branding_contact(db, "admin@shop.com")

    cat = await client.post("/api/categories", json={"name": "Widgets"},
                            headers={"Authorization": f"Bearer {admin_token}"})
    prod = await client.post("/api/products", json={"name": "Widget B", "price": "5.00", "stock_quantity": 20,
                                                     "category_id": cat.json()["id"]},
                             headers={"Authorization": f"Bearer {admin_token}"})

    sent_subjects = {}

    async def mock_send_email(recipient, subject, body, session=None):
        sent_subjects[recipient] = subject
        return True

    with patch("app.plugins.checkout.service.send_email", side_effect=mock_send_email):
        resp = await client.post("/api/checkout", json={
            "payment_method": "cash",
            "guest_email": "guest@buyer.com",
            "use_cart": False,
            "items": [{"product_id": prod.json()["id"], "quantity": 1}],
        })

    assert resp.status_code == 201
    assert "guest@buyer.com" in sent_subjects
    assert "admin@shop.com" in sent_subjects
    assert "New order" in sent_subjects["admin@shop.com"]
