from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class DiscountRule(BaseModel):
    __tablename__ = "discount_rules"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "percentage" or "fixed"
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    min_order_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="1")
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
