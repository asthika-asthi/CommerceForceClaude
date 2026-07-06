from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.plugins.scheduling.models import AppointmentType, Provider
from app.plugins.scheduling.schemas import (
    AppointmentTypeCreate,
    AppointmentTypeUpdate,
    ProviderCreate,
    ProviderUpdate,
)


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


# ── APPOINTMENT TYPES ───────────────────────────────────────────────────────────

async def _resolve_providers(provider_ids: list[str], db: AsyncSession) -> list[Provider]:
    result = await db.execute(select(Provider).where(Provider.id.in_(provider_ids)))
    providers = list(result.scalars().all())
    found_ids = {p.id for p in providers}
    missing = [pid for pid in provider_ids if pid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider(s) not found: {', '.join(missing)}",
        )
    return providers


async def _get_appointment_type_with_providers(appointment_type_id: str, db: AsyncSession) -> AppointmentType:
    result = await db.execute(
        select(AppointmentType)
        .where(AppointmentType.id == appointment_type_id)
        .options(selectinload(AppointmentType.providers))
    )
    appointment_type = result.scalar_one_or_none()
    if not appointment_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment type not found")
    return appointment_type


async def create_appointment_type(data: AppointmentTypeCreate, db: AsyncSession) -> AppointmentType:
    payload = data.model_dump(exclude={"provider_ids"})
    appointment_type = AppointmentType(**payload)
    if data.provider_ids is not None:
        appointment_type.providers = await _resolve_providers(data.provider_ids, db)
    db.add(appointment_type)
    await db.flush()
    return await _get_appointment_type_with_providers(appointment_type.id, db)


async def get_appointment_type(appointment_type_id: str, db: AsyncSession) -> AppointmentType:
    return await _get_appointment_type_with_providers(appointment_type_id, db)


async def list_appointment_types(
    db: AsyncSession,
    page: int,
    page_size: int,
    active_only: bool = False,
    provider_id: str | None = None,
) -> tuple[list[AppointmentType], int]:
    query = select(AppointmentType)
    count_query = select(func.count()).select_from(AppointmentType)
    if active_only:
        query = query.where(AppointmentType.is_active == True)  # noqa: E712
        count_query = count_query.where(AppointmentType.is_active == True)  # noqa: E712
    if provider_id:
        query = query.join(AppointmentType.providers).where(Provider.id == provider_id)
        count_query = count_query.join(AppointmentType.providers).where(Provider.id == provider_id)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(AppointmentType.name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_appointment_type(
    appointment_type_id: str, data: AppointmentTypeUpdate, db: AsyncSession
) -> AppointmentType:
    appointment_type = await _get_appointment_type_with_providers(appointment_type_id, db)
    updates = data.model_dump(exclude_unset=True, exclude={"provider_ids"})
    for field, value in updates.items():
        setattr(appointment_type, field, value)
    if data.provider_ids is not None:
        appointment_type.providers = await _resolve_providers(data.provider_ids, db)
    await db.flush()
    return await _get_appointment_type_with_providers(appointment_type_id, db)


async def deactivate_appointment_type(appointment_type_id: str, db: AsyncSession) -> None:
    """Soft delete: preserves appointment history that references this type."""
    appointment_type = await get_appointment_type(appointment_type_id, db)
    appointment_type.is_active = False
    await db.flush()
