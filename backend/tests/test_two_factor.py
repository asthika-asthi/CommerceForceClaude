"""Email-code two-factor auth (feature P).

Covers enrolment (setup + confirm), the login challenge, code verification and its
guards (wrong / single-use / newest-only), password-gated disable, superadmin
force-disable for lockout recovery, and that non-2FA logins are unchanged.
"""
import re

from httpx import AsyncClient
from sqlalchemy import select, update

from tests.test_commerce import register_and_token, make_admin, ADMIN_DATA, CUSTOMER_DATA

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
VERIFY_URL = "/api/auth/login/verify-2fa"
RESEND_URL = "/api/auth/login/resend-2fa"
SETUP_URL = "/api/auth/2fa/setup"
CONFIRM_URL = "/api/auth/2fa/confirm"
DISABLE_URL = "/api/auth/2fa/disable"

SUPER_DATA = {"email": "super2fa@example.com", "password": "superpass1", "first_name": "Super", "last_name": "Admin"}


async def _latest_code(db, email: str) -> str:
    """Pull the most recent 6-digit login code emailed to `email` from EmailLog."""
    from app.shared.email import EmailLog
    row = (await db.execute(
        select(EmailLog)
        .where(EmailLog.recipient == email, EmailLog.subject == "Your login verification code")
        .order_by(EmailLog.created_at.desc())
    )).scalars().first()
    assert row is not None, f"no 2FA code email found for {email}"
    m = re.search(r"code is: (\d{6})", row.body)
    assert m is not None, f"no code in email body: {row.body!r}"
    return m.group(1)


async def _enable_2fa(client: AsyncClient, db, data: dict) -> str:
    """Register `data`, enrol in 2FA, return a fresh access token for the account."""
    token = await register_and_token(client, data)
    r = await client.post(SETUP_URL, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 204
    code = await _latest_code(db, data["email"])
    r = await client.post(CONFIRM_URL, json={"code": code}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["is_2fa_enabled"] is True
    return token


async def make_superadmin(client: AsyncClient, db) -> str:
    await register_and_token(client, SUPER_DATA)
    from app.plugins.auth.models import User, UserRole
    await db.execute(update(User).where(User.email == SUPER_DATA["email"]).values(role=UserRole.superadmin))
    await db.flush()
    r = await client.post(LOGIN_URL, json={"email": SUPER_DATA["email"], "password": SUPER_DATA["password"]})
    return r.json()["access_token"]


# ── login without 2FA is unchanged ──────────────────────────────────────────────

async def test_login_without_2fa_unchanged(client: AsyncClient, db):
    await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    r = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert r.status_code == 200
    body = r.json()
    assert body.get("two_factor_required") in (False, None)
    assert body["access_token"]
    assert body["user"]["email"] == CUSTOMER_DATA["email"]


# ── enrolment ────────────────────────────────────────────────────────────────────

async def test_enable_2fa_flow(client: AsyncClient, db):
    await _enable_2fa(client, db, CUSTOMER_DATA)


async def test_confirm_2fa_wrong_code_rejected(client: AsyncClient, db):
    token = await register_and_token(client, CUSTOMER_DATA)
    await client.post(SETUP_URL, headers={"Authorization": f"Bearer {token}"})
    r = await client.post(CONFIRM_URL, json={"code": "000000"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400


# ── login challenge + verification ──────────────────────────────────────────────

async def test_login_with_2fa_returns_challenge(client: AsyncClient, db):
    await _enable_2fa(client, db, CUSTOMER_DATA)
    r = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert r.status_code == 200
    body = r.json()
    assert body["two_factor_required"] is True
    assert body["pending_token"]
    assert body.get("access_token") is None


async def test_verify_2fa_success(client: AsyncClient, db):
    await _enable_2fa(client, db, CUSTOMER_DATA)
    login = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    pending = login.json()["pending_token"]
    code = await _latest_code(db, CUSTOMER_DATA["email"])
    r = await client.post(VERIFY_URL, json={"pending_token": pending, "code": code})
    assert r.status_code == 200
    assert r.json()["access_token"]
    assert r.json()["user"]["email"] == CUSTOMER_DATA["email"]


async def test_verify_2fa_wrong_code_rejected(client: AsyncClient, db):
    await _enable_2fa(client, db, CUSTOMER_DATA)
    login = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    pending = login.json()["pending_token"]
    r = await client.post(VERIFY_URL, json={"pending_token": pending, "code": "000000"})
    assert r.status_code == 400


async def test_2fa_code_is_single_use(client: AsyncClient, db):
    await _enable_2fa(client, db, CUSTOMER_DATA)
    login = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    pending = login.json()["pending_token"]
    code = await _latest_code(db, CUSTOMER_DATA["email"])
    assert (await client.post(VERIFY_URL, json={"pending_token": pending, "code": code})).status_code == 200
    # Re-use of the same code is rejected.
    login2 = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    pending2 = login2.json()["pending_token"]
    r = await client.post(VERIFY_URL, json={"pending_token": pending2, "code": code})
    assert r.status_code == 400


async def test_only_newest_code_valid_after_resend(client: AsyncClient, db):
    await _enable_2fa(client, db, CUSTOMER_DATA)
    login = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    pending = login.json()["pending_token"]
    old_code = await _latest_code(db, CUSTOMER_DATA["email"])

    resend = await client.post(RESEND_URL, json={"pending_token": pending})
    assert resend.status_code == 204
    new_code = await _latest_code(db, CUSTOMER_DATA["email"])
    assert new_code != old_code

    # The superseded code no longer works…
    assert (await client.post(VERIFY_URL, json={"pending_token": pending, "code": old_code})).status_code == 400
    # …but the freshest one does.
    assert (await client.post(VERIFY_URL, json={"pending_token": pending, "code": new_code})).status_code == 200


# ── disable ──────────────────────────────────────────────────────────────────────

async def test_disable_2fa_requires_correct_password(client: AsyncClient, db):
    token = await _enable_2fa(client, db, CUSTOMER_DATA)
    bad = await client.post(DISABLE_URL, json={"password": "wrongpass"}, headers={"Authorization": f"Bearer {token}"})
    assert bad.status_code == 400

    ok = await client.post(DISABLE_URL, json={"password": CUSTOMER_DATA["password"]}, headers={"Authorization": f"Bearer {token}"})
    assert ok.status_code == 200
    assert ok.json()["is_2fa_enabled"] is False

    # Login is back to a single step.
    r = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert r.json().get("two_factor_required") in (False, None)
    assert r.json()["access_token"]


# ── superadmin lockout recovery ─────────────────────────────────────────────────

async def test_superadmin_can_force_disable_2fa(client: AsyncClient, db):
    token = await _enable_2fa(client, db, CUSTOMER_DATA)
    user_id = (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})).json()["id"]

    super_token = await make_superadmin(client, db)
    r = await client.post(f"/api/auth/users/{user_id}/disable-2fa", headers={"Authorization": f"Bearer {super_token}"})
    assert r.status_code == 200
    assert r.json()["is_2fa_enabled"] is False

    login = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert login.json().get("two_factor_required") in (False, None)
    assert login.json()["access_token"]


async def test_admin_account_full_2fa_login(client: AsyncClient, db):
    """The admin-panel path: an admin-role account enrols, then its next login is
    gated by the emailed code (2FA is role-agnostic — same flow as a customer)."""
    token = await make_admin(client, db)

    assert (await client.post(SETUP_URL, headers={"Authorization": f"Bearer {token}"})).status_code == 204
    code = await _latest_code(db, ADMIN_DATA["email"])
    confirm = await client.post(CONFIRM_URL, json={"code": code}, headers={"Authorization": f"Bearer {token}"})
    assert confirm.status_code == 200
    assert confirm.json()["is_2fa_enabled"] is True

    login = await client.post(LOGIN_URL, json={"email": ADMIN_DATA["email"], "password": ADMIN_DATA["password"]})
    assert login.json()["two_factor_required"] is True
    assert login.json().get("access_token") is None
    pending = login.json()["pending_token"]

    login_code = await _latest_code(db, ADMIN_DATA["email"])
    verify = await client.post(VERIFY_URL, json={"pending_token": pending, "code": login_code})
    assert verify.status_code == 200
    assert verify.json()["access_token"]
    assert verify.json()["user"]["role"] == "admin"


async def test_admin_cannot_force_disable_2fa(client: AsyncClient, db):
    token = await _enable_2fa(client, db, CUSTOMER_DATA)
    user_id = (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})).json()["id"]

    admin_token = await make_admin(client, db)
    r = await client.post(f"/api/auth/users/{user_id}/disable-2fa", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 403
