from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.plugins.scheduling.models import Provider
from app.plugins.scheduling.schemas import ProviderCreate, ProviderUpdate


async def create_provider(data: ProviderCreate, db: AsyncSession) -> Provider:
    provider = Provider(**data.model_dump())
    db.add(provider)
    await db.flush()
    return provider


async def get_provider(provider_id: str, db: AsyncSession) -> Provider:
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return provider


async def list_providers(
    db: AsyncSession, page: int, page_size: int, active_only: bool = False
) -> tuple[list[Provider], int]:
    query = select(Provider)
    count_query = select(func.count()).select_from(Provider)
    if active_only:
        query = query.where(Provider.is_active == True)  # noqa: E712
        count_query = count_query.where(Provider.is_active == True)  # noqa: E712

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Provider.display_name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_provider(provider_id: str, data: ProviderUpdate, db: AsyncSession) -> Provider:
    provider = await get_provider(provider_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(provider, field, value)
    await db.flush()
    return provider


async def deactivate_provider(provider_id: str, db: AsyncSession) -> None:
    """Soft delete: preserves appointment/journal history that references this provider."""
    provider = await get_provider(provider_id, db)
    provider.is_active = False
    await db.flush()
