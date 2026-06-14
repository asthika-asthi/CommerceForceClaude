from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel as PydanticBase
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.announcements.models import Announcement

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AnnouncementCreate(PydanticBase):
    text: str
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    is_active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class AnnouncementUpdate(PydanticBase):
    text: Optional[str] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class AnnouncementRead(PydanticBase):
    id: str
    text: str
    link_url: Optional[str]
    link_text: Optional[str]
    is_active: bool
    starts_at: Optional[datetime]
    ends_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Public storefront endpoint (no auth) — declared BEFORE /{id} routes
# ---------------------------------------------------------------------------

@router.get("/active", response_model=Optional[AnnouncementRead])
async def get_active_announcement(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Announcement)
        .where(Announcement.is_active == True)
        .where(or_(Announcement.starts_at == None, Announcement.starts_at <= now))
        .where(or_(Announcement.ends_at == None, Announcement.ends_at > now))
        .order_by(Announcement.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Admin endpoints (auth required)
# ---------------------------------------------------------------------------

@router.get("", response_model=list[AnnouncementRead], dependencies=[Depends(require_admin())])
async def list_announcements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Announcement).order_by(Announcement.id.desc()))
    return result.scalars().all()


@router.post("", response_model=AnnouncementRead, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_announcement(data: AnnouncementCreate, db: AsyncSession = Depends(get_db)):
    announcement = Announcement(**data.model_dump())
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    return announcement


@router.put("/{id}", response_model=AnnouncementRead, dependencies=[Depends(require_admin())])
async def update_announcement(id: str, data: AnnouncementUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Announcement).where(Announcement.id == id))
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(announcement, field, value)
    await db.commit()
    await db.refresh(announcement)
    return announcement


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def delete_announcement(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Announcement).where(Announcement.id == id))
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    await db.delete(announcement)
    await db.commit()
