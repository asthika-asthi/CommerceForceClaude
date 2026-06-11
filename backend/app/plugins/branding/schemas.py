import json
from typing import Optional
from pydantic import BaseModel, field_validator, field_serializer


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
    model_config = {"from_attributes": True}

    @field_validator("social_links", mode="before")
    @classmethod
    def parse_social_links(cls, v: object) -> Optional[dict]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return None
        return v


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

    @field_serializer("social_links")
    def serialize_social_links(self, v: Optional[dict]) -> Optional[str]:
        return json.dumps(v) if v is not None else None
