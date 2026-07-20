"""Task 6 — full test coverage for the landing_page plugin's editable-content endpoints:
GET /api/landing_page/editable, GET /api/landing_page/overrides, PUT /api/landing_page/{section_key}.

Uses the shared `landing_config_fixture_path` fixture (backend/tests/conftest.py) to point
LANDING_CONFIG_PATH at backend/tests/fixtures/test_landing_config.json for the duration of
each test — that fixture already handles safe env-var restore + settings-cache clearing.
"""
from httpx import AsyncClient

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
EDITABLE_URL = "/api/landing_page/editable"
OVERRIDES_URL = "/api/landing_page/overrides"

ADMIN_DATA = {"email": "content2_admin@example.com", "password": "adminpass1", "first_name": "Admin", "last_name": "Content2"}
CUSTOMER_DATA = {"email": "content2_cust@example.com", "password": "custpass1", "first_name": "Cust", "last_name": "Content2"}


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


# ── GET /editable ────────────────────────────────────────────────────────────

async def test_editable_sections_only_returns_flagged_sections(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    r = await client.get(EDITABLE_URL, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    keys = {s["section_key"] for s in body}
    assert keys == {"trust-strip", "hero"}


async def test_editable_sections_infers_field_types_and_labels(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    r = await client.get(EDITABLE_URL, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    hero = next(s for s in r.json() if s["section_key"] == "hero")
    fields_by_name = {f["name"]: f for f in hero["fields"]}

    assert fields_by_name["title"]["type"] == "text"
    assert fields_by_name["title"]["label"] == "Title"

    assert fields_by_name["titleHighlight"]["label"] == "Title Highlight"

    assert fields_by_name["bgImageSrc"]["type"] == "image"
    assert fields_by_name["bgImageSrc"]["label"] == "Bg Image Src"


async def test_editable_sections_skips_unknown_field_name(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    r = await client.get(EDITABLE_URL, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    hero = next(s for s in r.json() if s["section_key"] == "hero")
    field_names = {f["name"] for f in hero["fields"]}
    assert field_names == {"title", "titleHighlight", "bgImageSrc"}


async def test_editable_sections_requires_admin(client: AsyncClient, db, landing_config_fixture_path):
    r = await client.get(EDITABLE_URL)
    assert r.status_code == 401


async def test_non_admin_cannot_list_editable_sections(client: AsyncClient, db, landing_config_fixture_path):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.get(EDITABLE_URL, headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 403


# ── PUT /{section_key} ───────────────────────────────────────────────────────

async def test_save_override_updates_value(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/landing_page/hero",
        json={"overrides": {"title": "New Headline"}, "is_hidden": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    fields_by_name = {f["name"]: f for f in body["fields"]}
    assert fields_by_name["title"]["value"] == "New Headline"
    assert fields_by_name["titleHighlight"]["value"] == "our range"


async def test_save_override_rejects_unknown_field(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/landing_page/hero",
        json={"overrides": {"notAllowed": "hack"}, "is_hidden": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


async def test_save_override_rejects_unknown_section(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/landing_page/does-not-exist",
        json={"overrides": {}, "is_hidden": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


async def test_non_admin_cannot_save(client: AsyncClient, db, landing_config_fixture_path):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.put(
        "/api/landing_page/hero",
        json={"overrides": {"title": "Hacked"}, "is_hidden": False},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


# ── GET /overrides (public) ──────────────────────────────────────────────────

async def test_public_overrides_empty_when_nothing_saved(client: AsyncClient, db, landing_config_fixture_path):
    r = await client.get(OVERRIDES_URL)
    assert r.status_code == 200
    assert r.json() == {}


async def test_public_overrides_reflects_saved_value_no_auth_needed(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    save_resp = await client.put(
        "/api/landing_page/trust-strip",
        json={"overrides": {"title": "Free shipping worldwide"}, "is_hidden": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert save_resp.status_code == 200

    r = await client.get(OVERRIDES_URL)
    assert r.status_code == 200
    body = r.json()
    assert body["trust-strip"]["overrides"] == {"title": "Free shipping worldwide"}
    assert body["trust-strip"]["is_hidden"] is False


async def test_hide_section_via_save(client: AsyncClient, db, landing_config_fixture_path):
    admin_token = await make_admin(client, db)
    r = await client.put(
        "/api/landing_page/trust-strip",
        json={"overrides": {}, "is_hidden": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200

    overrides_resp = await client.get(OVERRIDES_URL)
    assert overrides_resp.status_code == 200
    assert overrides_resp.json()["trust-strip"]["is_hidden"] is True
