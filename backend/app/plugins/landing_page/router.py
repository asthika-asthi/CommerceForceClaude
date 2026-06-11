from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.landing_page.schemas import LandingSectionCreate, LandingSectionUpdate, LandingSectionOut
from app.plugins.landing_page import service

router = APIRouter()


@router.get("", response_model=list[LandingSectionOut])
async def list_sections(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    return await service.list_sections(db, active_only=active_only)


@router.post("", response_model=LandingSectionOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_section(data: LandingSectionCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_section(data, db)


@router.put("/{section_id}", response_model=LandingSectionOut, dependencies=[Depends(require_admin())])
async def update_section(section_id: str, data: LandingSectionUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_section(section_id, data, db)


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def delete_section(section_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_section(section_id, db)


@router.post("/reorder", response_model=list[LandingSectionOut], dependencies=[Depends(require_admin())])
async def reorder_sections(section_ids: list[str], db: AsyncSession = Depends(get_db)):
    return await service.reorder_sections(section_ids, db)
