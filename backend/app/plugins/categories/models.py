from typing import Optional
from sqlalchemy import String, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.base_model import BaseModel


class Category(BaseModel):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    children: Mapped[list["Category"]] = relationship(
        "Category",
        back_populates="parent",
        foreign_keys=[parent_id],
        lazy="selectin",
    )
    parent: Mapped[Optional["Category"]] = relationship(
        "Category",
        back_populates="children",
        remote_side="Category.id",
        foreign_keys=[parent_id],
    )
