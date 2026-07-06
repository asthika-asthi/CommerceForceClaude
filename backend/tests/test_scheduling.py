"""Scheduling plugin — Task 1: plugin skeleton registers and appears in the menu."""
from httpx import AsyncClient


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
