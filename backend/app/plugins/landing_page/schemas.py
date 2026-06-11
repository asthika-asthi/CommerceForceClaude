from typing import Optional
from pydantic import BaseModel
from app.plugins.landing_page.models import SectionType


class LandingSectionCreate(BaseModel):
    section_type: SectionType
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    sort_order: int = 0
    background_color: Optional[str] = None


class LandingSectionUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    background_color: Optional[str] = None


class LandingSectionOut(BaseModel):
    id: str
    section_type: SectionType
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    sort_order: int
    is_active: bool
    background_color: Optional[str] = None
    model_config = {"from_attributes": True}
