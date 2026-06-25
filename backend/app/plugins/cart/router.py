import secrets
from typing import Optional
from fastapi import APIRouter, Depends, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user_optional
from app.plugins.cart.schemas import CartOut, AddItemRequest, UpdateItemRequest
from app.plugins.cart import service

GUEST_SESSION_COOKIE = "guest_session"
router = APIRouter()


def _get_session_id(request: Request, response: Response) -> Optional[str]:
    session_id = request.cookies.get(GUEST_SESSION_COOKIE)
    if not session_id:
        session_id = secrets.token_urlsafe(32)
        response.set_cookie(GUEST_SESSION_COOKIE, session_id, max_age=30 * 86400, httponly=True, samesite="lax")
    return session_id


@router.get("", response_model=CartOut)
async def get_cart(
    request: Request, response: Response,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if current_user:
        return await service.get_cart(db, user_id=current_user.id)
    session_id = _get_session_id(request, response)
    return await service.get_cart(db, session_id=session_id)


@router.post("/items", response_model=CartOut)
async def add_item(
    data: AddItemRequest, request: Request, response: Response,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if current_user:
        return await service.add_item(data.variant_id, data.quantity, db, user_id=current_user.id)
    session_id = _get_session_id(request, response)
    return await service.add_item(data.variant_id, data.quantity, db, session_id=session_id)


@router.put("/items/{variant_id}", response_model=CartOut)
async def update_item(
    variant_id: str, data: UpdateItemRequest, request: Request, response: Response,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if current_user:
        return await service.update_item(variant_id, data.quantity, db, user_id=current_user.id)
    session_id = _get_session_id(request, response)
    return await service.update_item(variant_id, data.quantity, db, session_id=session_id)


@router.delete("/items/{variant_id}", response_model=CartOut)
async def remove_item(
    variant_id: str, request: Request, response: Response,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if current_user:
        return await service.remove_item(variant_id, db, user_id=current_user.id)
    session_id = _get_session_id(request, response)
    return await service.remove_item(variant_id, db, session_id=session_id)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_cart(
    request: Request, response: Response,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if current_user:
        await service.clear_cart(db, user_id=current_user.id)
    else:
        session_id = request.cookies.get(GUEST_SESSION_COOKIE)
        if session_id:
            await service.clear_cart(db, session_id=session_id)


@router.post("/merge", response_model=CartOut)
async def merge_cart(
    request: Request,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Call after login to merge guest cart into user cart."""
    if not current_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Must be logged in to merge cart")
    session_id = request.cookies.get(GUEST_SESSION_COOKIE)
    if not session_id:
        return await service.get_cart(db, user_id=current_user.id)
    return await service.merge_guest_cart(current_user.id, session_id, db)
