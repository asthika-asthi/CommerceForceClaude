# Product Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flexible product variants (any named option set, shared pricing, per-variant warehouse stock) so admins can configure size/colour/material combinations with separate SKUs and inventory tracking.

**Architecture:** All products always have at least one variant (the "default" variant for simple products). Cart, inventory, and checkout all reference `variant_id` instead of `product_id`. A one-time migration script creates default variants for existing products and re-points existing warehouse stock and cart item rows.

**Tech Stack:** FastAPI, SQLAlchemy async (SQLite), Pydantic v2, Next.js 16 App Router, Zustand, Tailwind v4.

---

## File Map

### Backend — new files
- `backend/app/plugins/products/variant_service.py` — all variant CRUD logic
- `backend/app/plugins/products/variant_router.py` — variant API routes
- `backend/tests/test_variants.py` — all variant tests
- `scripts/migrate_variants.py` — one-time production migration script

### Backend — modified files
- `backend/app/plugins/products/models.py` — add 4 new model classes
- `backend/app/plugins/products/schemas.py` — add variant schemas; extend ProductOut
- `backend/app/plugins/products/router.py` — include variant_router
- `backend/app/plugins/cart/models.py` — swap `product_id` → `variant_id` on CartItem
- `backend/app/plugins/cart/schemas.py` — update CartItemOut, AddItemRequest
- `backend/app/plugins/cart/service.py` — resolve product via variant; update all functions
- `backend/app/plugins/cart/router.py` — rename path param product_id → variant_id
- `backend/app/plugins/inventory/models.py` — swap `product_id` → `variant_id` on WarehouseStock
- `backend/app/plugins/inventory/schemas.py` — update all stock schemas to use variant_id
- `backend/app/plugins/inventory/service.py` — update all queries; add `deduct_stock_for_variant`
- `backend/app/plugins/orders/models.py` — add nullable `variant_id` + `variant_label` to OrderItem
- `backend/app/plugins/checkout/service.py` — include variant_id/label in items dict; call inventory deduct
- `backend/tests/conftest.py` — add new model imports

### Frontend — modified files
- `frontend-admin/app/(dashboard)/products/[id]/page.tsx` — add Variants tab UI
- `frontend-admin/app/(dashboard)/inventory/page.tsx` — update stock form to use variant_id
- `frontend-starter/lib/types.ts` — add ProductVariant, ProductOptionType, ProductOptionValue types
- `frontend-starter/store/cart.ts` — addItem takes variant_id; CartItemOut includes variant_label
- `frontend-starter/app/products/[slug]/page.tsx` — add variant picker section
- `frontend-starter/app/products/[slug]/add-to-cart-button.tsx` — accept selectedVariantId prop

---

## Task 1: Add variant models to products/models.py

**Files:**
- Modify: `backend/app/plugins/products/models.py`

- [ ] **Step 1.1: Add four new model classes**

Add after the existing `ProductImage` class. Do not change any existing code.

```python
class ProductOptionType(BaseModel):
    __tablename__ = "product_option_types"

    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    values: Mapped[list["ProductOptionValue"]] = relationship(
        "ProductOptionValue", back_populates="option_type",
        cascade="all, delete-orphan", order_by="ProductOptionValue.sort_order", lazy="selectin"
    )


class ProductOptionValue(BaseModel):
    __tablename__ = "product_option_values"

    option_type_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product_option_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    option_type: Mapped["ProductOptionType"] = relationship("ProductOptionType", back_populates="values")


class ProductVariant(BaseModel):
    __tablename__ = "product_variants"

    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    option_links: Mapped[list["ProductVariantOption"]] = relationship(
        "ProductVariantOption", back_populates="variant",
        cascade="all, delete-orphan", lazy="selectin"
    )


class ProductVariantOption(BaseModel):
    __tablename__ = "product_variant_options"
    __table_args__ = (UniqueConstraint("variant_id", "option_value_id", name="uq_variant_option"),)

    variant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    option_value_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product_option_values.id", ondelete="CASCADE"), nullable=False
    )

    variant: Mapped["ProductVariant"] = relationship("ProductVariant", back_populates="option_links")
    option_value: Mapped["ProductOptionValue"] = relationship("ProductOptionValue", lazy="selectin")
```

Add `UniqueConstraint` to the imports at the top of the file (it's already used elsewhere in the project — check if it needs adding).

- [ ] **Step 1.2: Update conftest.py imports**

In `backend/tests/conftest.py`, add inside the `setup_test_db` fixture, after the existing product model imports:

```python
from app.plugins.products.models import ProductOptionType, ProductOptionValue, ProductVariant, ProductVariantOption  # noqa
```

- [ ] **Step 1.3: Verify tables create without error**

```bash
cd backend
python -c "from app.plugins.products.models import ProductOptionType, ProductOptionValue, ProductVariant, ProductVariantOption; print('OK')"
```

Expected: `OK`

- [ ] **Step 1.4: Commit**

```bash
git add backend/app/plugins/products/models.py backend/tests/conftest.py
git commit -m "feat(variants): add ProductOptionType, ProductOptionValue, ProductVariant, ProductVariantOption models"
```

---

## Task 2: Add variant schemas

**Files:**
- Modify: `backend/app/plugins/products/schemas.py`

- [ ] **Step 2.1: Add new schema classes**

Add these classes to the end of `schemas.py`:

```python
class OptionValueOut(BaseModel):
    id: str
    label: str
    sort_order: int
    model_config = {"from_attributes": True}


class OptionTypeOut(BaseModel):
    id: str
    name: str
    sort_order: int
    values: List[OptionValueOut] = []
    model_config = {"from_attributes": True}


class OptionTypeCreate(BaseModel):
    name: str
    sort_order: int = 0


class OptionValueCreate(BaseModel):
    label: str
    sort_order: int = 0


class VariantOptionLink(BaseModel):
    option_type_name: str
    option_value_label: str


class ProductVariantOut(BaseModel):
    id: str
    product_id: str
    sku: str
    is_default: bool
    is_active: bool
    option_values: List[VariantOptionLink] = []
    label: str = ""  # e.g. "Size: M, Colour: Red"
    model_config = {"from_attributes": True}


class VariantUpdate(BaseModel):
    sku: Optional[str] = None
    is_active: Optional[bool] = None
```

- [ ] **Step 2.2: Extend ProductOut to include variants**

Add two fields to the existing `ProductOut` class:

```python
option_types: List["OptionTypeOut"] = []
variants: List["ProductVariantOut"] = []
```

These fields are optional and default to empty list so existing code that builds `ProductOut` from ORM objects without variants keeps working.

- [ ] **Step 2.3: Commit**

```bash
git add backend/app/plugins/products/schemas.py
git commit -m "feat(variants): add variant schemas (OptionTypeOut, ProductVariantOut, VariantUpdate)"
```

---

## Task 3: Write variant tests (failing)

**Files:**
- Create: `backend/tests/test_variants.py`

Write tests first. They will fail until Task 4 (variant service + router) is complete.

- [ ] **Step 3.1: Create test file**

```python
import pytest
from httpx import AsyncClient


# ── helpers ──────────────────────────────────────────────────────────────────

async def _admin_token(client: AsyncClient) -> str:
    r = await client.post("/api/auth/login", json={"email": "admin@commerceforce.dev", "password": "Admin1234!"})
    return r.json()["access_token"]


async def _make_product(client: AsyncClient, token: str) -> dict:
    r = await client.post(
        "/api/products",
        json={"name": "Test Shirt", "price": "19.99", "stock_quantity": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── option type CRUD ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_option_type(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Size"
    assert data["values"] == []


@pytest.mark.asyncio
async def test_add_option_value(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]

    r = await client.post(
        f"/api/products/{product['id']}/options/{opt_id}/values",
        json={"label": "M", "sort_order": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    assert r.json()["label"] == "M"


# ── variant generation ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_variants_single_axis(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    # Add Size option with 3 values
    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    for label in ["S", "M", "L"]:
        await client.post(
            f"/api/products/{product['id']}/options/{opt_id}/values",
            json={"label": label},
            headers={"Authorization": f"Bearer {token}"},
        )

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 3
    labels = {v["label"] for v in variants}
    assert labels == {"Size: S", "Size: M", "Size: L"}


@pytest.mark.asyncio
async def test_generate_variants_two_axes(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    for axis_name, values in [("Size", ["S", "M"]), ("Colour", ["Red", "Blue"])]:
        opt_r = await client.post(
            f"/api/products/{product['id']}/options",
            json={"name": axis_name},
            headers={"Authorization": f"Bearer {token}"},
        )
        opt_id = opt_r.json()["id"]
        for label in values:
            await client.post(
                f"/api/products/{product['id']}/options/{opt_id}/values",
                json={"label": label},
                headers={"Authorization": f"Bearer {token}"},
            )

    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 4  # S/Red, S/Blue, M/Red, M/Blue


@pytest.mark.asyncio
async def test_default_variant_exists_on_new_product(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    r = await client.get(f"/api/products/{product['id']}/variants")
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 1
    assert variants[0]["is_default"] is True


@pytest.mark.asyncio
async def test_update_variant_sku(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    variants_r = await client.get(f"/api/products/{product['id']}/variants")
    variant_id = variants_r.json()[0]["id"]

    r = await client.patch(
        f"/api/products/{product['id']}/variants/{variant_id}",
        json={"sku": "MYSKU-001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["sku"] == "MYSKU-001"


@pytest.mark.asyncio
async def test_delete_option_type_deactivates_variants(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    opt_r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    opt_id = opt_r.json()["id"]
    await client.post(
        f"/api/products/{product['id']}/options/{opt_id}/values",
        json={"label": "M"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    del_r = await client.delete(
        f"/api/products/{product['id']}/options/{opt_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_r.status_code == 204

    variants_r = await client.get(f"/api/products/{product['id']}/variants")
    active = [v for v in variants_r.json() if v["is_active"]]
    assert len(active) == 0


# ── product detail includes variants ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_product_detail_includes_variants(client: AsyncClient):
    token = await _admin_token(client)
    product = await _make_product(client, token)

    r = await client.get(f"/api/products/{product['id']}")
    assert r.status_code == 200
    data = r.json()
    assert "variants" in data
    assert len(data["variants"]) >= 1
    assert "option_types" in data
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
cd D:/Projects/20260609_Commerceforce
python -m pytest backend/tests/test_variants.py -q --tb=short 2>&1 | tail -20
```

Expected: all tests fail with 404 or 422 (routes don't exist yet).

---

## Task 4: Implement variant service and router

**Files:**
- Create: `backend/app/plugins/products/variant_service.py`
- Create: `backend/app/plugins/products/variant_router.py`
- Modify: `backend/app/plugins/products/router.py`

- [ ] **Step 4.1: Create variant_service.py**

```python
from itertools import product as itertools_product
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status as http_status
from app.plugins.products.models import (
    Product, ProductOptionType, ProductOptionValue, ProductVariant, ProductVariantOption,
)
from app.plugins.products.schemas import OptionTypeCreate, OptionValueCreate, VariantUpdate


async def _load_product(product_id: str, db: AsyncSession) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


async def _load_option_type(option_type_id: str, db: AsyncSession) -> ProductOptionType:
    result = await db.execute(
        select(ProductOptionType).where(ProductOptionType.id == option_type_id)
        .options(selectinload(ProductOptionType.values))
    )
    opt = result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="Option type not found")
    return opt


async def _load_variant(variant_id: str, db: AsyncSession) -> ProductVariant:
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.id == variant_id)
        .options(selectinload(ProductVariant.option_links))
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Variant not found")
    return v


def _build_label(variant: ProductVariant) -> str:
    """Build 'Size: M, Colour: Red' from the variant's option links."""
    parts = []
    for link in sorted(variant.option_links, key=lambda l: l.option_value.option_type.sort_order):
        parts.append(f"{link.option_value.option_type.name}: {link.option_value.label}")
    return ", ".join(parts) if parts else ""


async def get_or_create_default_variant(product_id: str, db: AsyncSession) -> ProductVariant:
    """Return the existing default variant, or create one if none exists."""
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product_id, ProductVariant.is_default == True
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    product = await _load_product(product_id, db)
    variant = ProductVariant(product_id=product_id, sku=product.sku, is_default=True, is_active=True)
    db.add(variant)
    await db.flush()
    return variant


async def list_option_types(product_id: str, db: AsyncSession) -> list[ProductOptionType]:
    result = await db.execute(
        select(ProductOptionType).where(ProductOptionType.product_id == product_id)
        .options(selectinload(ProductOptionType.values))
        .order_by(ProductOptionType.sort_order)
    )
    return list(result.scalars().all())


async def create_option_type(product_id: str, data: OptionTypeCreate, db: AsyncSession) -> ProductOptionType:
    await _load_product(product_id, db)
    opt = ProductOptionType(product_id=product_id, name=data.name, sort_order=data.sort_order)
    db.add(opt)
    await db.flush()
    result = await db.execute(
        select(ProductOptionType).where(ProductOptionType.id == opt.id)
        .options(selectinload(ProductOptionType.values))
    )
    return result.scalar_one()


async def delete_option_type(product_id: str, option_type_id: str, db: AsyncSession) -> None:
    opt = await _load_option_type(option_type_id, db)
    if opt.product_id != product_id:
        raise HTTPException(status_code=404, detail="Option type not found for this product")
    # Deactivate all variants that use any value from this option type
    value_ids = {v.id for v in opt.values}
    if value_ids:
        result = await db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product_id)
            .options(selectinload(ProductVariant.option_links))
        )
        for variant in result.scalars().all():
            linked_value_ids = {link.option_value_id for link in variant.option_links}
            if linked_value_ids & value_ids:
                variant.is_active = False
    await db.delete(opt)
    await db.flush()


async def add_option_value(product_id: str, option_type_id: str, data: OptionValueCreate, db: AsyncSession) -> ProductOptionValue:
    opt = await _load_option_type(option_type_id, db)
    if opt.product_id != product_id:
        raise HTTPException(status_code=404, detail="Option type not found for this product")
    val = ProductOptionValue(option_type_id=option_type_id, label=data.label, sort_order=data.sort_order)
    db.add(val)
    await db.flush()
    return val


async def delete_option_value(product_id: str, option_type_id: str, value_id: str, db: AsyncSession) -> None:
    opt = await _load_option_type(option_type_id, db)
    if opt.product_id != product_id:
        raise HTTPException(status_code=404, detail="Option type not found")
    result = await db.execute(
        select(ProductOptionValue).where(ProductOptionValue.id == value_id, ProductOptionValue.option_type_id == option_type_id)
    )
    val = result.scalar_one_or_none()
    if not val:
        raise HTTPException(status_code=404, detail="Option value not found")
    # Deactivate variants that use this value
    link_result = await db.execute(
        select(ProductVariantOption).where(ProductVariantOption.option_value_id == value_id)
    )
    for link in link_result.scalars().all():
        v_result = await db.execute(select(ProductVariant).where(ProductVariant.id == link.variant_id))
        variant = v_result.scalar_one_or_none()
        if variant:
            variant.is_active = False
    await db.delete(val)
    await db.flush()


async def generate_variants(product_id: str, db: AsyncSession) -> list[ProductVariant]:
    """
    Auto-generate all combinations from the product's option types and values.
    Existing non-default variants that match a combination are reactivated rather than recreated.
    New combinations are created. The default variant is deactivated if options are defined.
    """
    option_types = await list_option_types(product_id, db)
    if not option_types:
        raise HTTPException(status_code=400, detail="No option types defined — add options before generating variants")

    product = await _load_product(product_id, db)

    # Get all existing variants for this product
    existing_result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
        .options(selectinload(ProductVariant.option_links))
    )
    existing_variants = list(existing_result.scalars().all())

    # Deactivate the default variant — product now has real variants
    for v in existing_variants:
        if v.is_default:
            v.is_active = False

    # Build value lists per axis
    axes = [opt.values for opt in option_types]
    combinations = list(itertools_product(*axes))

    result_variants = []
    for combo in combinations:
        combo_value_ids = frozenset(val.id for val in combo)

        # Check if this combination already exists
        matched = None
        for ev in existing_variants:
            if not ev.is_default:
                ev_value_ids = frozenset(link.option_value_id for link in ev.option_links)
                if ev_value_ids == combo_value_ids:
                    matched = ev
                    break

        if matched:
            matched.is_active = True
            result_variants.append(matched)
        else:
            # Build SKU: product.sku + abbreviated option values
            suffix = "-".join(val.label[:3].upper() for val in combo)
            sku = f"{product.sku}-{suffix}"
            # Ensure uniqueness
            counter = 1
            base_sku = sku
            while True:
                check = await db.execute(select(ProductVariant).where(ProductVariant.sku == sku))
                if not check.scalar_one_or_none():
                    break
                sku = f"{base_sku}-{counter}"
                counter += 1

            new_variant = ProductVariant(product_id=product_id, sku=sku, is_default=False, is_active=True)
            db.add(new_variant)
            await db.flush()

            for val in combo:
                link = ProductVariantOption(variant_id=new_variant.id, option_value_id=val.id)
                db.add(link)
            await db.flush()

            # Reload with links
            reloaded = await db.execute(
                select(ProductVariant).where(ProductVariant.id == new_variant.id)
                .options(selectinload(ProductVariant.option_links).selectinload(ProductVariantOption.option_value).selectinload(ProductOptionValue.option_type))
            )
            result_variants.append(reloaded.scalar_one())

    await db.flush()
    return result_variants


async def list_variants(product_id: str, db: AsyncSession) -> list[ProductVariant]:
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
        .options(
            selectinload(ProductVariant.option_links)
            .selectinload(ProductVariantOption.option_value)
            .selectinload(ProductOptionValue.option_type)
        )
        .order_by(ProductVariant.is_default.desc())
    )
    return list(result.scalars().all())


async def update_variant(product_id: str, variant_id: str, data: VariantUpdate, db: AsyncSession) -> ProductVariant:
    variant = await _load_variant(variant_id, db)
    if variant.product_id != product_id:
        raise HTTPException(status_code=404, detail="Variant not found for this product")
    updates = data.model_dump(exclude_unset=True)
    if "sku" in updates:
        # Check SKU uniqueness
        check = await db.execute(
            select(ProductVariant).where(ProductVariant.sku == updates["sku"], ProductVariant.id != variant_id)
        )
        if check.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"SKU '{updates['sku']}' already in use")
    for k, v in updates.items():
        setattr(variant, k, v)
    await db.flush()
    return await _load_variant(variant_id, db)


def build_variant_out(variant: ProductVariant) -> dict:
    """Build a dict matching ProductVariantOut from a loaded variant."""
    option_values = []
    for link in sorted(variant.option_links, key=lambda l: getattr(l.option_value.option_type, "sort_order", 0)):
        option_values.append({
            "option_type_name": link.option_value.option_type.name,
            "option_value_label": link.option_value.label,
        })
    label_parts = [f"{ov['option_type_name']}: {ov['option_value_label']}" for ov in option_values]
    return {
        "id": variant.id,
        "product_id": variant.product_id,
        "sku": variant.sku,
        "is_default": variant.is_default,
        "is_active": variant.is_active,
        "option_values": option_values,
        "label": ", ".join(label_parts),
    }
```

- [ ] **Step 4.2: Create variant_router.py**

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.products import variant_service as service
from app.plugins.products.schemas import (
    OptionTypeCreate, OptionTypeOut, OptionValueCreate, OptionValueOut,
    ProductVariantOut, VariantUpdate,
)

router = APIRouter()


@router.get("/{product_id}/options", response_model=list[OptionTypeOut])
async def list_option_types(product_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_option_types(product_id, db)


@router.post("/{product_id}/options", response_model=OptionTypeOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_option_type(product_id: str, data: OptionTypeCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_option_type(product_id, data, db)


@router.delete("/{product_id}/options/{option_type_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def delete_option_type(product_id: str, option_type_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_option_type(product_id, option_type_id, db)


@router.post("/{product_id}/options/{option_type_id}/values", response_model=OptionValueOut,
             status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin())])
async def add_option_value(product_id: str, option_type_id: str, data: OptionValueCreate,
                           db: AsyncSession = Depends(get_db)):
    return await service.add_option_value(product_id, option_type_id, data, db)


@router.delete("/{product_id}/options/{option_type_id}/values/{value_id}",
               status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin())])
async def delete_option_value(product_id: str, option_type_id: str, value_id: str,
                              db: AsyncSession = Depends(get_db)):
    await service.delete_option_value(product_id, option_type_id, value_id, db)


@router.get("/{product_id}/variants", response_model=list[dict])
async def list_variants(product_id: str, db: AsyncSession = Depends(get_db)):
    variants = await service.list_variants(product_id, db)
    return [service.build_variant_out(v) for v in variants]


@router.post("/{product_id}/variants/generate", response_model=list[dict],
             dependencies=[Depends(require_admin())])
async def generate_variants(product_id: str, db: AsyncSession = Depends(get_db)):
    variants = await service.generate_variants(product_id, db)
    return [service.build_variant_out(v) for v in variants]


@router.patch("/{product_id}/variants/{variant_id}", response_model=dict,
              dependencies=[Depends(require_admin())])
async def update_variant(product_id: str, variant_id: str, data: VariantUpdate,
                         db: AsyncSession = Depends(get_db)):
    variant = await service.update_variant(product_id, variant_id, data, db)
    return service.build_variant_out(variant)
```

- [ ] **Step 4.3: Wire variant router into products/router.py**

At the top of `backend/app/plugins/products/router.py`, add the import:

```python
from app.plugins.products import variant_router
```

At the bottom of the file (after all existing routes), add:

```python
# Include variant sub-routes (mounted at same prefix /api/products/...)
router.include_router(variant_router.router)
```

- [ ] **Step 4.4: Update product detail endpoint to include variants**

In `backend/app/plugins/products/router.py`, find the `GET /api/products/{product_id}` endpoint and update it to load and return variants. Find the service function it calls and extend it to populate `option_types` and `variants` on the `ProductOut` response.

In `backend/app/plugins/products/service.py`, find or create the function that returns a single product. After loading the product, also load its option types and variants:

```python
from app.plugins.products import variant_service
# At the end of the get_product function, after loading the product:
option_types = await variant_service.list_option_types(product.id, db)
variants = await variant_service.list_variants(product.id, db)
# Build the response manually or use a dict override approach
```

The cleanest approach is to return a dict from the endpoint rather than relying purely on Pydantic `from_attributes`, since `ProductOut` doesn't have ORM relationships for variants. The GET endpoint should build the response dict:

```python
product_dict = ProductOut.model_validate(product).model_dump()
product_dict["option_types"] = [OptionTypeOut.model_validate(ot).model_dump() for ot in option_types]
product_dict["variants"] = [variant_service.build_variant_out(v) for v in variants]
return product_dict
```

- [ ] **Step 4.5: Ensure default variant is created when a product is created**

In `backend/app/plugins/products/service.py`, find the `create_product` function. After flushing the new product, call:

```python
await variant_service.get_or_create_default_variant(product.id, db)
```

This ensures every new product has a default variant from the moment it's created.

- [ ] **Step 4.6: Run variant tests**

```bash
cd D:/Projects/20260609_Commerceforce
python -m pytest backend/tests/test_variants.py -q --tb=short 2>&1 | tail -30
```

Expected: all variant tests pass.

- [ ] **Step 4.7: Run full test suite to check for regressions**

```bash
python -m pytest backend/tests/ -q --tb=short --ignore=backend/tests/test_content.py 2>&1 | tail -15
```

Expected: same pass count as before (AI chat tests excluded as pre-existing failure).

- [ ] **Step 4.8: Commit**

```bash
git add backend/app/plugins/products/
git commit -m "feat(variants): add variant service, router, and product detail variant loading"
```

---

## Task 5: Update cart to use variant_id

**Files:**
- Modify: `backend/app/plugins/cart/models.py`
- Modify: `backend/app/plugins/cart/schemas.py`
- Modify: `backend/app/plugins/cart/service.py`
- Modify: `backend/app/plugins/cart/router.py`

This is a breaking change to the CartItem table. In the test environment, the database is recreated fresh each run, so no migration is needed here. In production, the migration script (Task 12) handles this.

- [ ] **Step 5.1: Update CartItem model**

In `backend/app/plugins/cart/models.py`:

1. Replace `product_id` with `variant_id` on `CartItem`:
   - Change the column from `ForeignKey("products.id", ...)` to `ForeignKey("product_variants.id", ...)`
   - Rename the column from `product_id` to `variant_id`
2. Update the `UniqueConstraint` from `("cart_id", "product_id")` to `("cart_id", "variant_id")`
3. Add the import for `ProductVariant` at the top if needed

After change, `CartItem` looks like:
```python
class CartItem(BaseModel):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("cart_id", "variant_id", name="uq_cart_variant"),)

    cart_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    cart: Mapped["Cart"] = relationship("Cart", back_populates="items")
```

- [ ] **Step 5.2: Update cart schemas**

In `backend/app/plugins/cart/schemas.py`:

1. `CartItemOut`: rename `product_id` field → `variant_id`; add `variant_label: Optional[str] = None`
2. `AddItemRequest`: rename `product_id` → `variant_id`

After change:
```python
class CartItemOut(BaseModel):
    id: str
    variant_id: str
    product_id: str          # still included — resolved from variant
    product_name: str
    product_sku: str
    product_slug: str
    variant_label: str       # "Size: M, Colour: Red" or "" for default variants
    unit_price: Decimal
    quantity: int
    line_total: Decimal
    primary_image: Optional[str] = None
    in_stock: bool
    stock_quantity: int      # from variant's warehouse stock sum

class AddItemRequest(BaseModel):
    variant_id: str
    quantity: int = 1
```

- [ ] **Step 5.3: Update cart service**

In `backend/app/plugins/cart/service.py`, make these changes:

1. Add import: `from app.plugins.products.models import ProductVariant, ProductOptionType, ProductOptionValue, ProductVariantOption`
2. Add import: `from app.plugins.products import variant_service`
3. In `_build_cart_out`, for each cart item:
   - Load the variant by `item.variant_id`
   - Load the product via `variant.product_id`
   - Build `variant_label` using `variant_service.build_variant_out(variant)["label"]`
   - Use `CartItemOut(variant_id=item.variant_id, ...)` instead of `product_id`
4. In `add_item`: change signature from `(product_id, ...)` to `(variant_id, ...)`; load the variant first, then load the product from it; check `product.is_active`; check variant is active; check stock from WarehouseStock (via `inventory_service.get_variant_stock_total(variant_id, db)`)
5. In `update_item`: change `product_id` → `variant_id` throughout
6. In `remove_item`: change `product_id` → `variant_id`
7. In `merge_guest_cart`: update the `next()` call that checks `i.product_id` to check `i.variant_id`

For stock checking in `add_item`, since inventory is now per-variant, query WarehouseStock directly:
```python
from app.plugins.inventory.models import WarehouseStock
from sqlalchemy import func
result = await db.execute(
    select(func.sum(WarehouseStock.quantity - WarehouseStock.reserved_quantity))
    .where(WarehouseStock.variant_id == variant_id)
)
available = result.scalar() or 0
if available < quantity:
    raise HTTPException(status_code=409, detail="Insufficient stock")
```

- [ ] **Step 5.4: Update cart router**

In `backend/app/plugins/cart/router.py`:
1. Change `service.add_item(data.product_id, ...)` → `service.add_item(data.variant_id, ...)`
2. Rename path params in `PUT /items/{product_id}` and `DELETE /items/{product_id}` to `variant_id`
3. Change the calls `service.update_item(product_id, ...)` → `service.update_item(variant_id, ...)`
4. Change `service.remove_item(product_id, ...)` → `service.remove_item(variant_id, ...)`

- [ ] **Step 5.5: Run full test suite**

```bash
cd D:/Projects/20260609_Commerceforce
rm -f test_commerceforce.db test_commerceforce.db-journal
python -m pytest backend/tests/ -q --tb=short --ignore=backend/tests/test_content.py 2>&1 | tail -20
```

Expected: same or more tests passing than before. Cart tests should all pass.

- [ ] **Step 5.6: Commit**

```bash
git add backend/app/plugins/cart/
git commit -m "feat(variants): update cart to use variant_id instead of product_id"
```

---

## Task 6: Update inventory to use variant_id

**Files:**
- Modify: `backend/app/plugins/inventory/models.py`
- Modify: `backend/app/plugins/inventory/schemas.py`
- Modify: `backend/app/plugins/inventory/service.py`

- [ ] **Step 6.1: Update WarehouseStock model**

In `backend/app/plugins/inventory/models.py`, on the `WarehouseStock` class:
1. Replace `product_id` column with `variant_id` pointing to `product_variants.id`
2. Update the `UniqueConstraint` from `("warehouse_id", "product_id")` to `("warehouse_id", "variant_id")`

After change:
```python
class WarehouseStock(BaseModel):
    __tablename__ = "warehouse_stock"
    __table_args__ = (UniqueConstraint("warehouse_id", "variant_id", name="uq_warehouse_variant"),)

    warehouse_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="stock_items")

    @property
    def available_quantity(self) -> int:
        return max(0, self.quantity - self.reserved_quantity)
```

- [ ] **Step 6.2: Update inventory schemas**

In `backend/app/plugins/inventory/schemas.py`:
1. `StockSetRequest`: rename `product_id` → `variant_id`
2. `StockAdjustRequest`: rename `product_id` → `variant_id`
3. `WarehouseStockOut`: rename `product_id` → `variant_id`; add optional `variant_label: str = ""`
4. `ProductStockSummary`: rename `product_id` → `variant_id`; rename class to `VariantStockSummary` (or keep name but change the field)

- [ ] **Step 6.3: Update inventory service**

In `backend/app/plugins/inventory/service.py`, update every reference from `product_id` to `variant_id`:
1. `set_stock`: change `data.product_id` → `data.variant_id` in all queries and model constructions
2. `adjust_stock`: same
3. `get_product_stock`: rename to `get_variant_stock`; change filter from `product_id` to `variant_id`
4. `get_warehouse_stock`: unchanged (loads by warehouse_id — no product_id reference)

Add a new function:
```python
async def deduct_stock_for_variant(variant_id: str, quantity: int, db: AsyncSession) -> None:
    """Deduct stock from all warehouses for a variant (default warehouse first, then others)."""
    # Load all stock records for this variant, preferring default warehouse
    result = await db.execute(
        select(WarehouseStock).where(WarehouseStock.variant_id == variant_id).with_for_update()
    )
    stocks = list(result.scalars().all())
    if not stocks:
        raise HTTPException(status_code=409, detail=f"No warehouse stock record for variant {variant_id}")
    
    remaining = quantity
    for stock in stocks:
        available = stock.quantity - stock.reserved_quantity
        deduct = min(remaining, available)
        if deduct > 0:
            stock.quantity -= deduct
            remaining -= deduct
        if remaining == 0:
            break
    
    if remaining > 0:
        raise HTTPException(status_code=409, detail="Insufficient stock across all warehouses")
    await db.flush()
```

Add a helper for the cart stock check:
```python
async def get_variant_stock_total(variant_id: str, db: AsyncSession) -> int:
    """Return total available quantity across all warehouses for a variant."""
    from sqlalchemy import func
    result = await db.execute(
        select(func.sum(WarehouseStock.quantity - WarehouseStock.reserved_quantity))
        .where(WarehouseStock.variant_id == variant_id)
    )
    return result.scalar() or 0
```

- [ ] **Step 6.4: Run tests**

```bash
cd D:/Projects/20260609_Commerceforce
rm -f test_commerceforce.db test_commerceforce.db-journal
python -m pytest backend/tests/ -q --tb=short --ignore=backend/tests/test_content.py 2>&1 | tail -20
```

- [ ] **Step 6.5: Commit**

```bash
git add backend/app/plugins/inventory/
git commit -m "feat(variants): update inventory warehouse_stock to use variant_id"
```

---

## Task 7: Update orders model and checkout service

**Files:**
- Modify: `backend/app/plugins/orders/models.py`
- Modify: `backend/app/plugins/checkout/service.py`

- [ ] **Step 7.1: Add variant fields to OrderItem**

In `backend/app/plugins/orders/models.py`, add two nullable columns to `OrderItem` after `product_sku`:

```python
variant_id: Mapped[Optional[str]] = mapped_column(
    String(36), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True
)
variant_label: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
```

Historical order items will have `variant_id = NULL` and `variant_label = NULL`, which is correct.

- [ ] **Step 7.2: Update checkout service**

In `backend/app/plugins/checkout/service.py`:

1. In `_items_from_cart`, change the item-building logic:
   - Load the variant by `cart_item.variant_id` instead of loading a product by `cart_item.product_id`
   - Load the product via `variant.product_id`
   - Add `variant_id` and `variant_label` to the item dict
   - Check `variant.is_active` (raise 409 if variant is no longer available)
   - For stock, call `inventory_service.get_variant_stock_total(variant_id, db)` instead of checking `product.stock_quantity`

2. In `_items_from_explicit`, update similarly. The `CheckoutItem` schema needs to accept `variant_id` — update `backend/app/plugins/checkout/schemas.py` if it exists, or the inline schema.

3. Replace the `deduct_stock` call at line 174:
   - Before: `await product_service.deduct_stock(item["product_id"], item["quantity"], db)`
   - After: `await inventory_service.deduct_stock_for_variant(item["variant_id"], item["quantity"], db)`
   - Add import: `from app.plugins.inventory import service as inventory_service`

4. In `order_service.create_order`, update the `OrderItem` construction to include `variant_id` and `variant_label` from the items dict.

- [ ] **Step 7.3: Run full test suite**

```bash
cd D:/Projects/20260609_Commerceforce
rm -f test_commerceforce.db test_commerceforce.db-journal
python -m pytest backend/tests/ -q --tb=short --ignore=backend/tests/test_content.py 2>&1 | tail -20
```

Expected: all tests pass (checkout tests now use variants internally).

- [ ] **Step 7.4: Commit**

```bash
git add backend/app/plugins/orders/models.py backend/app/plugins/checkout/
git commit -m "feat(variants): update orders and checkout to capture variant_id and variant_label"
```

---

## Task 8: Migration script

**Files:**
- Create: `scripts/migrate_variants.py`

This script is for existing production databases that already have products, warehouse stock, and cart items referencing `product_id`. It is NOT run automatically at startup.

- [ ] **Step 8.1: Create migration script**

```python
#!/usr/bin/env python
"""
One-time migration: introduces the product variant schema and migrates
existing warehouse_stock and cart_items rows to reference variant_id.

Run once against the production database:
    python scripts/migrate_variants.py

Safe to run multiple times (idempotent).
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./backend/commerceforce.db")
os.environ.setdefault("ENABLED_PLUGINS", "auth,categories,products,cart,orders,checkout,rfq,credit,inventory,coupons,loyalty,newsletter,branding,landing_page,ai_chat,contact,shipping")
os.environ.setdefault("SECRET_KEY", "migration-run")

from app.core.database import engine
from app.core.base_model import Base


async def run():
    # 1. Create all new tables (idempotent with checkfirst=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("[migrate] New tables created (if not already present)")

    # 2. Work through all products and create default variants where missing
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select, text
    from app.plugins.products.models import Product, ProductVariant

    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        async with db.begin():
            products_result = await db.execute(select(Product))
            products = products_result.scalars().all()

            migrated_products = 0
            for product in products:
                existing = await db.execute(
                    select(ProductVariant).where(ProductVariant.product_id == product.id)
                )
                if existing.scalar_one_or_none():
                    continue  # already has a variant — skip
                variant = ProductVariant(
                    product_id=product.id,
                    sku=product.sku,
                    is_default=True,
                    is_active=True,
                )
                db.add(variant)
                await db.flush()

                # Update warehouse_stock rows that reference this product_id
                # Using raw SQL because we're changing column semantics
                await db.execute(
                    text("UPDATE warehouse_stock SET variant_id = :vid WHERE product_id = :pid"),
                    {"vid": variant.id, "pid": product.id},
                )
                # Update cart_items similarly
                await db.execute(
                    text("UPDATE cart_items SET variant_id = :vid WHERE product_id = :pid"),
                    {"vid": variant.id, "pid": product.id},
                )
                migrated_products += 1

        print(f"[migrate] Created default variants for {migrated_products} products")
        print("[migrate] Done. Verify with: SELECT COUNT(*) FROM product_variants;")


if __name__ == "__main__":
    asyncio.run(run())
```

Note: The raw SQL `UPDATE warehouse_stock SET variant_id = ...` only works AFTER the column has been added and the old `product_id` column still exists during migration. The migration assumes the new schema columns were added first via `create_all`. The old `product_id` columns on `warehouse_stock` and `cart_items` are kept temporarily during migration, then removed.

- [ ] **Step 8.2: Commit**

```bash
git add scripts/migrate_variants.py
git commit -m "feat(variants): add one-time migration script for production databases"
```

---

## Task 9: Admin UI — Product editor Variants tab

**Files:**
- Modify: `frontend-admin/app/(dashboard)/products/[id]/page.tsx`

The existing product editor page is a single-page form. We add a second "Variants" tab that becomes visible once the product is saved.

- [ ] **Step 9.1: Read the existing product editor page**

Read `frontend-admin/app/(dashboard)/products/[id]/page.tsx` in full before making changes.

- [ ] **Step 9.2: Add tab state and Variants tab shell**

At the top of the component, add tab state:
```tsx
const [activeTab, setActiveTab] = useState<"details" | "variants">("details")
```

Wrap the existing form fields in `{activeTab === "details" && ...}`.

Add tab buttons:
```tsx
<div className="flex gap-2 mb-6 border-b border-slate-200">
  <button onClick={() => setActiveTab("details")}
    className={`px-4 py-2 text-sm font-medium ${activeTab === "details" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
    Product Details
  </button>
  <button onClick={() => setActiveTab("variants")}
    className={`px-4 py-2 text-sm font-medium ${activeTab === "variants" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
    Variants
  </button>
</div>
```

- [ ] **Step 9.3: Add Variants tab content**

The Variants tab has three sections:

**Section A — Option types list with add/delete**
Fetch `GET /api/products/{id}/options` and display each option type as a card showing its name and its values as chips. Include a delete button per option type, and an inline "Add value" input.

**Section B — "Add option type" form**
A small inline form: text input for option name + "Add" button that calls `POST /api/products/{id}/options`.

**Section C — Generated variants table**
A "Generate combinations" button calls `POST /api/products/{id}/variants/generate` and refreshes the table. The table shows columns: Options (the label), SKU (inline editable), Active (toggle). Inline SKU edit calls `PATCH /api/products/{id}/variants/{variant_id}`.

Use `api.get`, `api.post`, `api.del`, `api.patch` from `lib/api.ts`. Use React Query or `useSWR` if already used in the product editor — otherwise simple `useState` + `useEffect` + fetch calls.

The variants data fetch:
```tsx
const { data: options, mutate: refreshOptions } = useSWR(
  id ? `/api/products/${id}/options` : null,
  api.get
)
const { data: variants, mutate: refreshVariants } = useSWR(
  id ? `/api/products/${id}/variants` : null,
  api.get
)
```

Check what data-fetching library is used in the existing product editor page and follow the same pattern.

- [ ] **Step 9.4: Verify UI works manually**

Start the admin dev server and test:
1. Open a product → Variants tab shows "No options defined"
2. Add "Size" option type → appears in list
3. Add values "S", "M", "L" → appear as chips
4. Click "Generate combinations" → 3 variants appear in table
5. Edit a variant SKU inline → saved via PATCH
6. Add second option "Colour" with "Red", "Blue" → generate → 6 variants
7. Delete an option type → affected variants become inactive

- [ ] **Step 9.5: Commit**

```bash
git add "frontend-admin/app/(dashboard)/products/"
git commit -m "feat(variants): add Variants tab to product editor"
```

---

## Task 10: Admin UI — Inventory stock management update

**Files:**
- Modify: `frontend-admin/app/(dashboard)/inventory/page.tsx`

The inventory page currently has a "Set stock" form that takes a `product_id`. It needs to take a `variant_id` instead. The form should show a grouped view: product name → variant combinations.

- [ ] **Step 10.1: Read the existing inventory page**

Read `frontend-admin/app/(dashboard)/inventory/page.tsx` in full.

- [ ] **Step 10.2: Update stock set form**

The stock form currently has a product picker (dropdown of products). Change it to a variant picker that:
1. Loads all products: `GET /api/products`
2. For the selected product, loads its variants: `GET /api/products/{id}/variants`
3. Shows a second dropdown of variants formatted as "label (SKU)" — e.g., "Size: M, Colour: Red (TS-M-RED)" or just "Default (SKU)" for simple products
4. Submits `POST /api/inventory/warehouses/{id}/stock` with `variant_id` instead of `product_id`

The `StockSetRequest` schema on the backend now expects `variant_id`, so update the request body accordingly.

- [ ] **Step 10.3: Update stock display**

The existing stock item display shows `product_id`. Update it to show the variant's label and SKU. You may need to fetch `GET /api/products/{product_id}/variants` for each product to build a lookup map, or add a `variant_label` field to `WarehouseStockOut` on the backend (the schema update in Task 6 added this field).

To populate `variant_label` in `WarehouseStockOut`, update `inventory/service.py`'s stock loading to also join/load the variant's option links. This may require a secondary query in `_build_cart_out`-style fashion.

- [ ] **Step 10.4: Commit**

```bash
git add "frontend-admin/app/(dashboard)/inventory/page.tsx"
git commit -m "feat(variants): update inventory stock UI to use variant_id"
```

---

## Task 11: Storefront — variant picker and updated cart

**Files:**
- Modify: `frontend-starter/lib/types.ts`
- Modify: `frontend-starter/store/cart.ts`
- Modify: `frontend-starter/app/products/[slug]/page.tsx`
- Modify: `frontend-starter/app/products/[slug]/add-to-cart-button.tsx`

- [ ] **Step 11.1: Add types to lib/types.ts**

Add these interfaces to `frontend-starter/lib/types.ts`:

```typescript
export interface ProductOptionValue {
  option_type_name: string
  option_value_label: string
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  is_default: boolean
  is_active: boolean
  option_values: ProductOptionValue[]
  label: string  // "Size: M, Colour: Red"
}

export interface ProductOptionType {
  id: string
  name: string
  sort_order: number
  values: Array<{ id: string; label: string; sort_order: number }>
}
```

Also update the existing `Product` type to include:
```typescript
option_types?: ProductOptionType[]
variants?: ProductVariant[]
```

Update `CartItem` type to include:
```typescript
variant_id: string
variant_label?: string
```
And change `product_id` to still be present (it's still returned alongside variant_id).

- [ ] **Step 11.2: Update cart store**

In `frontend-starter/store/cart.ts`, update `addItem`:
```typescript
addItem: async (variant_id: string, quantity = 1) => {
  try {
    await api.post("/api/cart/items", { variant_id, quantity })
    await get().fetch()
    return true
  } catch {
    return false
  }
},
```

The signature changes from `(product_id: string, ...)` to `(variant_id: string, ...)`. All callers of `addItem` must be updated to pass `variant_id` instead of `product_id`.

`updateItem` and `removeItem` pass the CartItem `id` in the URL path — these are unchanged (the path param was always the cart item id, not product id). Check the router: it was using `product_id` as the path param. After Task 5's router update, it uses `variant_id`. The store must now pass `variant_id` instead of the cart item's `id` for `updateItem` and `removeItem`. Read the updated cart router to confirm the path param name.

Actually, looking at the current cart router: `PUT /api/cart/items/{product_id}` and `DELETE /api/cart/items/{product_id}`. The cart STORE calls `updateItem(item_id, quantity)` where `item_id` comes from `CartItemOut.id` (not the product_id). This is a bug in the existing store — it should be passing `product_id` but calls it `item_id`. After our change, the router expects `variant_id` in the path. So the store must pass `variant_id`:

```typescript
updateItem: async (variant_id: string, quantity: number) => {
  try {
    await api.put(`/api/cart/items/${variant_id}`, { quantity })
    await get().fetch()
    return true
  } catch {
    return false
  }
},
removeItem: async (variant_id: string) => {
  try {
    await api.del(`/api/cart/items/${variant_id}`)
    await get().fetch()
    return true
  } catch {
    return false
  }
},
```

Check all call sites of `updateItem` and `removeItem` in the cart page and update them to pass `item.variant_id`.

- [ ] **Step 11.3: Update product detail page**

In `frontend-starter/app/products/[slug]/page.tsx`:

1. After fetching the product, check if it has option types: `product.option_types?.length > 0`
2. If it has options, render the variant picker section between the description and the "Add to Cart" button:

```tsx
{product.option_types && product.option_types.length > 0 && (
  <VariantPicker
    optionTypes={product.option_types}
    variants={product.variants ?? []}
    onSelect={(variantId) => setSelectedVariantId(variantId)}
  />
)}
```

Since `page.tsx` is a server component, the variant picker must be a client component. Create a new file:
`frontend-starter/app/products/[slug]/variant-picker.tsx`

The picker renders one `<select>` per option type. When a selection changes:
1. Find the variant that matches all selected values
2. Call `onSelect(variant.id)` — or `onSelect(null)` if no complete combination is selected
3. If the matched variant is inactive or has no stock, show "Out of stock"

For stock, the variant doesn't currently carry its own stock count in the API response. Two options:
a. Add `stock_quantity` to `ProductVariantOut` in the backend (requires querying WarehouseStock per variant)
b. Show "check availability" and let the cart call return a 409 if out of stock

Recommendation: go with option (b) for v1 — it's simpler and the spec says basic v1 only. Show "Out of stock" only when the cart `addItem` fails.

- [ ] **Step 11.4: Update add-to-cart-button.tsx**

Change the component signature to accept an optional `selectedVariantId`:

```tsx
export function AddToCartButton({
  productId,
  defaultVariantId,
  selectedVariantId,
  inStock,
}: {
  productId: string
  defaultVariantId: string   // the default variant id (for simple products)
  selectedVariantId?: string  // selected via variant picker
  inStock: boolean
})
```

In `handleAdd`, use `selectedVariantId ?? defaultVariantId` as the variant_id passed to `addItem`.

The product page must pass `defaultVariantId` — get it from `product.variants?.find(v => v.is_default)?.id`.

- [ ] **Step 11.5: Update cart page**

In `frontend-starter/app/cart/page.tsx`, update any references to `item.product_id` in `updateItem` / `removeItem` calls to use `item.variant_id`.

Display `item.variant_label` under the product name in the cart line item if it's non-empty.

- [ ] **Step 11.6: Build check**

```bash
cd D:/Projects/20260609_Commerceforce/frontend-starter
npm run build 2>&1 | tail -20
```

Expected: zero TypeScript errors. Fix any type errors before proceeding.

- [ ] **Step 11.7: Manual smoke test**

Start backend and storefront dev server. Test:
1. Open a simple product (no options) → add to cart works as before
2. Open a product with Size + Colour variants → dropdowns appear
3. Select Size M, Colour Red → variant resolved
4. Click "Add to cart" → correct variant added; cart shows "Size: M, Colour: Red"

- [ ] **Step 11.8: Commit**

```bash
git add frontend-starter/
git commit -m "feat(variants): storefront variant picker and updated cart store"
```

---

## Task 12: Final integration test

- [ ] **Step 12.1: Run complete test suite**

```bash
cd D:/Projects/20260609_Commerceforce
rm -f test_commerceforce.db test_commerceforce.db-journal
python -m pytest backend/tests/ -q --tb=short 2>&1 | tail -20
```

Expected: 3 failures (pre-existing AI chat tests only). All other tests including new variant tests pass.

- [ ] **Step 12.2: Update backlog**

In `docs/backlog.md`, move product variants (O) from "Not built — Priority 4" to "Built, not tested" and add a "What to test" entry:

```
| Product variants | Create product with Size + Colour options, generate combos, add variant to cart, checkout, verify stock decrements on correct variant only |
```

- [ ] **Step 12.3: Final commit**

```bash
git add docs/backlog.md
git commit -m "feat(variants): update backlog — variants built, pending manual test"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Flexible option axes — `ProductOptionType` with any `name` field
- ✅ Shared pricing — variant has no price field; inherits product price
- ✅ Warehouse stock per variant — `WarehouseStock.variant_id` replaces `product_id`
- ✅ Default variant for all products — created in `create_product` + migration script
- ✅ Generate combinations — `generate_variants()` uses `itertools.product`
- ✅ Admin variants tab — Task 9
- ✅ Inventory UI update — Task 10
- ✅ Basic storefront dropdown — Task 11
- ✅ Migration script — Task 8
- ✅ Historical orders unaffected — `variant_id` nullable on `OrderItem`
- ✅ Default variant invisible to shopper — product page only shows pickers if `option_types.length > 0`

**Known edge cases handled:**
- SKU collision during generation: counter suffix appended
- Delete option type: deactivates (not deletes) affected variants
- Inactive variant in cart at checkout: 409 response

**Out of scope (per spec):**
- Per-variant pricing
- Variant images
- Polished swatch UI
- Bulk CSV import
