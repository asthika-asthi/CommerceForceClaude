from typing import Any, Optional
from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class BrandingConfig(BaseModel):
    __tablename__ = "branding_config"

    store_name: Mapped[str] = mapped_column(String(255), default="My Store", nullable=False)
    tagline: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    favicon_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#000000", nullable=False)
    secondary_color: Mapped[str] = mapped_column(String(20), default="#ffffff", nullable=False)
    font_family: Mapped[str] = mapped_column(String(100), default="Inter", nullable=False)
    custom_css: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    social_links: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    stripe_publishable_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bank_transfer_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paypal_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ga4_measurement_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    meta_pixel_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Theme colour overrides chosen in the admin panel:
    # {"core": {"brand": "#..", "dark": "#..", ...}, "overrides": {"<token>": "#.."}}
    # Empty dict = storefront uses its theme-file defaults untouched.
    theme_colors: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
