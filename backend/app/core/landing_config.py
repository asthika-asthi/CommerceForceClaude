import json
from pathlib import Path
from typing import Any
from app.core.config import get_settings


def read_landing_sections() -> list[dict[str, Any]]:
    """Read the storefront's landing-page.config.json fresh from disk every call.

    No caching: this file only changes when a superadmin edits and redeploys
    it, and a stale cache would silently show shop-admins the wrong editable
    fields until a backend restart. A disk read is cheap enough not to need one.
    """
    path = Path(get_settings().LANDING_CONFIG_PATH)
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    return data.get("sections", [])


def get_editable_section_defs() -> list[dict[str, Any]]:
    """Sections flagged adminEditable=true, with their key + allow-listed fields."""
    defs = []
    for section in read_landing_sections():
        if section.get("adminEditable") is not True:
            continue
        key = section.get("adminSectionKey")
        fields = section.get("adminEditableFields")
        if not key or not isinstance(fields, list):
            continue
        defs.append({"section_key": key, "editable_fields": fields, "section": section})
    return defs
