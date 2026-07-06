"""Scheduling plugin — Task 1: plugin skeleton registers and appears in the menu."""
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


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
