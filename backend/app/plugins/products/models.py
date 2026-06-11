from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Boolean, Integer, Numeric, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.base_model import BaseModel


class Product(BaseModel):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    category_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    sale_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    is_on_sale: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weight: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 3), nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    images: Mapped[list["ProductImage"]] = relationship(
        "ProductImage", back_populates="product", cascade="all, delete-orphan",
        order_by="ProductImage.sort_order", lazy="selectin"
    )

    @property
    def effective_price(self) -> Decimal:
        return self.sale_price if self.is_on_sale and self.sale_price else self.price

    @property
    def in_stock(self) -> bool:
        return self.stock_quantity > 0


class ProductImage(BaseModel):
    __tablename__ = "product_images"

    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    alt_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="images")
