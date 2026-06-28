# Per-Variant Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `price_adjustment` (±decimal) to each product variant so that cart, checkout, and the storefront price display all reflect the adjusted price.

**Architecture:** Add `price_adjustment: Optional[Decimal]` to the `ProductVariant` model with a nullable DB column (null = no adjustment). Cart and checkout services compute `effective_price = product.effective_price + (variant.price_adjustment or 0)`. On the storefront, a new client component wraps the price display and `AddToCartButton`, managing `selectedVariantId` state so the price can react live to the user's selection.

**Tech Stack:** FastAPI + SQLAlchemy async (backend), Alembic (migrations), pytest-asyncio (tests), Next.js 16 App Router + TypeScript + Tailwind v4 (storefront + admin).

---

## File map

| File | Change |
|------|--------|
| `backend/app/plugins/products/models.py` | Add `price_adjustment` column to `ProductVariant` |
| `backend/alembic/versions/<new>.py` | Migration: `ALTER TABLE product_variants ADD COLUMN price_adjustment` |
| `backend/app/plugins/products/schemas.py` | Add `price_adjustment` to `ProductVariantOut` and `VariantUpdate` |
| `backend/app/plugins/cart/service.py` | Use adjusted price at line 81 |
| `backend/app/plugins/checkout/service.py` | Use adjusted price at line 76 |
| `backend/tests/test_variants.py` | Add 4 new test cases for price adjustment |
| `frontend-admin/app/(dashboard)/products/[id]/page.tsx` | Add `price_adjustment` to local type + 4th table column |
| `frontend-starter/lib/types.ts` | Add `price_adjustment?: string` to `ProductVariant` |
| `frontend-starter/app/products/[slug]/product-detail-client.tsx` | NEW — client wrapper managing selectedVariantId + live price |
| `frontend-starter/app/products/[slug]/add-to-cart-button.tsx` | Make controlled: accept `selectedVariantId` + `onVariantSelect` as props |
| `frontend-starter/app/products/[slug]/page.tsx` | Use `ProductDetailClient` instead of static price + `AddToCartButton` |

---

## Task 1: Backend model + migration

**Files:**
- Modify: `backend/app/plugins/products/models.py`
- Create: `backend/alembic/versions/<new_revision>_add_variant_price_adjustment.py`

- [ ] **Step 1: Add `price_adjustment` to `ProductVariant` model**

In `backend/app/plugins/products/models.py`, find the `ProductVariant` class (line 83). Add one field after `is_active`:

```python
class ProductVariant(BaseModel):
    __tablename__ = "product_variants"

    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    price_adjustment: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    option_links: Mapped[list["ProductVariantOption"]] = relationship(
        "ProductVariantOption", back_populates="variant",
        cascade="all, delete-orphan", lazy="selectin"
    )
```

`Decimal` and `Optional` are already imported at the top of the file. `Numeric` is already imported from sqlalchemy.

- [ ] **Step 2: Find the current Alembic HEAD**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe -m alembic heads
```

Note the revision hash printed (e.g. `a1b2c3d4e5f6`). Use it as `down_revision` in the next step. If multiple heads are listed, use all of them as a tuple: `down_revision = ('hash1', 'hash2')`.

- [ ] **Step 3: Create the migration file**

Create `backend/alembic/versions/<timestamp>_add_variant_price_adjustment.py`. Replace `<current_head>` with the hash from Step 2 and `<new_revision>` with a new unique 12-char hex string (e.g. `g4h5i6j7k8l9`):

```python
"""add price_adjustment to product_variants

Revision ID: g4h5i6j7k8l9
Revises: <current_head>
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'g4h5i6j7k8l9'
down_revision = '<current_head>'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.add_column(
            sa.Column('price_adjustment', sa.Numeric(12, 2), nullable=True)
        )


def downgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.drop_column('price_adjustment')
```

- [ ] **Step 4: Run the migration**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe -m alembic upgrade head
```

Expected: `Running upgrade <old> -> g4h5i6j7k8l9, add price_adjustment to product_variants`

- [ ] **Step 5: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add backend/app/plugins/products/models.py backend/alembic/versions/
git commit -m "feat: add price_adjustment column to product_variants"
```

---

## Task 2: Update schemas and variant PATCH

**Files:**
- Modify: `backend/app/plugins/products/schemas.py`

- [ ] **Step 1: Add `price_adjustment` to `ProductVariantOut`**

Find `ProductVariantOut` (around line 170). Add `price_adjustment` field:

```python
class ProductVariantOut(BaseModel):
    id: str
    product_id: str
    sku: str
    is_default: bool
    is_active: bool
    option_values: list[VariantOptionLink] = []
    label: str = ""
    price_adjustment: Optional[Decimal] = None
    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Add `price_adjustment` to `VariantUpdate`**

Find `VariantUpdate` (around line 181). Add the field:

```python
class VariantUpdate(BaseModel):
    sku: Optional[str] = None
    is_active: Optional[bool] = None
    price_adjustment: Optional[Decimal] = None
```

Note: `variant_service.update_variant()` already uses `data.model_dump(exclude_unset=True)` + `setattr(variant, k, v)`, so no changes to `variant_service.py` are needed — the new field is handled automatically.

- [ ] **Step 3: Run existing tests to confirm nothing breaks**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe -m pytest tests/test_variants.py -q
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add backend/app/plugins/products/schemas.py
git commit -m "feat: expose price_adjustment in variant schema; accept in PATCH"
```

---

## Task 3: Cart + checkout services with adjusted pricing (TDD)

**Files:**
- Modify: `backend/tests/test_variants.py`
- Modify: `backend/app/plugins/cart/service.py`
- Modify: `backend/app/plugins/checkout/service.py`

- [ ] **Step 1: Write failing tests**

Add these four tests to the END of `backend/tests/test_variants.py`:

```python
# ── price adjustment ──────────────────────────────────────────────────────────

async def _setup_product_with_adjusted_variant(
    client: AsyncClient, token: str
) -> tuple[dict, dict]:
    """Create a £20 product with a Size option, generate variants, set XL +£5. Returns (product, xl_variant)."""
    r = await client.post(
        "/api/products",
        json={"name": "Priced Shirt", "price": "20.00", "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    product = r.json()

    # Add Size option with S and XL values
    r = await client.post(
        f"/api/products/{product['id']}/options",
        json={"name": "Size", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    opt = r.json()

    for label in ("S", "XL"):
        r = await client.post(
            f"/api/products/{product['id']}/options/{opt['id']}/values",
            json={"label": label, "sort_order": 0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201

    # Generate variants
    r = await client.post(
        f"/api/products/{product['id']}/variants/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    # Fetch variants and find XL
    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    variants = r.json()
    xl = next(v for v in variants if "XL" in v["label"])

    # Set XL price_adjustment = 5.00
    r = await client.patch(
        f"/api/products/{product['id']}/variants/{xl['id']}",
        json={"price_adjustment": "5.00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["price_adjustment"] == "5.00"

    return product, xl


@pytest.mark.asyncio
async def test_variant_patch_price_adjustment(client: AsyncClient, db: AsyncSession):
    """PATCH variant sets and clears price_adjustment."""
    token = await _admin_token(client, db)
    product = await _make_product(client, token)

    # Get default variant
    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    variants = r.json()
    assert len(variants) >= 1
    variant_id = variants[0]["id"]

    # Set adjustment
    r = await client.patch(
        f"/api/products/{product['id']}/variants/{variant_id}",
        json={"price_adjustment": "3.50"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["price_adjustment"] == "3.50"

    # Clear adjustment
    r = await client.patch(
        f"/api/products/{product['id']}/variants/{variant_id}",
        json={"price_adjustment": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["price_adjustment"] is None


@pytest.mark.asyncio
async def test_cart_unit_price_uses_variant_adjustment(client: AsyncClient, db: AsyncSession):
    """Cart unit_price = product.effective_price + variant.price_adjustment."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    # Add XL to cart as guest
    r = await client.post(
        "/api/cart/items",
        json={"variant_id": xl["id"], "quantity": 1},
        headers={"X-Session-Id": "test-session-adj"},
    )
    assert r.status_code == 200
    cart = r.json()
    item = next(i for i in cart["items"] if i["variant_id"] == xl["id"])
    assert float(item["unit_price"]) == 25.00  # £20 + £5


@pytest.mark.asyncio
async def test_cart_unit_price_null_adjustment_uses_base(client: AsyncClient, db: AsyncSession):
    """Cart unit_price = product.effective_price when price_adjustment is null."""
    token = await _admin_token(client, db)

    r = await client.post(
        "/api/products",
        json={"name": "Plain Shirt", "price": "20.00", "stock_quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    product = r.json()
    r = await client.get(
        f"/api/products/{product['id']}/variants",
        headers={"Authorization": f"Bearer {token}"},
    )
    default_variant = r.json()[0]

    r = await client.post(
        "/api/cart/items",
        json={"variant_id": default_variant["id"], "quantity": 1},
        headers={"X-Session-Id": "test-session-null-adj"},
    )
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert float(item["unit_price"]) == 20.00


@pytest.mark.asyncio
async def test_checkout_order_item_uses_variant_adjustment(client: AsyncClient, db: AsyncSession):
    """Checkout order item unit_price = product.effective_price + variant.price_adjustment."""
    token = await _admin_token(client, db)
    product, xl = await _setup_product_with_adjusted_variant(client, token)

    # Register a customer
    r = await client.post(
        "/api/auth/register",
        json={"email": "buyer@test.com", "password": "Buyer1234!", "first_name": "B", "last_name": "U"},
    )
    r = await client.post("/api/auth/login", json={"email": "buyer@test.com", "password": "Buyer1234!"})
    customer_token = r.json()["access_token"]

    # Add XL to cart
    await client.post(
        "/api/cart/items",
        json={"variant_id": xl["id"], "quantity": 2},
        headers={"Authorization": f"Bearer {customer_token}"},
    )

    # Checkout
    r = await client.post(
        "/api/checkout",
        json={
            "use_cart": True,
            "payment_method": "cash",
            "shipping_address": "1 Test St",
        },
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert r.status_code == 200
    order_id = r.json()["order_id"]

    # Fetch order and verify unit_price
    r = await client.get(f"/api/orders/{order_id}", headers={"Authorization": f"Bearer {customer_token}"})
    order = r.json()
    item = order["items"][0]
    assert float(item["unit_price"]) == 25.00  # £20 + £5
    assert float(item["subtotal"]) == 50.00    # 2 × £25
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe -m pytest tests/test_variants.py::test_variant_patch_price_adjustment tests/test_variants.py::test_cart_unit_price_uses_variant_adjustment tests/test_variants.py::test_cart_unit_price_null_adjustment_uses_base tests/test_variants.py::test_checkout_order_item_uses_variant_adjustment -v
```

Expected: 3 PASS (schema tests pass immediately), 2 FAIL on price assertions (cart and checkout still return £20.00 not £25.00). `test_variant_patch_price_adjustment` may already pass after Task 2.

- [ ] **Step 3: Update cart service**

In `backend/app/plugins/cart/service.py`, find line 81:
```python
        unit_price = product.effective_price
```

Replace with:
```python
        unit_price = product.effective_price + (variant.price_adjustment or Decimal("0"))
```

`variant` is already loaded earlier in `_build_cart_out` (line 64: `variant = await _load_variant_with_options(item.variant_id, db)`). The `Decimal` import is already at the top of the file.

- [ ] **Step 4: Update checkout service**

In `backend/app/plugins/checkout/service.py`, find `_items_from_cart()` function (around line 45). Find line 76:
```python
            "unit_price": product.effective_price,
```

Replace with:
```python
            "unit_price": product.effective_price + (variant.price_adjustment or Decimal("0")),
```

`variant` is already loaded at line 51 of `_items_from_cart`. `Decimal` is already imported at the top of the file.

- [ ] **Step 5: Run all four new tests — confirm they PASS**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe -m pytest tests/test_variants.py::test_variant_patch_price_adjustment tests/test_variants.py::test_cart_unit_price_uses_variant_adjustment tests/test_variants.py::test_cart_unit_price_null_adjustment_uses_base tests/test_variants.py::test_checkout_order_item_uses_variant_adjustment -v
```

Expected: 4 PASS.

- [ ] **Step 6: Run full test suite to confirm no regressions**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe -m pytest -q
```

Expected: all tests pass (same count as before + 4 new).

- [ ] **Step 7: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add backend/tests/test_variants.py backend/app/plugins/cart/service.py backend/app/plugins/checkout/service.py
git commit -m "feat: apply variant price_adjustment in cart and checkout"
```

---

## Task 4: Admin UI — price adjustment column

**Files:**
- Modify: `frontend-admin/app/(dashboard)/products/[id]/page.tsx`

- [ ] **Step 1: Add `price_adjustment` to the local `ProductVariant` interface**

Find the `ProductVariant` interface near the top of the file (around line 25):

```typescript
interface ProductVariant {
  id: string
  label: string
  sku: string | null
  is_active: boolean
}
```

Replace with:

```typescript
interface ProductVariant {
  id: string
  label: string
  sku: string | null
  is_active: boolean
  price_adjustment: string | null
}
```

- [ ] **Step 2: Add `variantAdjustments` state**

Find the line (around line 155):
```typescript
  const [variantSkus, setVariantSkus] = useState<Record<string, string>>({})
```

Add immediately after it:
```typescript
  const [variantAdjustments, setVariantAdjustments] = useState<Record<string, string>>({})
```

- [ ] **Step 3: Seed `variantAdjustments` in `loadVariantData`**

Find `loadVariantData` (around line 157). Inside the `try` block, after the block that seeds `variantSkus`:

```typescript
      // Seed SKU editing state from fetched variants
      const skuMap: Record<string, string> = {}
      for (const v of vars) {
        skuMap[v.id] = v.sku ?? ""
      }
      setVariantSkus(skuMap)
```

Add immediately after `setVariantSkus(skuMap)`:

```typescript
      const adjMap: Record<string, string> = {}
      for (const v of vars) {
        adjMap[v.id] = v.price_adjustment ?? ""
      }
      setVariantAdjustments(adjMap)
```

- [ ] **Step 4: Add `handleVariantAdjustmentBlur` handler**

Find `handleVariantSkuBlur` (around line 250). Add the following function immediately after it (before `handleVariantActiveChange`):

```typescript
  async function handleVariantAdjustmentBlur(variantId: string) {
    const raw = variantAdjustments[variantId] ?? ""
    const current = variants.find((v) => v.id === variantId)
    if (!current) return
    if (raw === (current.price_adjustment ?? "")) return
    const price_adjustment = raw === "" ? null : parseFloat(raw)
    if (raw !== "" && (isNaN(price_adjustment!) || price_adjustment! < 0 && raw[0] !== "-")) return
    setVariantsError("")
    try {
      await api.patch(`/api/products/${id}/variants/${variantId}`, { price_adjustment })
      setVariants((prev) =>
        prev.map((v) =>
          v.id === variantId ? { ...v, price_adjustment: raw || null } : v
        )
      )
    } catch (err) {
      setVariantsError(err instanceof Error ? err.message : "Failed to update variant")
    }
  }
```

- [ ] **Step 5: Add the table header column**

Find the variants table header (around line 588):
```tsx
                          <th className="text-left py-2 pr-4 font-medium text-slate-600">Variant</th>
                          <th className="text-left py-2 pr-4 font-medium text-slate-600">SKU</th>
                          <th className="text-left py-2 font-medium text-slate-600">Active</th>
```

Replace with:
```tsx
                          <th className="text-left py-2 pr-4 font-medium text-slate-600">Variant</th>
                          <th className="text-left py-2 pr-4 font-medium text-slate-600">SKU</th>
                          <th className="text-left py-2 pr-4 font-medium text-slate-600">Price adj. (£)</th>
                          <th className="text-left py-2 font-medium text-slate-600">Active</th>
```

- [ ] **Step 6: Add the table body cell**

Find the variants table body row (around line 596). After the SKU cell (`</td>` that closes the SKU input), add a new cell before the Active cell:

Current structure (find the closing `</td>` for the SKU input and then the Active `<td>`):
```tsx
                            <td className="py-2 pr-4">
                              <input
                                value={variantSkus[variant.id] ?? ""}
                                onChange={(e) =>
                                  setVariantSkus((prev) => ({ ...prev, [variant.id]: e.target.value }))
                                }
                                onBlur={() => handleVariantSkuBlur(variant.id)}
                                placeholder="SKU"
                                className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="checkbox"
```

Insert a new `<td>` between the SKU cell and the Active cell:
```tsx
                            <td className="py-2 pr-4">
                              <input
                                value={variantSkus[variant.id] ?? ""}
                                onChange={(e) =>
                                  setVariantSkus((prev) => ({ ...prev, [variant.id]: e.target.value }))
                                }
                                onBlur={() => handleVariantSkuBlur(variant.id)}
                                placeholder="SKU"
                                className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                step="0.01"
                                value={variantAdjustments[variant.id] ?? ""}
                                onChange={(e) =>
                                  setVariantAdjustments((prev) => ({ ...prev, [variant.id]: e.target.value }))
                                }
                                onBlur={() => handleVariantAdjustmentBlur(variant.id)}
                                placeholder="0.00"
                                className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="checkbox"
```

- [ ] **Step 7: Build check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-admin
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 8: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add "frontend-admin/app/(dashboard)/products/[id]/page.tsx"
git commit -m "feat: add price_adjustment column to admin variants table"
```

---

## Task 5: Storefront — types, client component, page refactor

**Files:**
- Modify: `frontend-starter/lib/types.ts`
- Create: `frontend-starter/app/products/[slug]/product-detail-client.tsx`
- Modify: `frontend-starter/app/products/[slug]/add-to-cart-button.tsx`
- Modify: `frontend-starter/app/products/[slug]/page.tsx`

- [ ] **Step 1: Add `price_adjustment` to `ProductVariant` in `types.ts`**

Find `ProductVariant` interface in `frontend-starter/lib/types.ts` (around line 69):

```typescript
export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  is_default: boolean
  is_active: boolean
  option_values: VariantOptionValue[]
  label: string
}
```

Replace with:

```typescript
export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  is_default: boolean
  is_active: boolean
  option_values: VariantOptionValue[]
  label: string
  price_adjustment?: string | null
}
```

- [ ] **Step 2: Make `AddToCartButton` controlled for variant selection**

Replace `frontend-starter/app/products/[slug]/add-to-cart-button.tsx` entirely with:

```tsx
"use client"
import { useState } from "react"
import { ShoppingCart, Check, X } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { VariantPicker } from "./variant-picker"

interface OptionValue {
  id: string
  label: string
  sort_order: number
}

interface OptionType {
  id: string
  name: string
  sort_order: number
  values: OptionValue[]
}

interface Variant {
  id: string
  is_default: boolean
  is_active: boolean
  option_values: Array<{ option_type_name: string; option_value_label: string }>
  label: string
  price_adjustment?: string | null
}

interface AddToCartButtonProps {
  productId: string
  inStock: boolean
  defaultVariantId: string
  optionTypes?: OptionType[]
  variants?: Variant[]
  selectedVariantId: string | null
  onVariantSelect: (id: string | null) => void
}

export function AddToCartButton({
  productId: _productId,
  inStock,
  defaultVariantId,
  optionTypes = [],
  variants = [],
  selectedVariantId,
  onVariantSelect,
}: AddToCartButtonProps) {
  const addItem = useCartStore((s) => s.addItem)
  const [qty, setQty] = useState(1)
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle")

  const hasOptions = optionTypes.length > 0
  const isVariantRequired = hasOptions && !selectedVariantId
  const selectedVariantInactive =
    !!selectedVariantId &&
    variants.find(v => v.id === selectedVariantId)?.is_active === false

  async function handleAdd() {
    const variantId = selectedVariantId ?? defaultVariantId
    const ok = await addItem(variantId, qty)
    setStatus(ok ? "added" : "error")
    setTimeout(() => setStatus("idle"), 2500)
  }

  if (!inStock) {
    return (
      <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 font-semibold cursor-not-allowed">
        Out of stock
      </button>
    )
  }

  return (
    <div>
      {hasOptions && (
        <VariantPicker
          optionTypes={optionTypes}
          variants={variants}
          onSelect={onVariantSelect}
        />
      )}
      <div className="flex gap-3">
        <div className="flex items-center border border-slate-200 rounded-xl">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-l-xl">−</button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-r-xl">+</button>
        </div>
        <button
          onClick={handleAdd}
          disabled={status !== "idle" || isVariantRequired || selectedVariantInactive}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${
            status === "added" ? "bg-green-600 text-white"
            : status === "error" ? "bg-red-500 text-white"
            : (isVariantRequired || selectedVariantInactive) ? "bg-slate-100 text-slate-400"
            : "bg-brand hover:bg-brand-hover text-white"
          }`}
        >
          {status === "added" ? <><Check size={18} /> Added!</>
           : status === "error" ? <><X size={18} /> Failed — try again</>
           : selectedVariantInactive ? <>Out of stock</>
           : isVariantRequired ? <>Select options above</>
           : <><ShoppingCart size={18} /> Add to cart</>}
        </button>
      </div>
    </div>
  )
}
```

The only changes from the previous version: removed `useState` for `selectedVariantId`, added `selectedVariantId` and `onVariantSelect` as required props, changed `onSelect={setSelectedVariantId}` to `onSelect={onVariantSelect}`.

- [ ] **Step 3: Create `product-detail-client.tsx`**

Create `frontend-starter/app/products/[slug]/product-detail-client.tsx`:

```tsx
"use client"
import { useState } from "react"
import { AddToCartButton } from "./add-to-cart-button"
import type { Product, ReviewSummary } from "@/lib/types"

interface Props {
  product: Product
  inStock: boolean
  defaultVariantId: string
  summary: ReviewSummary | null
}

export function ProductDetailClient({ product, inStock, defaultVariantId, summary }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const variants = product.variants ?? []
  const basePrice = parseFloat(product.price)
  const salePrice = product.sale_price ? parseFloat(product.sale_price) : null
  const effectiveBasePrice = salePrice ?? basePrice

  const selectedVariant = variants.find(v => v.id === selectedVariantId)
  const adjustment = selectedVariant?.price_adjustment ? parseFloat(selectedVariant.price_adjustment) : 0
  const displayPrice = effectiveBasePrice + adjustment

  return (
    <>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-2xl font-bold text-slate-900">&#163;{displayPrice.toFixed(2)}</span>
        {salePrice && <span className="text-lg text-slate-400 line-through">&#163;{basePrice.toFixed(2)}</span>}
      </div>

      {summary && summary.total_reviews > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <StarRow rating={summary.average_rating} />
          <span className="text-sm text-slate-500">
            {summary.average_rating.toFixed(1)} ({summary.total_reviews}{" "}
            {summary.total_reviews === 1 ? "review" : "reviews"})
          </span>
        </div>
      )}

      {inStock ? (
        <p className="text-sm text-green-600 font-medium mb-4">
          In stock ({product.stock_quantity} available)
        </p>
      ) : (
        <p className="text-sm text-red-500 font-medium mb-4">Out of stock</p>
      )}

      {product.description && (
        <div className="prose prose-sm prose-slate mb-6">
          <p>{product.description}</p>
        </div>
      )}

      <AddToCartButton
        productId={product.id}
        inStock={inStock}
        defaultVariantId={defaultVariantId}
        optionTypes={product.option_types ?? []}
        variants={variants}
        selectedVariantId={selectedVariantId}
        onVariantSelect={setSelectedVariantId}
      />
    </>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`w-4 h-4 ${n <= Math.round(rating) ? "text-amber-400" : "text-slate-200"} fill-current`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Refactor `page.tsx` to use `ProductDetailClient`**

Replace `frontend-starter/app/products/[slug]/page.tsx` entirely with:

```tsx
import { serverFetch } from "@/lib/api"
import type { Product, Review, ReviewSummary } from "@/lib/types"
import { notFound } from "next/navigation"
import Link from "next/link"
import { WishlistButton } from "@/components/shop/wishlist-button"
import { ProductReviews } from "./reviews"
import { ProductDetailClient } from "./product-detail-client"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) return {}
  const base = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? ""
  const images = product.images?.length > 0
    ? [{ url: product.images[0].url, alt: product.images[0].alt_text ?? product.name }]
    : []
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      url: `${base}/products/${slug}`,
      type: "website",
      images,
    },
    twitter: { card: images.length > 0 ? "summary_large_image" : "summary", title: product.name, description: product.description, images: images.map(i => i.url) },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await serverFetch<Product>(`/api/products/by-slug/${slug}`)
  if (!product) notFound()

  const [reviews, summary] = await Promise.all([
    serverFetch<Review[]>(`/api/reviews?product_id=${product.id}`).catch(() => [] as Review[]),
    serverFetch<ReviewSummary>(`/api/reviews/summary?product_id=${product.id}`).catch(() => null),
  ])

  const defaultVariantId = product.variants?.find(v => v.is_default)?.id ?? ""
  const inStock = product.stock_quantity > 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/products" className="inline-flex items-center gap-1.5 text-[13px] text-[#5C5C5C] hover:text-brand-dark mb-6 transition-colors">
        Back to products
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          {product.images && product.images.length > 0 ? (
            <div className="space-y-3">
              <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden">
                <img src={product.images[0].url} alt={product.images[0].alt_text ?? product.name}
                  className="w-full h-full object-cover" />
              </div>
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.slice(1, 5).map((img) => (
                    <div key={img.id} className="aspect-square bg-slate-50 rounded-xl overflow-hidden">
                      <img src={img.url} alt={img.alt_text ?? ""} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 text-6xl">
              &#128230;
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
            <WishlistButton productId={product.id} size={20} className="mt-1" />
          </div>

          <ProductDetailClient
            product={product}
            inStock={inStock}
            defaultVariantId={defaultVariantId}
            summary={summary}
          />
        </div>
      </div>

      <ProductReviews productId={product.id} initialReviews={reviews ?? []} summary={summary} />
    </div>
  )
}
```

- [ ] **Step 5: Build check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npm run build
```

Expected: zero TypeScript errors, all pages generated.

- [ ] **Step 6: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add frontend-starter/lib/types.ts `
        "frontend-starter/app/products/[slug]/add-to-cart-button.tsx" `
        "frontend-starter/app/products/[slug]/product-detail-client.tsx" `
        "frontend-starter/app/products/[slug]/page.tsx"
git commit -m "feat: live price update on storefront when variant with price adjustment selected"
```

---

## Self-review checklist

- [x] **Spec coverage:** Data model (Task 1), cart+checkout (Task 3), admin UI (Task 4), storefront live price (Task 5), storefront types (Task 5 Step 1). All spec sections covered.
- [x] **No placeholders:** All code is complete. Migration down_revision requires a runtime lookup (Step 2) — instruction is concrete, not vague.
- [x] **Type consistency:** `price_adjustment` is `Optional[Decimal]` in Python, `string | null` in TypeScript (Pydantic serialises Decimal as string). `parseFloat` used in storefront. Consistent throughout.
- [x] **Interface consistency:** `AddToCartButton` now requires `selectedVariantId` and `onVariantSelect` — `ProductDetailClient` provides both. `page.tsx` no longer uses `AddToCartButton` directly. No stale callers.
