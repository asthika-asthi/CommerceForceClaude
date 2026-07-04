"""B1 — Stripe payments must not consume stock / coupon / loyalty until paid.

Cash and credit settle synchronously (effects applied at checkout). Stripe only creates
a PaymentIntent at checkout; the stock/coupon/loyalty effects are deferred to the
`payment_intent.succeeded` webhook, so an abandoned card checkout leaks nothing.

Stripe itself is mocked (the project has no Stripe test credentials).
"""
import stripe as stripe_lib
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.plugins.checkout import service as checkout_service
from app.plugins.checkout.schemas import CheckoutRequest
from app.plugins.orders.models import PaymentMethod, PaymentStatus
from app.plugins.products.models import Product
from app.plugins.coupons.models import Coupon

from tests.test_commerce import make_admin


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
