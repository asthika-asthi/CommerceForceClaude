# Product Variants — Design Spec

**Date:** 2026-06-25
**Status:** Approved, pending implementation

---

## Problem

Every product currently has one SKU, one price, and one stock number. Clients who sell clothing, equipment, or any goods with multiple configurations (size, colour, material, etc.) cannot represent those configurations as distinct buyable items. There is no way to say "Size M is in stock but Size XL is sold out."

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Variant axes | Flexible — any named option set | Client product range is mixed and unknown; fixed Size+Colour would not cover all cases |
| Pricing | Shared — all variants inherit the product price | Sufficient for v1; per-variant pricing deferred to v2 |
| Stock tracking | Warehouse stock per variant | Client requested accurate per-variant, per-warehouse inventory |
| Architecture | Default variant — all products always have at least one variant | Uniform code paths everywhere; no dual-mode logic |
| Storefront picker UI | Basic dropdowns for v1 | Polished swatches/buttons deferred to component library (Q) |

---

## Database Schema

### New tables

**`product_option_types`** — the named axes for a product's variants

| Column | Type | Notes |
|--------|------|-------|
| id | String(36) PK | UUID |
| product_id | String(36) FK → products | CASCADE delete |
| name | String(100) | e.g. "Size", "Colour", "Material" |
| sort_order | Integer | display order |

**`product_option_values`** — allowed values per axis

| Column | Type | Notes |
|--------|------|-------|
| id | String(36) PK | UUID |
| option_type_id | String(36) FK → product_option_types | CASCADE delete |
| label | String(100) | e.g. "M", "Red", "Aluminium" |
| sort_order | Integer | display order |

**`product_variants`** — each buyable combination

| Column | Type | Notes |
|--------|------|-------|
| id | String(36) PK | UUID |
| product_id | String(36) FK → products | CASCADE delete |
| sku | String(100) UNIQUE | unique across all variants |
| is_default | Boolean | True for auto-created variants on simple products |
| is_active | Boolean | admin can deactivate a single combination |

**`product_variant_options`** — junction: which option values define this variant

| Column | Type | Notes |
|--------|------|-------|
| variant_id | String(36) FK → product_variants | CASCADE delete |
| option_value_id | String(36) FK → product_option_values | CASCADE delete |
| UNIQUE | (variant_id, option_value_id) | no duplicate links |

### Modified tables

**`warehouse_stock`**
- Remove `product_id` column
- Add `variant_id` String(36) FK → product_variants (CASCADE delete)
- Change unique constraint from `(warehouse_id, product_id)` → `(warehouse_id, variant_id)`

**`cart_items`**
- Remove `product_id` column
- Add `variant_id` String(36) FK → product_variants (CASCADE delete)
- Change unique constraint from `(cart_id, product_id)` → `(cart_id, variant_id)`

**`order_items`**
- Add `variant_id` String(36) FK → product_variants nullable (SET NULL on delete)
- Add `variant_label` String(500) nullable — human-readable snapshot e.g. "Size: M, Colour: Red"
- Existing columns `product_name`, `product_sku` remain — historical orders are unaffected

### Product SKU field

Once a product has explicit variants, `product.sku` becomes a display-only reference field (the "base SKU prefix"). It is no longer enforced as a unique cart or order identifier — variant SKUs take that role. The field is kept because it is displayed in the admin product list and the migration uses it to seed the default variant's SKU.

### Migration

A standalone script `scripts/migrate_variants.py` must be run once after deploying this feature. It must NOT run automatically at startup (startup failure would take down the whole service).

Steps:
1. For each product that has no `product_variants` rows: create one `ProductVariant` with `is_default=True`, `is_active=True`, and `sku = product.sku`
2. Update all `WarehouseStock` rows: set `variant_id` to the default variant of the referenced product, clear `product_id`
3. Update all `CartItem` rows: set `variant_id` to the default variant of the referenced product, clear `product_id`
4. Leave `OrderItem` rows unchanged (`variant_id` and `variant_label` remain NULL for historical orders)

The migration is idempotent (safe to run multiple times). It should be run against a test database first.

---

## API

### Products plugin — new and changed endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/products/{id} | public | now includes `option_types` and `variants` arrays |
| GET | /api/products/{id}/variants | public | list all active variants for a product |
| POST | /api/products/{id}/options | admin | create an option type (e.g. name: "Size") |
| DELETE | /api/products/{id}/options/{option_type_id} | admin | remove option type + its values; variants that used those values are deactivated (not deleted, to preserve order history) |
| POST | /api/products/{id}/options/{option_type_id}/values | admin | add a value to an option type |
| DELETE | /api/products/{id}/options/{option_type_id}/values/{value_id} | admin | remove a value |
| POST | /api/products/{id}/variants/generate | admin | auto-generate all combinations from current option values |
| PATCH | /api/products/{id}/variants/{variant_id} | admin | update a variant's SKU or active status |

### Cart plugin — changed

`POST /api/cart` request body changes from `{ product_id, quantity }` to `{ variant_id, quantity }`.

The cart service resolves the product from the variant to check active status, fetch the price, and return the product name.

### Inventory plugin — changed

All stock endpoints now work with `variant_id` instead of `product_id`. The warehouse stock UI groups entries by product name for readability:

```
T-Shirt (product)
  ├── S / Red  →  qty: 10
  ├── M / Red  →  qty: 5
  └── L / Blue →  qty: 0
```

### Checkout plugin — unchanged interface, internal change

Checkout resolves the variant to check stock, decrements stock at the `variant_id` level, and writes `variant_id` + `variant_label` onto `OrderItem`.

---

## Admin UI

### Product editor — Variants tab

A new "Variants" tab appears alongside the existing product fields. It contains:

1. **Options section** — list of option types. Each option type shows its values as chips. Admin can add/remove option types and values.
2. **"Generate combinations" button** — creates (or refreshes) the variants table from the current option values. Warns if regeneration will deactivate existing combinations.
3. **Variants table** — one row per combination. Columns: option values, SKU (editable inline), active toggle. Admin assigns or edits SKUs.

For simple products (no option types defined), the tab shows: *"No options defined. Add an option to create variants."* The hidden default variant remains in place.

### Inventory page — stock management

The existing warehouse stock UI is unchanged in layout. The product picker becomes a variant picker — showing "Product Name — Option1 / Option2" in the dropdown. Existing entries for default variants display as just "Product Name" (no option suffix).

---

## Storefront

Product page changes (v1 — basic):
- Below product description, render one `<select>` dropdown per option type
- The selected combination resolves to a variant; if that variant is out of stock, disable the "Add to Cart" button and show "Out of stock"
- Cart line item displays: `{product_name} — {variant_label}`

The polished variant picker (swatches, visual size grids, cross-out for out-of-stock) is deferred to the component library feature (Q).

---

## Scope boundary — what is NOT in this spec

| Deferred item | Target |
|---------------|--------|
| Per-variant pricing (e.g. XL costs £2 more) | v2 of this feature |
| Polished storefront variant picker (swatches, visual grid) | Component library (Q) |
| Warehouse-to-warehouse stock transfers at variant level | Inventory v2 |
| Bulk variant import via CSV | Separate sprint |
| Variant images (e.g. show red image when Red is selected) | Separate sprint |

---

## Testing

| Area | What to test |
|------|-------------|
| Migration | Existing products get a default variant; warehouse stock and cart items migrate correctly |
| Option CRUD | Create option type, add values, delete value — variants regenerate correctly |
| Generate combinations | 2 options × 3 values each → 6 variants created with correct SKUs |
| Cart | `POST /api/cart` with `variant_id` adds correct item; duplicate variant in cart updates quantity |
| Stock check | Checkout blocks if variant has zero stock; decrements correct variant after order |
| Order history | OrderItem stores `variant_label`; displayed correctly in admin order detail |
| Storefront | Dropdown renders correct options; out-of-stock variant disables Add to Cart |
| Default variant | Product with no options works exactly as before (no visible change to shopper) |
