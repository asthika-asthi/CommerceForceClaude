import pytest
from sqlalchemy import update
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.plugins.auth.models import User, UserRole


ADMIN = {"email": "shipadmin@example.com", "password": "Passw0rd!", "first_name": "Ship", "last_name": "Admin"}


async def _admin_token(client: AsyncClient, db: AsyncSession) -> dict:
    await client.post("/api/auth/register", json=ADMIN)
    await db.execute(update(User).where(User.email == ADMIN["email"]).values(role=UserRole.admin))
    await db.flush()
    login = await client.post("/api/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_zone(client: AsyncClient, headers: dict, countries: str, flat_rate: float, is_active: bool = True) -> dict:
    r = await client.post("/api/shipping/zones", json={
        "name": f"Zone-{countries}", "countries": countries, "flat_rate": flat_rate, "is_active": is_active,
    }, headers=headers)
    assert r.status_code == 201
    return r.json()


@pytest.mark.anyio
async def test_create_and_list_zones(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "GB", 4.99)
    await _create_zone(client, headers, "US", 12.99)
    r = await client.get("/api/shipping/zones", headers=headers)
    assert r.status_code == 200
    names = [z["name"] for z in r.json()]
    assert "Zone-GB" in names
    assert "Zone-US" in names


@pytest.mark.anyio
async def test_rate_lookup_exact_match(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "GB", 4.99)
    await _create_zone(client, headers, "US", 12.99)
    r = await client.get("/api/shipping/rate?country=GB")
    assert r.status_code == 200
    assert float(r.json()["flat_rate"]) == 4.99


@pytest.mark.anyio
async def test_rate_lookup_catch_all(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "*", 7.50)
    r = await client.get("/api/shipping/rate?country=AU")
    assert r.status_code == 200
    assert float(r.json()["flat_rate"]) == 7.50


@pytest.mark.anyio
async def test_exact_match_beats_catch_all(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "*", 7.50)
    await _create_zone(client, headers, "GB", 4.99)
    r = await client.get("/api/shipping/rate?country=GB")
    assert float(r.json()["flat_rate"]) == 4.99


@pytest.mark.anyio
async def test_no_zone_returns_zero(client: AsyncClient):
    r = await client.get("/api/shipping/rate?country=AU")
    assert r.status_code == 200
    assert float(r.json()["flat_rate"]) == 0.00


@pytest.mark.anyio
async def test_inactive_zone_ignored(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    await _create_zone(client, headers, "GB", 4.99, is_active=False)
    r = await client.get("/api/shipping/rate?country=GB")
    assert float(r.json()["flat_rate"]) == 0.00


@pytest.mark.anyio
async def test_update_zone(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    zone = await _create_zone(client, headers, "DE", 8.00)
    r = await client.put(f"/api/shipping/zones/{zone['id']}", json={"flat_rate": 9.50}, headers=headers)
    assert r.status_code == 200
    assert float(r.json()["flat_rate"]) == 9.50


@pytest.mark.anyio
async def test_delete_zone(client: AsyncClient, db: AsyncSession):
    headers = await _admin_token(client, db)
    zone = await _create_zone(client, headers, "FR", 6.00)
    r = await client.delete(f"/api/shipping/zones/{zone['id']}", headers=headers)
    assert r.status_code == 204
    zones = (await client.get("/api/shipping/zones", headers=headers)).json()
    assert not any(z["id"] == zone["id"] for z in zones)


@pytest.mark.anyio
async def test_zones_require_admin(client: AsyncClient):
    r = await client.get("/api/shipping/zones")
    assert r.status_code == 401


@pytest.mark.anyio
async def test_rate_country_code_must_be_2_chars(client: AsyncClient):
    r = await client.get("/api/shipping/rate?country=GBR")
    assert r.status_code == 422
