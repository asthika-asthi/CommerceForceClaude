import json
import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator, field_serializer, model_validator

# Allowed values for the storefront text scale and the header sizing preset.
# Kept in sync with frontend-starter/lib/header-config.ts.
_BASE_FONT_SIZES = {"compact", "default", "comfortable", "large", "xlarge"}
_HEADER_SIZES = {"compact", "standard", "large", "xlarge"}
_VARIANT_DISPLAYS = {"dropdown", "buttons"}

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
    show_store_name: bool = True
    enable_cash_on_delivery: bool = True
    show_bespoke_enquiry: bool = False
    show_best_sellers_card: bool = False
    tagline: Optional[str] = None
    hero_heading: Optional[str] = None
    hero_heading_highlight: Optional[str] = None
    hero_image_url: Optional[str] = None
    hero_image_alt: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    catalogue_url: Optional[str] = None
    base_font_size: str = "default"
    header_size: str = "standard"
    variant_display: str = "dropdown"
    header_elevated: bool = False
    header_filled: bool = False
    header_shrink_on_scroll: bool = False
    primary_color: str
    secondary_color: str
    font_family: str
    custom_css: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    opening_hours: Optional[str] = None
    social_links: Optional[dict] = None
    stripe_publishable_key: Optional[str] = None
    bank_transfer_details: Optional[str] = None
    paypal_email: Optional[str] = None
    ga4_measurement_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None
    company_number: Optional[str] = None
    vat_number: Optional[str] = None
    eori_number: Optional[str] = None
    trademark_number: Optional[str] = None
    delivery_promo_text: Optional[str] = None
    dispatch_days: Optional[int] = None
    dispatch_title: str = "Same Day Despatch"
    dispatch_subtitle: str = "Orders placed before 2pm"
    transit_days_min: Optional[int] = None
    transit_days_max: Optional[int] = None
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
    show_store_name: Optional[bool] = None
    enable_cash_on_delivery: Optional[bool] = None
    show_bespoke_enquiry: Optional[bool] = None
    show_best_sellers_card: Optional[bool] = None
    tagline: Optional[str] = None
    hero_heading: Optional[str] = None
    hero_heading_highlight: Optional[str] = None
    hero_image_url: Optional[str] = None
    hero_image_alt: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    catalogue_url: Optional[str] = None
    base_font_size: Optional[str] = None
    header_size: Optional[str] = None
    variant_display: Optional[str] = None
    header_elevated: Optional[bool] = None
    header_filled: Optional[bool] = None
    header_shrink_on_scroll: Optional[bool] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    font_family: Optional[str] = None
    custom_css: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    opening_hours: Optional[str] = None
    social_links: Optional[dict] = None
    stripe_publishable_key: Optional[str] = None
    bank_transfer_details: Optional[str] = None
    paypal_email: Optional[str] = None
    ga4_measurement_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None
    company_number: Optional[str] = None
    vat_number: Optional[str] = None
    eori_number: Optional[str] = None
    trademark_number: Optional[str] = None
    delivery_promo_text: Optional[str] = None
    dispatch_days: Optional[int] = None
    dispatch_title: Optional[str] = Field(None, max_length=100)
    dispatch_subtitle: Optional[str] = Field(None, max_length=200)
    transit_days_min: Optional[int] = None
    transit_days_max: Optional[int] = None
    theme_colors: Optional[dict] = None

    @model_validator(mode="after")
    def _validate_delivery_days(self) -> "BrandingConfigUpdate":
        for field in ("dispatch_days", "transit_days_min", "transit_days_max"):
            value = getattr(self, field)
            if value is not None and value < 0:
                raise ValueError(f"{field} must not be negative")
        if (
            self.transit_days_min is not None
            and self.transit_days_max is not None
            and self.transit_days_min > self.transit_days_max
        ):
            raise ValueError("transit_days_min must not exceed transit_days_max")
        return self

    @field_validator("base_font_size")
    @classmethod
    def validate_base_font_size(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _BASE_FONT_SIZES:
            raise ValueError(f"base_font_size must be one of {sorted(_BASE_FONT_SIZES)}")
        return v

    @field_validator("header_size")
    @classmethod
    def validate_header_size(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _HEADER_SIZES:
            raise ValueError(f"header_size must be one of {sorted(_HEADER_SIZES)}")
        return v

    @field_validator("dispatch_title", "dispatch_subtitle")
    @classmethod
    def validate_dispatch_text(cls, v: Optional[str]) -> Optional[str]:
        # Columns are NOT NULL: "" means "hide the message", null is not allowed.
        if v is None:
            raise ValueError("must be a string (use an empty string to hide it)")
        return v.strip()

    @field_validator("variant_display")
    @classmethod
    def validate_variant_display(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VARIANT_DISPLAYS:
            raise ValueError(f"variant_display must be one of {sorted(_VARIANT_DISPLAYS)}")
        return v

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
