from typing import Optional
from sqlalchemy import String, Boolean, Integer, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.base_model import BaseModel


class Warehouse(BaseModel):
    __tablename__ = "warehouses"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    stock_items: Mapped[list["WarehouseStock"]] = relationship(
        "WarehouseStock", back_populates="warehouse", cascade="all, delete-orphan", lazy="selectin"
    )


class WarehouseStock(BaseModel):
    __tablename__ = "warehouse_stock"
    __table_args__ = (UniqueConstraint("warehouse_id", "product_id", name="uq_warehouse_product"),)

    warehouse_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="stock_items")

    @property
    def available_quantity(self) -> int:
        return max(0, self.quantity - self.reserved_quantity)
