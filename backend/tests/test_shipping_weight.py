"""Parcel weight: product weight, per-variant override, store default, and the
checkout → shipping hook that prices delivery on the cart's total weight."""
from decimal import Decimal

from httpx import AsyncClient

from app.plugins.shipping import service as shipping_service
from app.plugins.shipping.schemas import ShippingSettingsUpdate
from tests.test_commerce import make_admin

GUEST = {
    "payment_method": "cash",
    "guest_email": "g@example.com",
    "guest_name": "Test Guest",
    "guest_postcode": "SW1A 1AA",
    "shipping_address": "1 Test St",
}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _product(client: AsyncClient, token: str, name: str, weight: str | None) -> str:
    body = {"name": name, "price": "10.00", "stock_quantity": 50}
    if weight is not None:
        body["weight"] = weight
    r = await client.post("/api/products", json=body, headers=_auth(token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _default_variant(client: AsyncClient, product_id: str) -> dict:
    r = await client.get(f"/api/products/{product_id}/variants")
    assert r.status_code == 200, r.text
    return r.json()[0]


async def _setup(client: AsyncClient, db) -> tuple[str, str, str, str]:
    """GB zone at £5; default weight 2kg; products: 1.5kg, 1.5kg-with-4kg-variant, no weight."""
    token = await make_admin(client, db)
    r = await client.post("/api/shipping/zones", json={
        "name": "UK", "countries": "GB", "flat_rate": 5, "is_active": True,
    }, headers=_auth(token))
    assert r.status_code == 201, r.text
    r = await client.put("/api/shipping/bands", json={"bands": [
        {"min_order_value": "0", "charge": "5"},
    ]}, headers=_auth(token))
    assert r.status_code == 200, r.text
    r = await client.put("/api/shipping/settings", json={"default_weight_kg": "2"}, headers=_auth(token))
    assert r.status_code == 200, r.text

    plain = await _product(client, token, "Plain Sheet", "1.5")
    heavy = await _product(client, token, "Heavy Tarp", "1.5")
    variant = await _default_variant(client, heavy)
    r = await client.patch(
        f"/api/products/{heavy}/variants/{variant['id']}", json={"weight": "4"}, headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    unweighed = await _product(client, token, "Mystery Box", None)
    return token, plain, heavy, unweighed


async def test_variant_weight_round_trips_and_clears(client: AsyncClient, db):
    token = await make_admin(client, db)
    pid = await _product(client, token, "Tarp", "1.5")
    vid = (await _default_variant(client, pid))["id"]

    r = await client.patch(f"/api/products/{pid}/variants/{vid}", json={"weight": "3.25"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["weight"]) == Decimal("3.25")

    r = await client.patch(f"/api/products/{pid}/variants/{vid}", json={"weight": None}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["weight"] is None


async def test_negative_weights_rejected(client: AsyncClient, db):
    token = await make_admin(client, db)
    pid = await _product(client, token, "Tarp", "1")
    vid = (await _default_variant(client, pid))["id"]
    r = await client.patch(f"/api/products/{pid}/variants/{vid}", json={"weight": "-1"}, headers=_auth(token))
    assert r.status_code == 422
    r = await client.put(f"/api/products/{pid}", json={"weight": "-1"}, headers=_auth(token))
    assert r.status_code == 422
    r = await client.put("/api/shipping/settings", json={"default_weight_kg": "-1"}, headers=_auth(token))
    assert r.status_code == 422


async def test_parcel_weight_falls_back_to_default(db):
    await shipping_service.update_settings(
        ShippingSettingsUpdate(default_weight_kg=Decimal("0.5")), db,
    )
    total = await shipping_service.parcel_weight([(Decimal("1.2"), 2), (None, 3)], db)
    assert total == Decimal("3.900")


async def test_settings_default_and_admin_only(client: AsyncClient, db):
    token = await make_admin(client, db)
    r = await client.get("/api/shipping/settings", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["default_weight_kg"]) == Decimal("1")

    r = await client.put("/api/shipping/settings", json={"default_weight_kg": "3"})
    assert r.status_code in (401, 403)


async def test_checkout_records_parcel_weight(client: AsyncClient, db):
    _token, plain, heavy, unweighed = await _setup(client, db)
    r = await client.post("/api/checkout", json={
        **GUEST,
        "use_cart": False,
        "delivery_country": "GB",
        "items": [
            {"product_id": plain, "quantity": 2},      # 2 x 1.5 = 3
            {"product_id": heavy, "quantity": 1},      # variant override 4
            {"product_id": unweighed, "quantity": 1},  # default 2
        ],
    })
    assert r.status_code == 201, r.text
    assert Decimal(r.json()["shipping_cost"]) == Decimal("5")

    order = await client.get(f"/api/orders/{r.json()['order_id']}", headers=_auth(_token))
    assert order.status_code == 200, order.text
    assert Decimal(order.json()["total_weight_kg"]) == Decimal("9")


async def test_shipping_quote_for_guest_cart(client: AsyncClient, db):
    _token, plain, heavy, _ = await _setup(client, db)
    for pid, qty in ((plain, 1), (heavy, 2)):
        r = await client.post("/api/cart/items", json={"product_id": pid, "quantity": qty})
        assert r.status_code == 200, r.text

    r = await client.post("/api/checkout/shipping-quote", json={"delivery_country": "GB"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert Decimal(body["weight_kg"]) == Decimal("9.5")  # 1.5 + 2 x 4
    assert Decimal(body["cost"]) == Decimal("5")
    assert body["zone_name"] == "UK"

    # No country yet: weight is still reported, no charge.
    r = await client.post("/api/checkout/shipping-quote", json={})
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["cost"]) == Decimal("0")
    assert Decimal(r.json()["weight_kg"]) == Decimal("9.5")
