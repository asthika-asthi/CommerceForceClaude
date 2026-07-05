"""Currency is driven by settings.CURRENCY_CODE (set per client at deploy).

Covers: symbol lookup (default, all known codes, unknown fallback), format_money
formatting (int/float/string/zero/negative/rounding), the Stripe charge currency, and
that order-confirmation emails render the store currency symbol.
"""
import stripe as stripe_lib
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.shared import currency
from app.shared.email import EmailLog
from app.plugins.checkout import service as checkout_service
from app.plugins.checkout.schemas import CheckoutRequest
from app.plugins.orders.models import PaymentMethod

from tests.test_commerce import make_admin


# ── symbol lookup ───────────────────────────────────────────────────────────────

def test_currency_symbol_defaults_to_gbp():
    # Test env leaves CURRENCY_CODE at its default.
    assert settings.CURRENCY_CODE == "GBP"
    assert currency.currency_symbol() == "£"


def test_currency_symbol_for_all_known_codes(monkeypatch):
    expected = {
        "GBP": "£", "USD": "$", "EUR": "€", "INR": "₹",
        "AUD": "A$", "CAD": "C$", "AED": "د.إ", "SGD": "S$", "NZD": "NZ$",
    }
    for code, sym in expected.items():
        monkeypatch.setattr(settings, "CURRENCY_CODE", code)
        assert currency.currency_symbol() == sym


def test_currency_symbol_is_case_insensitive(monkeypatch):
    monkeypatch.setattr(settings, "CURRENCY_CODE", "usd")
    assert currency.currency_symbol() == "$"


def test_currency_symbol_unknown_code_falls_back_to_code(monkeypatch):
    monkeypatch.setattr(settings, "CURRENCY_CODE", "ZAR")
    assert currency.currency_symbol() == "ZAR "
    assert currency.format_money(10) == "ZAR 10.00"


# ── format_money ────────────────────────────────────────────────────────────────

def test_format_money_accepts_int_float_and_string(monkeypatch):
    monkeypatch.setattr(settings, "CURRENCY_CODE", "USD")
    assert currency.format_money(12) == "$12.00"
    assert currency.format_money(12.5) == "$12.50"
    assert currency.format_money("3.4") == "$3.40"


def test_format_money_zero_negative_and_rounding(monkeypatch):
    monkeypatch.setattr(settings, "CURRENCY_CODE", "GBP")
    assert currency.format_money(0) == "£0.00"
    assert currency.format_money(-5) == "£-5.00"
    assert currency.format_money(1.999) == "£2.00"      # rounds to 2dp
    assert currency.format_money("100") == "£100.00"


# ── Stripe charge currency ──────────────────────────────────────────────────────

async def test_stripe_charges_in_configured_currency(client: AsyncClient, db, monkeypatch):
    admin_token = await make_admin(client, db)
    p = await client.post(
        "/api/products", json={"name": "Cur Widget", "price": "20.00", "stock_quantity": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = p.json()["id"]

    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setattr(settings, "CURRENCY_CODE", "USD")

    captured: dict = {}

    class FakePI:
        id = "pi_cur"
        client_secret = "pi_cur_secret"

    def fake_create(**kw):
        captured.update(kw)
        return FakePI()

    monkeypatch.setattr(stripe_lib.PaymentIntent, "create", fake_create)

    data = CheckoutRequest(
        payment_method=PaymentMethod.stripe, use_cart=False,
        items=[{"product_id": product_id, "quantity": 1}], guest_email="g@example.com",
    )
    await checkout_service.checkout(data, db, user_id=None)
    assert captured.get("currency") == "usd"


# ── order emails render the store currency ──────────────────────────────────────

async def test_order_confirmation_email_uses_currency_symbol(client: AsyncClient, db, monkeypatch):
    monkeypatch.setattr(settings, "CURRENCY_CODE", "USD")
    admin_token = await make_admin(client, db)
    p = await client.post(
        "/api/products", json={"name": "Email Widget", "price": "20.00", "stock_quantity": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    product_id = p.json()["id"]

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "buyer@example.com",
        "shipping_address": "1 Test St",
    })
    assert r.status_code == 201, r.text

    logs = (await db.execute(select(EmailLog).where(EmailLog.recipient == "buyer@example.com"))).scalars().all()
    body = "\n".join(log.body for log in logs)
    assert "$" in body, "order email should use the configured currency symbol"
    assert "£" not in body, "order email must not fall back to the hardcoded £"
