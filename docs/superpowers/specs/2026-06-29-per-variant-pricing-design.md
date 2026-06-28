# Per-Variant Pricing — Design Spec

**Date:** 2026-06-29
**Status:** Approved

---

## Goal

Allow individual product variants to carry a price adjustment (positive or negative) on top of the product's base price. When a customer selects a variant on the product page, the displayed price updates live to reflect the adjustment.

---

## Decisions made

| Question | Decision |
|---|---|
| Absolute price or adjustment? | Adjustment (delta) — variant price = product effective price ± adjustment |
| Sale price interaction | Adjustment applies on top of `product.effective_price` (which already accounts for sale price) — client-level business decision |
| Storefront display | Main price updates live when variant is selected; no delta shown on pill buttons |
| Admin display | Plain numeric input per variant, blank = no adjustment |

---

## Section 1 — Data model

Add one nullable column to `product_variants`:

```
price_adjustment: Optional[Decimal]  -- default NULL
```

**Null means no adjustment** — the variant uses the product's effective price unchanged. Positive values raise the price, negative lower it.

**Effective price formula:**
```
effective_variant_price = product.effective_price + (variant.price_adjustment or 0)
```

`product.effective_price` already handles the product-level sale price logic (`sale_price if is_on_sale else price`). The variant adjustment composes on top of whatever that returns.

No existing data migration required — all current variants get `NULL`, which behaves identically to the current system.

---

## Section 2 — Backend

### 2a. Model
Add to `ProductVariant` in `backend/app/plugins/products/models.py`:
```python
price_adjustment: Optional[Decimal] = None
```

### 2b. Migration
New Alembic migration: `ALTER TABLE product_variants ADD COLUMN price_adjustment NUMERIC(10,2) NULL`.

### 2c. Cart service
`backend/app/plugins/cart/service.py` currently uses `product.effective_price` as unit price. Change to:
```
unit_price = product.effective_price + (variant.price_adjustment or 0)
```

### 2d. Checkout service
`backend/app/plugins/checkout/service.py` has the same pattern in `_items_from_cart()`. Apply the same change.

### 2e. Variant API schema
Add `price_adjustment: Optional[Decimal]` to the variant response schema so the storefront and admin can read it.

### 2f. Variant PATCH endpoint
The existing `PATCH /api/products/{id}/variants/{variant_id}` endpoint accepts SKU and `is_active` updates. Extend it to also accept and persist `price_adjustment`.

---

## Section 3 — Admin UI

In the product editor variants table (`frontend-admin/app/(dashboard)/products/[id]/page.tsx`), add a fourth column: **Price adj. (£)**.

- Plain numeric input, accepts positive and negative decimals
- Placeholder: `0.00`
- Blank / zero = no adjustment
- Saved via the existing variant PATCH endpoint on blur — same pattern as the SKU inline edit
- Display the raw number the admin typed (no special formatting in the input itself)

No new UI components needed.

---

## Section 4 — Storefront

The product detail page (`frontend-starter/app/products/[slug]/page.tsx`) fetches the product server-side, including the full variants array (which now includes `price_adjustment` in the API response).

A client component wraps the price display and listens to the selected variant ID (already managed as state on the page). When the selection changes:

1. Look up the selected variant in the variants array
2. Compute `displayPrice = product.effective_price + (variant.price_adjustment or 0)`
3. Re-render the price

**No extra API calls.** All data is already available from the initial page fetch.

Variants with `price_adjustment = null` or `0` show the product's normal price — no visible change for products where no variants have adjustments set.

---

## Testing approach

No automated tests for the admin/storefront UI. Backend cart and checkout service changes are covered by the existing pytest suite — add test cases for:
- Cart item unit price = product price + variant adjustment
- Cart item unit price = product price when adjustment is null
- Checkout line total uses adjusted price
- Checkout order item `unit_price` snapshot uses adjusted price

Manual browser verification:
- Admin: set a price adjustment on a variant, save, reload — value persists
- Storefront: select the adjusted variant — price updates live
- Storefront: add adjusted variant to cart — cart shows adjusted price
- Checkout: order total reflects adjusted price; order item `unit_price` is correct
