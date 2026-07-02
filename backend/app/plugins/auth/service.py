import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.core.security import get_password_hash, verify_password
from app.core.config import settings
from app.plugins.auth.models import User, RefreshToken, PasswordResetToken, UserRole
from app.plugins.auth.schemas import RegisterRequest, TradeRegisterRequest, UpdateProfileRequest, ChangePasswordRequest
from app.shared.email import send_email

logger = logging.getLogger(__name__)

PASSWORD_RESET_EXPIRE_MINUTES = 30


EMAIL_VERIFICATION_EXPIRE_HOURS = 24


async def create_user(data: RegisterRequest, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRE_HOURS)

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.customer,
        company_name=data.company_name,
        phone=data.phone,
        email_verification_token=token_hash,
        email_verification_expires_at=expires_at,
    )
    db.add(user)
    await db.flush()

    verify_url = f"{settings.STOREFRONT_URL}/verify-email?token={raw_token}"
    logger.info("Email verification link for %s: %s", data.email, verify_url)
    print(f"\n[EMAIL VERIFY] {data.email} -> {verify_url}\n", flush=True)
    await send_email(
        data.email,
        "Please verify your email address",
        f"Hi {data.first_name},\n\n"
        f"Thanks for creating an account! Please verify your email address by clicking the link below "
        f"(valid for {EMAIL_VERIFICATION_EXPIRE_HOURS} hours):\n\n"
        f"{verify_url}\n\n"
        f"If you didn't create this account, you can safely ignore this email.",
        db,
    )

    return user


async def verify_email_token(raw_token: str, db: AsyncSession) -> User:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    result = await db.execute(select(User).where(User.email_verification_token == token_hash))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification link")

    if user.is_email_verified:
        return user  # already verified — idempotent

    expires = user.email_verification_expires_at
    if expires is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification link")
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link has expired. Please request a new one.")

    user.is_email_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    await db.flush()
    return user


async def create_trade_user(data: TradeRegisterRequest, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.customer,
        company_name=data.company_name,
        phone=data.phone,
        vat_number=data.vat_number,
        business_type=data.business_type,
        trade_status="pending",
    )
    db.add(user)
    await db.flush()

    # Notify admin of new trade application
    if settings.SMTP_USER:
        from app.plugins.branding.service import get_config
        from app.shared.email import send_email
        branding = await get_config(db)
        store_email = branding.contact_email or "admin@commerceforce.dev"
        store_name = branding.store_name or "Store"
        await send_email(
            store_email,
            f"[{store_name}] New trade account application from {data.first_name} {data.last_name}",
            f"A new trade account application has been submitted:\n\n"
            f"Name: {data.first_name} {data.last_name}\n"
            f"Email: {data.email}\n"
            f"Company: {data.company_name}\n"
            f"VAT number: {data.vat_number or '—'}\n"
            f"Business type: {data.business_type or '—'}\n\n"
            f"Log in to the admin panel to approve or reject this application.",
            db,
        )

    return user


async def authenticate(email: str, password: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


async def issue_refresh_token(user_id: str, db: AsyncSession) -> str:
    raw_token = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db.add(RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
    return raw_token


async def rotate_refresh_token(raw_token: str, db: AsyncSession) -> tuple[User, str]:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    if not stored or stored.revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    # Normalize to UTC-aware for comparison (SQLite returns naive datetimes)
    expires = stored.expires_at.replace(tzinfo=timezone.utc) if stored.expires_at.tzinfo is None else stored.expires_at
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")


    stored.revoked = True

    result = await db.execute(select(User).where(User.id == stored.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_raw = await issue_refresh_token(user.id, db)
    return user, new_raw


async def revoke_refresh_token(raw_token: str, db: AsyncSession) -> None:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked = True


async def change_password(user: User, data: ChangePasswordRequest, db: AsyncSession) -> None:
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.hashed_password = get_password_hash(data.new_password)
    await db.flush()


async def list_users(db: AsyncSession, page: int = 1, page_size: int = 20) -> tuple[list[User], int]:
    from sqlalchemy import func
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    result = await db.execute(
        select(User).order_by(User.email)
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), total


async def patch_user(user_id: str, data: dict, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if "is_active" in data and data["is_active"] is not None:
        user.is_active = data["is_active"]
    if "role" in data and data["role"] is not None:
        from app.plugins.auth.models import UserRole
        user.role = UserRole(data["role"])
    if "trade_status" in data and data["trade_status"] is not None:
        user.trade_status = data["trade_status"]
    await db.flush()
    return user


async def request_password_reset(email: str, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    # Always return 200 — never reveal whether the email exists
    if not user or not user.is_active:
        return

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))

    base_url = settings.ADMIN_URL if user.role in (UserRole.admin, UserRole.superadmin) else settings.STOREFRONT_URL
    reset_url = f"{base_url}/reset-password?token={raw_token}"
    logger.info("Password reset link for %s: %s", email, reset_url)
    print(f"\n[PASSWORD RESET] {email} -> {reset_url}\n", flush=True)

    await send_email(
        email,
        "Reset your password",
        f"You requested a password reset.\n\n"
        f"Click the link below to set a new password (expires in {PASSWORD_RESET_EXPIRE_MINUTES} minutes):\n\n"
        f"{reset_url}\n\n"
        f"If you did not request this, you can safely ignore this email.",
        db,
    )


async def reset_password(token: str, new_password: str, db: AsyncSession) -> None:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    if not stored or stored.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already used reset token")

    expires = stored.expires_at.replace(tzinfo=timezone.utc) if stored.expires_at.tzinfo is None else stored.expires_at
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already used reset token")

    user.hashed_password = get_password_hash(new_password)
    stored.used = True
    await db.flush()


async def update_profile(user: User, data: UpdateProfileRequest, db: AsyncSession) -> User:
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.phone is not None:
        user.phone = data.phone
    if data.company_name is not None:
        user.company_name = data.company_name
    await db.flush()
    await db.refresh(user)
    return user
