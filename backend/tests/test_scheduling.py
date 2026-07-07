"""Scheduling plugin — Task 1: plugin skeleton registers and appears in the menu."""
from datetime import datetime, timedelta, timezone

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
