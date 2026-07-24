import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    customer = "customer"


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.customer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    vat_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    business_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    trade_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # pending | approved | rejected
    email_verification_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email_verification_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Opt-in email-code two-factor auth. When True, login requires a 6-digit code
    # emailed to this address (see auth/service.py's login + TwoFactorCode below).
    is_2fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class RefreshToken(BaseModel):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class PasswordResetToken(BaseModel):
    __tablename__ = "password_reset_tokens"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class TwoFactorCode(BaseModel):
    """A single-use 6-digit email login code. Only the hash is stored (same
    discipline as PasswordResetToken). Used both to confirm 2FA enrolment and,
    once enabled, as the second factor at login. Only the newest unused,
    unexpired row for a user is accepted — see auth/service.py."""
    __tablename__ = "two_factor_codes"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class DeletionRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    completed = "completed"


class DataDeletionRequest(BaseModel):
    """A GDPR 'right to be forgotten' request. Self-service to submit, admin
    review required before anything is scrubbed — see auth/service.py's
    anonymize_user(). `created_at` (inherited) is the request timestamp."""
    __tablename__ = "data_deletion_requests"

    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Captured at request time so the admin can still identify the requester
    # even after the account has been anonymized.
    user_email_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DeletionRequestStatus] = mapped_column(
        SAEnum(DeletionRequestStatus), default=DeletionRequestStatus.pending, nullable=False
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
