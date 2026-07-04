import csv
import io
from fastapi import APIRouter, Depends, Response, Request, status, Query
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import create_access_token
from app.core.dependencies import get_current_user, require_admin
from app.plugins.auth.models import User, UserRole
from app.plugins.auth.schemas import RegisterRequest, TradeRegisterRequest, LoginRequest, TokenResponse, UserOut, AuthResponse, UpdateProfileRequest, ChangePasswordRequest, UpdateUserRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.plugins.auth import service
from app.shared.pagination import Page, paginate

REFRESH_COOKIE = "refresh_token"

router = APIRouter()


def _set_refresh_cookie(response: Response, token: str, max_age_days: int) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="lax",
        max_age=max_age_days * 86400,
        path="/api/auth/refresh",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(request: Request, data: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await service.create_user(data, db)
    access_token = create_access_token(user.id, user.role.value)
    refresh_raw = await service.issue_refresh_token(user.id, db)
    _set_refresh_cookie(response, refresh_raw, max_age_days=7)
    return AuthResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/register-trade", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_trade(data: TradeRegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await service.create_trade_user(data, db)
    access_token = create_access_token(user.id, user.role.value)
    refresh_raw = await service.issue_refresh_token(user.id, db)
    _set_refresh_cookie(response, refresh_raw, max_age_days=7)
    return AuthResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await service.authenticate(data.email, data.password, db)
    access_token = create_access_token(user.id, user.role.value)
    refresh_raw = await service.issue_refresh_token(user.id, db)
    _set_refresh_cookie(response, refresh_raw, max_age_days=7)
    return AuthResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get(REFRESH_COOKIE)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")
    user, new_raw = await service.rotate_refresh_token(raw_token, db)
    access_token = create_access_token(user.id, user.role.value)
    _set_refresh_cookie(response, new_raw, max_age_days=7)
    return TokenResponse(access_token=access_token)


@router.get("/verify-email", response_model=UserOut)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    user = await service.verify_email_token(token, db)
    return UserOut.model_validate(user)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await service.request_password_reset(data.email, db)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    await service.reset_password(data.token, data.new_password, db)


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
async def resend_verification(request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await service.resend_verification(data.email, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get(REFRESH_COOKIE)
    if raw_token:
        await service.revoke_refresh_token(raw_token, db)
    response.delete_cookie(key=REFRESH_COOKIE, path="/api/auth/refresh")


@router.get("/me", response_model=UserOut)
async def me(current_user=Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.put("/me", response_model=UserOut)
async def update_me(
    data: UpdateProfileRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await service.update_profile(current_user, data, db)
    return UserOut.model_validate(user)


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.change_password(current_user, data, db)


@router.get("/users", response_model=Page[UserOut])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    users, total = await service.list_users(db, page=page, page_size=page_size)
    return paginate([UserOut.model_validate(u) for u in users], total, page, page_size)


@router.patch("/users/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: str,
    data: UpdateUserRequest,
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    user = await service.patch_user(
        user_id,
        data.model_dump(exclude_none=True),
        db,
        actor_is_superadmin=(current_user.role == "superadmin"),
    )
    return UserOut.model_validate(user)


def _csv_safe(value: str) -> str:
    """Prevent CSV formula injection by prefixing dangerous leading characters."""
    s = str(value) if value is not None else ""
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


@router.get("/customers/export/csv", dependencies=[Depends(require_admin())])
async def export_customers_csv(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.role == UserRole.customer).order_by(User.email)
    )
    users = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "first_name", "last_name", "email", "company_name",
        "phone", "trade_status", "is_active", "created_at",
    ])
    writer.writeheader()
    for u in users:
        writer.writerow({
            "first_name": _csv_safe(u.first_name),
            "last_name": _csv_safe(u.last_name),
            "email": _csv_safe(u.email),
            "company_name": _csv_safe(u.company_name or ""),
            "phone": _csv_safe(u.phone or ""),
            "trade_status": u.trade_status or "",
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="customers.csv"'},
    )
