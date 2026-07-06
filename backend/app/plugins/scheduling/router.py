from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.scheduling import service, templates
from app.plugins.scheduling.schemas import (
    ProviderCreate,
    ProviderListOut,
    ProviderOut,
    ProviderUpdate,
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
