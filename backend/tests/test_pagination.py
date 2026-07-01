"""Pagination integration tests — covers all 7 paginated admin list endpoints.

Uses page_size=2 with small data sets so pagination can be verified without
creating 20+ rows per test.  The response shape { items, total, page, page_size,
pages } must be consistent across every endpoint.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import update

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

_ADMIN_SEQ = 0


def _admin_data():
    global _ADMIN_SEQ
    _ADMIN_SEQ += 1
    return {
        "email": f"pagadmin{_ADMIN_SEQ}@example.com",
        "password": "AdminPass1!",
        "first_name": "Pag",
        "last_name": "Admin",
    }


async def _make_admin(client: AsyncClient, db) -> str:
    data = _admin_data()
    r = await client.post(REGISTER_URL, json=data)
    assert r.status_code == 201, r.text
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == data["email"]).values(role=UserRole.admin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": data["email"], "password": data["password"]})
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── PAGE SHAPE HELPER ─────────────────────────────────────────────────────────

def assert_page_shape(body: dict, *, page: int, page_size: int):
    """Assert the standard { items, total, page, page_size, pages } shape."""
    assert "items" in body, f"missing 'items': {body}"
    assert "total" in body, f"missing 'total': {body}"
    assert "page" in body, f"missing 'page': {body}"
    assert "page_size" in body, f"missing 'page_size': {body}"
    assert "pages" in body, f"missing 'pages': {body}"
    assert isinstance(body["items"], list)
    assert body["page"] == page
    assert body["page_size"] == page_size
    assert body["pages"] >= 1


# ── PRODUCTS ─────────────────────────────────────────────────────────────────

async def test_products_returns_page_shape(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await client.post("/api/products", json={"name": f"Widget {i}", "price": "9.99"}, headers=_auth(token))

    r = await client.get("/api/products?page=1&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert_page_shape(body, page=1, page_size=2)
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["pages"] == 2


async def test_products_page2_returns_remainder(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await client.post("/api/products", json={"name": f"Gadget {i}", "price": "5.00"}, headers=_auth(token))

    r = await client.get("/api/products?page=2&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 2
    assert len(body["items"]) == 1


async def test_products_search_filters(client: AsyncClient, db):
    token = await _make_admin(client, db)
    await client.post("/api/products", json={"name": "Blue Widget", "price": "9.99"}, headers=_auth(token))
    await client.post("/api/products", json={"name": "Red Gadget", "price": "9.99"}, headers=_auth(token))

    r = await client.get("/api/products?search=widget", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Blue Widget"


async def test_products_search_empty_result(client: AsyncClient, db):
    token = await _make_admin(client, db)
    await client.post("/api/products", json={"name": "Tarpaulin", "price": "50.00"}, headers=_auth(token))

    r = await client.get("/api/products?search=zzzznonexistent", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["items"] == []


async def test_products_page_size_capped_at_50(client: AsyncClient, db):
    token = await _make_admin(client, db)
    r = await client.get("/api/products?page_size=200", headers=_auth(token))
    # FastAPI rejects page_size > 50 with 422
    assert r.status_code == 422


# ── USERS ─────────────────────────────────────────────────────────────────────

async def test_users_returns_page_shape(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await client.post(REGISTER_URL, json={
            "email": f"user{i}@example.com", "password": "Pass1234!",
            "first_name": f"User{i}", "last_name": "Test",
        })

    r = await client.get("/api/auth/users?page=1&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert_page_shape(body, page=1, page_size=2)
    assert body["total"] >= 3
    assert len(body["items"]) == 2


async def test_users_page2(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await client.post(REGISTER_URL, json={
            "email": f"upaguser{i}@example.com", "password": "Pass1234!",
            "first_name": f"UPag{i}", "last_name": "Test",
        })

    # total is 4 (1 admin + 3 customers), page_size=2 → 2 pages
    r = await client.get("/api/auth/users?page=2&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 2
    assert len(body["items"]) >= 1


async def test_users_requires_admin(client: AsyncClient, db):
    cust = {"email": "cust_nonadmin@example.com", "password": "Pass1234!", "first_name": "C", "last_name": "T"}
    r = await client.post(REGISTER_URL, json=cust)
    token = r.json()["access_token"]
    r = await client.get("/api/auth/users", headers=_auth(token))
    assert r.status_code == 403


async def test_users_unauthenticated(client: AsyncClient):
    r = await client.get("/api/auth/users")
    assert r.status_code == 401


# ── NEWSLETTER ────────────────────────────────────────────────────────────────

async def _subscribe(client: AsyncClient, email: str):
    r = await client.post("/api/newsletter/subscribe", json={"email": email})
    assert r.status_code == 201, r.text


async def test_newsletter_returns_page_shape(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await _subscribe(client, f"nl{i}@example.com")

    r = await client.get("/api/newsletter/subscribers?page=1&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert_page_shape(body, page=1, page_size=2)
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["pages"] == 2


async def test_newsletter_page2(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await _subscribe(client, f"nlpg{i}@example.com")

    r = await client.get("/api/newsletter/subscribers?page=2&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 2
    assert len(body["items"]) == 1


async def test_newsletter_active_only_filter(client: AsyncClient, db):
    token = await _make_admin(client, db)
    # Subscribe 2 — one will be unsubscribed
    await _subscribe(client, "nlact1@example.com")
    await _subscribe(client, "nlact2@example.com")
    # Unsubscribe via token — update DB directly
    from sqlalchemy import select
    from app.plugins.newsletter.models import NewsletterSubscriber
    result = await db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.email == "nlact2@example.com"))
    sub = result.scalar_one()
    sub.is_active = False
    await db.flush()

    # active_only=True (default) should return only 1
    r = await client.get("/api/newsletter/subscribers?active_only=true", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["total"] == 1

    # active_only=false should return 2
    r = await client.get("/api/newsletter/subscribers?active_only=false", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["total"] == 2


async def test_newsletter_requires_admin(client: AsyncClient):
    r = await client.get("/api/newsletter/subscribers")
    assert r.status_code == 401


# ── REVIEWS ───────────────────────────────────────────────────────────────────

async def _insert_review(db, product_id: str, user_id: str, rating: int = 4) -> str:
    """Insert a review directly via DB (bypasses verified-purchase check)."""
    from app.plugins.reviews.models import Review
    review = Review(
        product_id=product_id,
        user_id=user_id,
        rating=rating,
        body="Test review",
        is_approved=False,
    )
    db.add(review)
    await db.flush()
    return review.id


async def _insert_customer(db, email: str) -> str:
    """Insert a customer directly into the DB (no rate limiter, no email)."""
    import bcrypt
    from app.plugins.auth.models import User, UserRole
    pw_hash = bcrypt.hashpw(b"Pass1234!", bcrypt.gensalt()).decode()
    user = User(email=email, hashed_password=pw_hash, first_name="Cust", last_name="Review",
                role=UserRole.customer, is_active=True, is_email_verified=True)
    db.add(user)
    await db.flush()
    return user.id


async def test_reviews_returns_page_shape(client: AsyncClient, db):
    admin_token = await _make_admin(client, db)
    r = await client.post("/api/products", json={"name": "Review Prod", "price": "10.00"}, headers=_auth(admin_token))
    pid = r.json()["id"]

    for i in range(3):
        uid = await _insert_customer(db, f"reviewer{i}@example.com")
        await _insert_review(db, pid, uid)

    r = await client.get("/api/reviews/admin/all?page=1&page_size=2", headers=_auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert_page_shape(body, page=1, page_size=2)
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["pages"] == 2


async def test_reviews_page2(client: AsyncClient, db):
    admin_token = await _make_admin(client, db)
    r = await client.post("/api/products", json={"name": "Rev Prod 2", "price": "10.00"}, headers=_auth(admin_token))
    pid = r.json()["id"]

    for i in range(3):
        uid = await _insert_customer(db, f"revpg{i}@example.com")
        await _insert_review(db, pid, uid)

    r = await client.get("/api/reviews/admin/all?page=2&page_size=2", headers=_auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 2
    assert len(body["items"]) == 1


async def test_reviews_is_approved_filter(client: AsyncClient, db):
    admin_token = await _make_admin(client, db)
    r = await client.post("/api/products", json={"name": "Approvable Prod", "price": "10.00"}, headers=_auth(admin_token))
    pid = r.json()["id"]

    uid1 = await _insert_customer(db, "approv1@example.com")
    uid2 = await _insert_customer(db, "approv2@example.com")
    rid1 = await _insert_review(db, pid, uid1)
    await _insert_review(db, pid, uid2)
    await client.patch(f"/api/reviews/{rid1}/approve", headers=_auth(admin_token))

    r = await client.get("/api/reviews/admin/all?is_approved=true", headers=_auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["is_approved"] is True

    r = await client.get("/api/reviews/admin/all?is_approved=false", headers=_auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["is_approved"] is False

    r = await client.get("/api/reviews/admin/all", headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["total"] == 2


async def test_reviews_requires_admin(client: AsyncClient):
    # No auth → 401
    r = await client.get("/api/reviews/admin/all")
    assert r.status_code == 401


# ── CONTACT / ENQUIRIES ───────────────────────────────────────────────────────

async def _submit_enquiry(client: AsyncClient, i: int):
    r = await client.post("/api/contact", json={
        "name": f"Person {i}", "email": f"person{i}@example.com",
        "message": f"Test enquiry {i}",
    })
    assert r.status_code == 201, r.text


async def test_enquiries_returns_page_shape(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await _submit_enquiry(client, i)

    r = await client.get("/api/contact?page=1&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert_page_shape(body, page=1, page_size=2)
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["pages"] == 2


async def test_enquiries_page2(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await _submit_enquiry(client, i + 10)

    r = await client.get("/api/contact?page=2&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 2
    assert len(body["items"]) == 1


async def test_enquiries_ordered_newest_first(client: AsyncClient, db):
    token = await _make_admin(client, db)
    for i in range(3):
        await _submit_enquiry(client, i + 20)

    r = await client.get("/api/contact", headers=_auth(token))
    assert r.status_code == 200
    items = r.json()["items"]
    # created_at should be descending
    dates = [item["created_at"] for item in items]
    assert dates == sorted(dates, reverse=True)


async def test_enquiries_requires_admin(client: AsyncClient):
    r = await client.get("/api/contact")
    assert r.status_code == 401


# ── ORDERS ────────────────────────────────────────────────────────────────────

async def test_orders_returns_page_shape(client: AsyncClient, db):
    token = await _make_admin(client, db)
    r = await client.get("/api/orders?page=1&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert_page_shape(body, page=1, page_size=2)
    assert isinstance(body["items"], list)


async def test_orders_page_size_capped_at_50(client: AsyncClient, db):
    token = await _make_admin(client, db)
    r = await client.get("/api/orders?page_size=200", headers=_auth(token))
    assert r.status_code == 422


# ── RFQ ───────────────────────────────────────────────────────────────────────

async def test_rfq_returns_page_shape(client: AsyncClient, db):
    token = await _make_admin(client, db)
    r = await client.get("/api/rfq?page=1&page_size=2", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert_page_shape(body, page=1, page_size=2)


async def test_rfq_page_size_capped_at_50(client: AsyncClient, db):
    token = await _make_admin(client, db)
    r = await client.get("/api/rfq?page_size=200", headers=_auth(token))
    assert r.status_code == 422


# ── PAGINATION MATH ───────────────────────────────────────────────────────────

async def test_pages_calc_exact_multiple(client: AsyncClient, db):
    """4 records with page_size=2 → pages=2, not 3."""
    token = await _make_admin(client, db)
    for i in range(4):
        await client.post("/api/products", json={"name": f"PagesCalc {i}", "price": "1.00"}, headers=_auth(token))

    r = await client.get("/api/products?page_size=2", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["pages"] == 2


async def test_pages_calc_remainder(client: AsyncClient, db):
    """5 records with page_size=2 → pages=3."""
    token = await _make_admin(client, db)
    for i in range(5):
        await client.post("/api/products", json={"name": f"PagesRem {i}", "price": "1.00"}, headers=_auth(token))

    r = await client.get("/api/products?page_size=2", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["pages"] == 3


async def test_empty_list_returns_page_1_of_1(client: AsyncClient, db):
    """Zero records should return pages=1, not pages=0."""
    token = await _make_admin(client, db)
    r = await client.get("/api/products", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["pages"] == 1


async def test_invalid_page_param(client: AsyncClient, db):
    """page=0 should be rejected with 422."""
    token = await _make_admin(client, db)
    r = await client.get("/api/products?page=0", headers=_auth(token))
    assert r.status_code == 422
