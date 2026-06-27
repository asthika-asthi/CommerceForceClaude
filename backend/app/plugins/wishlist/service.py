from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.plugins.wishlist.models import WishlistItem


async def get_wishlist_product_ids(user_id: str, db: AsyncSession) -> List[str]:
    result = await db.execute(select(WishlistItem.product_id).where(WishlistItem.user_id == user_id))
    return list(result.scalars().all())


async def list_wishlist(user_id: str, db: AsyncSession) -> List[WishlistItem]:
    result = await db.execute(select(WishlistItem).where(WishlistItem.user_id == user_id))
    return list(result.scalars().all())


async def add_to_wishlist(user_id: str, product_id: str, db: AsyncSession) -> WishlistItem:
    result = await db.execute(
        select(WishlistItem).where(WishlistItem.user_id == user_id, WishlistItem.product_id == product_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    item = WishlistItem(user_id=user_id, product_id=product_id)
    db.add(item)
    await db.flush()
    return item


async def remove_from_wishlist(user_id: str, product_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(WishlistItem).where(WishlistItem.user_id == user_id, WishlistItem.product_id == product_id)
    )
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.flush()
