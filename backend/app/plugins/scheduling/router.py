from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.plugins.scheduling import service, templates
from app.plugins.scheduling.schemas import (
    AppointmentTypeCreate,
    AppointmentTypeListOut,
    AppointmentTypeOut,
    AppointmentTypeUpdate,
    AvailabilityCreate,
    AvailabilityOut,
    ClientCreate,
    ClientListOut,
    ClientOut,
    ClientSelfUpdate,
    ClientUpdate,
    ExceptionCreate,
    ExceptionOut,
    ProviderCreate,
    ProviderListOut,
    ProviderOut,
    ProviderUpdate,
    SlotsOut,
)
from app.shared.pagination import Page, paginate

router = APIRouter()


@router.get("/config")
async def get_config():
    return templates.get_active_config()


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
