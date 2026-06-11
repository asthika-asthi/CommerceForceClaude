"""Phase 5 — Content & AI integration tests: Branding, Landing Page, AI Chat."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"

ADMIN_DATA = {"email": "content_admin@example.com", "password": "adminpass1", "first_name": "Admin", "last_name": "Content"}
CUSTOMER_DATA = {"email": "content_cust@example.com", "password": "custpass1", "first_name": "Cust", "last_name": "Content"}


async def register_and_token(client: AsyncClient, data: dict) -> str:
    r = await client.post(REGISTER_URL, json=data)
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def make_admin(client: AsyncClient, db) -> str:
    token = await register_and_token(client, ADMIN_DATA)
    from sqlalchemy import update
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == ADMIN_DATA["email"]).values(role=UserRole.admin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": ADMIN_DATA["email"], "password": ADMIN_DATA["password"]})
    return r.json()["access_token"]


# ── BRANDING ──────────────────────────────────────────────────────────────────

async def test_branding_get_defaults(client: AsyncClient, db):
    r = await client.get("/api/branding")
    assert r.status_code == 200
    body = r.json()
    assert body["store_name"] == "My Store"
    assert body["primary_color"] == "#000000"
    assert body["secondary_color"] == "#ffffff"
    assert body["font_family"] == "Inter"


async def test_branding_get_creates_singleton(client: AsyncClient, db):
    # Two calls should return the same record (singleton)
    r1 = await client.get("/api/branding")
    r2 = await client.get("/api/branding")
    assert r1.json()["id"] == r2.json()["id"]


async def test_admin_update_branding(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/branding",
        json={
            "store_name": "TechShop Pro",
            "tagline": "The best gadgets online",
            "primary_color": "#1a73e8",
            "contact_email": "hello@techshop.com",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["store_name"] == "TechShop Pro"
    assert body["tagline"] == "The best gadgets online"
    assert body["primary_color"] == "#1a73e8"
    assert body["contact_email"] == "hello@techshop.com"
    # Unchanged fields keep their value
    assert body["font_family"] == "Inter"


async def test_branding_update_is_idempotent(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.put(
        "/api/branding",
        json={"store_name": "First Name"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r = await client.put(
        "/api/branding",
        json={"store_name": "Second Name"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["store_name"] == "Second Name"

    # Confirm still a single record
    r2 = await client.get("/api/branding")
    assert r2.json()["store_name"] == "Second Name"


async def test_non_admin_cannot_update_branding(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.put(
        "/api/branding",
        json={"store_name": "Hacked"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_branding_public_access(client: AsyncClient, db):
    # No auth required for GET
    r = await client.get("/api/branding")
    assert r.status_code == 200


# ── LANDING PAGE ──────────────────────────────────────────────────────────────

async def test_create_hero_section(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/landing_page",
        json={
            "section_type": "hero",
            "title": "Welcome to Our Store",
            "subtitle": "Discover amazing products",
            "cta_text": "Shop Now",
            "cta_url": "/products",
            "sort_order": 0,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["section_type"] == "hero"
    assert body["title"] == "Welcome to Our Store"
    assert body["is_active"] is True
    assert body["sort_order"] == 0


async def test_create_multiple_sections(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    for i, stype in enumerate(["hero", "features", "cta"]):
        await client.post(
            "/api/landing_page",
            json={"section_type": stype, "title": f"Section {i}", "sort_order": i},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    r = await client.get("/api/landing_page")
    assert r.status_code == 200
    assert len(r.json()) == 3


async def test_list_sections_active_only(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r1 = await client.post(
        "/api/landing_page",
        json={"section_type": "hero", "title": "Active Hero", "sort_order": 0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r2 = await client.post(
        "/api/landing_page",
        json={"section_type": "html", "title": "Inactive", "sort_order": 1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    section_id = r2.json()["id"]
    # Deactivate the second section
    await client.put(
        f"/api/landing_page/{section_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Default active_only=True — should return only the active one
    r = await client.get("/api/landing_page")
    assert len(r.json()) == 1
    assert r.json()[0]["title"] == "Active Hero"

    # active_only=False — should return both
    r_all = await client.get("/api/landing_page?active_only=false")
    assert len(r_all.json()) == 2


async def test_list_sections_ordered_by_sort_order(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    for sort_order, title in [(2, "Third"), (0, "First"), (1, "Second")]:
        await client.post(
            "/api/landing_page",
            json={"section_type": "html", "title": title, "sort_order": sort_order},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    r = await client.get("/api/landing_page")
    titles = [s["title"] for s in r.json()]
    assert titles == ["First", "Second", "Third"]


async def test_update_section(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/landing_page",
        json={"section_type": "features", "title": "Old Title", "sort_order": 0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    section_id = r.json()["id"]
    r2 = await client.put(
        f"/api/landing_page/{section_id}",
        json={"title": "New Title", "subtitle": "New subtitle added"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    assert r2.json()["title"] == "New Title"
    assert r2.json()["subtitle"] == "New subtitle added"


async def test_delete_section(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/landing_page",
        json={"section_type": "cta", "title": "Delete Me", "sort_order": 0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    section_id = r.json()["id"]
    r2 = await client.delete(
        f"/api/landing_page/{section_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 204

    r3 = await client.get("/api/landing_page")
    assert len(r3.json()) == 0


async def test_reorder_sections(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    ids = []
    for i, title in enumerate(["A", "B", "C"]):
        r = await client.post(
            "/api/landing_page",
            json={"section_type": "html", "title": title, "sort_order": i},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        ids.append(r.json()["id"])

    # Reverse order: C, B, A
    r = await client.post(
        "/api/landing_page/reorder",
        json=list(reversed(ids)),
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    titles = [s["title"] for s in r.json()]
    assert titles == ["C", "B", "A"]


async def test_non_admin_cannot_create_section(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/landing_page",
        json={"section_type": "hero", "title": "Hack", "sort_order": 0},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_delete_nonexistent_section(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.delete(
        "/api/landing_page/nonexistent-id",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


async def test_landing_page_public_list(client: AsyncClient, db):
    # Public access (no auth) — GET list
    r = await client.get("/api/landing_page")
    assert r.status_code == 200


# ── AI CHAT ───────────────────────────────────────────────────────────────────

def _make_mock_anthropic(reply_text: str):
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=reply_text)]

    mock_messages = MagicMock()
    mock_messages.create = AsyncMock(return_value=mock_response)

    mock_client = MagicMock()
    mock_client.messages = mock_messages

    mock_anthropic = MagicMock()
    mock_anthropic.AsyncAnthropic.return_value = mock_client
    return mock_anthropic


async def test_ai_chat_basic_response(client: AsyncClient, db):
    mock_anthropic = _make_mock_anthropic("Hello! How can I help you today?")
    with patch("app.plugins.ai_chat.service._anthropic", mock_anthropic):
        r = await client.post(
            "/api/ai_chat/chat",
            json={"message": "Hello", "history": []},
        )
    assert r.status_code == 200
    assert r.json()["reply"] == "Hello! How can I help you today?"


async def test_ai_chat_with_history(client: AsyncClient, db):
    mock_anthropic = _make_mock_anthropic("We have electronics, clothing, and home goods.")
    with patch("app.plugins.ai_chat.service._anthropic", mock_anthropic):
        r = await client.post(
            "/api/ai_chat/chat",
            json={
                "message": "What categories do you have?",
                "history": [
                    {"role": "user", "content": "Hi"},
                    {"role": "assistant", "content": "Hello! How can I help?"},
                ],
            },
        )
    assert r.status_code == 200
    assert "electronics" in r.json()["reply"]


async def test_ai_chat_uses_branding_context(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.put(
        "/api/branding",
        json={"store_name": "GadgetWorld", "tagline": "Best gadgets at best prices"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    captured_system = {}

    async def mock_create(**kwargs):
        captured_system["prompt"] = kwargs.get("system", "")
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Welcome to GadgetWorld!")]
        return mock_response

    mock_messages = MagicMock()
    mock_messages.create = mock_create
    mock_client = MagicMock()
    mock_client.messages = mock_messages
    mock_anthropic = MagicMock()
    mock_anthropic.AsyncAnthropic.return_value = mock_client

    with patch("app.plugins.ai_chat.service._anthropic", mock_anthropic):
        r = await client.post(
            "/api/ai_chat/chat",
            json={"message": "What store is this?", "history": []},
        )
    assert r.status_code == 200
    assert "GadgetWorld" in captured_system["prompt"]


async def test_ai_chat_no_api_key_returns_503(client: AsyncClient, db):
    with patch("app.plugins.ai_chat.router.get_settings") as mock_settings:
        mock_settings.return_value.ANTHROPIC_API_KEY = ""
        r = await client.post(
            "/api/ai_chat/chat",
            json={"message": "Hello", "history": []},
        )
    assert r.status_code == 503


async def test_ai_chat_no_anthropic_package_returns_503(client: AsyncClient, db):
    with patch("app.plugins.ai_chat.service._anthropic", None):
        r = await client.post(
            "/api/ai_chat/chat",
            json={"message": "Hello", "history": []},
        )
    assert r.status_code == 503


# ── CSV IMPORT ────────────────────────────────────────────────────────────────

async def test_csv_import_creates_products(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv_content = "name,price,stock_quantity,description\nWidget Alpha,10.00,5,A widget\nGadget Beta,20.00,3,"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert body["errors"] == []


async def test_csv_import_missing_required_fields_reported(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv_content = "name,price\nGood Product,5.00\n,\nNo Price,"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 1
    assert len(body["errors"]) == 2
    error_rows = [e["row"] for e in body["errors"]]
    assert 3 in error_rows
    assert 4 in error_rows


async def test_csv_import_non_admin_rejected(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    csv_content = "name,price\nHack,1.00"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_csv_import_partial_errors_continue(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv_content = "name,price\nProduct One,15.00\nBad Price,not-a-number\nProduct Three,25.00"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert len(body["errors"]) == 1
    assert body["errors"][0]["row"] == 3


async def test_csv_import_empty_file(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv_content = "name,price\n"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 0
    assert body["errors"] == []
