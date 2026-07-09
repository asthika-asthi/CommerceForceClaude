import pytest
from sqlalchemy import update
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.plugins.auth.models import User, UserRole


ADMIN = {"email": "taxadmin@example.com", "password": "Passw0rd!", "first_name": "Tax", "last_name": "Admin"}


async def _admin_token(client: AsyncClient, db: AsyncSession) -> dict:
    await client.post("/api/auth/register", json=ADMIN)
    await db.execute(update(User).where(User.email == ADMIN["email"]).values(role=UserRole.admin))
    await db.flush()
    login = await client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_zone(client: AsyncClient, headers: dict, countries: str, rate_percent: float, is_active: bool = True) -> dict:
    r = await client.post("/api/tax/zones", json={
        "name": f"Zone-{countries}", "countries": countries, "rate_percent": rate_percent, "is_active": is_active,
    }, headers=headers)
    assert r.status_code == 201
    return r.json()


@pytest.mark.anyio
async def test_create_and_list_zones(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "GB", 20.00)
    await _create_zone(client, headers, "US", 0.00)
    r = await client.get("/api/tax/zones", headers=headers)
    assert r.status_code == 200
    names = [z["name"] for z in r.json()]
    assert "Zone-GB" in names
    assert "Zone-US" in names


@pytest.mark.anyio
async def test_rate_lookup_exact_match(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "GB", 20.00)
    await _create_zone(client, headers, "US", 5.00)
    r = await client.get("/api/tax/rate?country=GB")
    assert r.status_code == 200
    assert float(r.json()["rate_percent"]) == 20.00


@pytest.mark.anyio
async def test_rate_lookup_catch_all(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "*", 15.00)
    r = await client.get("/api/tax/rate?country=AU")
    assert r.status_code == 200
    assert float(r.json()["rate_percent"]) == 15.00


@pytest.mark.anyio
async def test_exact_match_beats_catch_all(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "*", 15.00)
    await _create_zone(client, headers, "GB", 20.00)
    r = await client.get("/api/tax/rate?country=GB")
    assert float(r.json()["rate_percent"]) == 20.00


@pytest.mark.anyio
async def test_no_zone_returns_zero(client: AsyncClient):
    r = await client.get("/api/tax/rate?country=AU")
    assert r.status_code == 200
    assert float(r.json()["rate_percent"]) == 0.00


@pytest.mark.anyio
async def test_inactive_zone_ignored(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "GB", 20.00, is_active=False)
    r = await client.get("/api/tax/rate?country=GB")
    assert float(r.json()["rate_percent"]) == 0.00


@pytest.mark.anyio
async def test_update_zone(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    zone = await _create_zone(client, headers, "DE", 19.00)
    r = await client.put(f"/api/tax/zones/{zone['id']}", json={"rate_percent": 21.00}, headers=headers)
    assert r.status_code == 200
    assert float(r.json()["rate_percent"]) == 21.00


@pytest.mark.anyio
async def test_delete_zone(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    zone = await _create_zone(client, headers, "FR", 20.00)
    r = await client.delete(f"/api/tax/zones/{zone['id']}", headers=headers)
    assert r.status_code == 204
    zones = (await client.get("/api/tax/zones", headers=headers)).json()
    assert not any(z["id"] == zone["id"] for z in zones)


@pytest.mark.anyio
async def test_zones_require_admin(client: AsyncClient):
    r = await client.get("/api/tax/zones")
    assert r.status_code == 401


@pytest.mark.anyio
async def test_rate_country_code_must_be_2_chars(client: AsyncClient):
    r = await client.get("/api/tax/rate?country=GBR")
    assert r.status_code == 422
