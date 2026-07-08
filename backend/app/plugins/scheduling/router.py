from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_optional, require_admin, require_superadmin
from app.plugins.scheduling import journal_service, service, templates
from app.plugins.scheduling.models import AppointmentStatus
from app.plugins.scheduling.schemas import (
    AppointmentCreate,
    AppointmentListOut,
    AppointmentOut,
    AppointmentTypeCreate,
    AppointmentTypeListOut,
    AppointmentTypeOut,
    AppointmentTypeUpdate,
    AvailabilityCreate,
    AvailabilityOut,
    CancelRequest,
    ClientCreate,
    ClientListOut,
    ClientOut,
    ClientSelfUpdate,
    ClientUpdate,
    ExceptionCreate,
    ExceptionOut,
    JournalEntryCreate,
    JournalEntryListOut,
    JournalEntryOut,
    JournalEntryUpdate,
    NoteAccessLogOut,
    ProviderCreate,
    ProviderListOut,
    ProviderOut,
    ProviderUpdate,
    PublicAppointmentTypeOut,
    RescheduleRequest,
    SlotsOut,
    StatusChangeRequest,
)
from app.shared.pagination import Page, paginate

router = APIRouter()


@router.get("/config")
async def get_config():
    return templates.get_active_config()


# ── PUBLIC BOOKING PICKERS (storefront self-service, no auth) ──────────────────
# Active-only, read-only, unpaginated — feed the storefront's service/provider
# pickers before it calls the already-public GET /availability.

@router.get(
    "/public/appointment-types",
    response_model=list[PublicAppointmentTypeOut],
)
async def list_public_appointment_types(db: AsyncSession = Depends(get_db)):
    items = await service.list_public_appointment_types(db)
    return [PublicAppointmentTypeOut.model_validate(t) for t in items]


@router.get(
    "/public/providers",
    response_model=list[ProviderListOut],
)
async def list_public_providers(
    appointment_type_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    items = await service.list_public_providers(db, appointment_type_id=appointment_type_id)
    return [ProviderListOut.model_validate(p) for p in items]


@router.post(
    "/providers",
    response_model=ProviderOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin())],
)
async def create_provider(data: ProviderCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_provider(data, db)


@router.get(
    "/providers",
    response_model=Page[ProviderListOut],
    dependencies=[Depends(require_admin())],
)
async def list_providers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list_providers(db, page=page, page_size=page_size, active_only=active_only)
    return paginate(
        [ProviderListOut.model_validate(p) for p in items], total, page, page_size
    )


@router.get(
    "/providers/{provider_id}",
    response_model=ProviderOut,
    dependencies=[Depends(require_admin())],
)
async def get_provider(provider_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_provider(provider_id, db)


@router.patch(
    "/providers/{provider_id}",
    response_model=ProviderOut,
    dependencies=[Depends(require_admin())],
)
async def update_provider(provider_id: str, data: ProviderUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_provider(provider_id, data, db)


@router.delete(
    "/providers/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin())],
)
async def deactivate_provider(provider_id: str, db: AsyncSession = Depends(get_db)):
    await service.deactivate_provider(provider_id, db)


@router.post(
    "/appointment-types",
    response_model=AppointmentTypeOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin())],
)
async def create_appointment_type(data: AppointmentTypeCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_appointment_type(data, db)


@router.get(
    "/appointment-types",
    response_model=Page[AppointmentTypeListOut],
    dependencies=[Depends(require_admin())],
)
async def list_appointment_types(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    active_only: bool = False,
    provider_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list_appointment_types(
        db, page=page, page_size=page_size, active_only=active_only, provider_id=provider_id
    )
    return paginate(
        [AppointmentTypeListOut.model_validate(t) for t in items], total, page, page_size
    )


@router.get(
    "/appointment-types/{appointment_type_id}",
    response_model=AppointmentTypeOut,
    dependencies=[Depends(require_admin())],
)
async def get_appointment_type(appointment_type_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_appointment_type(appointment_type_id, db)


@router.patch(
    "/appointment-types/{appointment_type_id}",
    response_model=AppointmentTypeOut,
    dependencies=[Depends(require_admin())],
)
async def update_appointment_type(
    appointment_type_id: str, data: AppointmentTypeUpdate, db: AsyncSession = Depends(get_db)
):
    return await service.update_appointment_type(appointment_type_id, data, db)


@router.delete(
    "/appointment-types/{appointment_type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin())],
)
async def deactivate_appointment_type(appointment_type_id: str, db: AsyncSession = Depends(get_db)):
    await service.deactivate_appointment_type(appointment_type_id, db)


# ── PROVIDER AVAILABILITY (Task 6) ─────────────────────────────────────────────

@router.post(
    "/providers/{provider_id}/availability",
    response_model=AvailabilityOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin())],
)
async def add_availability(
    provider_id: str, data: AvailabilityCreate, db: AsyncSession = Depends(get_db)
):
    return await service.add_availability(provider_id, data, db)


@router.get(
    "/providers/{provider_id}/availability",
    response_model=list[AvailabilityOut],
    dependencies=[Depends(require_admin())],
)
async def list_availability(provider_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_availability(provider_id, db)


@router.delete(
    "/availability/{availability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin())],
)
async def delete_availability(availability_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_availability(availability_id, db)


@router.post(
    "/providers/{provider_id}/exceptions",
    response_model=ExceptionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin())],
)
async def add_exception(
    provider_id: str, data: ExceptionCreate, db: AsyncSession = Depends(get_db)
):
    return await service.add_exception(provider_id, data, db)


@router.get(
    "/providers/{provider_id}/exceptions",
    response_model=list[ExceptionOut],
    dependencies=[Depends(require_admin())],
)
async def list_exceptions(
    provider_id: str,
    date_from: Optional[date] = Query(None, alias="from"),
    date_to: Optional[date] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_exceptions(provider_id, db, date_from=date_from, date_to=date_to)


@router.delete(
    "/exceptions/{exception_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin())],
)
async def delete_exception(exception_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_exception(exception_id, db)


# ── OPEN SLOT COMPUTATION (Task 7) — PUBLIC, no auth ───────────────────────────

@router.get(
    "/availability",
    response_model=SlotsOut,
)
async def get_availability(
    provider_id: str,
    appointment_type_id: str,
    date_from: date,
    date_to: date,
    db: AsyncSession = Depends(get_db),
):
    slots = await service.compute_open_slots(provider_id, appointment_type_id, date_from, date_to, db)
    return SlotsOut(slots=slots)


# ── CLIENTS (Task 8) ────────────────────────────────────────────────────────────
# NOTE: /clients/me routes are defined BEFORE /clients/{client_id} so "me" is not
# captured as a client_id path param.

@router.get("/clients/me", response_model=ClientOut)
async def get_my_client(
    current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await service.get_client_for_user(current_user.id, db)


@router.patch("/clients/me", response_model=ClientOut)
async def update_my_client(
    data: ClientSelfUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_client_self(current_user.id, data, db)


@router.post(
    "/clients",
    response_model=ClientOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin())],
)
async def create_client(data: ClientCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_client(data, db)


@router.get(
    "/clients",
    response_model=Page[ClientListOut],
    dependencies=[Depends(require_admin())],
)
async def list_clients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list_clients(db, page=page, page_size=page_size, search=search)
    return paginate([ClientListOut.model_validate(c) for c in items], total, page, page_size)


@router.get(
    "/clients/{client_id}",
    response_model=ClientOut,
    dependencies=[Depends(require_admin())],
)
async def get_client(client_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_client(client_id, db)


@router.patch(
    "/clients/{client_id}",
    response_model=ClientOut,
    dependencies=[Depends(require_admin())],
)
async def update_client(client_id: str, data: ClientUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_client(client_id, data, db)


@router.delete(
    "/clients/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin())],
)
async def deactivate_client(client_id: str, db: AsyncSession = Depends(get_db)):
    await service.deactivate_client(client_id, db)


# ── PROVIDER-SCOPED JOURNAL + AUDIT LOG (Task 12) ───────────────────────────────
# require_admin() is the coarse gate (superadmin or admin); the finer
# provider-scoping (related provider / can_view_all_clients / superadmin) is
# enforced inside journal_service against the specific client_id / entry.

@router.get(
    "/clients/{client_id}/journal",
    response_model=list[JournalEntryListOut],
)
async def list_client_journal(
    client_id: str,
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    return await journal_service.list_client_journal(current_user, client_id, db)


@router.post(
    "/clients/{client_id}/journal",
    response_model=JournalEntryOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_client_journal_entry(
    client_id: str,
    data: JournalEntryCreate,
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    return await journal_service.create_journal_entry(current_user, client_id, data, db)


@router.get(
    "/journal/{entry_id}",
    response_model=JournalEntryOut,
)
async def get_journal_entry(
    entry_id: str,
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    return await journal_service.get_journal_entry(current_user, entry_id, db)


@router.patch(
    "/journal/{entry_id}",
    response_model=JournalEntryOut,
)
async def update_journal_entry(
    entry_id: str,
    data: JournalEntryUpdate,
    current_user=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    return await journal_service.update_journal_entry(current_user, entry_id, data, db)


@router.get(
    "/audit",
    response_model=Page[NoteAccessLogOut],
    dependencies=[Depends(require_superadmin())],
)
async def list_note_access_audit(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    items, total = await journal_service.list_audit(db, page, page_size)
    return paginate([NoteAccessLogOut.model_validate(i) for i in items], total, page, page_size)


# ── APPOINTMENT BOOKING + LIFECYCLE (Task 9) ────────────────────────────────────
# NOTE: static sub-paths ("/appointments/{id}/status" etc.) are fine after the
# dynamic {appointment_id} routes here since none of them collide with "me"-style
# literal segments the way /clients/me does.

@router.post(
    "/appointments",
    response_model=AppointmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_appointment(
    data: AppointmentCreate,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    appt = await service.create_appointment(data, db, current_user=current_user)
    return service.to_appointment_out(appt)


@router.get(
    "/appointments",
    response_model=Page[AppointmentListOut],
)
async def list_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    provider_id: Optional[str] = None,
    client_id: Optional[str] = None,
    appt_status: Optional[AppointmentStatus] = Query(None, alias="status"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list_appointments(
        db,
        current_user=current_user,
        provider_id=provider_id,
        client_id=client_id,
        appt_status=appt_status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return paginate([service.to_appointment_list_out(a) for a in items], total, page, page_size)


@router.get(
    "/appointments/{appointment_id}",
    response_model=AppointmentOut,
)
async def get_appointment(
    appointment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    appt = await service.get_appointment(appointment_id, db, current_user=current_user)
    return service.to_appointment_out(appt)


@router.patch(
    "/appointments/{appointment_id}/status",
    response_model=AppointmentOut,
    dependencies=[Depends(require_admin())],
)
async def change_appointment_status(
    appointment_id: str,
    data: StatusChangeRequest,
    db: AsyncSession = Depends(get_db),
):
    appt = await service.change_status(appointment_id, data.status, data.cancellation_reason, db)
    return service.to_appointment_out(appt)


@router.post(
    "/appointments/{appointment_id}/reschedule",
    response_model=AppointmentOut,
)
async def reschedule_appointment(
    appointment_id: str,
    data: RescheduleRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    appt = await service.reschedule_appointment(appointment_id, data.start_at, db, current_user=current_user)
    return service.to_appointment_out(appt)


@router.post(
    "/appointments/{appointment_id}/cancel",
    response_model=AppointmentOut,
)
async def cancel_appointment(
    appointment_id: str,
    data: Optional[CancelRequest] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cancellation_reason = data.cancellation_reason if data else None
    appt = await service.cancel_appointment(
        appointment_id, db, current_user=current_user, cancellation_reason=cancellation_reason
    )
    return service.to_appointment_out(appt)
