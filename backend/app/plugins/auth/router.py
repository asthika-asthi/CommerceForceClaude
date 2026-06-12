from fastapi import APIRouter, Depends, Response, Request, status
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.core.dependencies import get_current_user, require_admin
from app.plugins.auth.schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut, AuthResponse, UpdateProfileRequest, ChangePasswordRequest, UpdateUserRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.plugins.auth import service

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
async def register(data: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await service.create_user(data, db)
    access_token = create_access_token(user.id, user.role.value)
    refresh_raw = await service.issue_refresh_token(user.id, db)
    _set_refresh_cookie(response, refresh_raw, max_age_days=7)
    return AuthResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
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


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await service.request_password_reset(data.email, db)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    await service.reset_password(data.token, data.new_password, db)


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


@router.get("/users", response_model=list[UserOut])
async def list_users(
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    return [UserOut.model_validate(u) for u in await service.list_users(db)]


@router.patch("/users/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: str,
    data: UpdateUserRequest,
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    user = await service.patch_user(user_id, data.model_dump(exclude_none=True), db)
    return UserOut.model_validate(user)
