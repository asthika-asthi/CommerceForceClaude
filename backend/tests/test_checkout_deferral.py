"""B1 — Stripe payments must not consume stock / coupon / loyalty until paid.

Cash and credit settle synchronously (effects applied at checkout). Stripe only creates
a PaymentIntent at checkout; the stock/coupon/loyalty effects are deferred to the
`payment_intent.succeeded` webhook, so an abandoned card checkout leaks nothing.

Stripe itself is mocked (the project has no Stripe test credentials).
"""
import pytest
import stripe as stripe_lib
from fastapi import HTTPException
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.plugins.branding.models import BrandingConfig
from app.plugins.checkout import service as checkout_service
from app.plugins.checkout.schemas import CheckoutRequest
from app.plugins.orders import service as order_service
from app.plugins.orders.models import PaymentMethod, PaymentStatus
from app.plugins.products.models import Product
from app.plugins.coupons.models import Coupon

from tests.test_commerce import make_admin, register_and_token, _create_product_and_variant, CUSTOMER_DATA


async def _make_product(client: AsyncClient, token: str, name: str, stock: int) -> str:
    r = await client.post(
        "/api/products",
        json={"name": name, "price": "20.00", "stock_quantity": stock},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()["id"]


async def _make_coupon(client: AsyncClient, token: str, code: str) -> None:
    await client.post(
        "/api/coupons",
        json={"code": code, "name": code, "discount_type": "percentage", "discount_value": "10", "is_active": True},
        headers={"Authorization": f"Bearer {token}"},
    )


async def _setup_branding(db, **kwargs) -> None:
    db.add(BrandingConfig(store_name="Test Shop", **kwargs))
    await db.flush()


async def test_stripe_checkout_defers_effects_until_webhook(client: AsyncClient, db, monkeypatch):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Stripe Widget", stock=10)
    await _make_coupon(client, admin_token, "TENOFF")

    # Mock Stripe: configured keys + a fake PaymentIntent.
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_x")

    class FakePI:
        id = "pi_test_123"
        client_secret = "pi_test_123_secret"

    monkeypatch.setattr(stripe_lib.PaymentIntent, "create", lambda **kw: FakePI())

    data = CheckoutRequest(
        payment_method=PaymentMethod.stripe,
        use_cart=False,
        items=[{"product_id": product_id, "quantity": 2}],
        coupon_code="TENOFF",
        guest_email="buyer@example.com",
    )
    order, client_secret = await checkout_service.checkout(data, db, user_id=None)
    await db.flush()

    # Order exists and a PaymentIntent was created, but NOTHING is consumed yet.
    assert client_secret == "pi_test_123_secret"
    assert order.payment_status == PaymentStatus.pending
    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 10, "stock must not be deducted before payment"
    coupon = (await db.execute(select(Coupon).where(Coupon.code == "TENOFF"))).scalar_one()
    assert coupon.used_count == 0, "coupon must not be consumed before payment"

    # Now the payment succeeds — the webhook applies the deferred effects.
    event = {
        "type": "payment_intent.succeeded",
        "data": {"object": {
            "id": "pi_test_123",
            "metadata": {"order_id": order.id, "coupon_code": "TENOFF", "redeem_points": "0"},
        }},
    }
    monkeypatch.setattr(stripe_lib.Webhook, "construct_event", lambda payload, sig, secret: event)
    await checkout_service.handle_stripe_webhook(b"{}", "sig", db)
    await db.flush()

    assert order.payment_status == PaymentStatus.paid
    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 8, "stock deducted once payment succeeded"
    coupon = (await db.execute(select(Coupon).where(Coupon.code == "TENOFF"))).scalar_one()
    assert coupon.used_count == 1, "coupon usage recorded once payment succeeded"


async def test_stripe_webhook_is_idempotent(client: AsyncClient, db, monkeypatch):
    """A duplicate payment_intent.succeeded must not double-deduct stock."""
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Idem Widget", stock=10)

    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_x")

    class FakePI:
        id = "pi_idem"
        client_secret = "pi_idem_secret"

    monkeypatch.setattr(stripe_lib.PaymentIntent, "create", lambda **kw: FakePI())

    data = CheckoutRequest(
        payment_method=PaymentMethod.stripe, use_cart=False,
        items=[{"product_id": product_id, "quantity": 3}], guest_email="b@example.com",
    )
    order, _ = await checkout_service.checkout(data, db, user_id=None)
    await db.flush()

    event = {"type": "payment_intent.succeeded",
             "data": {"object": {"id": "pi_idem", "metadata": {"order_id": order.id, "redeem_points": "0"}}}}
    monkeypatch.setattr(stripe_lib.Webhook, "construct_event", lambda payload, sig, secret: event)

    await checkout_service.handle_stripe_webhook(b"{}", "sig", db)
    await checkout_service.handle_stripe_webhook(b"{}", "sig", db)  # duplicate delivery
    await db.flush()

    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 7, "duplicate webhook must not double-deduct"


async def test_cash_checkout_applies_effects_immediately(client: AsyncClient, db):
    """Regression: cash/credit still consume stock + coupon synchronously at checkout."""
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Cash Widget", stock=10)
    await _make_coupon(client, admin_token, "CASH10")

    data = CheckoutRequest(
        payment_method=PaymentMethod.cash, use_cart=False,
        items=[{"product_id": product_id, "quantity": 3}],
        coupon_code="CASH10", guest_email="cash@example.com",
    )
    order, _ = await checkout_service.checkout(data, db, user_id=None)
    await db.flush()

    assert order.payment_status == PaymentStatus.paid
    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 7
    coupon = (await db.execute(select(Coupon).where(Coupon.code == "CASH10"))).scalar_one()
    assert coupon.used_count == 1


async def test_bank_transfer_checkout_defers_effects_until_marked_paid(client: AsyncClient, db):
    """Bank transfer has no webhook — an admin's mark_paid() is the deferred trigger."""
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Bank Widget", stock=10)
    await _make_coupon(client, admin_token, "BANK10")
    await _setup_branding(db, bank_transfer_details="Acc: 12345678, Sort: 00-00-00")

    data = CheckoutRequest(
        payment_method=PaymentMethod.bank_transfer, use_cart=False,
        items=[{"product_id": product_id, "quantity": 2}],
        coupon_code="BANK10", guest_email="bank@example.com",
    )
    order, client_secret = await checkout_service.checkout(data, db, user_id=None)
    await db.flush()

    assert client_secret is None
    assert order.payment_status == PaymentStatus.pending
    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 10, "stock must not be deducted before manual confirmation"
    coupon = (await db.execute(select(Coupon).where(Coupon.code == "BANK10"))).scalar_one()
    assert coupon.used_count == 0, "coupon must not be consumed before manual confirmation"

    await order_service.mark_paid(order.id, db)
    await db.flush()

    assert order.payment_status == PaymentStatus.paid
    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 8, "stock deducted once marked paid"
    coupon = (await db.execute(select(Coupon).where(Coupon.code == "BANK10"))).scalar_one()
    assert coupon.used_count == 1, "coupon usage recorded once marked paid"


async def test_paypal_checkout_same_deferral(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "PayPal Widget", stock=5)
    await _setup_branding(db, paypal_email="pay@example.com")

    data = CheckoutRequest(
        payment_method=PaymentMethod.paypal, use_cart=False,
        items=[{"product_id": product_id, "quantity": 1}], guest_email="pp@example.com",
    )
    order, client_secret = await checkout_service.checkout(data, db, user_id=None)
    await db.flush()

    assert client_secret is None
    assert order.payment_status == PaymentStatus.pending

    await order_service.mark_paid(order.id, db)
    await db.flush()

    assert order.payment_status == PaymentStatus.paid
    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 4


async def test_mark_paid_is_idempotent(client: AsyncClient, db):
    """A duplicate 'mark as paid' click must not double-deduct stock."""
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Idem Bank Widget", stock=10)
    await _setup_branding(db, bank_transfer_details="Acc: 1")

    data = CheckoutRequest(
        payment_method=PaymentMethod.bank_transfer, use_cart=False,
        items=[{"product_id": product_id, "quantity": 3}], guest_email="idem@example.com",
    )
    order, _ = await checkout_service.checkout(data, db, user_id=None)
    await db.flush()

    await order_service.mark_paid(order.id, db)
    await db.flush()

    with pytest.raises(HTTPException) as exc_info:
        await order_service.mark_paid(order.id, db)
    assert exc_info.value.status_code == 409

    prod = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    assert prod.stock_quantity == 7, "duplicate mark_paid must not double-deduct"


async def test_mark_paid_rejects_wrong_payment_method(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Cash Reject Widget", stock=5)

    data = CheckoutRequest(
        payment_method=PaymentMethod.cash, use_cart=False,
        items=[{"product_id": product_id, "quantity": 1}], guest_email="cashreject@example.com",
    )
    order, _ = await checkout_service.checkout(data, db, user_id=None)
    await db.flush()

    with pytest.raises(HTTPException) as exc_info:
        await order_service.mark_paid(order.id, db)
    assert exc_info.value.status_code == 400


async def test_bank_transfer_checkout_503_when_not_configured(client: AsyncClient, db):
    """No BrandingConfig row (or one without bank_transfer_details) — checkout must refuse."""
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Unconfigured Widget", stock=5)

    data = CheckoutRequest(
        payment_method=PaymentMethod.bank_transfer, use_cart=False,
        items=[{"product_id": product_id, "quantity": 1}], guest_email="unconf@example.com",
    )
    with pytest.raises(HTTPException) as exc_info:
        await checkout_service.checkout(data, db, user_id=None)
    assert exc_info.value.status_code == 503


# ── HTTP-level tests — mark-paid endpoint + branding round-trip ────────────────

async def test_mark_paid_endpoint_via_http(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}
    r = await client.put(
        "/api/branding",
        json={"bank_transfer_details": "Acc: 12345678, Sort: 00-00-00"},
        headers=admin_h,
    )
    assert r.status_code == 200

    cust_token = await register_and_token(client, CUSTOMER_DATA)
    cust_h = {"Authorization": f"Bearer {cust_token}"}
    _, variant_id = await _create_product_and_variant(client, admin_token, stock=10)
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1}, headers=cust_h)

    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "bank_transfer", "shipping_address": "1 Test St"},
        headers=cust_h,
    )
    assert r.status_code == 201
    checkout_body = r.json()
    assert checkout_body["payment_status"] == "pending"
    order_id = checkout_body["order_id"]

    r = await client.post(f"/api/orders/{order_id}/mark-paid", headers=admin_h)
    assert r.status_code == 200
    body = r.json()
    assert body["payment_status"] == "paid"
    assert body["status"] == "confirmed"

    # Idempotent at the HTTP layer too — a second click gets a 409, not a silent 200.
    r = await client.post(f"/api/orders/{order_id}/mark-paid", headers=admin_h)
    assert r.status_code == 409


async def test_mark_paid_endpoint_requires_admin(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}
    await client.put("/api/branding", json={"paypal_email": "pay@example.com"}, headers=admin_h)

    cust_token = await register_and_token(client, CUSTOMER_DATA)
    cust_h = {"Authorization": f"Bearer {cust_token}"}
    _, variant_id = await _create_product_and_variant(client, admin_token, stock=5)
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1}, headers=cust_h)
    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "paypal", "shipping_address": "1 Test St"},
        headers=cust_h,
    )
    order_id = r.json()["order_id"]

    # A customer (non-admin) cannot mark their own order as paid.
    r = await client.post(f"/api/orders/{order_id}/mark-paid", headers=cust_h)
    assert r.status_code == 403


async def test_mark_paid_endpoint_rejects_non_manual_order(client: AsyncClient, db):
    """HTTP-level companion to test_mark_paid_rejects_wrong_payment_method (direct call)."""
    admin_token = await make_admin(client, db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    cust_h = {"Authorization": f"Bearer {cust_token}"}
    _, variant_id = await _create_product_and_variant(client, admin_token, stock=5)
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1}, headers=cust_h)
    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "shipping_address": "1 Test St"},
        headers=cust_h,
    )
    order_id = r.json()["order_id"]

    r = await client.post(f"/api/orders/{order_id}/mark-paid", headers=admin_h)
    assert r.status_code == 400


async def test_branding_round_trip_payment_fields(client: AsyncClient, db):
    """PUT then GET /api/branding — bank/PayPal fields persist through a real request cycle."""
    admin_token = await make_admin(client, db)
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    details = "Bank: Test Bank\nAccount name: Test Shop Ltd\nAccount number: 12345678\nSort code: 00-00-00"
    r = await client.put(
        "/api/branding",
        json={"bank_transfer_details": details, "paypal_email": "payments@teststore.com"},
        headers=admin_h,
    )
    assert r.status_code == 200
    assert r.json()["bank_transfer_details"] == details
    assert r.json()["paypal_email"] == "payments@teststore.com"

    # GET is public (no auth) — this is what the storefront checkout page reads.
    r = await client.get("/api/branding")
    assert r.status_code == 200
    assert r.json()["bank_transfer_details"] == details
    assert r.json()["paypal_email"] == "payments@teststore.com"


async def test_branding_put_requires_admin(client: AsyncClient, db):
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.put(
        "/api/branding",
        json={"bank_transfer_details": "should not be allowed"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403
