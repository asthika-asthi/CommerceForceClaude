from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class Announcement(BaseModel):
    __tablename__ = "announcements"

    text: Mapped[str] = mapped_column(String(500), nullable=False)
    link_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    link_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
