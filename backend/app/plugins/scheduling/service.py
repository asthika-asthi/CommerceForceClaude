from datetime import date as date_
from datetime import datetime, time as time_, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.plugins.scheduling.models import (
    Appointment,
    AppointmentStatus,
    AppointmentType,
    AvailabilityException,
    Provider,
    ProviderAvailability,
)
from app.plugins.scheduling.schemas import (
    AppointmentTypeCreate,
    AppointmentTypeUpdate,
    AvailabilityCreate,
    ExceptionCreate,
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


# ── PROVIDER AVAILABILITY (Task 6) ──────────────────────────────────────────────

async def add_availability(
    provider_id: str, data: AvailabilityCreate, db: AsyncSession
) -> ProviderAvailability:
    await get_provider(provider_id, db)
    availability = ProviderAvailability(provider_id=provider_id, **data.model_dump())
    db.add(availability)
    await db.flush()
    return availability


async def list_availability(provider_id: str, db: AsyncSession) -> list[ProviderAvailability]:
    result = await db.execute(
        select(ProviderAvailability)
        .where(ProviderAvailability.provider_id == provider_id)
        .order_by(ProviderAvailability.weekday, ProviderAvailability.start_time)
    )
    return list(result.scalars().all())


async def delete_availability(availability_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(ProviderAvailability).where(ProviderAvailability.id == availability_id)
    )
    availability = result.scalar_one_or_none()
    if not availability:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability not found")
    await db.delete(availability)
    await db.flush()


async def add_exception(
    provider_id: str, data: ExceptionCreate, db: AsyncSession
) -> AvailabilityException:
    await get_provider(provider_id, db)
    exception = AvailabilityException(provider_id=provider_id, **data.model_dump())
    db.add(exception)
    await db.flush()
    return exception


async def list_exceptions(
    provider_id: str,
    db: AsyncSession,
    date_from: Optional[date_] = None,
    date_to: Optional[date_] = None,
) -> list[AvailabilityException]:
    query = select(AvailabilityException).where(AvailabilityException.provider_id == provider_id)
    if date_from is not None:
        query = query.where(AvailabilityException.date >= date_from)
    if date_to is not None:
        query = query.where(AvailabilityException.date <= date_to)
    query = query.order_by(AvailabilityException.date)
    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_exception(exception_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(AvailabilityException).where(AvailabilityException.id == exception_id)
    )
    exception = result.scalar_one_or_none()
    if not exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exception not found")
    await db.delete(exception)
    await db.flush()


# ── OPEN SLOT COMPUTATION (Task 7) ──────────────────────────────────────────────

def _time_to_min(t: time_) -> int:
    return t.hour * 60 + t.minute


def _min_to_time(m: int) -> time_:
    return time_(hour=m // 60, minute=m % 60)


def _as_utc(dt: datetime) -> datetime:
    """Normalize a (possibly naive, e.g. from SQLite) datetime to UTC-aware."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _subtract_window(
    windows: list[tuple[int, int]], block_start: int, block_end: int
) -> list[tuple[int, int]]:
    """Remove [block_start, block_end) from each (start, end) window, splitting/trimming as needed."""
    result: list[tuple[int, int]] = []
    for start, end in windows:
        if block_end <= start or block_start >= end:
            result.append((start, end))
            continue
        if block_start > start:
            result.append((start, block_start))
        if block_end < end:
            result.append((block_end, end))
    return result


async def compute_open_slots(
    provider_id: str,
    appointment_type_id: str,
    date_from: date_,
    date_to: date_,
    db: AsyncSession,
) -> list[datetime]:
    appointment_type = await get_appointment_type(appointment_type_id, db)
    if not appointment_type.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment type not found")
    await get_provider(provider_id, db)

    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="date_to must not be before date_from"
        )
    if (date_to - date_from).days > 31:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="date range too wide, max 31 days"
        )

    duration_minutes = appointment_type.duration_minutes

    avail_result = await db.execute(
        select(ProviderAvailability).where(ProviderAvailability.provider_id == provider_id)
    )
    availabilities = list(avail_result.scalars().all())

    exceptions = await list_exceptions(provider_id, db, date_from=date_from, date_to=date_to)

    window_start = datetime.combine(date_from, time_.min, tzinfo=timezone.utc)
    window_end = datetime.combine(date_to + timedelta(days=1), time_.min, tzinfo=timezone.utc)
    appt_result = await db.execute(
        select(Appointment).where(
            Appointment.provider_id == provider_id,
            Appointment.status != AppointmentStatus.cancelled,
            Appointment.start_at >= window_start,
            Appointment.start_at < window_end,
        )
    )
    appointments = list(appt_result.scalars().all())

    slots: list[datetime] = []
    day_count = (date_to - date_from).days
    for i in range(day_count + 1):
        d = date_from + timedelta(days=i)
        day_exceptions = [e for e in exceptions if e.date == d]

        if any(
            e.is_available is False and e.start_time is None and e.end_time is None
            for e in day_exceptions
        ):
            continue  # whole-day block

        windows = [
            (_time_to_min(a.start_time), _time_to_min(a.end_time))
            for a in availabilities
            if a.weekday == d.weekday()
        ]

        for e in day_exceptions:
            if e.is_available is False and e.start_time is not None and e.end_time is not None:
                windows = _subtract_window(windows, _time_to_min(e.start_time), _time_to_min(e.end_time))

        for e in day_exceptions:
            if e.is_available is True and e.start_time is not None and e.end_time is not None:
                windows.append((_time_to_min(e.start_time), _time_to_min(e.end_time)))

        for window_start_min, window_end_min in windows:
            t = window_start_min
            while t + duration_minutes <= window_end_min:
                cand_start = datetime.combine(d, _min_to_time(t), tzinfo=timezone.utc)
                cand_end = cand_start + timedelta(minutes=duration_minutes)
                conflict = any(
                    cand_start < _as_utc(appt.end_at) and cand_end > _as_utc(appt.start_at)
                    for appt in appointments
                )
                if not conflict:
                    slots.append(cand_start)
                t += duration_minutes

    return sorted(set(slots))
