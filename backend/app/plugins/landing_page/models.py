import enum
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class SectionType(str, enum.Enum):
    hero = "hero"
    features = "features"
    testimonials = "testimonials"
    cta = "cta"
    html = "html"
    products = "products"
    block = "block"


class LandingSection(BaseModel):
    __tablename__ = "landing_sections"

    section_type: Mapped[SectionType] = mapped_column(SAEnum(SectionType), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    subtitle: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON for structured content
    image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    cta_text: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    cta_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    background_color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
