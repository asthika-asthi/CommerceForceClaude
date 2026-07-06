"""BUG-1, BUG-2, BUG-3 — order-cancellation integrity and reset-password rate limit.

BUG-1: cancelling an UNPAID order (e.g. an abandoned Stripe checkout, whose stock
       deduction is deferred to the webhook) must NOT restore stock — it was never
       deducted, so restoring it inflates inventory and lets the store oversell.
BUG-2: a customer cancelling a PAID card order must trigger a Stripe refund, exactly
       like the admin path already does — otherwise the customer is never refunded.
BUG-3: /api/auth/forgot-password must be rate limited like login/register, so it can't
       be used to email-bomb an address or enumerate accounts by timing.
"""
from httpx import AsyncClient
from sqlalchemy import select

from app.plugins.auth.models import User
from app.plugins.orders import service as order_service
from app.plugins.orders.models import Order, OrderStatus, PaymentMethod, PaymentStatus
from app.plugins.products.models import Product

from tests.test_commerce import (
    make_admin,
    register_and_token,
    _create_product_and_variant,
    CUSTOMER_DATA,
)


async def _customer_id(db) -> str:
    user = (await db.execute(select(User).where(User.email == CUSTOMER_DATA["email"]))).scalar_one()
    return user.id


async def _product_stock(db, product_id: str) -> int:
    db.expire_all()
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    return product.stock_quantity


async def _make_order(
    db,
    *,
    user_id: str,
    product_id: str,
    payment_method: PaymentMethod,
    payment_status: PaymentStatus,
    qty: int = 1,
    stripe_pi: str | None = None,
) -> Order:
    """Create an order at the service layer (no stock deduction — mirrors a freshly
    created order before any paid-order effects are applied)."""
    order = await order_service.create_order(
        items=[{
            "product_id": product_id,
            "product_name": "Widget",
            "product_sku": "SKU-X",
            "unit_price": "10.00",
            "quantity": qty,
            "variant_id": None,
            "variant_label": None,
        }],
        payment_method=payment_method,
        db=db,
        user_id=user_id,
        shipping_address="1 Test St",
    )
    order.payment_status = payment_status
    if stripe_pi:
        order.stripe_payment_intent_id = stripe_pi
    await db.flush()
    return order


# ── BUG-1 — unpaid cancel must not restore stock ────────────────────────────────

async def test_cancel_unpaid_order_does_not_restore_stock(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await register_and_token(client, CUSTOMER_DATA)
    user_id = await _customer_id(db)
    product_id, _ = await _create_product_and_variant(client, admin_token, stock=10)

    # An unpaid Stripe order: stock was NOT deducted (deferred to the webhook).
    order = await _make_order(
        db, user_id=user_id, product_id=product_id,
        payment_method=PaymentMethod.stripe, payment_status=PaymentStatus.pending,
    )
    order_id = order.id  # capture before _product_stock expires the ORM object
    assert await _product_stock(db, product_id) == 10

    await order_service.cancel_order(order_id, user_id, db)

    # Stock must be unchanged — before the fix it was inflated to 11.
    assert await _product_stock(db, product_id) == 10


async def test_admin_cancel_unpaid_order_does_not_restore_stock(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await register_and_token(client, CUSTOMER_DATA)
    user_id = await _customer_id(db)
    product_id, _ = await _create_product_and_variant(client, admin_token, stock=10)

    order = await _make_order(
        db, user_id=user_id, product_id=product_id,
        payment_method=PaymentMethod.stripe, payment_status=PaymentStatus.pending,
    )
    order_id = order.id

    from app.plugins.orders.schemas import UpdateStatusRequest
    await order_service.update_status(order_id, UpdateStatusRequest(status=OrderStatus.cancelled), db)

    assert await _product_stock(db, product_id) == 10


# ── Paid orders still restore stock (guard didn't break the happy path) ──────────

async def test_cancel_paid_cash_order_restores_stock(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    product_id, variant_id = await _create_product_and_variant(client, admin_token, stock=10)

    cust_h = {"Authorization": f"Bearer {cust_token}"}
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 2}, headers=cust_h)
    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "shipping_address": "1 Test St"},
        headers=cust_h,
    )
    order_id = r.json()["order_id"]
    assert await _product_stock(db, product_id) == 8  # cash checkout deducted 2

    r = await client.post(f"/api/orders/{order_id}/cancel", headers=cust_h)
    assert r.status_code == 200
    assert await _product_stock(db, product_id) == 10  # restored


# ── BUG-2 — customer cancel of a paid card order refunds the card ────────────────

async def test_customer_cancel_paid_stripe_order_issues_refund(client: AsyncClient, db, monkeypatch):
    admin_token = await make_admin(client, db)
    await register_and_token(client, CUSTOMER_DATA)
    user_id = await _customer_id(db)
    product_id, _ = await _create_product_and_variant(client, admin_token, stock=10)

    refunds: list[str] = []

    async def _fake_refund(order):
        refunds.append(order.stripe_payment_intent_id)

    monkeypatch.setattr(order_service, "_issue_stripe_refund", _fake_refund)

    # A PAID card order (status confirmed, as the webhook would leave it).
    order = await _make_order(
        db, user_id=user_id, product_id=product_id,
        payment_method=PaymentMethod.stripe, payment_status=PaymentStatus.paid,
        stripe_pi="pi_test_123",
    )
    order.status = OrderStatus.confirmed
    await db.flush()

    await order_service.cancel_order(order.id, user_id, db)

    assert refunds == ["pi_test_123"], "customer cancel of a paid card order must refund it"


async def test_customer_cancel_unpaid_stripe_order_does_not_refund(client: AsyncClient, db, monkeypatch):
    admin_token = await make_admin(client, db)
    await register_and_token(client, CUSTOMER_DATA)
    user_id = await _customer_id(db)
    product_id, _ = await _create_product_and_variant(client, admin_token, stock=10)

    refunds: list[str] = []

    async def _fake_refund(order):
        refunds.append(order.stripe_payment_intent_id)

    monkeypatch.setattr(order_service, "_issue_stripe_refund", _fake_refund)

    # Unpaid card order — never captured money, so must NOT refund.
    order = await _make_order(
        db, user_id=user_id, product_id=product_id,
        payment_method=PaymentMethod.stripe, payment_status=PaymentStatus.pending,
        stripe_pi="pi_test_456",
    )

    await order_service.cancel_order(order.id, user_id, db)

    assert refunds == [], "an unpaid card order must not be refunded"


# ── BUG-3 — forgot-password is rate limited ─────────────────────────────────────

async def test_forgot_password_is_rate_limited(client: AsyncClient, db, reset_rate_limiter):
    # 3/minute — the 4th request in a window must be throttled with 429.
    statuses = []
    for _ in range(5):
        r = await client.post("/api/auth/forgot-password", json={"email": "someone@example.com"})
        statuses.append(r.status_code)

    assert 429 in statuses, f"forgot-password should be rate limited, got {statuses}"
    assert statuses[:3] == [204, 204, 204], f"first 3 should succeed, got {statuses}"
