from typing import Any
from sqlalchemy import String, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class LandingContentOverride(BaseModel):
    __tablename__ = "landing_content_overrides"

    section_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    overrides: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
