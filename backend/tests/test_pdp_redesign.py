"""Product-page redesign — product short_description/specifications, branding
legal + delivery fields, and the category ancestor-path endpoint."""
from httpx import AsyncClient

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

ADMIN_DATA = {"email": "pdp_admin@example.com", "password": "adminpass1", "first_name": "Admin", "last_name": "Pdp"}
CUSTOMER_DATA = {"email": "pdp_cust@example.com", "password": "custpass1", "first_name": "Cust", "last_name": "Pdp"}


async def make_superadmin(client: AsyncClient, db) -> str:
    # Branding writes are superadmin-only; every other endpoint this file hits
    # (products, categories, reviews) accepts a superadmin too.
    await client.post(REGISTER_URL, json=ADMIN_DATA)
    from sqlalchemy import update
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == ADMIN_DATA["email"]).values(role=UserRole.superadmin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": ADMIN_DATA["email"], "password": ADMIN_DATA["password"]})
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Product short_description + specifications ────────────────────────────────

async def test_product_short_description_and_specifications_roundtrip(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    payload = {
        "name": "Heavy Duty Dust Sheet",
        "price": "9.84",
        "stock_quantity": 5,
        "short_description": "- Pack of 1, 3, 5 & 10\n- Extra thick weave",
        "specifications": [
            {"label": "Material", "value": "Heavy duty woven cotton"},
            {"label": "Size", "value": "12ft x 9ft"},
            {"label": "  ", "value": "  "},  # blank row — dropped on save
        ],
    }
    r = await client.post("/api/products", json=payload, headers=_auth(token))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["short_description"] == "- Pack of 1, 3, 5 & 10\n- Extra thick weave"
    assert body["specifications"] == [
        {"label": "Material", "value": "Heavy duty woven cotton"},
        {"label": "Size", "value": "12ft x 9ft"},
    ]

    slug = body["slug"]
    r = await client.get(f"/api/products/by-slug/{slug}")
    assert r.status_code == 200
    got = r.json()
    assert got["short_description"] == payload["short_description"]
    assert len(got["specifications"]) == 2

    # Update replaces the list and can clear the short description
    r = await client.put(
        f"/api/products/{body['id']}",
        json={"short_description": "", "specifications": [{"label": "Weight", "value": "2.1 kg"}]},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    updated = r.json()
    assert (updated["short_description"] or "") == ""
    assert updated["specifications"] == [{"label": "Weight", "value": "2.1 kg"}]


async def test_product_specifications_default_empty(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    r = await client.post(
        "/api/products", json={"name": "Plain Product", "price": "1.00"}, headers=_auth(token)
    )
    assert r.status_code == 201, r.text
    assert r.json()["specifications"] == []
    assert r.json()["short_description"] is None


# ── Branding legal + delivery fields ────────────────────────────────────────

async def test_branding_legal_and_delivery_fields_roundtrip(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    r = await client.put(
        "/api/branding",
        json={
            "company_number": "4608774",
            "vat_number": "GB 811 6522 57",
            "eori_number": "XI811652257000",
            "trademark_number": "UK00003457950",
            "delivery_promo_text": "Free Delivery | Express Delivery Available",
            "dispatch_days": 1,
            "transit_days_min": 2,
            "transit_days_max": 4,
        },
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["company_number"] == "4608774"
    assert body["vat_number"] == "GB 811 6522 57"
    assert body["eori_number"] == "XI811652257000"
    assert body["trademark_number"] == "UK00003457950"
    assert body["delivery_promo_text"] == "Free Delivery | Express Delivery Available"
    assert body["dispatch_days"] == 1
    assert body["transit_days_min"] == 2
    assert body["transit_days_max"] == 4

    # Public GET exposes them too
    r = await client.get("/api/branding")
    assert r.json()["dispatch_days"] == 1


async def test_branding_rejects_transit_min_greater_than_max(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    r = await client.put(
        "/api/branding",
        json={"transit_days_min": 5, "transit_days_max": 2},
        headers=_auth(token),
    )
    assert r.status_code == 422, r.text


async def test_branding_rejects_negative_delivery_days(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    r = await client.put(
        "/api/branding", json={"dispatch_days": -1}, headers=_auth(token)
    )
    assert r.status_code == 422, r.text


async def test_branding_show_store_name_defaults_true_and_toggles(client: AsyncClient, db):
    token = await make_superadmin(client, db)

    r = await client.get("/api/branding")
    assert r.json()["show_store_name"] is True  # default

    r = await client.put("/api/branding", json={"show_store_name": False}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["show_store_name"] is False

    # Public GET reflects it, and an unrelated update leaves it alone
    assert (await client.get("/api/branding")).json()["show_store_name"] is False
    await client.put("/api/branding", json={"tagline": "x"}, headers=_auth(token))
    assert (await client.get("/api/branding")).json()["show_store_name"] is False


async def test_branding_enable_cash_on_delivery_defaults_true_and_toggles(client: AsyncClient, db):
    token = await make_superadmin(client, db)

    assert (await client.get("/api/branding")).json()["enable_cash_on_delivery"] is True

    r = await client.put("/api/branding", json={"enable_cash_on_delivery": False}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["enable_cash_on_delivery"] is False
    assert (await client.get("/api/branding")).json()["enable_cash_on_delivery"] is False


async def test_checkout_rejects_cash_when_disabled(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    await client.put("/api/branding", json={"enable_cash_on_delivery": False}, headers=_auth(token))

    prod = await client.post(
        "/api/products", json={"name": "COD Widget", "price": "12.00", "stock_quantity": 3},
        headers=_auth(token),
    )
    detail = await client.get(f"/api/products/{prod.json()['id']}")
    variant_id = next(v["id"] for v in detail.json()["variants"] if v["is_default"])
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1}, headers=_auth(token))

    r = await client.post(
        "/api/checkout",
        json={"use_cart": True, "payment_method": "cash", "shipping_address": "1 Test St\nLondon\nAB1 2CD\nGB"},
        headers=_auth(token),
    )
    assert r.status_code == 503, r.text
    assert "cash" in r.json()["detail"].lower()


# ── Category ancestor-path endpoint ─────────────────────────────────────────

async def test_category_path_returns_root_to_leaf(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    root = await client.post("/api/categories", json={"name": "Cotton Dust Sheets"}, headers=_auth(token))
    root_id = root.json()["id"]
    mid = await client.post(
        "/api/categories", json={"name": "Heavy Duty Dust Sheets", "parent_id": root_id}, headers=_auth(token)
    )
    mid_id = mid.json()["id"]
    leaf = await client.post(
        "/api/categories", json={"name": "Heavy Duty Dust Sheets 12ft x 9ft", "parent_id": mid_id}, headers=_auth(token)
    )
    leaf_id = leaf.json()["id"]

    r = await client.get(f"/api/categories/{leaf_id}/path")
    assert r.status_code == 200, r.text
    trail = r.json()
    assert [c["id"] for c in trail] == [root_id, mid_id, leaf_id]
    assert [c["name"] for c in trail] == [
        "Cotton Dust Sheets",
        "Heavy Duty Dust Sheets",
        "Heavy Duty Dust Sheets 12ft x 9ft",
    ]


async def test_category_path_root_is_single_item(client: AsyncClient, db):
    token = await make_superadmin(client, db)
    root = await client.post("/api/categories", json={"name": "Standalone"}, headers=_auth(token))
    root_id = root.json()["id"]
    r = await client.get(f"/api/categories/{root_id}/path")
    assert r.status_code == 200
    assert [c["id"] for c in r.json()] == [root_id]


async def test_category_path_unknown_id_is_404(client: AsyncClient, db):
    r = await client.get("/api/categories/does-not-exist/path")
    assert r.status_code == 404


# ── Regression: reviews list must serialise reviews whose author was deleted ──

async def test_reviews_list_serialises_null_user_id(client: AsyncClient, db):
    """A GDPR-deleted author leaves user_id NULL; the storefront reviews list
    (response_model=list[ReviewOut]) must still serialise it, not 500."""
    token = await make_superadmin(client, db)
    prod = await client.post(
        "/api/products", json={"name": "Reviewed Widget", "price": "5.00", "stock_quantity": 1},
        headers=_auth(token),
    )
    product_id = prod.json()["id"]

    from app.plugins.reviews.models import Review
    db.add(Review(product_id=product_id, user_id=None, rating=5, title="Great", body="Loved it", is_approved=True))
    await db.flush()

    r = await client.get(f"/api/reviews?product_id={product_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 1
    assert body[0]["user_id"] is None
    assert body[0]["reviewer_name"] == "Former customer"
