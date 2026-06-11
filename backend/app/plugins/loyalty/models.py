import enum
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Integer, Numeric, Text, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class TransactionType(str, enum.Enum):
    earn = "earn"
    redeem = "redeem"
    adjust = "adjust"
    expire = "expire"


class LoyaltyConfig(BaseModel):
    __tablename__ = "loyalty_config"

    points_per_dollar: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("1.0"), nullable=False)
    redemption_rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0.01"), nullable=False)
    min_redemption: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class LoyaltyAccount(BaseModel):
    __tablename__ = "loyalty_accounts"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    points_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class LoyaltyTransaction(BaseModel):
    __tablename__ = "loyalty_transactions"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    transaction_type: Mapped[TransactionType] = mapped_column(SAEnum(TransactionType), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
