import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.plugins.auth.models import User, RefreshToken, UserRole
from app.plugins.auth.schemas import RegisterRequest, UpdateProfileRequest, ChangePasswordRequest


async def create_user(data: RegisterRequest, db: AsyncSession) -> User:
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
    )
    db.add(user)
    await db.flush()
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


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.email))
    return list(result.scalars().all())


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
    await db.flush()
    return user


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
