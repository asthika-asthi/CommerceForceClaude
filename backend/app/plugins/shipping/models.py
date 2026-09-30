from decimal import Decimal
from sqlalchemy import String, Numeric, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class ShippingZone(BaseModel):
    __tablename__ = "shipping_zones"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Comma-separated ISO-3166-1 alpha-2 country codes, e.g. "GB,IE"  or "*" for catch-all
    countries: Mapped[str] = mapped_column(Text, nullable=False)
    flat_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ShippingBand(BaseModel):
    """Order-value delivery band: orders worth at least ``min_order_value`` pay ``charge``.

    The band with the highest ``min_order_value`` not above the order value applies;
    ``charge`` 0 means free delivery. Bands are global (zones only decide where we ship).
    """
    __tablename__ = "shipping_bands"

    min_order_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    charge: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))


class ShippingSettings(BaseModel):
    """Single-row store-wide shipping settings."""
    __tablename__ = "shipping_settings"

    # Used for any cart item whose product/variant has no weight entered.
    default_weight_kg: Mapped[Decimal] = mapped_column(
        Numeric(8, 3), nullable=False, default=Decimal("1.000"), server_default="1.000"
    )
