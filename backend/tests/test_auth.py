from httpx import AsyncClient

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
REFRESH_URL = "/api/auth/refresh"
LOGOUT_URL = "/api/auth/logout"
ME_URL = "/api/auth/me"

USER_DATA = {
    "email": "test@example.com",
    "password": "securepass123",
    "first_name": "Test",
    "last_name": "User",
}


async def test_register_success(client: AsyncClient):
    response = await client.post(REGISTER_URL, json=USER_DATA)
    assert response.status_code == 201
    body = response.json()
    assert "access_token" in body
    assert body["user"]["email"] == USER_DATA["email"]
    assert body["user"]["role"] == "customer"


async def test_register_duplicate_email(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_DATA)
    response = await client.post(REGISTER_URL, json=USER_DATA)
    assert response.status_code == 409


async def test_register_weak_password(client: AsyncClient):
    data = {**USER_DATA, "password": "short"}
    response = await client.post(REGISTER_URL, json=data)
    assert response.status_code == 422


async def test_login_success(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_DATA)
    response = await client.post(LOGIN_URL, json={"email": USER_DATA["email"], "password": USER_DATA["password"]})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "refresh_token" in response.cookies


async def test_login_wrong_password(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_DATA)
    response = await client.post(LOGIN_URL, json={"email": USER_DATA["email"], "password": "wrongpassword"})
    assert response.status_code == 401


async def test_me_authenticated(client: AsyncClient):
    reg = await client.post(REGISTER_URL, json=USER_DATA)
    token = reg.json()["access_token"]
    response = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == USER_DATA["email"]


async def test_me_unauthenticated(client: AsyncClient):
    response = await client.get(ME_URL)
    assert response.status_code == 401


async def test_me_invalid_token(client: AsyncClient):
    response = await client.get(ME_URL, headers={"Authorization": "Bearer invalid.token.here"})
    assert response.status_code == 401


async def test_refresh_token(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_DATA)
    await client.post(LOGIN_URL, json={"email": USER_DATA["email"], "password": USER_DATA["password"]})
    # Client cookie jar retains the refresh_token cookie from login
    response = await client.post(REFRESH_URL)
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_logout(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_DATA)
    await client.post(LOGIN_URL, json={"email": USER_DATA["email"], "password": USER_DATA["password"]})
    logout_resp = await client.post(LOGOUT_URL)
    assert logout_resp.status_code == 204
    # Refresh should now fail — token is revoked
    response = await client.post(REFRESH_URL)
    assert response.status_code == 401


async def test_health(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "auth" in response.json()["plugins"]


async def test_menu(client: AsyncClient):
    response = await client.get("/api/menu")
    assert response.status_code == 200
    body = response.json()
    assert "admin_menu" in body
    assert "superadmin_menu" in body
    assert any(m["plugin"] == "auth" for m in body["admin_menu"])


async def test_update_profile(client: AsyncClient, db):
    reg = await client.post(REGISTER_URL, json=USER_DATA)
    token = reg.json()["access_token"]
    r = await client.put(
        "/api/auth/me",
        json={"first_name": "Updated", "last_name": "Name", "phone": "555-1234"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["first_name"] == "Updated"
    assert body["last_name"] == "Name"
    assert body["phone"] == "555-1234"


async def test_update_profile_unauthenticated(client: AsyncClient):
    r = await client.put("/api/auth/me", json={"first_name": "Hacker"})
    assert r.status_code == 401


async def test_update_profile_partial(client: AsyncClient, db):
    reg = await client.post(REGISTER_URL, json=USER_DATA)
    token = reg.json()["access_token"]
    # Only update phone; first_name and last_name should be unchanged
    r = await client.put(
        "/api/auth/me",
        json={"phone": "555-9999"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["phone"] == "555-9999"
    assert body["first_name"] == USER_DATA["first_name"]
    assert body["last_name"] == USER_DATA["last_name"]
