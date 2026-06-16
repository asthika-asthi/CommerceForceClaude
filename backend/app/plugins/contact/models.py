from typing import Optional
from sqlalchemy import String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel


class Enquiry(BaseModel):
    __tablename__ = "enquiries"

    enquiry_type: Mapped[str] = mapped_column(String(20), nullable=False, default="general")  # general | bespoke
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Bespoke-specific fields
    material_type: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    quantity_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    size_spec: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    deadline: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
