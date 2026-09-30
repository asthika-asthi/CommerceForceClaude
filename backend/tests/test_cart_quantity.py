"""Cart quantity limits: never below 1, and never above stock — including across
repeated adds of the same item (the storefront quantity box caps this client-side,
but the API is the authority)."""
from httpx import AsyncClient

from tests.test_commerce import make_admin


async def _product(client: AsyncClient, db, stock: int) -> str:
    token = await make_admin(client, db)
    r = await client.post(
        "/api/products",
        json={"name": "Stock Widget", "price": "10.00", "stock_quantity": stock},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _add(client: AsyncClient, product_id: str, quantity):
    return await client.post("/api/cart/items", json={"product_id": product_id, "quantity": quantity})


async def test_cannot_add_zero_negative_or_non_numeric(client: AsyncClient, db):
    pid = await _product(client, db, 10)
    assert (await _add(client, pid, 0)).status_code == 422
    assert (await _add(client, pid, -3)).status_code == 422
    assert (await _add(client, pid, "abc")).status_code == 422


async def test_cannot_add_more_than_stock_in_one_go(client: AsyncClient, db):
    pid = await _product(client, db, 10)
    r = await _add(client, pid, 11)
    assert r.status_code == 409, r.text
    assert (await _add(client, pid, 10)).status_code == 200


async def test_repeated_adds_cannot_exceed_stock(client: AsyncClient, db):
    """Regression: add_item only compared the new quantity to stock, so two adds of 6
    against stock 10 put 12 in the cart."""
    pid = await _product(client, db, 10)
    assert (await _add(client, pid, 6)).status_code == 200
    r = await _add(client, pid, 6)
    assert r.status_code == 409, r.text
    # Still allowed up to the remaining stock.
    assert (await _add(client, pid, 4)).status_code == 200
    cart = (await client.get("/api/cart")).json()
    assert [i["quantity"] for i in cart["items"]] == [10]
