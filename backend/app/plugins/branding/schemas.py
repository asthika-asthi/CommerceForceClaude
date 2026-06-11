from typing import Optional
from pydantic import BaseModel


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
    social_links: Optional[str] = None
    model_config = {"from_attributes": True}


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
    social_links: Optional[str] = None
