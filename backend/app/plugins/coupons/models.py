import enum
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Numeric, Text, Boolean, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class DiscountType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"


class Coupon(BaseModel):
    __tablename__ = "coupons"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(SAEnum(DiscountType), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    min_order_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    max_uses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class CouponUsage(BaseModel):
    __tablename__ = "coupon_usages"

    coupon_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    discount_applied: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
