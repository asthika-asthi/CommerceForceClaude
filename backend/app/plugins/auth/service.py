import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.core.security import get_password_hash, verify_password
from app.core.config import settings
from app.plugins.auth.models import User, RefreshToken, PasswordResetToken, UserRole, DataDeletionRequest, DeletionRequestStatus
from app.plugins.auth.schemas import RegisterRequest, TradeRegisterRequest, UpdateProfileRequest, ChangePasswordRequest
from app.shared.email import send_email

logger = logging.getLogger(__name__)

PASSWORD_RESET_EXPIRE_MINUTES = 30


EMAIL_VERIFICATION_EXPIRE_HOURS = 24


async def _issue_and_send_verification(user: User, db: AsyncSession) -> None:
    """Generate a fresh verification token on the user and email the link. Shared by
    registration (customer + trade) and the resend endpoint."""
    raw_token = secrets.token_urlsafe(32)
    user.email_verification_token = hashlib.sha256(raw_token.encode()).hexdigest()
    user.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRE_HOURS)
    await db.flush()

    verify_url = f"{settings.STOREFRONT_URL}/verify-email?token={raw_token}"
    logger.info("Email verification link for %s: %s", user.email, verify_url)
    print(f"\n[EMAIL VERIFY] {user.email} -> {verify_url}\n", flush=True)
    await send_email(
        user.email,
        "Please verify your email address",
        f"Hi {user.first_name},\n\n"
        f"Thanks for creating an account! Please verify your email address by clicking the link below "
        f"(valid for {EMAIL_VERIFICATION_EXPIRE_HOURS} hours):\n\n"
        f"{verify_url}\n\n"
        f"If you didn't create this account, you can safely ignore this email.",
        db,
    )


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
    await _issue_and_send_verification(user, db)
    return user


async def resend_verification(email: str, db: AsyncSession) -> None:
    """Re-issue a verification email. Always silent (no account enumeration)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.is_email_verified or user.role != UserRole.customer:
        return
    await _issue_and_send_verification(user, db)


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
    await _issue_and_send_verification(user, db)

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
    # Customers must verify their email first (admins/superadmins are exempt — they don't
    # self-register). Gated behind a setting so deployments can opt out.
    if settings.REQUIRE_EMAIL_VERIFICATION and user.role == UserRole.customer and not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before signing in. Check your inbox or request a new link.",
        )
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

    user_row = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_row.scalar_one_or_none()
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


async def revoke_all_refresh_tokens(user_id: str, db: AsyncSession) -> None:
    """Revoke every refresh token for a user — call after a password change/reset so
    existing sessions (including an attacker's) can no longer be refreshed."""
    await db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user_id).values(revoked=True)
    )


async def change_password(user: User, data: ChangePasswordRequest, db: AsyncSession) -> None:
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.hashed_password = get_password_hash(data.new_password)
    await revoke_all_refresh_tokens(user.id, db)
    await db.flush()


async def list_users(db: AsyncSession, page: int = 1, page_size: int = 20) -> tuple[list[User], int]:
    from sqlalchemy import func
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    result = await db.execute(
        select(User).order_by(User.email)
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), total


async def patch_user(
    user_id: str, data: dict, db: AsyncSession, actor_is_superadmin: bool = False
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if "is_active" in data and data["is_active"] is not None:
        user.is_active = data["is_active"]
    if "role" in data and data["role"] is not None:
        # Changing a user's role is a privilege operation — only a superadmin may do it,
        # otherwise any admin could promote themselves (or anyone) to superadmin.
        if not actor_is_superadmin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only a superadmin can change a user's role",
            )
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
    await revoke_all_refresh_tokens(user.id, db)
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


# ── GDPR: data export ────────────────────────────────────────────────────────

def _row_to_dict(row: Any, exclude: Optional[set[str]] = None) -> dict:
    skip = (exclude or set()) | {"_sa_instance_state"}
    return {k: v for k, v in vars(row).items() if k not in skip}


async def export_user_data(user: User, db: AsyncSession) -> dict:
    """Everything this platform holds that's linked to this account, as one
    JSON-serializable dict. Self-service, immediate — non-destructive, so no
    admin approval step (contrast with account deletion, below)."""
    from app.plugins.orders.models import Order
    from app.plugins.addresses.models import Address
    from app.plugins.wishlist.models import WishlistItem
    from app.plugins.reviews.models import Review
    from app.plugins.cart.models import Cart

    data: dict[str, Any] = {
        "account": _row_to_dict(user, exclude={"hashed_password", "email_verification_token"}),
    }

    orders = (await db.execute(
        select(Order).where(Order.user_id == user.id).options(selectinload(Order.items))
    )).scalars().all()
    data["orders"] = [
        {**_row_to_dict(o, exclude={"items"}), "items": [_row_to_dict(i) for i in o.items]}
        for o in orders
    ]

    data["addresses"] = [
        _row_to_dict(a) for a in (await db.execute(select(Address).where(Address.user_id == user.id))).scalars().all()
    ]
    data["wishlist_items"] = [
        _row_to_dict(w) for w in (await db.execute(select(WishlistItem).where(WishlistItem.user_id == user.id))).scalars().all()
    ]
    data["reviews"] = [
        _row_to_dict(r) for r in (await db.execute(select(Review).where(Review.user_id == user.id))).scalars().all()
    ]

    try:
        from app.plugins.credit.models import CreditAccount
        credit = (await db.execute(select(CreditAccount).where(CreditAccount.user_id == user.id))).scalar_one_or_none()
        data["credit_account"] = _row_to_dict(credit) if credit else None
    except ImportError:
        pass

    try:
        from app.plugins.loyalty.models import LoyaltyAccount, LoyaltyTransaction
        loyalty = (await db.execute(select(LoyaltyAccount).where(LoyaltyAccount.user_id == user.id))).scalar_one_or_none()
        data["loyalty_account"] = _row_to_dict(loyalty) if loyalty else None
        data["loyalty_transactions"] = [
            _row_to_dict(t) for t in
            (await db.execute(select(LoyaltyTransaction).where(LoyaltyTransaction.user_id == user.id))).scalars().all()
        ]
    except ImportError:
        pass

    try:
        from app.plugins.coupons.models import CouponUsage
        data["coupon_usages"] = [
            _row_to_dict(c) for c in
            (await db.execute(select(CouponUsage).where(CouponUsage.user_id == user.id))).scalars().all()
        ]
    except ImportError:
        pass

    try:
        from app.plugins.rfq.models import RFQ
        rfqs = (await db.execute(
            select(RFQ).where(RFQ.user_id == user.id).options(selectinload(RFQ.items))
        )).scalars().all()
        data["rfqs"] = [
            {**_row_to_dict(r, exclude={"items"}), "items": [_row_to_dict(i) for i in r.items]}
            for r in rfqs
        ]
    except ImportError:
        pass

    cart = (await db.execute(
        select(Cart).where(Cart.user_id == user.id).options(selectinload(Cart.items))
    )).scalar_one_or_none()
    data["cart"] = {**_row_to_dict(cart, exclude={"items"}), "items": [_row_to_dict(i) for i in cart.items]} if cart else None

    return data


# ── GDPR: account deletion (request → admin review → anonymize) ────────────

async def request_deletion(user: User, db: AsyncSession) -> DataDeletionRequest:
    existing = await db.execute(
        select(DataDeletionRequest).where(
            DataDeletionRequest.user_id == user.id,
            DataDeletionRequest.status == DeletionRequestStatus.pending,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A deletion request is already pending review")

    req = DataDeletionRequest(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email_snapshot=user.email,
        status=DeletionRequestStatus.pending,
    )
    db.add(req)
    await db.flush()
    return req


async def get_own_deletion_request(user: User, db: AsyncSession) -> Optional[DataDeletionRequest]:
    result = await db.execute(
        select(DataDeletionRequest)
        .where(DataDeletionRequest.user_id == user.id)
        .order_by(DataDeletionRequest.created_at.desc())
    )
    return result.scalars().first()


async def list_deletion_requests(
    db: AsyncSession, status_filter: Optional[str] = None, page: int = 1, page_size: int = 20
) -> tuple[list[DataDeletionRequest], int]:
    from sqlalchemy import func
    query = select(DataDeletionRequest)
    if status_filter:
        query = query.where(DataDeletionRequest.status == DeletionRequestStatus(status_filter))
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    result = await db.execute(
        query.order_by(DataDeletionRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), total


async def _load_deletion_request(request_id: str, db: AsyncSession) -> DataDeletionRequest:
    result = await db.execute(select(DataDeletionRequest).where(DataDeletionRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deletion request not found")
    return req


async def anonymize_user(user_id: str, db: AsyncSession) -> None:
    """Scrub an account's PII in place. Never a hard delete — orders and other
    financial/audit records are retained per the privacy policy's retention
    commitments (order records: 7 years), just stripped of free-text PII.

    Deliberately out of scope: scheduling_journal_entries.created_by and
    scheduling_note_access_log.user_id are clinical/audit records tied to
    provider (staff) accounts, not customers — not touched by this
    customer-facing GDPR flow.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return

    placeholder = f"deleted-user-{user.id}@deleted.local"
    user.email = placeholder
    user.first_name = "Deleted"
    user.last_name = "User"
    user.phone = None
    user.company_name = None
    user.vat_number = None
    user.is_active = False
    user.hashed_password = get_password_hash(secrets.token_urlsafe(32))
    await revoke_all_refresh_tokens(user.id, db)

    from app.plugins.orders.models import Order
    orders = (await db.execute(select(Order).where(Order.user_id == user_id))).scalars().all()
    for order in orders:
        order.guest_email = None
        order.shipping_address = "[redacted]" if order.shipping_address else order.shipping_address
        order.notes = "[redacted]" if order.notes else order.notes

    from app.plugins.reviews.models import Review
    await db.execute(update(Review).where(Review.user_id == user_id).values(user_id=None))

    from app.plugins.addresses.models import Address
    for addr in (await db.execute(select(Address).where(Address.user_id == user_id))).scalars().all():
        await db.delete(addr)

    from app.plugins.wishlist.models import WishlistItem
    for item in (await db.execute(select(WishlistItem).where(WishlistItem.user_id == user_id))).scalars().all():
        await db.delete(item)

    await db.flush()


async def approve_deletion_request(request_id: str, admin_user: User, db: AsyncSession) -> DataDeletionRequest:
    req = await _load_deletion_request(request_id, db)
    if req.status != DeletionRequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is already {req.status}")
    if req.user_id:
        await anonymize_user(req.user_id, db)
    req.status = DeletionRequestStatus.completed
    req.reviewed_at = datetime.now(timezone.utc)
    req.reviewed_by = admin_user.id
    await db.flush()
    return req


async def reject_deletion_request(request_id: str, admin_notes: str, admin_user: User, db: AsyncSession) -> DataDeletionRequest:
    req = await _load_deletion_request(request_id, db)
    if req.status != DeletionRequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Request is already {req.status}")
    req.status = DeletionRequestStatus.rejected
    req.admin_notes = admin_notes
    req.reviewed_at = datetime.now(timezone.utc)
    req.reviewed_by = admin_user.id
    await db.flush()
    return req
