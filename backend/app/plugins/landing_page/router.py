from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.landing_page.schemas import EditableSectionOut, ContentOverrideSave, ContentOverrideEntryOut
from app.plugins.landing_page import service

router = APIRouter()


# Static paths declared before /{section_key} — same ordering rule as every
# other plugin router in this codebase (dynamic path segments must come last).

@router.get("/editable", response_model=list[EditableSectionOut], dependencies=[Depends(require_admin())])
async def list_editable_sections(db: AsyncSession = Depends(get_db)):
    return await service.get_editable_sections(db)


@router.get("/overrides", response_model=dict[str, ContentOverrideEntryOut])
async def list_overrides(db: AsyncSession = Depends(get_db)):
    return await service.get_override_map(db)


@router.put("/{section_key}", response_model=EditableSectionOut, dependencies=[Depends(require_admin())])
async def save_section_content(section_key: str, data: ContentOverrideSave, db: AsyncSession = Depends(get_db)):
    await service.save_override(db, section_key, data.overrides, data.is_hidden)
    sections = await service.get_editable_sections(db)
    for s in sections:
        if s["section_key"] == section_key:
            return s
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section is not editable")
