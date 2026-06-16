from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.plugins.wishlist import service
from app.plugins.wishlist.schemas import WishlistItemOut

router = APIRouter()


@router.get("", response_model=List[WishlistItemOut])
async def list_wishlist(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.list_wishlist(current_user.id, db)


@router.get("/ids", response_model=List[str])
async def get_wishlist_ids(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.get_wishlist_product_ids(current_user.id, db)


@router.post("/{product_id}", response_model=WishlistItemOut, status_code=status.HTTP_201_CREATED)
async def add_to_wishlist(
    product_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.add_to_wishlist(current_user.id, product_id, db)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_wishlist(
    product_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.remove_from_wishlist(current_user.id, product_id, db)
