import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


# ── helpers ──────────────────────────────────────────────────────────────────

_ADMIN_EMAIL = "admin@commerceforce.dev"
_ADMIN_PASSWORD = "Admin1234!"


async def _admin_token(client: AsyncClient, db: AsyncSession) -> str:
    """Register admin user, promote to admin role, return access token."""
    await client.post(
        "/api/auth/register",
        json={
            "email": _ADMIN_EMAIL,
            "password": _ADMIN_PASSWORD,
            "first_name": "Admin",
            "last_name": "User",
        },
    )
    from sqlalchemy import update
    from app.plugins.auth.models import User, UserRole
    await db.execute(
        update(User).where(User.email == _ADMIN_EMAIL).values(role=UserRole.admin)
    )
    await db.flush()
    r = await client.post("/api/auth/login", json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD})
    return r.json()["access_token"]


async def _make_product(client: AsyncClient, token: str) -> dict:
    r = await client.post(
        "/api/products",
        json={"name": "Test Shirt", "price": "19.99", "stock_quantity": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── option type CRUD ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_option_type(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Size"
    assert data["values"] == []


@pytest.mark.asyncio
async def test_add_option_value(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]

    r = await client.post(
        f"/api/products/{product['id']}/options/{opt_id}/values",
        json={"label": "M", "sort_order": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    assert r.json()["label"] == "M"


# ── variant generation ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_variants_single_axis(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    for label in ["S", "M", "L"]:
        await client.post(
            f"/api/products/{product['id']}/options/{opt_id}/values",
            json={"label": label},
            headers={"Authorization": f"Bearer {token}"},
        )

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 3
    labels = {v["label"] for v in variants}
    assert labels == {"Size: S", "Size: M", "Size: L"}


@pytest.mark.asyncio
async def test_generate_variants_two_axes(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    for axis_name, values in [("Size", ["S", "M"]), ("Colour", ["Red", "Blue"])]:
        opt_r = await client.post(
            f"/api/products/{product['id']}/options",
            json={"name": axis_name},
            headers={"Authorization": f"Bearer {token}"},
        )
        opt_id = opt_r.json()["id"]
        for label in values:
            await client.post(
                f"/api/products/{product['id']}/options/{opt_id}/values",
                json={"label": label},
                headers={"Authorization": f"Bearer {token}"},
            )

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 4  # S/Red, S/Blue, M/Red, M/Blue


@pytest.mark.asyncio
async def test_default_variant_exists_on_new_product(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    r = await client.get(f"/api/products/{product['id']}/variants")
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 1
    assert variants[0]["is_default"] is True


@pytest.mark.asyncio
async def test_update_variant_sku(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    variants_r = await client.get(f"/api/products/{product['id']}/variants")
    variant_id = variants_r.json()[0]["id"]

    r = await client.patch(
        f"/api/products/{product['id']}/variants/{variant_id}",
        json={"sku": "MYSKU-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["sku"] == "MYSKU-001"


@pytest.mark.asyncio
async def test_delete_option_type_deactivates_variants(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    await client.post(
        f"/api/products/{product['id']}/options/{opt_id}/values",
        json={"label": "M"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    del_r = await client.delete(
        f"/api/products/{product['id']}/options/{opt_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_r.status_code == 204

    variants_r = await client.get(f"/api/products/{product['id']}/variants")
    active = [v for v in variants_r.json() if v["is_active"]]
    assert len(active) == 0


# ── product detail includes variants ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_product_detail_includes_variants(client: AsyncClient, db: AsyncSession):
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    r = await client.get(f"/api/products/{product['id']}")
    assert r.status_code == 200
    data = r.json()
    assert "variants" in data
    assert len(data["variants"]) >= 1
    assert "option_types" in data


# ── product list exposes has_variants ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_product_list_has_variants_flag(client: AsyncClient, db: AsyncSession):
    """The /products list endpoint must expose has_variants so the storefront can
    tell simple products from multi-variant ones without a full product fetch —
    this is what product-card.tsx relies on to route quick-add correctly."""
    token = await _admin_token(client, db)

    simple = await _make_product(client, token)

    r = await client.post(
        "/api/products",
        json={"name": "Multi Variant Product", "price": "25.00", "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    multi = r.json()
    opt_r = await client.post(
        f"/api/products/{multi['id']}/options",
        json={"name": "Size", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    await client.post(
        f"/api/products/{multi['id']}/options/{opt_id}/values",
        json={"label": "M"},
        headers={"Authorization": f"Bearer {token}"},
    )

    r = await client.get("/api/products", params={"page_size": 50})
    assert r.status_code == 200
    items_by_id = {item["id"]: item for item in r.json()["items"]}

    assert items_by_id[simple["id"]]["has_variants"] is False
    assert items_by_id[multi["id"]]["has_variants"] is True


# ── price adjustment ──────────────────────────────────────────────────────────

async def _setup_product_with_adjusted_variant(
    client: AsyncClient, token: str
) -> tuple[dict, dict]:
    """Create a £20 product with a Size option, generate variants, set XL +£5. Returns (product, xl_variant)."""
    r = await client.post(
        "/api/products",
        json={"name": "Priced Shirt", "price": "20.00", "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    product = r.json()

    # Add Size option with S and XL values
    r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    opt = r.json()

    for label in ("S", "XL"):
        r = await client.post(
            f"/api/products/{product['id']}/options/{opt['id']}/values",
            json={"label": label, "sort_order": 0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201

    # Generate variants
    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    # Fetch variants and find XL
    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    variants = r.json()
    xl = next(v for v in variants if "XL" in v["label"])

    # Set XL price_adjustment = 5.00 and give it stock — generating variants starts
    # every variant at 0 stock (by design: no product-level number is carried over
    # or split), so tests using this fixture need stock set explicitly to be able
    # to add XL to cart / check out.
    r = await client.patch(
        f"/api/products/{product['id']}/variants/{xl['id']}",
        json={"price_adjustment": "5.00", "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["price_adjustment"] == "5.00"

    return product, xl


@pytest.mark.asyncio
async def test_variant_patch_price_adjustment(client: AsyncClient, db: AsyncSession):
    """PATCH variant sets and clears price_adjustment."""
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    # Get default variant
    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    variants = r.json()
    assert len(variants) >= 1
    variant_id = variants[0]["id"]

    # Set adjustment
    r = await client.patch(
        f"/api/products/{product['id']}/variants/{variant_id}",
        json={"price_adjustment": "3.50"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["price_adjustment"] == "3.50"

    # Clear adjustment
    r = await client.patch(
        f"/api/products/{product['id']}/variants/{variant_id}",
        json={"price_adjustment": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["price_adjustment"] is None


@pytest.mark.asyncio
async def test_cart_unit_price_uses_variant_adjustment(client: AsyncClient, db: AsyncSession):
    """Cart unit_price = product.effective_price + variant.price_adjustment."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    # Add XL to cart as guest
    r = await client.post(
        "/api/cart/items",
        json={"variant_id": xl["id"], "quantity": 1},
        headers={"X-Session-Id": "test-session-adj"},
    )
    assert r.status_code == 200
    cart = r.json()
    item = next(i for i in cart["items"] if i["variant_id"] == xl["id"])
    assert float(item["unit_price"]) == 25.00  # £20 + £5


@pytest.mark.asyncio
async def test_cart_unit_price_null_adjustment_uses_base(client: AsyncClient, db: AsyncSession):
    """Cart unit_price = product.effective_price when price_adjustment is null."""
    token = await _admin_token(client, db)

    r = await client.post(
        "/api/products",
        json={"name": "Plain Shirt", "price": "20.00", "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    product = r.json()
    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    default_variant = r.json()[0]

    r = await client.post(
        "/api/cart/items",
        json={"variant_id": default_variant["id"], "quantity": 1},
        headers={"X-Session-Id": "test-session-null-adj"},
    )
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert float(item["unit_price"]) == 20.00


@pytest.mark.asyncio
async def test_add_item_product_id_only_rejected_when_variants_exist(client: AsyncClient, db: AsyncSession):
    """product_id-only add-to-cart must not silently resolve to the default variant
    once the product has real option-linked variants — the customer never chose one."""
    token = await _admin_token(client, db)
    product, _xl = await _setup_product_with_adjusted_variant(client, token)

    r = await client.post(
        "/api/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers={"X-Session-Id": "test-session-ambiguous"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_add_item_explicit_ghost_variant_id_rejected(client: AsyncClient, db: AsyncSession):
    """A hand-crafted request that passes the default/no-option variant's id directly
    (bypassing the product_id-only guard) must still be rejected once the product has
    real option-linked variants — the ghost row is never a valid explicit choice.

    generate_variants() deactivates any pre-existing default variant, so under normal
    flows the ghost row here would already be caught by the is_active/404 check. To
    prove this new guard independently (and to cover legacy data from before this fix
    existed, where the ghost variant was reactivated by a since-blocked cart add), the
    ghost variant is flipped back to active directly via the DB, mirroring real broken
    data rather than a flow the API can still produce today."""
    token = await _admin_token(client, db)
    product, _xl = await _setup_product_with_adjusted_variant(client, token)

    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    ghost_variant = next(v for v in r.json() if v["is_default"])

    from sqlalchemy import update
    from app.plugins.products.models import ProductVariant
    await db.execute(
        update(ProductVariant).where(ProductVariant.id == ghost_variant["id"]).values(is_active=True)
    )
    await db.flush()

    r = await client.post(
        "/api/cart/items",
        json={"variant_id": ghost_variant["id"], "quantity": 1},
        headers={"X-Session-Id": "test-session-explicit-ghost"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_add_item_product_id_only_still_works_for_simple_product(client: AsyncClient, db: AsyncSession):
    """A product with no option types has only its default variant — product_id-only
    add-to-cart is unambiguous and must keep working."""
    token = await _admin_token(client, db)
    r = await client.post(
        "/api/products",
        json={"name": "Simple Product", "price": "10.00", "stock_quantity": 5},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    product = r.json()

    r = await client.post(
        "/api/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers={"X-Session-Id": "test-session-simple"},
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_update_variant_rejects_price_on_default_when_options_exist(client: AsyncClient, db: AsyncSession):
    """The auto-created default variant becomes a 'ghost' row once real option-linked
    variants exist — it must not be assignable a price adjustment."""
    token = await _admin_token(client, db)
    product, _xl = await _setup_product_with_adjusted_variant(client, token)

    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    default_variant = next(v for v in r.json() if v["is_default"])

    r = await client.patch(
        f"/api/products/{product['id']}/variants/{default_variant['id']}",
        json={"price_adjustment": "15.00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_checkout_order_item_uses_variant_adjustment(client: AsyncClient, db: AsyncSession):
    """Checkout order item unit_price = product.effective_price + variant.price_adjustment."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    # Register a customer
    r = await client.post(
        "/api/auth/register",
        json={"email": "buyer@test.com", "password": "Buyer1234!", "first_name": "B", "last_name": "U"},
    )
    r = await client.post("/api/auth/login", json={"email": "buyer@test.com", "password": "Buyer1234!"})
    customer_token = r.json()["access_token"]

    # Add XL to cart
    await client.post(
        "/api/cart/items",
        json={"variant_id": xl["id"], "quantity": 2},
        headers={"Authorization": f"Bearer {customer_token}"},
    )

    # Checkout
    r = await client.post(
        "/api/checkout",
        json={
            "use_cart": True,
            "payment_method": "cash",
            "shipping_address": "1 Test St",
        },
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 201
    order_id = r.json()["order_id"]

    # Fetch order and verify unit_price
    r = await client.get(f"/api/orders/{order_id}", headers={"Authorization": f"Bearer {customer_token}"})
    order = r.json()
    item = order["items"][0]
    assert float(item["unit_price"]) == 25.00  # £20 + £5
    assert float(item["subtotal"]) == 50.00    # 2 × £25


# ── per-variant stock ───────────────────────────────────────────────────────

async def _get_product(client: AsyncClient, token: str, product_id: str) -> dict:
    r = await client.get(f"/api/products/{product_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    return r.json()


async def _get_variants(client: AsyncClient, token: str, product_id: str) -> list[dict]:
    r = await client.get(f"/api/products/{product_id}/variants", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    return r.json()


async def _set_variant_stock(client: AsyncClient, token: str, product_id: str, variant_id: str, qty: int) -> dict:
    r = await client.patch(
        f"/api/products/{product_id}/variants/{variant_id}",
        json={"stock_quantity": qty},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_generate_variants_starts_stock_at_zero(client: AsyncClient, db: AsyncSession):
    """Generating variants must never split or carry over a pre-existing product-level
    stock number — new variants start at 0, and the product total (now a derived sum)
    reflects that."""
    token = await _admin_token(client, db)
    r = await client.post(
        "/api/products",
        json={"name": "Zero Start Widget", "price": "10.00", "stock_quantity": 11},
        headers={"Authorization": f"Bearer {token}"},
    )
    product = r.json()
    assert product["stock_quantity"] == 11

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    for label in ("S", "M"):
        await client.post(
            f"/api/products/{product['id']}/options/{opt_id}/values",
            json={"label": label},
            headers={"Authorization": f"Bearer {token}"},
        )

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    variants = r.json()
    assert all(v["stock_quantity"] == 0 for v in variants)

    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == 0, "old product-level stock must not be carried over or split"


@pytest.mark.asyncio
async def test_product_stock_equals_sum_of_variant_stock(client: AsyncClient, db: AsyncSession):
    """The sync invariant: product.stock_quantity == sum(active variant stock)."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)
    # Fixture already sets XL stock to 10; S starts at 0 (generate_variants default).
    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == 10

    variants = await _get_variants(client, token, product["id"])
    s_variant = next(v for v in variants if v["label"] == "Size: S")
    await _set_variant_stock(client, token, product["id"], s_variant["id"], 5)

    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == 15  # 5 (S) + 10 (XL)


@pytest.mark.asyncio
async def test_product_stock_excludes_deactivated_variant(client: AsyncClient, db: AsyncSession):
    """Deactivating a variant must drop it out of the product-level sum."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    variants = await _get_variants(client, token, product["id"])
    s_variant = next(v for v in variants if v["label"] == "Size: S")
    await _set_variant_stock(client, token, product["id"], s_variant["id"], 3)

    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == 13  # 3 (S) + 10 (XL)

    r = await client.patch(
        f"/api/products/{product['id']}/variants/{xl['id']}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == 3  # XL's 10 no longer counted


@pytest.mark.asyncio
async def test_patch_product_stock_ignored_when_real_variants_exist(client: AsyncClient, db: AsyncSession):
    """PATCH /api/products/{id} with stock_quantity must not drift the derived total —
    otherwise the API silently reintroduces the exact sync bug this feature closes."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)
    before = (await _get_product(client, token, product["id"]))["stock_quantity"]
    assert before == 10

    r = await client.put(
        f"/api/products/{product['id']}",
        json={"name": product["name"], "price": product["price"], "stock_quantity": 999},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == before, "stock_quantity must stay the derived sum, not 999"


@pytest.mark.asyncio
async def test_cart_409_uses_variant_stock_not_product_stock(client: AsyncClient, db: AsyncSession):
    """A variant with insufficient stock must 409 even though the product-level (summed)
    total would otherwise appear to cover the request — proves the variant's own number
    is what's actually enforced, not the roll-up."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    variants = await _get_variants(client, token, product["id"])
    s_variant = next(v for v in variants if v["label"] == "Size: S")
    await _set_variant_stock(client, token, product["id"], s_variant["id"], 5)
    # Product total is now 5 (S) + 10 (XL) = 15, comfortably enough for a qty=2 request —
    # but S itself only has 5, so requesting 6 of S specifically must still fail.

    r = await client.post(
        "/api/cart/items",
        json={"variant_id": s_variant["id"], "quantity": 6},
        headers={"X-Session-Id": "test-session-variant-stock-409"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_checkout_deducts_variant_stock(client: AsyncClient, db: AsyncSession):
    """Checkout must deduct from the variant's own stock, and the product-level total
    must reflect that (via recalculation), not an independent product-level deduction."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    r = await client.post(
        "/api/auth/register",
        json={"email": "stockbuyer@test.com", "password": "Buyer1234!", "first_name": "B", "last_name": "U"},
    )
    r = await client.post("/api/auth/login", json={"email": "stockbuyer@test.com", "password": "Buyer1234!"})
    customer_token = r.json()["access_token"]

    await client.post(
        "/api/cart/items",
        json={"variant_id": xl["id"], "quantity": 3},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "shipping_address": "1 Test St"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 201, r.text

    variants = await _get_variants(client, token, product["id"])
    xl_after = next(v for v in variants if v["id"] == xl["id"])
    assert xl_after["stock_quantity"] == 7  # 10 - 3

    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == 7  # S(0) + XL(7)


@pytest.mark.asyncio
async def test_order_cancellation_restores_variant_stock(client: AsyncClient, db: AsyncSession):
    """Cancelling a paid order must restore stock to the variant, not the product."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    r = await client.post(
        "/api/auth/register",
        json={"email": "cancelbuyer@test.com", "password": "Buyer1234!", "first_name": "B", "last_name": "U"},
    )
    r = await client.post("/api/auth/login", json={"email": "cancelbuyer@test.com", "password": "Buyer1234!"})
    customer_token = r.json()["access_token"]

    await client.post(
        "/api/cart/items",
        json={"variant_id": xl["id"], "quantity": 4},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "shipping_address": "1 Test St"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 201
    order_id = r.json()["order_id"]

    variants = await _get_variants(client, token, product["id"])
    xl_after_purchase = next(v for v in variants if v["id"] == xl["id"])
    assert xl_after_purchase["stock_quantity"] == 6  # 10 - 4

    r = await client.post(
        f"/api/orders/{order_id}/cancel",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 200, r.text

    variants = await _get_variants(client, token, product["id"])
    xl_after_cancel = next(v for v in variants if v["id"] == xl["id"])
    assert xl_after_cancel["stock_quantity"] == 10  # restored

    reloaded = await _get_product(client, token, product["id"])
    assert reloaded["stock_quantity"] == 10  # S(0) + XL(10)
