"""Phase 5 — Content & AI integration tests: Branding, Landing Page, AI Chat."""
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
    await register_and_token(client, ADMIN_DATA)
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


async def test_branding_theme_colors_default_empty(client: AsyncClient, db):
    r = await client.get("/api/branding")
    assert r.status_code == 200
    assert r.json()["theme_colors"] == {}


async def test_admin_update_theme_colors(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    payload = {
        "core": {"brand": "#D4A017", "dark": "#1B2A4A"},
        "overrides": {"brand-tint": "#FFF8E1"},
    }
    r = await client.put(
        "/api/branding",
        json={"theme_colors": payload},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["theme_colors"] == payload

    # Round-trips on public GET
    r2 = await client.get("/api/branding")
    assert r2.json()["theme_colors"] == payload

    # Clearing back to {} resets to theme defaults
    r3 = await client.put(
        "/api/branding",
        json={"theme_colors": {}},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 200
    assert r3.json()["theme_colors"] == {}


async def test_non_admin_cannot_update_theme_colors(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.put(
        "/api/branding",
        json={"theme_colors": {"core": {"brand": "#000000"}}},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_branding_blank_store_name_roundtrips(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/branding",
        json={"store_name": ""},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["store_name"] == ""

    r2 = await client.get("/api/branding")
    assert r2.json()["store_name"] == ""


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
    await client.post(
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

def _make_mock_httpx_response(reply_text: str, status_code: int = 200):
    """Return a mock httpx.Response for OpenRouter chat completions."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": reply_text}}]
    }
    mock_resp.text = reply_text
    return mock_resp


async def test_ai_chat_basic_response(client: AsyncClient, db):
    mock_resp = _make_mock_httpx_response("Hello! How can I help you today?")
    with patch("app.plugins.ai_chat.router.get_settings") as mock_settings, \
         patch("app.plugins.ai_chat.service.httpx.AsyncClient") as mock_client_cls:
        mock_settings.return_value.OPENROUTER_API_KEY = "test-key"
        mock_settings.return_value.OPENROUTER_MODEL = "anthropic/claude-haiku-4-5-20251001"
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        r = await client.post(
            "/api/ai_chat/chat",
            json={"message": "Hello", "session_key": "test-session-basic"},
        )
    assert r.status_code == 200
    assert r.json()["reply"] == "Hello! How can I help you today?"
    assert r.json()["session_key"] == "test-session-basic"


async def test_ai_chat_history_persisted_and_loaded(client: AsyncClient, db):
    """Send two messages in the same session; history endpoint returns both turns."""
    session_key = "test-session-history"
    mock_resp1 = _make_mock_httpx_response("We have electronics, clothing, and home goods.")
    mock_resp2 = _make_mock_httpx_response("Our electronics start at £9.99.")

    with patch("app.plugins.ai_chat.router.get_settings") as mock_settings, \
         patch("app.plugins.ai_chat.service.httpx.AsyncClient") as mock_client_cls:
        mock_settings.return_value.OPENROUTER_API_KEY = "test-key"
        mock_settings.return_value.OPENROUTER_MODEL = "anthropic/claude-haiku-4-5-20251001"
        mock_http = AsyncMock()
        mock_http.post = AsyncMock(side_effect=[mock_resp1, mock_resp2])
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        r1 = await client.post(
            "/api/ai_chat/chat",
            json={"message": "What categories do you have?", "session_key": session_key},
        )
        assert r1.status_code == 200

        r2 = await client.post(
            "/api/ai_chat/chat",
            json={"message": "What are the prices?", "session_key": session_key},
        )
        assert r2.status_code == 200

    hist = await client.get(f"/api/ai_chat/history/{session_key}")
    assert hist.status_code == 200
    msgs = hist.json()["messages"]
    # 2 user + 2 assistant = 4 messages
    assert len(msgs) == 4
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"


async def test_ai_chat_history_empty_for_unknown_session(client: AsyncClient, db):
    r = await client.get("/api/ai_chat/history/nonexistent-session-xyz")
    assert r.status_code == 200
    assert r.json()["messages"] == []


async def test_ai_chat_uses_branding_context(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.put(
        "/api/branding",
        json={"store_name": "GadgetWorld", "tagline": "Best gadgets at best prices"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    captured_payload = {}

    async def mock_post(url, **kwargs):
        captured_payload.update(kwargs.get("json", {}))
        return _make_mock_httpx_response("Welcome to GadgetWorld!")

    with patch("app.plugins.ai_chat.router.get_settings") as mock_settings, \
         patch("app.plugins.ai_chat.service.httpx.AsyncClient") as mock_client_cls:
        mock_settings.return_value.OPENROUTER_API_KEY = "test-key"
        mock_settings.return_value.OPENROUTER_MODEL = "anthropic/claude-haiku-4-5-20251001"
        mock_http = AsyncMock()
        mock_http.post = mock_post
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        r = await client.post(
            "/api/ai_chat/chat",
            json={"message": "What store is this?", "session_key": "test-session-branding"},
        )
    assert r.status_code == 200
    system_msg = captured_payload["messages"][0]["content"]
    assert "GadgetWorld" in system_msg


async def test_ai_chat_no_api_key_returns_503(client: AsyncClient, db):
    with patch("app.plugins.ai_chat.router.get_settings") as mock_settings:
        mock_settings.return_value.OPENROUTER_API_KEY = ""
        mock_settings.return_value.OPENROUTER_MODEL = "anthropic/claude-haiku-4-5-20251001"
        r = await client.post(
            "/api/ai_chat/chat",
            json={"message": "Hello", "session_key": "test-session-nokey"},
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


# ── CSV DEDUPLICATION ─────────────────────────────────────────────────────────

async def _import_csv(client: AsyncClient, admin_token: str, csv_content: str):
    return await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )


async def test_product_reimport_updates_not_duplicates(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv = "name,price\nWidget A,9.99\n"
    await _import_csv(client, admin_token, csv)
    r = await _import_csv(client, admin_token, csv)
    assert r.json()["updated"] == 1
    assert r.json()["created"] == 0
    products = (await client.get("/api/products")).json()["items"]
    assert [p["name"] for p in products].count("Widget A") == 1


async def test_product_reimport_updates_price(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await _import_csv(client, admin_token, "name,price\nWidget A,9.99\n")
    await _import_csv(client, admin_token, "name,price\nWidget A,14.99\n")
    products = (await client.get("/api/products")).json()["items"]
    widget = next(p for p in products if p["name"] == "Widget A")
    assert float(widget["price"]) == 14.99


async def test_product_reimport_case_insensitive(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await _import_csv(client, admin_token, "name,price\nWidget A,9.99\n")
    r = await _import_csv(client, admin_token, "name,price\nwidget a,9.99\n")
    # lowercase match → update, not create
    assert r.json()["updated"] == 1
    products = (await client.get("/api/products")).json()["items"]
    assert len([p for p in products if "widget" in p["name"].lower()]) == 1


# ── DUPLICATE FINDER ──────────────────────────────────────────────────────────

async def test_find_duplicates_returns_groups(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await _import_csv(client, admin_token, "name,price\nWidget A,9.99\n")
    # Create second product with same name via API (bypasses dedup — tests the cleanup tool)
    await client.post("/api/products", json={"name": "Widget A", "price": "12.99", "stock_quantity": 5},
                      headers={"Authorization": f"Bearer {admin_token}"})
    await client.post("/api/products", json={"name": "Unique Item", "price": "5.00", "stock_quantity": 3},
                      headers={"Authorization": f"Bearer {admin_token}"})

    r = await client.get("/api/products/duplicates", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) == 1
    assert groups[0]["name"].lower() == "widget a"
    assert len(groups[0]["products"]) == 2


async def test_find_duplicates_empty_when_no_duplicates(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    await client.post("/api/products", json={"name": "Unique A", "price": "1.00"},
                      headers={"Authorization": f"Bearer {admin_token}"})
    r = await client.get("/api/products/duplicates", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json() == []


async def test_find_duplicates_requires_admin(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = (await client.post(REGISTER_URL, json=CUSTOMER_DATA)).json()["access_token"]
    r = await client.get("/api/products/duplicates", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 403


async def test_delete_duplicates_keeps_selected(client: AsyncClient, db):
    import json as json_lib
    admin_token = await make_admin(client, db)
    await _import_csv(client, admin_token, "name,price\nWidget A,9.99\n")
    r2 = await client.post("/api/products", json={"name": "Widget A", "price": "12.99", "stock_quantity": 5},
                           headers={"Authorization": f"Bearer {admin_token}"})
    keep_id = r2.json()["id"]

    resp = await client.request(
        "DELETE", "/api/products/duplicates",
        content=json_lib.dumps({"keep_ids": [keep_id]}),
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 1

    remaining = (await client.get("/api/products")).json()["items"]
    ids = [p["id"] for p in remaining]
    assert keep_id in ids
    assert len([p for p in remaining if p["name"].lower() == "widget a"]) == 1


async def test_delete_duplicates_requires_admin(client: AsyncClient, db):
    import json as json_lib
    await make_admin(client, db)
    cust_token = (await client.post(REGISTER_URL, json=CUSTOMER_DATA)).json()["access_token"]
    r = await client.request(
        "DELETE", "/api/products/duplicates",
        content=json_lib.dumps({"keep_ids": []}),
        headers={"Authorization": f"Bearer {cust_token}", "Content-Type": "application/json"},
    )
    assert r.status_code == 403
