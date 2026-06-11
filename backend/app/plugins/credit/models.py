from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Boolean, Numeric, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class CreditAccount(BaseModel):
    __tablename__ = "credit_accounts"
    __table_args__ = (UniqueConstraint("user_id", name="uq_credit_user"),)

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    used_credit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def available_credit(self) -> Decimal:
        return self.credit_limit - self.used_credit
