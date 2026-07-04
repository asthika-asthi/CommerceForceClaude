"""Security regression tests for bugs-log B4 and B5.

- B4: only a superadmin may change a user's role (an admin could previously escalate
  itself or anyone to superadmin via PATCH /api/auth/users/{id}).
- B5: changing or resetting a password revokes all of that user's refresh tokens, so
  existing sessions (including an attacker's) can no longer be refreshed.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select, update

from tests.test_commerce import make_admin, register_and_token, CUSTOMER_DATA

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
REFRESH_URL = "/api/auth/refresh"

SUPERADMIN_DATA = {"email": "super@example.com", "password": "superpass1", "first_name": "Super", "last_name": "Admin"}


async def make_superadmin(client: AsyncClient, db) -> str:
    """Register a user, promote to superadmin in the DB, return a fresh token."""
    await register_and_token(client, SUPERADMIN_DATA)
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == SUPERADMIN_DATA["email"]).values(role=UserRole.superadmin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": SUPERADMIN_DATA["email"], "password": SUPERADMIN_DATA["password"]})
    return r.json()["access_token"]


async def _create_customer(client: AsyncClient) -> str:
    r = await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    return r.json()["user"]["id"]


# ── B4 — role changes require superadmin ────────────────────────────────────────

async def test_admin_cannot_escalate_user_to_superadmin(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_id = await _create_customer(client)
    r = await client.patch(
        f"/api/auth/users/{cust_id}",
        json={"role": "superadmin"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 403


async def test_admin_cannot_change_role_at_all(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_id = await _create_customer(client)
    r = await client.patch(
        f"/api/auth/users/{cust_id}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 403


async def test_admin_can_still_deactivate_user(client: AsyncClient, db):
    """The role guard must not break an admin's normal user management."""
    admin_token = await make_admin(client, db)
    cust_id = await _create_customer(client)
    r = await client.patch(
        f"/api/auth/users/{cust_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["is_active"] is False


async def test_superadmin_can_change_role(client: AsyncClient, db):
    super_token = await make_superadmin(client, db)
    cust_id = await _create_customer(client)
    r = await client.patch(
        f"/api/auth/users/{cust_id}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {super_token}"},
    )
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


# ── B5 — password change/reset revokes existing sessions ────────────────────────

async def test_change_password_revokes_existing_sessions(client: AsyncClient, db):
    await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    login = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    token = login.json()["access_token"]

    # The refresh cookie works before the password change.
    assert (await client.post(REFRESH_URL)).status_code == 200

    r = await client.post(
        "/api/auth/me/change-password",
        json={"current_password": CUSTOMER_DATA["password"], "new_password": "newpass456"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 204

    # The previously-issued session can no longer be refreshed.
    assert (await client.post(REFRESH_URL)).status_code == 401


async def test_reset_password_revokes_existing_sessions(client: AsyncClient, db):
    from app.plugins.auth.models import User, PasswordResetToken

    await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert (await client.post(REFRESH_URL)).status_code == 200

    user = (await db.execute(select(User).where(User.email == CUSTOMER_DATA["email"]))).scalar_one()
    raw = secrets.token_urlsafe(16)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    ))
    await db.flush()

    r = await client.post("/api/auth/reset-password", json={"token": raw, "new_password": "resetpass789"})
    assert r.status_code == 204

    assert (await client.post(REFRESH_URL)).status_code == 401
