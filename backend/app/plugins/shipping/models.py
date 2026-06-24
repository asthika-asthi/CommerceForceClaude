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
