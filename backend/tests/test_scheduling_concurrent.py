"""Task 10 — concurrency test for the double-booking guard in create_appointment.

NOTE on SQLite + async (mirrors tests/test_concurrent.py): SQLite's
``with_for_update()`` is a no-op, so the row lock taken in
``create_appointment`` before the overlap check does not actually serialize
two requests that use SEPARATE DB sessions/connections.  This test exercises
exactly that scenario via the ``concurrent_client`` fixture (a fresh
AsyncSession per request, auto-committed after each request — unlike the
shared-session ``client`` fixture) and ``asyncio.gather``.

Session model: because ``concurrent_client`` commits after every request,
ALL setup here (admin creation, provider/appointment-type/availability/client
creation) also goes through ``concurrent_client`` so the racing requests
(which open their own fresh sessions) can actually see that data. This
matches test_concurrent.py's approach.
"""
import asyncio
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import TestSessionLocal

ADMIN_EMAIL = "sched_race_admin@example.com"
ADMIN_PASSWORD = "adminpass1"

BOOKING_START = "2026-08-03T09:00:00+00:00"  # Monday — future fixed slot
BOOKING_START_DT = datetime(2026, 8, 3, 9, 0, tzinfo=timezone.utc)


# ── helpers (mirrors tests/test_concurrent.py's helper style) ─────────────────

async def _register_and_token(
    client: AsyncClient, email: str, password: str = "custpass1"
) -> str:
    r = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Race",
            "last_name": "Tester",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


async def _make_admin(client: AsyncClient) -> str:
    """Register an admin user, promote them via direct DB update, re-login.

    Promotion goes straight to a fresh TestSessionLocal + commit (as in
    test_concurrent.py) because concurrent_client's per-request sessions
    would otherwise not see a role change made through a different session.
    """
    await _register_and_token(client, ADMIN_EMAIL, ADMIN_PASSWORD)

    from sqlalchemy import update

    from app.plugins.auth.models import User, UserRole

    async with TestSessionLocal() as session:
        await session.execute(
            update(User).where(User.email == ADMIN_EMAIL).values(role=UserRole.admin)
        )
        await session.commit()

    r = await client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _setup_provider_and_type(client: AsyncClient, admin_token: str) -> tuple[str, str]:
    """Create a provider + a 30-min appointment type linked to it + Monday availability."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "Dr Race"}, headers=headers
    )
    assert r.status_code == 201, r.text
    provider_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Consult", "duration_minutes": 30, "provider_ids": [provider_id]},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    type_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/availability",
        json={"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
        headers=headers,
    )
    assert r.status_code == 201, r.text

    return provider_id, type_id


async def _create_client_record(client: AsyncClient, admin_token: str, first_name: str, last_name: str) -> str:
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": first_name, "last_name": last_name},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _book(
    client: AsyncClient,
    admin_token: str,
    provider_id: str,
    type_id: str,
    client_id: str,
    start_at: str,
):
    headers = {"Authorization": f"Bearer {admin_token}"}
    return await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": start_at,
        },
        headers=headers,
    )


# ── Test: concurrent double-booking — exactly one wins ────────────────────────

async def test_concurrent_double_booking_prevented(concurrent_client: AsyncClient):
    """Two simultaneous bookings for the SAME provider + type + start_at.

    Exactly one must succeed (201); the other must be rejected with 409
    ("That time slot is no longer available"). The DB must end up with
    exactly one non-cancelled appointment for that provider+start_at.
    """
    admin_token = await _make_admin(concurrent_client)
    provider_id, type_id = await _setup_provider_and_type(concurrent_client, admin_token)

    # Two distinct existing clients so both bookings are otherwise legitimate.
    client1_id = await _create_client_record(concurrent_client, admin_token, "Jane", "Doe")
    client2_id = await _create_client_record(concurrent_client, admin_token, "John", "Roe")

    r1, r2 = await asyncio.gather(
        _book(concurrent_client, admin_token, provider_id, type_id, client1_id, BOOKING_START),
        _book(concurrent_client, admin_token, provider_id, type_id, client2_id, BOOKING_START),
        return_exceptions=True,
    )

    for r in (r1, r2):
        assert not isinstance(r, Exception), f"concurrent booking request raised: {r!r}"

    statuses = sorted([r1.status_code, r2.status_code])
    assert statuses == [201, 409], (
        f"Expected exactly one success (201) and one conflict (409), got {statuses}: "
        f"r1={r1.status_code} {r1.text!r}, r2={r2.status_code} {r2.text!r}"
    )

    # DB truth: exactly one non-cancelled appointment for this provider+start_at,
    # regardless of which of the two racing requests happened to win.
    from app.plugins.scheduling.models import Appointment, AppointmentStatus

    async with TestSessionLocal() as session:
        result = await session.execute(
            select(Appointment).where(
                Appointment.provider_id == provider_id,
                Appointment.start_at == BOOKING_START_DT,
                Appointment.status != AppointmentStatus.cancelled,
            )
        )
        rows = result.scalars().all()

    assert len(rows) == 1, (
        f"Expected exactly one non-cancelled appointment for provider {provider_id} "
        f"at {BOOKING_START_DT}, found {len(rows)}"
    )
