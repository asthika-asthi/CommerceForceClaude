from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TradeRegisterRequest(RegisterRequest):
    company_name: str  # required for trade
    vat_number: Optional[str] = None
    business_type: Optional[str] = None  # decorator | builder | scaffolding | groundworks | other


class UserOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    is_email_verified: bool
    company_name: Optional[str] = None
    phone: Optional[str] = None
    vat_number: Optional[str] = None
    business_type: Optional[str] = None
    trade_status: Optional[str] = None
    is_2fa_enabled: bool = False

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginResponse(BaseModel):
    """Login result. Either a completed login (access_token + user) OR, when the
    account has 2FA enabled, a challenge (two_factor_required + pending_token) that
    must be exchanged at /login/verify-2fa. The two states are mutually exclusive."""
    two_factor_required: bool = False
    pending_token: Optional[str] = None
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserOut] = None


class VerifyTwoFactorRequest(BaseModel):
    pending_token: str
    code: str


class ResendTwoFactorRequest(BaseModel):
    pending_token: str


class ConfirmTwoFactorRequest(BaseModel):
    code: str


class DisableTwoFactorRequest(BaseModel):
    password: str


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Must not be blank")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None
    trade_status: Optional[str] = None

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("superadmin", "admin", "customer"):
            raise ValueError("Invalid role")
        return v

    @field_validator("trade_status")
    @classmethod
    def valid_trade_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("pending", "approved", "rejected"):
            raise ValueError("Invalid trade_status")
        return v


class DeletionRequestOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_email_snapshot: str
    status: str
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    admin_notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class RejectDeletionRequest(BaseModel):
    admin_notes: str = ""
