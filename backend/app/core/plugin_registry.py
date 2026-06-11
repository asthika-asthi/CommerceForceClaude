import importlib
from typing import Any
from fastapi import FastAPI
from app.core.config import settings

_registered_manifests: list[dict] = []


def get_manifests() -> list[dict]:
    return _registered_manifests


def register_plugins(app: FastAPI) -> None:
    _registered_manifests.clear()

    enabled_plugins: set[str] = set(settings.enabled_plugins)

    for plugin_name in settings.enabled_plugins:
        try:
            module = importlib.import_module(f"app.plugins.{plugin_name}")
        except ModuleNotFoundError:
            raise RuntimeError(f"Plugin '{plugin_name}' listed in ENABLED_PLUGINS but not found at app/plugins/{plugin_name}/")

        if not hasattr(module, "MANIFEST"):
            raise RuntimeError(f"Plugin '{plugin_name}' is missing a MANIFEST in its __init__.py")

        manifest: dict[str, Any] = module.MANIFEST
        _validate_manifest(plugin_name, manifest, enabled_plugins)

        if hasattr(module, "router"):
            app.include_router(module.router, prefix=f"/api/{plugin_name}", tags=[manifest["label"]])

        _registered_manifests.append(manifest)
        print(f"  + Plugin loaded: {plugin_name}")


def _validate_manifest(name: str, manifest: dict, enabled_plugins: set[str]) -> None:
    required = {"name", "label", "admin_menu", "superadmin_menu"}
    missing = required - manifest.keys()
    if missing:
        raise RuntimeError(f"Plugin '{name}' manifest missing required keys: {missing}")
    for dep in manifest.get("depends_on", []):
        if dep not in enabled_plugins:
            raise RuntimeError(
                f"Plugin '{name}' requires plugin '{dep}' to be enabled "
                f"(add '{dep}' to ENABLED_PLUGINS)"
            )
