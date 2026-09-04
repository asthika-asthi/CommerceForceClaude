from typing import Any, Optional
from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class BrandingConfig(BaseModel):
    __tablename__ = "branding_config"

    store_name: Mapped[str] = mapped_column(String(255), default="My Store", nullable=False)
    tagline: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    favicon_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    # When false, the site header/footer show neither the store-name text nor the
    # initials monogram that stands in for a missing logo — for clients that want
    # the brand lockup blank unless a real logo image is set.
    show_store_name: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", nullable=False
    )
    # When false, "Cash on Delivery" is not offered at checkout.
    enable_cash_on_delivery: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", nullable=False
    )
    catalogue_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
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
    # Legal / company registration numbers — rendered in the storefront footer.
    company_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    vat_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    eori_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    trademark_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Delivery / dispatch — drive the "Estimated delivery dates" range on product pages.
    delivery_promo_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dispatch_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transit_days_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transit_days_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Theme colour overrides chosen in the admin panel:
    # {"core": {"brand": "#..", "dark": "#..", ...}, "overrides": {"<token>": "#.."}}
    # Empty dict = storefront uses its theme-file defaults untouched.
    theme_colors: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
