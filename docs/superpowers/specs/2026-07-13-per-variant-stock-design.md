# Per-Variant Stock — Design Spec

**Date:** 2026-07-13
**Status:** Approved

---

## Goal

Give each product variant its own stock level, enforced at cart and checkout, while keeping `Product.stock_quantity` accurate and never allowed to drift from the sum of its variants' stock.

---

## Background — how this was discovered

The user asked "how do I add stock for each variant?" The first answer given (point at the Inventory page's per-warehouse stock) was wrong, and the user's follow-up questions exposed why. Investigation of the live database and code turned up three separate problems:

**1. There is no working per-variant stock feature today.** `ProductVariant` (`backend/app/plugins/products/models.py:85-99`) has `sku`, `is_default`, `is_active`, `price_adjustment` — no stock column. `WarehouseStock` exists and the Inventory page writes to it, but nothing in cart or checkout ever reads it: every stock check and deduction goes through `Product.stock_quantity` (`cart/service.py:185`, `checkout/service.py:66,124`, `products/service.py:244 deduct_stock`). `inventory/service.py:129 deduct_stock_for_variant` exists but is dead code, never called. The number the Inventory page writes has never gated a single purchase.

**2. The user's products had zero real variants.** Live DB at the time:

| Product | Option type | Values | Real (option-linked) variants |
|---|---|---|---|
| 80g All Purpose Tarpaulins BLUE | "Size and Number" | 3 | 0 |
| Fleece Dust Covers | "Size" | 3 | 0 |

Option types and values had been defined, but "Generate combinations" was never clicked — that button, not the values, is what creates variants. This is why the Inventory page's "Manage Stock" panel and the Transfer variant dropdown both appeared broken (they need a variant to target, and `inventory/page.tsx:426` filters the Transfer dropdown to non-default variants, of which there were none). The admin UI gave no hint that this step was missed.

**3. A real bug:** `frontend-starter/app/products/[slug]/variant-picker.tsx:73-74` matches a variant with `v.option_values.every(...)`, which is vacuously true for an empty array — so the ghost default variant matches any option selection. On a product with real option-linked variants, picking an option resolves to the ghost variant instead, which a separate cart guard (added earlier) then rejects with a 400. Affected products are currently unbuyable with a confusing error. This is fixed as part of this work, independent of the stock feature.

---

## Decisions made

| Question | Decision |
|---|---|
| Where does sellable stock live? | On the variant itself (`ProductVariant.stock_quantity`), not the warehouse system. Warehouses remain optional physical-location tracking only. |
| How is `Product.stock_quantity` kept in sync? | It becomes a **derived cache** for any product with real variants — always recomputed as the sum of active, option-linked variants' stock. Never independently editable once real variants exist. |
| What happens to a pre-existing product-level stock number when variants are generated? | **Nothing is carried over or split.** The admin sets each variant's stock explicitly; the product total is simply the sum. New variants start at 0 (product goes out of stock until stock is entered) — no automatic even-split or single-variant dump, since either would fabricate inventory data. |
| Scope of "real variant" | A variant with option links (created via "Generate combinations"). A product with no option types still uses `Product.stock_quantity` directly, exactly as today — no migration forced on simple products. |
| Warehouse stock / CSV warehouse columns | Out of scope. Left exactly as-is (tracking only, not wired into checkout). |

---

## Section 1 — Data model

Add one column to `product_variants`:

```
stock_quantity: int  -- default 0, NOT NULL
```

New Alembic migration under `backend/alembic/versions/`, following the existing file-naming and structure convention (see e.g. `f4a5b6c7d8e9_add_theme_colors_to_branding.py`).

**Sync invariant:** for any product with at least one option-linked (non-default) variant:

```
product.stock_quantity == sum(v.stock_quantity for v in variants if v.is_active and v.option_links)
```

This is recomputed and persisted — not just computed on read — so every existing read path that already depends on `product.stock_quantity` (the `in_stock` property in `models.py:40`, the `in_stock_only` filter in `service.py:127`, product cards, search, admin lists) keeps working unmodified.

A product with **no** option-linked variants (a simple product, or one whose variants were all deactivated) is unaffected — `product.stock_quantity` stays a directly-editable field exactly as it is today.

---

## Section 2 — Backend

### 2a. Model
`backend/app/plugins/products/models.py` — add to `ProductVariant`:
```python
stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
```

### 2b. Migration
New Alembic migration: `ALTER TABLE product_variants ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0`.

### 2c. Schemas (`products/schemas.py`)
- `VariantUpdate` accepts `stock_quantity: Optional[int]`.
- Variant output schema includes `stock_quantity`.
- `ProductUpdate.stock_quantity` is accepted by the schema as today, but the service layer (2f) ignores it once the product has real variants.

### 2d. `variant_service.py`
- `build_variant_out` — include `stock_quantity` in the response dict.
- `update_variant` — allow setting `stock_quantity`. Reuse the existing ghost-variant guard already in place for `price_adjustment`: a default/no-option variant on a product that *has* real option types must not be assigned stock either (it isn't purchasable, per the earlier variant-picker fix).
- New `recalc_product_stock(product_id, db)` — sets `Product.stock_quantity` to the sum over active, option-linked variants; no-ops (leaves it untouched) for products with no real variants. Called from `update_variant` (after a stock change) and from `generate_variants` (after new variants are created at 0).
- New `deduct_variant_stock(variant_id, qty, db)` / `restore_variant_stock(variant_id, qty, db)` — mirror the `with_for_update` + 409-on-insufficient-stock pattern already used in `products/service.py:244-258 deduct_stock` / `restore_stock`, then call `recalc_product_stock`.
- New helper `effective_stock_for(variant, product)` — returns `variant.stock_quantity` if the variant is option-linked, else `product.stock_quantity`. This is the single function every stock check below calls, so there is exactly one place that decides "which number counts."

### 2e. Cart (`cart/service.py`)
- Stock checks in `add_item` (:185) and `update_item` (:233) call `effective_stock_for` instead of reading `product.stock_quantity` directly.
- The per-line-item `stock_quantity` returned in `_build_cart_out` (:114) reflects the same effective value, so the cart UI shows the right number.

### 2f. Checkout (`checkout/service.py`)
- Stock checks in `_items_from_cart` (:66) and `_items_from_explicit` (:124) call `effective_stock_for`.
- The `stock_items` tuples currently `(product_id, quantity)` (built at :145, :292, :401) widen to `(product_id, variant_id, quantity)`.
- `_apply_paid_order_effects` (:157-160) deducts from the variant via `deduct_variant_stock` when the item's variant is option-linked, falling back to the existing `product_service.deduct_stock` otherwise.

### 2g. Orders (`orders/service.py:158`)
Cancellation restores stock to the variant (`restore_variant_stock`) when the order item's variant is option-linked, else product-level (`restore_stock`) as today.

### 2h. Products (`products/service.py`)
- `update_product` ignores/drops `stock_quantity` from the update payload when the product has real variants (the derived-cache rule) — it does not error, it simply doesn't apply that field, so existing clients that always send the full form don't break.
- `import_from_csv` (:372, :407): for a product with real variants, skips writing `stock_quantity` from the CSV row and appends a warning to the import result instead of silently overwriting the derived total.

---

## Section 3 — Admin UI (`frontend-admin/app/(dashboard)/products/[id]/page.tsx`)

- Add an editable **Stock** column to the variant table, alongside the existing SKU / Price adj. / Active columns. Same debounced-`onBlur` → PATCH pattern already used for price adjustment (`handleVariantAdjustmentBlur`, ~line 691).
- When option types exist but no real variants do (the exact trap the user fell into), show a banner in the Variants tab: *"You've defined options but haven't generated variants yet — click Generate combinations. Until you do, this product can't be bought."*
- Immediately after generating variants on a product that previously had product-level stock, show a migration banner: *"Stock is now managed per variant. This product had N units; that number can't be split automatically. Enter stock for each variant below — until you do, this product is out of stock."*
- Once a product has real variants, the Details-tab stock field becomes **read-only**, displaying the derived sum with a note pointing to the Variants tab.

---

## Section 4 — Storefront

- **Bug fix** — `variant-picker.tsx:73-74`: only match variants that have `option_values.length > 0`; the ghost default variant must never be resolved from an option selection.
- Extend the picker's existing out-of-stock narrowing (currently keyed on `is_active`) to also treat `stock_quantity <= 0` as unavailable, so a sold-out size greys out the same way an inactive one does.
- `add-to-cart-button.tsx`: disable the button with an "Out of stock" state when the selected variant's stock is 0.
- `lib/types.ts`: add `stock_quantity` to the `ProductVariant` type.

---

## Section 5 — Inventory page (`frontend-admin/app/(dashboard)/inventory/page.tsx`)

Not rewired into checkout (out of scope), but corrected so it stops being misleading:
- Add a note that warehouse stock is physical-location tracking only; sellable stock is set per variant on the product page.
- Empty variant dropdowns (Manage Stock panel, Transfer panel) get a real empty state — *"This product has no variants — generate them on the product page"* — instead of silently rendering nothing.

---

## Out of scope

- Wiring `WarehouseStock` into cart/checkout stock checks.
- The variant CSV import's `stock_<warehouse_code>` columns (`variant_csv_service.py`) — these remain warehouse-tracking only, unrelated to the sellable stock this spec introduces.

---

## Data cleanup for already-affected products

After this ships, for each product that currently has option types but zero real variants (the tarpaulin and Fleece Dust Covers, at minimum):
1. Run `backend/find_orphan_priced_variants.py --apply` (already written, dry-run verified) to clear the stray `price_adjustment` sitting on the ghost default variant.
2. In admin → product → Variants tab → Generate combinations, then enter stock per variant.

---

## Testing approach

### Sync invariant (the specific concern that prompted this design)
After each of: setting variant stock, generating variants, deactivating a variant, deleting an option type, checking out, and cancelling an order — assert
`product.stock_quantity == sum(stock of active option-linked variants)`.

Additionally: `PATCH /api/products/{id}` with a `stock_quantity` value on a variant product does not change the derived total; a product CSV import with a stock value on a variant product doesn't either (both produce a warning instead of drifting).

### Other new backend tests
- Variant stock deduct/restore (`with_for_update`, 409 on insufficient stock).
- Cart returns 409 when the *variant's* stock is insufficient even though product-level stock is nonzero — proves the variant number is what's actually enforced.
- Checkout deducts the variant's stock, not the product's.
- Order cancellation restores the variant's stock.

### Regression
Full backend suite (currently 368 passing) must stay green, in particular `test_variants.py`, `test_explicit_checkout.py`, `test_concurrent.py`, `test_commerce.py`.

### Manual / E2E verification
- Admin sets variant stock → storefront shows a 0-stock size as out-of-stock and blocks Add to Cart; a stocked size adds and checks out at the right price; the admin product list shows the summed total.
- Re-run the exact original scenario: generate variants on the tarpaulin, confirm the migration banner appears and the product reads 0 stock, set different stock per variant, confirm the product total equals the sum, confirm the storefront picker greys out the zero-stock size, and confirm buying one decrements only that variant.

---

## Critical files

- `backend/app/plugins/products/models.py`, `schemas.py`, `variant_service.py`, `service.py`
- `backend/alembic/versions/<new>_add_variant_stock.py`
- `backend/app/plugins/cart/service.py`, `checkout/service.py`, `orders/service.py`
- `frontend-admin/app/(dashboard)/products/[id]/page.tsx`, `(dashboard)/inventory/page.tsx`
- `frontend-starter/app/products/[slug]/variant-picker.tsx`, `add-to-cart-button.tsx`, `lib/types.ts`
