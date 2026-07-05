"""Currency is driven by settings.CURRENCY_CODE (per-client at deploy)."""
import stripe as stripe_lib
from httpx import AsyncClient

from app.core.config import settings
from app.shared import currency
from app.plugins.checkout import service as checkout_service
from app.plugins.checkout.schemas import CheckoutRequest
from app.plugins.orders.models import PaymentMethod

from tests.test_commerce import make_admin


def test_format_money_follows_currency_code(monkeypatch):
    monkeypatch.setattr(settings, "CURRENCY_CODE", "USD")
    assert currency.currency_symbol() == "$"
    assert currency.format_money(12) == "$12.00"

    monkeypatch.setattr(settings, "CURRENCY_CODE", "INR")
    assert currency.format_money("5.5") == "₹5.50"

    monkeypatch.setattr(settings, "CURRENCY_CODE", "ZZZ")  # unknown code → "<CODE> "
    assert currency.format_money(1) == "ZZZ 1.00"


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
