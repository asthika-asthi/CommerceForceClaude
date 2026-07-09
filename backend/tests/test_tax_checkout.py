"""Tax/VAT must flow from the tax plugin into the order total at checkout."""
from httpx import AsyncClient

from tests.test_commerce import make_admin


async def _admin_token(client: AsyncClient, db) -> str:
    return await make_admin(client, db)


async def _create_zone(client: AsyncClient, token: str, countries: str, rate_percent: float) -> dict:
    r = await client.post("/api/tax/zones", json={
        "name": f"Zone-{countries}", "countries": countries, "rate_percent": rate_percent, "is_active": True,
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201
    return r.json()


async def _make_product(client: AsyncClient, token: str, name: str, price: str = "100.00", stock: int = 10) -> str:
    r = await client.post(
        "/api/products",
        json={"name": name, "price": price, "stock_quantity": stock},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()["id"]


async def test_checkout_applies_tax_for_matching_country(client: AsyncClient, db):
    admin_token = await _admin_token(client, db)
    await _create_zone(client, admin_token, "GB", 20.00)
    product_id = await _make_product(client, admin_token, "VAT Widget", price="100.00")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
        "delivery_country": "GB",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert float(body["subtotal"]) == 100.0
    assert float(body["tax_amount"]) == 20.0
    assert float(body["total"]) == 120.0


async def test_checkout_no_delivery_country_means_no_tax(client: AsyncClient, db):
    admin_token = await _admin_token(client, db)
    await _create_zone(client, admin_token, "GB", 20.00)
    product_id = await _make_product(client, admin_token, "No Country Widget", price="50.00")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert float(body["tax_amount"]) == 0.0
    assert float(body["total"]) == 50.0


async def test_checkout_country_with_no_zone_means_no_tax(client: AsyncClient, db):
    admin_token = await _admin_token(client, db)
    await _create_zone(client, admin_token, "GB", 20.00)
    product_id = await _make_product(client, admin_token, "US Widget", price="50.00")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
        "delivery_country": "US",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert float(body["tax_amount"]) == 0.0
    assert float(body["total"]) == 50.0


async def test_order_detail_exposes_tax_and_shipping(client: AsyncClient, db):
    """Regression: OrderOut previously omitted shipping_cost entirely, so the
    admin/storefront order-detail pages could never display it."""
    admin_token = await _admin_token(client, db)
    await _create_zone(client, admin_token, "GB", 20.00)
    await client.post("/api/shipping/zones", json={
        "name": "UK", "countries": "GB", "flat_rate": 5.00, "is_active": True,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    product_id = await _make_product(client, admin_token, "Detail Widget", price="100.00")

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
        "delivery_country": "GB",
    })
    assert r.status_code == 201, r.text
    order_id = r.json()["order_id"]

    detail = await client.get(f"/api/orders/{order_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert float(body["tax_amount"]) == 20.0
    assert float(body["shipping_cost"]) == 5.0
    assert float(body["total"]) == 125.0


async def test_tax_computed_on_discounted_subtotal(client: AsyncClient, db):
    """Tax base is subtotal minus discount, not the raw subtotal."""
    admin_token = await _admin_token(client, db)
    await _create_zone(client, admin_token, "GB", 20.00)
    product_id = await _make_product(client, admin_token, "Discounted Widget", price="100.00")

    coupon = await client.post("/api/coupons", json={
        "code": "TENOFF", "name": "Ten Off", "discount_type": "fixed", "discount_value": 10, "is_active": True,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert coupon.status_code == 201, coupon.text

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
        "delivery_country": "GB",
        "coupon_code": "TENOFF",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    # subtotal 100, discount 10 -> taxable 90 -> tax 18.00 -> total 100-10+18 = 108
    assert float(body["discount_amount"]) == 10.0
    assert float(body["tax_amount"]) == 18.0
    assert float(body["total"]) == 108.0
