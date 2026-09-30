"""Order-value delivery bands: admin-managed, chosen on goods after discounts (ex VAT),
identical in the checkout preview and the charge actually applied to the order."""
from decimal import Decimal

from httpx import AsyncClient

from app.plugins.shipping import service as shipping_service
from tests.test_commerce import make_admin

GUEST = {
    "payment_method": "cash",
    "guest_email": "g@example.com",
    "guest_name": "Test Guest",
    "guest_postcode": "SW1A 1AA",
    "shipping_address": "1 Test St",
}
BANDS = {"bands": [
    {"min_order_value": "0", "charge": "9.95"},
    {"min_order_value": "250", "charge": "4.95"},
    {"min_order_value": "500", "charge": "0"},
]}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _setup(client: AsyncClient, db) -> str:
    token = await make_admin(client, db)
    r = await client.post("/api/shipping/zones", json={
        "name": "UK", "countries": "GB", "flat_rate": 99, "is_active": True,
    }, headers=_auth(token))
    assert r.status_code == 201, r.text
    r = await client.put("/api/shipping/bands", json=BANDS, headers=_auth(token))
    assert r.status_code == 200, r.text
    return token


async def _product(client: AsyncClient, token: str, price: str) -> str:
    r = await client.post("/api/products", json={"name": f"P{price}", "price": price, "stock_quantity": 50},
                          headers=_auth(token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _checkout(client: AsyncClient, product_id: str, qty: int = 1, **extra) -> dict:
    r = await client.post("/api/checkout", json={
        **GUEST, "use_cart": False, "delivery_country": "GB",
        "items": [{"product_id": product_id, "quantity": qty}], **extra,
    })
    assert r.status_code == 201, r.text
    return r.json()


async def test_band_boundaries(client: AsyncClient, db):
    await _setup(client, db)
    bands = await shipping_service.list_bands(db)
    charge = lambda v: shipping_service.band_for(Decimal(v), bands).charge  # noqa: E731
    assert charge("0") == Decimal("9.95")
    assert charge("249.99") == Decimal("9.95")
    assert charge("250") == Decimal("4.95")
    assert charge("499.99") == Decimal("4.95")
    assert charge("500") == Decimal("0")
    assert charge("5000") == Decimal("0")


async def test_bands_public_read_admin_only_write(client: AsyncClient, db):
    token = await _setup(client, db)
    r = await client.get("/api/shipping/bands")  # public
    assert r.status_code == 200, r.text
    body = r.json()
    assert [Decimal(b["min_order_value"]) for b in body["bands"]] == [0, 250, 500]
    assert Decimal(body["free_threshold"]) == Decimal("500")
    assert body["currency"]

    r = await client.put("/api/shipping/bands", json=BANDS)
    assert r.status_code in (401, 403)
    r = await client.put("/api/shipping/bands", json=BANDS, headers=_auth(token))
    assert r.status_code == 200


async def test_band_validation(client: AsyncClient, db):
    token = await _setup(client, db)
    put = lambda bands: client.put("/api/shipping/bands", json={"bands": bands}, headers=_auth(token))  # noqa: E731
    assert (await put([{"min_order_value": "10", "charge": "5"}])).status_code == 422  # no £0 band
    assert (await put([{"min_order_value": "0", "charge": "5"},
                       {"min_order_value": "0", "charge": "3"}])).status_code == 422  # duplicate min
    assert (await put([{"min_order_value": "0", "charge": "-1"}])).status_code == 422  # negative charge
    assert (await put([])).status_code == 422  # empty
    # A rejected update leaves the previous bands untouched.
    assert len((await client.get("/api/shipping/bands")).json()["bands"]) == 3


async def test_checkout_charges_the_band(client: AsyncClient, db):
    token = await _setup(client, db)
    cheap = await _product(client, token, "100.00")
    mid = await _product(client, token, "300.00")
    big = await _product(client, token, "600.00")

    assert Decimal((await _checkout(client, cheap))["shipping_cost"]) == Decimal("9.95")
    assert Decimal((await _checkout(client, mid))["shipping_cost"]) == Decimal("4.95")
    free = await _checkout(client, big)
    assert Decimal(free["shipping_cost"]) == Decimal("0")
    assert Decimal(free["total"]) == Decimal(free["subtotal"]) - Decimal(free["discount_amount"]) + Decimal(free["tax_amount"])


async def test_quote_matches_charge_and_reports_next_band(client: AsyncClient, db):
    token = await _setup(client, db)
    pid = await _product(client, token, "300.00")
    r = await client.post("/api/cart/items", json={"product_id": pid, "quantity": 1})
    assert r.status_code == 200, r.text

    r = await client.post("/api/checkout/shipping-quote", json={"delivery_country": "GB"})
    assert r.status_code == 200, r.text
    q = r.json()
    assert Decimal(q["cost"]) == Decimal("4.95")
    assert Decimal(q["order_value"]) == Decimal("300")
    assert Decimal(q["next_threshold"]) == Decimal("500")
    assert Decimal(q["amount_to_next_band"]) == Decimal("200")


async def test_discount_can_drop_order_into_a_costlier_band(client: AsyncClient, db):
    token = await _setup(client, db)
    pid = await _product(client, token, "520.00")
    r = await client.post("/api/coupons", json={
        "code": "TAKE50", "name": "Take 50", "discount_type": "fixed", "discount_value": "50", "is_active": True,
    }, headers=_auth(token))
    assert r.status_code in (200, 201), r.text

    # £520 qualifies for free delivery; £470 after the coupon does not.
    assert Decimal((await _checkout(client, pid))["shipping_cost"]) == Decimal("0")
    summary = await _checkout(client, pid, coupon_code="TAKE50")
    assert Decimal(summary["shipping_cost"]) == Decimal("4.95")

    # The preview agrees with the charge, and a bad coupon is ignored, not an error.
    await client.post("/api/cart/items", json={"product_id": pid, "quantity": 1})
    r = await client.post("/api/checkout/shipping-quote", json={"delivery_country": "GB", "coupon_code": "TAKE50"})
    assert Decimal(r.json()["cost"]) == Decimal("4.95")
    r = await client.post("/api/checkout/shipping-quote", json={"delivery_country": "GB", "coupon_code": "NOPE"})
    assert r.status_code == 200 and Decimal(r.json()["cost"]) == Decimal("0")


async def test_no_zone_means_no_charge(client: AsyncClient, db):
    token = await _setup(client, db)
    pid = await _product(client, token, "100.00")
    r = await client.post("/api/checkout", json={
        **GUEST, "use_cart": False, "delivery_country": "FR",
        "items": [{"product_id": pid, "quantity": 1}],
    })
    assert r.status_code == 201, r.text
    assert Decimal(r.json()["shipping_cost"]) == Decimal("0")
