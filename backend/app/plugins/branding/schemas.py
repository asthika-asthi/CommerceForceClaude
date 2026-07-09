import json
import re
from typing import Optional
from pydantic import BaseModel, field_validator, field_serializer

# GA4 measurement IDs look like "G-XXXXXXXXXX"; Meta Pixel IDs are numeric.
# These render into a <script> tag on the storefront (see analytics-scripts.tsx),
# a materially higher-severity injection surface than custom_css's <style> tag,
# so — unlike custom_css — free text is not accepted here.
_GA4_ID_RE = re.compile(r"^G-[A-Z0-9]+$")
_PIXEL_ID_RE = re.compile(r"^\d{5,20}$")


def _validate_tracking_id(value: Optional[str], pattern: re.Pattern, label: str) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if not pattern.match(trimmed):
        raise ValueError(f"Invalid {label} format")
    return trimmed


class BrandingConfigOut(BaseModel):
    id: str
    store_name: str
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str
    secondary_color: str
    font_family: str
    custom_css: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    social_links: Optional[dict] = None
    stripe_publishable_key: Optional[str] = None
    ga4_measurement_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None
    theme_colors: dict = {}
    model_config = {"from_attributes": True}

    @field_validator("social_links", mode="before")
    @classmethod
    def parse_social_links(cls, v: object) -> Optional[dict]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return None
        return v if isinstance(v, dict) else None


class BrandingConfigUpdate(BaseModel):
    store_name: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    font_family: Optional[str] = None
    custom_css: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    social_links: Optional[dict] = None
    stripe_publishable_key: Optional[str] = None
    ga4_measurement_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None
    theme_colors: Optional[dict] = None

    @field_validator("ga4_measurement_id")
    @classmethod
    def validate_ga4_id(cls, v: Optional[str]) -> Optional[str]:
        return _validate_tracking_id(v, _GA4_ID_RE, "GA4 measurement ID (expected e.g. G-ABC1234567)")

    @field_validator("meta_pixel_id")
    @classmethod
    def validate_meta_pixel_id(cls, v: Optional[str]) -> Optional[str]:
        return _validate_tracking_id(v, _PIXEL_ID_RE, "Meta Pixel ID (expected a numeric ID)")

    @field_validator("social_links", mode="before")
    @classmethod
    def parse_social_links(cls, v: object) -> Optional[dict]:
        if isinstance(v, str):
            if not v.strip():
                return None
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else None
            except (json.JSONDecodeError, ValueError):
                return None
        return v if isinstance(v, dict) else None

    @field_serializer("social_links")
    def serialize_social_links(self, v: Optional[dict]) -> Optional[str]:
        return json.dumps(v) if v is not None else None
