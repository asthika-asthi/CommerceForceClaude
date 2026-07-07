"""Scheduling plugin — Task 1: plugin skeleton registers and appears in the menu."""
from datetime import date, datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_commerce import CUSTOMER_DATA, make_admin, register_and_token


async def test_plugin_registered(client: AsyncClient):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert "scheduling" in r.json()["plugins"]

    r = await client.get("/api/menu")
    assert r.status_code == 200
    admin_menu = r.json()["admin_menu"]
    assert any(entry["plugin"] == "scheduling" for entry in admin_menu)


async def test_config_endpoint(client: AsyncClient):
    r = await client.get("/api/scheduling/config")
    assert r.status_code == 200
    body = r.json()

    assert body["terms"]["client_singular"] == "Patient"
    assert body["terms"]["provider_singular"] == "Doctor"

    assert body["note_template"]["name"] == "soap"
    field_keys = [f["key"] for f in body["note_template"]["fields"]]
    assert field_keys == ["subjective", "objective", "assessment", "plan"]

    assert isinstance(body["intake_schema"], list) and len(body["intake_schema"]) > 0
    assert any(f["key"] == "allergies" for f in body["intake_schema"])


async def test_models_create_tables(db: AsyncSession):
    from app.plugins.scheduling.models import Appointment, AppointmentType, Client, Provider

    provider = Provider(display_name="Dr Smith")
    appointment_type = AppointmentType(name="Consult", duration_minutes=30)
    provider.appointment_types.append(appointment_type)
    client_obj = Client(first_name="Jane", last_name="Doe")

    db.add(provider)
    db.add(appointment_type)
    db.add(client_obj)
    await db.flush()

    assert provider.id is not None
    assert appointment_type.id is not None
    assert client_obj.id is not None

    start_at = datetime.now(timezone.utc)
    end_at = start_at + timedelta(minutes=30)
    appointment = Appointment(
        provider_id=provider.id,
        client_id=client_obj.id,
        appointment_type_id=appointment_type.id,
        start_at=start_at,
        end_at=end_at,
    )
    db.add(appointment)
    await db.flush()

    assert appointment.id is not None
    assert appointment.provider.display_name == "Dr Smith"
    assert appointment.client.first_name == "Jane"


# ── PROVIDERS CRUD (Task 4) ────────────────────────────────────────────────────

async def test_provider_crud(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/providers",
        json={"display_name": "Dr Smith", "title": "GP"},
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["id"]
    assert body["is_active"] is True
    provider_id = body["id"]

    r = await client.get("/api/scheduling/providers", headers=headers)
    assert r.status_code == 200
    listed = r.json()
    assert any(p["id"] == provider_id for p in listed["items"])

    r = await client.patch(
        f"/api/scheduling/providers/{provider_id}",
        json={"title": "Consultant"},
        headers=headers,
    )
    assert r.status_code == 200

    r = await client.get(f"/api/scheduling/providers/{provider_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["title"] == "Consultant"

    r = await client.delete(f"/api/scheduling/providers/{provider_id}", headers=headers)
    assert r.status_code == 204

    r = await client.get(f"/api/scheduling/providers/{provider_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["is_active"] is False

    r = await client.get("/api/scheduling/providers?active_only=true", headers=headers)
    assert r.status_code == 200
    assert not any(p["id"] == provider_id for p in r.json()["items"])


async def test_provider_requires_admin(client: AsyncClient):
    token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/scheduling/providers",
        json={"display_name": "Dr Jones"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403

    r = await client.post(
        "/api/scheduling/providers",
        json={"display_name": "Dr Jones"},
    )
    assert r.status_code == 401


async def test_provider_get_missing_404(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    r = await client.get(
        "/api/scheduling/providers/nonexistent-id",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404


# ── APPOINTMENT TYPES CRUD (Task 5) ────────────────────────────────────────────

async def test_appointment_type_crud(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/providers",
        json={"display_name": "Dr House"},
        headers=headers,
    )
    assert r.status_code == 201
    provider_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Consultation", "duration_minutes": 30, "provider_ids": [provider_id]},
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Consultation"
    assert body["duration_minutes"] == 30
    assert len(body["providers"]) == 1
    assert body["providers"][0]["id"] == provider_id
    assert body["providers"][0]["display_name"] == "Dr House"
    type_id = body["id"]

    r = await client.get(f"/api/scheduling/appointment-types/{type_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["providers"][0]["id"] == provider_id

    r = await client.get(
        f"/api/scheduling/appointment-types?provider_id={provider_id}",
        headers=headers,
    )
    assert r.status_code == 200
    assert any(t["id"] == type_id for t in r.json()["items"])

    r = await client.patch(
        f"/api/scheduling/appointment-types/{type_id}",
        json={"duration_minutes": 45},
        headers=headers,
    )
    assert r.status_code == 200

    r = await client.get(f"/api/scheduling/appointment-types/{type_id}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["duration_minutes"] == 45
    assert len(body["providers"]) == 1
    assert body["providers"][0]["id"] == provider_id

    r = await client.delete(f"/api/scheduling/appointment-types/{type_id}", headers=headers)
    assert r.status_code == 204

    r = await client.get("/api/scheduling/appointment-types?active_only=true", headers=headers)
    assert r.status_code == 200
    assert not any(t["id"] == type_id for t in r.json()["items"])


async def test_type_rejects_unknown_provider(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Checkup", "duration_minutes": 15, "provider_ids": ["does-not-exist"]},
        headers=headers,
    )
    assert r.status_code == 404


async def test_type_update_replaces_providers(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "P1"}, headers=headers
    )
    p1_id = r.json()["id"]
    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "P2"}, headers=headers
    )
    p2_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Followup", "duration_minutes": 20, "provider_ids": [p1_id]},
        headers=headers,
    )
    assert r.status_code == 201
    type_id = r.json()["id"]

    r = await client.patch(
        f"/api/scheduling/appointment-types/{type_id}",
        json={"provider_ids": [p2_id]},
        headers=headers,
    )
    assert r.status_code == 200

    r = await client.get(f"/api/scheduling/appointment-types/{type_id}", headers=headers)
    assert r.status_code == 200
    provider_ids = [p["id"] for p in r.json()["providers"]]
    assert provider_ids == [p2_id]


async def test_appointment_type_requires_admin(client: AsyncClient):
    token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Consultation", "duration_minutes": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


# ── AVAILABILITY + EXCEPTIONS CRUD (Task 6) ────────────────────────────────────

async def test_availability_crud(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "Dr Avail"}, headers=headers
    )
    assert r.status_code == 201
    provider_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/availability",
        json={"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["weekday"] == 0
    assert body["provider_id"] == provider_id
    availability_id = body["id"]

    r = await client.get(
        f"/api/scheduling/providers/{provider_id}/availability", headers=headers
    )
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/availability",
        json={"weekday": 1, "start_time": "17:00:00", "end_time": "09:00:00"},
        headers=headers,
    )
    assert r.status_code == 422

    r = await client.delete(
        f"/api/scheduling/availability/{availability_id}", headers=headers
    )
    assert r.status_code == 204

    r = await client.get(
        f"/api/scheduling/providers/{provider_id}/availability", headers=headers
    )
    assert r.status_code == 200
    assert r.json() == []


async def test_exception_crud(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "Dr Except"}, headers=headers
    )
    assert r.status_code == 201
    provider_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/exceptions",
        json={"date": "2026-08-03", "is_available": False},
        headers=headers,
    )
    assert r.status_code == 201
    block_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/exceptions",
        json={"date": "2026-08-04", "is_available": True},
        headers=headers,
    )
    assert r.status_code == 422

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/exceptions",
        json={
            "date": "2026-08-04",
            "is_available": True,
            "start_time": "10:00:00",
            "end_time": "12:00:00",
        },
        headers=headers,
    )
    assert r.status_code == 201
    extra_id = r.json()["id"]

    r = await client.get(
        f"/api/scheduling/providers/{provider_id}/exceptions"
        "?from=2026-08-04&to=2026-08-04",
        headers=headers,
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["date"] == "2026-08-04"

    r = await client.delete(
        f"/api/scheduling/exceptions/{block_id}", headers=headers
    )
    assert r.status_code == 204
    r = await client.delete(
        f"/api/scheduling/exceptions/{extra_id}", headers=headers
    )
    assert r.status_code == 204


async def test_availability_requires_admin(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    r = await client.post(
        "/api/scheduling/providers",
        json={"display_name": "Dr NoAccess"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    provider_id = r.json()["id"]

    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/availability",
        json={"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_availability_provider_missing_404(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    r = await client.post(
        "/api/scheduling/providers/nonexistent-id/availability",
        json={"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404


# ── OPEN SLOT COMPUTATION + PUBLIC AVAILABILITY (Task 7) ───────────────────────

async def _setup_basic_availability(
    client: AsyncClient,
    headers: dict,
    weekday: int = 0,
    start_time: str = "09:00:00",
    end_time: str = "11:00:00",
    duration_minutes: int = 30,
) -> tuple[str, str]:
    """Create a provider + a 30-min appointment type + a weekly availability window."""
    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "Dr Slots"}, headers=headers
    )
    assert r.status_code == 201
    provider_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Consult", "duration_minutes": duration_minutes},
        headers=headers,
    )
    assert r.status_code == 201
    type_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/availability",
        json={"weekday": weekday, "start_time": start_time, "end_time": end_time},
        headers=headers,
    )
    assert r.status_code == 201

    return provider_id, type_id


async def test_slots_basic(client: AsyncClient, db: AsyncSession):
    assert date(2026, 8, 3).weekday() == 0  # Monday — deterministic fixture date

    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_basic_availability(client, headers)

    r = await client.get(
        "/api/scheduling/availability",
        params={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "date_from": "2026-08-03",
            "date_to": "2026-08-03",
        },
    )
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert len(slots) == 4
    times = [s[11:16] for s in slots]
    assert times == ["09:00", "09:30", "10:00", "10:30"]


async def test_slots_excludes_booked(client: AsyncClient, db: AsyncSession):
    from app.plugins.scheduling.models import Appointment, AppointmentStatus, Client

    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_basic_availability(client, headers)

    client_obj = Client(first_name="Jane", last_name="Doe")
    db.add(client_obj)
    await db.flush()

    appt = Appointment(
        provider_id=provider_id,
        client_id=client_obj.id,
        appointment_type_id=type_id,
        start_at=datetime(2026, 8, 3, 9, 30, tzinfo=timezone.utc),
        end_at=datetime(2026, 8, 3, 10, 0, tzinfo=timezone.utc),
        status=AppointmentStatus.confirmed,
    )
    db.add(appt)
    await db.flush()

    r = await client.get(
        "/api/scheduling/availability",
        params={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "date_from": "2026-08-03",
            "date_to": "2026-08-03",
        },
    )
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert len(slots) == 3
    times = [s[11:16] for s in slots]
    assert "09:30" not in times
    assert times == ["09:00", "10:00", "10:30"]


async def test_slots_respects_block_exception(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_basic_availability(client, headers)

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/exceptions",
        json={"date": "2026-08-03", "is_available": False},
        headers=headers,
    )
    assert r.status_code == 201

    r = await client.get(
        "/api/scheduling/availability",
        params={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "date_from": "2026-08-03",
            "date_to": "2026-08-03",
        },
    )
    assert r.status_code == 200
    assert r.json()["slots"] == []


async def test_slots_timed_block_exception(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_basic_availability(client, headers)

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/exceptions",
        json={
            "date": "2026-08-03",
            "is_available": False,
            "start_time": "09:30:00",
            "end_time": "10:00:00",
        },
        headers=headers,
    )
    assert r.status_code == 201

    r = await client.get(
        "/api/scheduling/availability",
        params={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "date_from": "2026-08-03",
            "date_to": "2026-08-03",
        },
    )
    assert r.status_code == 200
    slots = r.json()["slots"]
    times = [s[11:16] for s in slots]
    assert "09:30" not in times
    assert times == ["09:00", "10:00", "10:30"]


async def test_exception_partial_block_rejected(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "Dr Partial"}, headers=headers
    )
    assert r.status_code == 201
    provider_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/exceptions",
        json={"date": "2026-08-03", "is_available": False, "start_time": "09:00:00"},
        headers=headers,
    )
    assert r.status_code == 422


async def test_slots_range_cap(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_basic_availability(client, headers)

    r = await client.get(
        "/api/scheduling/availability",
        params={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "date_from": "2026-08-03",
            "date_to": "2026-09-30",
        },
    )
    assert r.status_code == 400


async def test_slots_public_no_auth(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_basic_availability(client, headers)

    # No Authorization header on this request — endpoint must be public.
    r = await client.get(
        "/api/scheduling/availability",
        params={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "date_from": "2026-08-03",
            "date_to": "2026-08-03",
        },
    )
    assert r.status_code == 200


# ── CLIENTS CRUD + CUSTOMER SELF-RECORD (Task 8) ───────────────────────────────

async def test_client_crud(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe", "email": "jane@ex.com"},
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["id"]
    assert body["is_active"] is True
    client_id = body["id"]

    r = await client.get("/api/scheduling/clients", headers=headers)
    assert r.status_code == 200
    assert any(c["id"] == client_id for c in r.json()["items"])

    r = await client.get("/api/scheduling/clients?search=doe", headers=headers)
    assert r.status_code == 200
    assert any(c["id"] == client_id for c in r.json()["items"])

    r = await client.get("/api/scheduling/clients?search=zzz", headers=headers)
    assert r.status_code == 200
    assert not any(c["id"] == client_id for c in r.json()["items"])

    r = await client.patch(
        f"/api/scheduling/clients/{client_id}",
        json={"phone": "5551234"},
        headers=headers,
    )
    assert r.status_code == 200

    r = await client.get(f"/api/scheduling/clients/{client_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["phone"] == "5551234"

    r = await client.delete(f"/api/scheduling/clients/{client_id}", headers=headers)
    assert r.status_code == 204

    r = await client.get(f"/api/scheduling/clients/{client_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["is_active"] is False


async def test_client_me(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    cust_data = {
        "email": "client-me-cust@example.com",
        "password": "custpass1",
        "first_name": "Sam",
        "last_name": "Client",
    }
    cust_token = await register_and_token(client, cust_data)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    r = await client.get("/api/auth/me", headers=cust_headers)
    assert r.status_code == 200
    user_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Sam", "last_name": "Client", "user_id": user_id},
        headers=admin_headers,
    )
    assert r.status_code == 201
    linked_client_id = r.json()["id"]

    r = await client.get("/api/scheduling/clients/me", headers=cust_headers)
    assert r.status_code == 200
    assert r.json()["id"] == linked_client_id

    r = await client.patch(
        "/api/scheduling/clients/me",
        json={"phone": "12345"},
        headers=cust_headers,
    )
    assert r.status_code == 200
    assert r.json()["phone"] == "12345"

    other_cust_data = {
        "email": "client-me-other@example.com",
        "password": "custpass1",
        "first_name": "Other",
        "last_name": "Customer",
    }
    other_token = await register_and_token(client, other_cust_data)
    r = await client.get(
        "/api/scheduling/clients/me",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert r.status_code == 404


async def test_client_me_requires_auth(client: AsyncClient):
    r = await client.get("/api/scheduling/clients/me")
    assert r.status_code == 401


async def test_client_requires_admin(client: AsyncClient):
    token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


async def test_get_or_create_client_for_user_idempotent(client: AsyncClient, db: AsyncSession):
    from app.plugins.scheduling import service

    cust_data = {
        "email": "getorcreate-cust@example.com",
        "password": "custpass1",
        "first_name": "Alice",
        "last_name": "Idempo",
    }
    token = await register_and_token(client, cust_data)
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    uid = r.json()["id"]

    created = await service.get_or_create_client_for_user(
        uid, db, defaults={"first_name": "A", "last_name": "B", "email": "a@b.com"}
    )
    assert created.first_name == "A"
    first_id = created.id

    again = await service.get_or_create_client_for_user(
        uid, db, defaults={"first_name": "A", "last_name": "B", "email": "a@b.com"}
    )
    assert again.id == first_id

    from sqlalchemy import func, select

    from app.plugins.scheduling.models import Client

    count = (
        await db.execute(
            select(func.count()).select_from(Client).where(Client.user_id == uid)
        )
    ).scalar_one()
    assert count == 1


# ── APPOINTMENT BOOKING + LIFECYCLE (Task 9) ───────────────────────────────────

BOOKING_START = "2026-08-03T09:00:00+00:00"  # Monday — matches slot-test fixture date


async def _setup_booking_fixture(client: AsyncClient, headers: dict) -> tuple[str, str]:
    """Create a provider + a 30-min appointment type LINKED to that provider + Monday availability."""
    r = await client.post(
        "/api/scheduling/providers", json={"display_name": "Dr Book"}, headers=headers
    )
    assert r.status_code == 201
    provider_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Consult", "duration_minutes": 30, "provider_ids": [provider_id]},
        headers=headers,
    )
    assert r.status_code == 201
    type_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/providers/{provider_id}/availability",
        json={"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
        headers=headers,
    )
    assert r.status_code == 201

    return provider_id, type_id


async def test_admin_books_for_existing_client(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_booking_fixture(client, headers)

    r = await client.get("/api/auth/me", headers=headers)
    admin_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe", "email": "jane@ex.com"},
        headers=headers,
    )
    assert r.status_code == 201
    client_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": BOOKING_START,
        },
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["start_at"][:19] == BOOKING_START[:19]
    assert body["end_at"][11:19] == "09:30:00"
    assert body["status"] == "confirmed"
    assert body["booked_by"] == admin_id
    assert body["client_id"] == client_id


async def test_customer_books_self(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    cust_data = {
        "email": "book-self-cust@example.com",
        "password": "custpass1",
        "first_name": "Sam",
        "last_name": "Selfbook",
    }
    cust_token = await register_and_token(client, cust_data)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": BOOKING_START,
        },
        headers=cust_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["booked_by"] == "self"
    appt_id = body["id"]

    from sqlalchemy import select as sa_select

    from app.plugins.scheduling.models import Client as ClientModel

    r = await client.get("/api/auth/me", headers=cust_headers)
    uid = r.json()["id"]
    result = await db.execute(sa_select(ClientModel).where(ClientModel.user_id == uid))
    client_obj = result.scalar_one_or_none()
    assert client_obj is not None
    assert client_obj.id == body["client_id"]

    r = await client.get("/api/scheduling/appointments", headers=cust_headers)
    assert r.status_code == 200
    assert any(a["id"] == appt_id for a in r.json()["items"])


async def test_guest_books_with_email(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": BOOKING_START,
            "first_name": "Guest",
            "last_name": "Person",
            "email": "guest@example.com",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["booked_by"] == "guest"

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": "2026-08-03T10:00:00+00:00",
            "first_name": "NoEmail",
            "last_name": "Guest",
        },
    )
    assert r.status_code == 400


async def test_double_booking_rejected(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe"},
        headers=admin_headers,
    )
    client_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": BOOKING_START,
        },
        headers=admin_headers,
    )
    assert r.status_code == 201

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": "2026-08-03T09:15:00+00:00",
        },
        headers=admin_headers,
    )
    assert r.status_code == 409


async def test_provider_must_offer_type(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, _type_id = await _setup_booking_fixture(client, admin_headers)

    r = await client.post(
        "/api/scheduling/appointment-types",
        json={"name": "Unlinked", "duration_minutes": 30},
        headers=admin_headers,
    )
    assert r.status_code == 201
    unlinked_type_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": unlinked_type_id,
            "start_at": BOOKING_START,
            "first_name": "Guest",
            "last_name": "Person",
            "email": "guest2@example.com",
        },
    )
    assert r.status_code == 400


async def test_customer_cancels_own_and_cannot_cancel_others(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    cust_data = {
        "email": "cancel-own-cust@example.com",
        "password": "custpass1",
        "first_name": "Cancel",
        "last_name": "Owner",
    }
    cust_token = await register_and_token(client, cust_data)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": BOOKING_START,
        },
        headers=cust_headers,
    )
    assert r.status_code == 201
    appt_id = r.json()["id"]

    other_data = {
        "email": "cancel-other-cust@example.com",
        "password": "custpass1",
        "first_name": "Other",
        "last_name": "Customer",
    }
    other_token = await register_and_token(client, other_data)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    r = await client.post(
        f"/api/scheduling/appointments/{appt_id}/cancel",
        json={},
        headers=other_headers,
    )
    assert r.status_code == 403

    r = await client.post(
        f"/api/scheduling/appointments/{appt_id}/cancel",
        json={},
        headers=cust_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


async def test_illegal_status_transition(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_booking_fixture(client, headers)

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe"},
        headers=headers,
    )
    client_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": BOOKING_START,
        },
        headers=headers,
    )
    assert r.status_code == 201
    appt_id = r.json()["id"]
    assert r.json()["status"] == "confirmed"

    r = await client.patch(
        f"/api/scheduling/appointments/{appt_id}/status",
        json={"status": "cancelled", "cancellation_reason": "no longer needed"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    r = await client.patch(
        f"/api/scheduling/appointments/{appt_id}/status",
        json={"status": "confirmed"},
        headers=headers,
    )
    assert r.status_code == 409


async def test_reschedule_moves_slot(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_booking_fixture(client, headers)

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe"},
        headers=headers,
    )
    client_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": BOOKING_START,
        },
        headers=headers,
    )
    assert r.status_code == 201
    appt_id = r.json()["id"]

    r = await client.post(
        f"/api/scheduling/appointments/{appt_id}/reschedule",
        json={"start_at": "2026-08-03T10:00:00+00:00"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["start_at"][11:19] == "10:00:00"
    assert body["end_at"][11:19] == "10:30:00"

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": BOOKING_START,
        },
        headers=headers,
    )
    assert r.status_code == 201


async def test_reschedule_into_occupied_slot_rejected(client: AsyncClient, db: AsyncSession):
    token = await make_admin(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    provider_id, type_id = await _setup_booking_fixture(client, headers)

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe"},
        headers=headers,
    )
    client_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": BOOKING_START,
        },
        headers=headers,
    )
    assert r.status_code == 201

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "client_id": client_id,
            "start_at": "2026-08-03T10:00:00+00:00",
        },
        headers=headers,
    )
    assert r.status_code == 201
    appt_b_id = r.json()["id"]

    # Reschedule B onto A's slot — exercises the exclude-self overlap branch against a real conflict.
    r = await client.post(
        f"/api/scheduling/appointments/{appt_b_id}/reschedule",
        json={"start_at": BOOKING_START},
        headers=headers,
    )
    assert r.status_code == 409


async def test_customer_cannot_book_past(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    cust_token = await register_and_token(client, {
        "email": "book-past-cust@example.com",
        "password": "custpass1",
        "first_name": "Past",
        "last_name": "Booker",
    })
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": "2020-01-01T09:00:00+00:00",
        },
        headers=cust_headers,
    )
    assert r.status_code == 400


async def test_customer_list_excludes_others(client: AsyncClient, db: AsyncSession):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    cust1_token = await register_and_token(client, {
        "email": "list-cust1@example.com",
        "password": "custpass1",
        "first_name": "Cust",
        "last_name": "One",
    })
    cust1_headers = {"Authorization": f"Bearer {cust1_token}"}

    cust2_token = await register_and_token(client, {
        "email": "list-cust2@example.com",
        "password": "custpass1",
        "first_name": "Cust",
        "last_name": "Two",
    })
    cust2_headers = {"Authorization": f"Bearer {cust2_token}"}

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": BOOKING_START,
        },
        headers=cust1_headers,
    )
    assert r.status_code == 201
    cust1_appt_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": "2026-08-03T10:00:00+00:00",
        },
        headers=cust2_headers,
    )
    assert r.status_code == 201
    cust2_appt_id = r.json()["id"]

    r = await client.get("/api/scheduling/appointments", headers=cust1_headers)
    assert r.status_code == 200
    ids = [a["id"] for a in r.json()["items"]]
    assert cust1_appt_id in ids
    assert cust2_appt_id not in ids


# ── BOOKING CONFIRMATION EMAIL (Task 11) ────────────────────────────────────────

async def test_booking_sends_confirmation(client: AsyncClient, db: AsyncSession, monkeypatch):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    calls = []

    async def fake_send_email(to, subject, body, db):
        calls.append((to, subject))
        return True

    monkeypatch.setattr("app.plugins.scheduling.service.send_email", fake_send_email)

    guest_email = "confirm-guest@example.com"
    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": BOOKING_START,
            "first_name": "Confirm",
            "last_name": "Guest",
            "email": guest_email,
        },
    )
    assert r.status_code == 201

    assert len(calls) == 1
    to, subject = calls[0]
    assert to == guest_email
    assert subject == "Your Visit is confirmed"


async def test_booking_email_failure_does_not_break_booking(client: AsyncClient, db: AsyncSession, monkeypatch):
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    async def failing_send_email(to, subject, body, db):
        raise RuntimeError("smtp down")

    monkeypatch.setattr("app.plugins.scheduling.service.send_email", failing_send_email)

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": BOOKING_START,
            "first_name": "Fail",
            "last_name": "Guest",
            "email": "fail-email-guest@example.com",
        },
    )
    assert r.status_code == 201


# ── PROVIDER-SCOPED JOURNAL + AUDIT LOG (Task 12) ───────────────────────────────

SOAP_CONTENT = {
    "subjective": "Patient reports mild headache.",
    "objective": "BP 120/80.",
    "assessment": "Tension headache.",
    "plan": "Rest and hydration.",
}


async def _make_user_with_role(client: AsyncClient, db, email: str, role: str) -> str:
    """Register a fresh user with `email` then promote them to `role` via the DB
    (mirrors make_admin, but parameterized so tests can create a second, distinct
    admin, or a superadmin). Returns a fresh access token for that role."""
    from sqlalchemy import update

    from app.plugins.auth.models import User, UserRole

    password = "testpass1"
    await register_and_token(client, {
        "email": email,
        "password": password,
        "first_name": "Test",
        "last_name": "User",
    })
    await db.execute(update(User).where(User.email == email).values(role=UserRole(role)))
    await db.flush()
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    return r.json()["access_token"]


async def _user_id(client: AsyncClient, token: str) -> str:
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    return r.json()["id"]


async def _setup_journal_fixture(client: AsyncClient, db: AsyncSession) -> dict:
    """Admin user becomes "Provider A", linked via Provider.user_id, with a real
    relationship to a client (an appointment) so provider-scoped access is allowed."""
    admin_token = await make_admin(client, db)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_user_id = await _user_id(client, admin_token)

    provider_id, type_id = await _setup_booking_fixture(client, admin_headers)

    r = await client.patch(
        f"/api/scheduling/providers/{provider_id}",
        json={"user_id": admin_user_id},
        headers=admin_headers,
    )
    assert r.status_code == 200

    r = await client.post(
        "/api/scheduling/clients",
        json={"first_name": "Jane", "last_name": "Doe", "email": "jane-journal@example.com"},
        headers=admin_headers,
    )
    assert r.status_code == 201
    client_id = r.json()["id"]

    r = await client.post(
        "/api/scheduling/appointments",
        json={
            "provider_id": provider_id,
            "appointment_type_id": type_id,
            "start_at": BOOKING_START,
            "client_id": client_id,
        },
        headers=admin_headers,
    )
    assert r.status_code == 201

    return {
        "admin_token": admin_token,
        "admin_headers": admin_headers,
        "admin_user_id": admin_user_id,
        "provider_id": provider_id,
        "type_id": type_id,
        "client_id": client_id,
    }


async def test_provider_creates_and_reads_journal(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    r = await client.post(
        f"/api/scheduling/clients/{fx['client_id']}/journal",
        json={"template": "soap", "content": SOAP_CONTENT},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 201
    body = r.json()
    assert body["client_id"] == fx["client_id"]
    assert body["provider_id"] == fx["provider_id"]
    assert body["template"] == "soap"
    assert body["content"] == SOAP_CONTENT
    entry_id = body["id"]

    r = await client.get(f"/api/scheduling/clients/{fx['client_id']}/journal", headers=fx["admin_headers"])
    assert r.status_code == 200
    items = r.json()
    assert any(item["id"] == entry_id for item in items)

    r = await client.get(f"/api/scheduling/journal/{entry_id}", headers=fx["admin_headers"])
    assert r.status_code == 200
    assert r.json()["content"] == SOAP_CONTENT


async def test_journal_audit_rows_written(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    r = await client.post(
        f"/api/scheduling/clients/{fx['client_id']}/journal",
        json={"template": "soap", "content": SOAP_CONTENT},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 201
    entry_id = r.json()["id"]

    r = await client.get(f"/api/scheduling/journal/{entry_id}", headers=fx["admin_headers"])
    assert r.status_code == 200

    from sqlalchemy import select

    from app.plugins.scheduling.models import NoteAccessLog

    result = await db.execute(select(NoteAccessLog).where(NoteAccessLog.client_id == fx["client_id"]))
    logs = list(result.scalars().all())
    actions = [log.action for log in logs]
    assert "create" in actions
    assert "view" in actions
    assert all(log.user_id == fx["admin_user_id"] for log in logs)


async def test_journal_edit_logs_audit(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    r = await client.post(
        f"/api/scheduling/clients/{fx['client_id']}/journal",
        json={"template": "soap", "content": SOAP_CONTENT},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 201
    entry_id = r.json()["id"]

    updated_content = {**SOAP_CONTENT, "plan": "Follow up in 2 weeks."}
    r = await client.patch(
        f"/api/scheduling/journal/{entry_id}",
        json={"content": updated_content},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 200
    assert r.json()["content"] == updated_content

    from sqlalchemy import select

    from app.plugins.scheduling.models import NoteAccessLog

    result = await db.execute(select(NoteAccessLog).where(NoteAccessLog.journal_entry_id == entry_id))
    actions = [log.action for log in result.scalars().all()]
    assert "edit" in actions


async def test_unrelated_provider_denied(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    b_token = await _make_user_with_role(client, db, "provider-b@example.com", "admin")
    b_user_id = await _user_id(client, b_token)
    b_headers = {"Authorization": f"Bearer {b_token}"}

    r = await client.post(
        "/api/scheduling/providers",
        json={"display_name": "Dr B", "user_id": b_user_id, "can_view_all_clients": False},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 201

    r = await client.get(f"/api/scheduling/clients/{fx['client_id']}/journal", headers=b_headers)
    assert r.status_code == 403


async def test_can_view_all_clients_flag(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    c_token = await _make_user_with_role(client, db, "provider-c@example.com", "admin")
    c_user_id = await _user_id(client, c_token)
    c_headers = {"Authorization": f"Bearer {c_token}"}

    r = await client.post(
        "/api/scheduling/providers",
        json={"display_name": "Dr C", "user_id": c_user_id, "can_view_all_clients": True},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 201

    r = await client.get(f"/api/scheduling/clients/{fx['client_id']}/journal", headers=c_headers)
    assert r.status_code == 200


async def test_admin_without_provider_denied(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    d_token = await _make_user_with_role(client, db, "admin-no-provider@example.com", "admin")
    d_headers = {"Authorization": f"Bearer {d_token}"}

    r = await client.get(f"/api/scheduling/clients/{fx['client_id']}/journal", headers=d_headers)
    assert r.status_code == 403


async def test_superadmin_can_read_and_audit(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    r = await client.post(
        f"/api/scheduling/clients/{fx['client_id']}/journal",
        json={"template": "soap", "content": SOAP_CONTENT},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 201

    sa_token = await _make_user_with_role(client, db, "superadmin-journal@example.com", "superadmin")
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    r = await client.get(f"/api/scheduling/clients/{fx['client_id']}/journal", headers=sa_headers)
    assert r.status_code == 200

    r = await client.get("/api/scheduling/audit", headers=sa_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1


async def test_journal_bad_template_rejected(client: AsyncClient, db: AsyncSession):
    fx = await _setup_journal_fixture(client, db)

    r = await client.post(
        f"/api/scheduling/clients/{fx['client_id']}/journal",
        json={"template": "nonsense", "content": {}},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 422

    r = await client.post(
        f"/api/scheduling/clients/{fx['client_id']}/journal",
        json={
            "template": "soap",
            "content": {"subjective": "x", "objective": "y", "assessment": "z"},
        },
        headers=fx["admin_headers"],
    )
    assert r.status_code == 422

    r = await client.post(
        f"/api/scheduling/clients/{fx['client_id']}/journal",
        json={"template": "soap", "content": {**SOAP_CONTENT, "extra_key": "nope"}},
        headers=fx["admin_headers"],
    )
    assert r.status_code == 422
