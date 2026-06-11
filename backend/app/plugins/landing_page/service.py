from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.plugins.landing_page.models import LandingSection, SectionType
from app.plugins.landing_page.schemas import LandingSectionCreate, LandingSectionUpdate


async def list_sections(db: AsyncSession, active_only: bool = True) -> list[LandingSection]:
    query = select(LandingSection)
    if active_only:
        query = query.where(LandingSection.is_active == True)
    query = query.order_by(LandingSection.sort_order.asc(), LandingSection.created_at.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_section(section_id: str, db: AsyncSession) -> LandingSection:
    result = await db.execute(select(LandingSection).where(LandingSection.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return section


async def create_section(data: LandingSectionCreate, db: AsyncSession) -> LandingSection:
    section = LandingSection(
        section_type=SectionType(data.section_type),
        title=data.title,
        subtitle=data.subtitle,
        content=data.content,
        image_url=data.image_url,
        cta_text=data.cta_text,
        cta_url=data.cta_url,
        sort_order=data.sort_order,
        background_color=data.background_color,
    )
    db.add(section)
    await db.flush()
    return section


async def update_section(section_id: str, data: LandingSectionUpdate, db: AsyncSession) -> LandingSection:
    section = await get_section(section_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    await db.flush()
    return section


async def delete_section(section_id: str, db: AsyncSession) -> None:
    section = await get_section(section_id, db)
    await db.delete(section)
    await db.flush()


async def reorder_sections(section_ids: list[str], db: AsyncSession) -> list[LandingSection]:
    for idx, section_id in enumerate(section_ids):
        section = await get_section(section_id, db)
        section.sort_order = idx
    await db.flush()
    return await list_sections(db, active_only=False)
