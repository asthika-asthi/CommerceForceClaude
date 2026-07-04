"""B2 — explicit-items checkout must be variant-aware.

The `data.items` checkout path (used when not checking out the cart) previously priced
at the product base price and recorded no variant_id, unlike the cart path which adds the
variant's price_adjustment and records the variant. This makes variant products checked
out via `items` undercharged and untraceable.
"""
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy import select

from app.plugins.products.models import ProductVariant
from app.plugins.orders.models import OrderItem

from tests.test_commerce import make_admin


async def _make_product(client: AsyncClient, token: str, name: str, price: str = "20.00", stock: int = 10) -> str:
    r = await client.post(
        "/api/products",
        json={"name": name, "price": price, "stock_quantity": stock},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()["id"]


async def _default_variant(db, product_id: str) -> ProductVariant:
    return (await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product_id, ProductVariant.is_default == True
        )
    )).scalar_one()


async def test_explicit_checkout_records_variant_id(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "VarID Widget", stock=5)

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
    })
    assert r.status_code == 201, r.text
    order_id = r.json()["order_id"]

    default_variant = await _default_variant(db, product_id)
    item = (await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))).scalar_one()
    assert item.variant_id == default_variant.id, "explicit checkout must record the default variant"


async def test_explicit_checkout_applies_variant_price_adjustment(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Adj Widget", price="20.00", stock=10)

    variant = await _default_variant(db, product_id)
    variant.price_adjustment = Decimal("5.00")
    await db.flush()

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "quantity": 2}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
    })
    assert r.status_code == 201, r.text
    # unit price must be 20 + 5 = 25 → subtotal 50, not the base 40.
    assert float(r.json()["subtotal"]) == 50.0


async def test_explicit_checkout_honors_explicit_variant_id(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    product_id = await _make_product(client, admin_token, "Explicit Var Widget", stock=10)
    variant = await _default_variant(db, product_id)

    r = await client.post("/api/checkout", json={
        "use_cart": False,
        "items": [{"product_id": product_id, "variant_id": variant.id, "quantity": 1}],
        "payment_method": "cash",
        "guest_email": "g@example.com",
        "shipping_address": "1 Test St",
    })
    assert r.status_code == 201, r.text
    order_id = r.json()["order_id"]
    item = (await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))).scalar_one()
    assert item.variant_id == variant.id
