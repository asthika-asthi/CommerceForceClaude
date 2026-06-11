import enum
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Numeric, Text, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.base_model import BaseModel


class RFQStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    quoted = "quoted"
    accepted = "accepted"
    rejected = "rejected"
    expired = "expired"


class RFQ(BaseModel):
    __tablename__ = "rfqs"

    rfq_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[RFQStatus] = mapped_column(SAEnum(RFQStatus), default=RFQStatus.draft, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["RFQItem"]] = relationship(
        "RFQItem", back_populates="rfq", cascade="all, delete-orphan", lazy="selectin"
    )


class RFQItem(BaseModel):
    __tablename__ = "rfq_items"

    rfq_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    product_name: Mapped[str] = mapped_column(String(500), nullable=False)
    product_sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    requested_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    quoted_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    rfq: Mapped["RFQ"] = relationship("RFQ", back_populates="items")
