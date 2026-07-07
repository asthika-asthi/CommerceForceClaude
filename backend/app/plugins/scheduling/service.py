from datetime import date as date_
from datetime import datetime, time as time_, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.plugins.scheduling.models import (
    Appointment,
    AppointmentStatus,
    AppointmentType,
    AvailabilityException,
    Client,
    Provider,
    ProviderAvailability,
)
from app.plugins.scheduling.schemas import (
    AppointmentCreate,
    AppointmentListOut,
    AppointmentOut,
    AppointmentTypeCreate,
    AppointmentTypeUpdate,
    AvailabilityCreate,
    ClientCreate,
    ClientSelfUpdate,
    ClientUpdate,
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
    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="date_to must not be before date_from"
        )
    if (date_to - date_from).days > 31:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="date range too wide, max 31 days"
        )

    appointment_type = await get_appointment_type(appointment_type_id, db)
    if not appointment_type.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment type not found")
    provider = await get_provider(provider_id, db)
    if not provider.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

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
            Appointment.start_at < window_end,
            Appointment.end_at > window_start,
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


# ── CLIENTS (Task 8) ────────────────────────────────────────────────────────────

async def create_client(data: ClientCreate, db: AsyncSession) -> Client:
    client_obj = Client(**data.model_dump())
    db.add(client_obj)
    await db.flush()
    return client_obj


async def get_client(client_id: str, db: AsyncSession) -> Client:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client_obj = result.scalar_one_or_none()
    if not client_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client_obj


async def list_clients(
    db: AsyncSession, page: int, page_size: int, search: Optional[str] = None
) -> tuple[list[Client], int]:
    query = select(Client)
    count_query = select(func.count()).select_from(Client)
    if search:
        needle = search.lower()
        search_filter = (
            func.lower(Client.first_name).contains(needle)
            | func.lower(Client.last_name).contains(needle)
            | func.lower(Client.email).contains(needle)
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Client.last_name, Client.first_name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_client(client_id: str, data: ClientUpdate, db: AsyncSession) -> Client:
    client_obj = await get_client(client_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client_obj, field, value)
    await db.flush()
    return client_obj


async def deactivate_client(client_id: str, db: AsyncSession) -> None:
    client_obj = await get_client(client_id, db)
    client_obj.is_active = False
    await db.flush()


async def get_client_for_user(user_id: str, db: AsyncSession) -> Client:
    result = await db.execute(select(Client).where(Client.user_id == user_id))
    client_obj = result.scalar_one_or_none()
    if not client_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client_obj


async def update_client_self(user_id: str, data: ClientSelfUpdate, db: AsyncSession) -> Client:
    client_obj = await get_client_for_user(user_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client_obj, field, value)
    await db.flush()
    return client_obj


async def get_or_create_client_for_user(
    user_id: str, db: AsyncSession, *, defaults: Optional[dict] = None
) -> Client:
    result = await db.execute(select(Client).where(Client.user_id == user_id))
    client_obj = result.scalar_one_or_none()
    if client_obj:
        return client_obj

    payload = dict(defaults or {})
    payload.setdefault("first_name", "")
    payload.setdefault("last_name", "")
    client_obj = Client(user_id=user_id, **payload)
    db.add(client_obj)
    await db.flush()
    return client_obj


# ── APPOINTMENT BOOKING + LIFECYCLE (Task 9) ────────────────────────────────────

def _is_admin(current_user) -> bool:
    return current_user is not None and current_user.role in ("admin", "superadmin")


def to_appointment_out(appt: Appointment) -> AppointmentOut:
    """Build the API representation, including denormalized names for display.

    Relies on Appointment.provider/client/appointment_type being lazy="selectin"
    on the model itself, so these are already loaded — no explicit selectinload
    needed here (unlike the Provider<->AppointmentType m2m, which does need it).
    """
    client_name = None
    if appt.client is not None:
        client_name = f"{appt.client.first_name} {appt.client.last_name}".strip()
    return AppointmentOut(
        id=appt.id,
        provider_id=appt.provider_id,
        client_id=appt.client_id,
        appointment_type_id=appt.appointment_type_id,
        start_at=_as_utc(appt.start_at),
        end_at=_as_utc(appt.end_at),
        status=appt.status,
        reason=appt.reason,
        booked_by=appt.booked_by,
        cancellation_reason=appt.cancellation_reason,
        created_at=appt.created_at,
        provider_name=appt.provider.display_name if appt.provider else None,
        client_name=client_name,
        appointment_type_name=appt.appointment_type.name if appt.appointment_type else None,
    )


def to_appointment_list_out(appt: Appointment) -> AppointmentListOut:
    client_name = None
    if appt.client is not None:
        client_name = f"{appt.client.first_name} {appt.client.last_name}".strip()
    return AppointmentListOut(
        id=appt.id,
        start_at=_as_utc(appt.start_at),
        end_at=_as_utc(appt.end_at),
        status=appt.status,
        provider_name=appt.provider.display_name if appt.provider else None,
        client_name=client_name,
        appointment_type_name=appt.appointment_type.name if appt.appointment_type else None,
    )


async def _get_appointment_raw(appointment_id: str, db: AsyncSession) -> Appointment:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return appt


def _check_owner_or_admin(appt: Appointment, current_user) -> None:
    if _is_admin(current_user):
        return
    if current_user is None or appt.client is None or appt.client.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


async def _has_overlap(
    provider_id: str,
    start_at: datetime,
    end_at: datetime,
    db: AsyncSession,
    exclude_appointment_id: Optional[str] = None,
) -> bool:
    query = select(Appointment.id).where(
        Appointment.provider_id == provider_id,
        Appointment.status != AppointmentStatus.cancelled,
        Appointment.start_at < end_at,
        Appointment.end_at > start_at,
    )
    if exclude_appointment_id:
        query = query.where(Appointment.id != exclude_appointment_id)
    result = await db.execute(query)
    return result.first() is not None


async def create_appointment(data: AppointmentCreate, db: AsyncSession, *, current_user) -> Appointment:
    provider = await get_provider(data.provider_id, db)
    if not provider.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    appointment_type = await _get_appointment_type_with_providers(data.appointment_type_id, db)
    if not appointment_type.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment type not found")

    offered_provider_ids = {p.id for p in appointment_type.providers}
    if provider.id not in offered_provider_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="provider does not offer this appointment type",
        )

    start_at = _as_utc(data.start_at)
    end_at = start_at + timedelta(minutes=appointment_type.duration_minutes)

    is_admin = _is_admin(current_user)
    # Customers/guests can't book in the past; admins may backfill freely.
    if not is_admin and start_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="cannot book an appointment in the past"
        )
    if is_admin and data.client_id:
        client_obj = await get_client(data.client_id, db)
        booked_by = current_user.id
    elif is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id is required when booking as admin",
        )
    elif current_user is not None:
        # Logged-in customer: always resolve to (or create) their own client record —
        # any client_id they supplied is ignored so they can't book on someone else's behalf.
        defaults = {
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "email": current_user.email,
        }
        client_obj = await get_or_create_client_for_user(current_user.id, db, defaults=defaults)
        booked_by = "self"
    else:
        # Guest booking.
        if not data.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email is required for guest bookings")
        client_obj = Client(
            first_name=data.first_name or "",
            last_name=data.last_name or "",
            email=data.email,
            phone=data.phone,
        )
        db.add(client_obj)
        await db.flush()
        booked_by = "guest"

    # Lock the provider row so two concurrent bookings for the same provider+slot
    # can't both pass the overlap check before either has inserted (mirrors
    # products.deduct_stock's with_for_update pattern for preventing oversell).
    await db.execute(select(Provider).where(Provider.id == provider.id).with_for_update())

    if await _has_overlap(provider.id, start_at, end_at, db):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That time slot is no longer available")

    appointment = Appointment(
        provider_id=provider.id,
        client_id=client_obj.id,
        appointment_type_id=appointment_type.id,
        start_at=start_at,
        end_at=end_at,
        status=AppointmentStatus.confirmed,
        reason=data.reason,
        booked_by=booked_by,
    )
    db.add(appointment)
    try:
        await db.flush()
    except IntegrityError:
        # Belt-and-braces: the overlap check above can race when two requests use
        # SEPARATE DB sessions (with_for_update() is a no-op on SQLite, so the lock
        # taken earlier does not serialize them). The DB-enforced unique constraint
        # on (provider_id, start_at) is the last line of defense — convert the loser's
        # IntegrityError into the same 409 the overlap check would have raised.
        # Roll back explicitly (rather than relying on the caller) so a shared/reused
        # session (as in the test suite's `client`/`db` fixtures) isn't left in a
        # failed-transaction state for whatever runs next.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That time slot is no longer available"
        )
    return await _get_appointment_raw(appointment.id, db)


async def list_appointments(
    db: AsyncSession,
    *,
    current_user,
    provider_id: Optional[str] = None,
    client_id: Optional[str] = None,
    appt_status: Optional[AppointmentStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Appointment], int]:
    query = select(Appointment)
    count_query = select(func.count()).select_from(Appointment)

    if _is_admin(current_user):
        if provider_id:
            query = query.where(Appointment.provider_id == provider_id)
            count_query = count_query.where(Appointment.provider_id == provider_id)
        if client_id:
            query = query.where(Appointment.client_id == client_id)
            count_query = count_query.where(Appointment.client_id == client_id)
        if appt_status:
            query = query.where(Appointment.status == appt_status)
            count_query = count_query.where(Appointment.status == appt_status)
        if date_from:
            query = query.where(Appointment.start_at >= date_from)
            count_query = count_query.where(Appointment.start_at >= date_from)
        if date_to:
            query = query.where(Appointment.start_at <= date_to)
            count_query = count_query.where(Appointment.start_at <= date_to)
    else:
        query = query.join(Client, Appointment.client_id == Client.id).where(Client.user_id == current_user.id)
        count_query = count_query.join(Client, Appointment.client_id == Client.id).where(
            Client.user_id == current_user.id
        )

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Appointment.start_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def get_appointment(appointment_id: str, db: AsyncSession, *, current_user) -> Appointment:
    appt = await _get_appointment_raw(appointment_id, db)
    _check_owner_or_admin(appt, current_user)
    return appt


_APPOINTMENT_TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.requested: {AppointmentStatus.confirmed, AppointmentStatus.cancelled, AppointmentStatus.no_show},
    AppointmentStatus.confirmed: {AppointmentStatus.completed, AppointmentStatus.cancelled, AppointmentStatus.no_show},
    AppointmentStatus.completed: set(),
    AppointmentStatus.cancelled: set(),
    AppointmentStatus.no_show: set(),
}

# A status a customer may still cancel from (before it reaches a terminal state).
_CANCELLABLE_STATUSES = {AppointmentStatus.requested, AppointmentStatus.confirmed}


def _is_terminal(appt_status: AppointmentStatus) -> bool:
    """Single source of truth: a status is terminal when it has no outgoing transitions."""
    return not _APPOINTMENT_TRANSITIONS[appt_status]


async def reschedule_appointment(
    appointment_id: str, new_start_at: datetime, db: AsyncSession, *, current_user
) -> Appointment:
    appt = await _get_appointment_raw(appointment_id, db)
    _check_owner_or_admin(appt, current_user)

    if _is_terminal(appt.status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reschedule an appointment with status '{appt.status.value}'",
        )

    new_start_at = _as_utc(new_start_at)
    if not _is_admin(current_user) and new_start_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="cannot book an appointment in the past"
        )
    new_end_at = new_start_at + timedelta(minutes=appt.appointment_type.duration_minutes)

    await db.execute(select(Provider).where(Provider.id == appt.provider_id).with_for_update())

    if await _has_overlap(appt.provider_id, new_start_at, new_end_at, db, exclude_appointment_id=appt.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That time slot is no longer available")

    appt.start_at = new_start_at
    appt.end_at = new_end_at
    await db.flush()
    return appt


async def change_status(
    appointment_id: str,
    target: AppointmentStatus,
    cancellation_reason: Optional[str],
    db: AsyncSession,
) -> Appointment:
    appt = await _get_appointment_raw(appointment_id, db)
    prev = appt.status
    if target != prev and target not in _APPOINTMENT_TRANSITIONS.get(prev, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change appointment status from '{prev.value}' to '{target.value}'",
        )
    appt.status = target
    if target == AppointmentStatus.cancelled:
        appt.cancellation_reason = cancellation_reason
    await db.flush()
    return appt


async def cancel_appointment(
    appointment_id: str,
    db: AsyncSession,
    *,
    current_user,
    cancellation_reason: Optional[str] = None,
) -> Appointment:
    appt = await _get_appointment_raw(appointment_id, db)
    _check_owner_or_admin(appt, current_user)
    if appt.status not in _CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel appointment with status '{appt.status.value}'",
        )
    appt.status = AppointmentStatus.cancelled
    if cancellation_reason:
        appt.cancellation_reason = cancellation_reason
    await db.flush()
    return appt
