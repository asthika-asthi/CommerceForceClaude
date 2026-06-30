# CSV Import / Export Guide

All template files are in this folder (`docs/templates/`).

---

## Step 1 — Import products

**Template:** `products_for_variants_template.csv`
**Where:** Admin → Products → Import CSV

After import, go to the product list and note the SKU assigned to each product (shown in the edit page or product table). You need these SKUs for the variant import.

The existing `products_template.csv` is the full-featured version with sale prices, tags, and weight — use that for real client data. Use `products_for_variants_template.csv` when you just need quick products to test variants against.

---

## Step 2 — Import variants

**Template:** `variants_template.csv`
**Where:** Admin → Bulk Variants → Choose CSV file

Before uploading, edit the file and replace the example SKUs (`TSHIRT`, `HOODIE`, `SHORTS`) in the `product_sku` column with the actual SKUs from Step 1.

**Column reference:**

| Column | Required | Notes |
|---|---|---|
| `product_sku` | Yes | Must match an existing product SKU exactly |
| `variant_sku` | Yes | Must be unique across all products |
| `option1_name` | No | e.g. `Size` |
| `option1_value` | No | e.g. `S` |
| `option2_name` / `option2_value` | No | e.g. `Colour` / `Red` |
| `option3_name` / `option3_value` | No | Third option if needed |
| `price_adjustment` | No | Added to base product price. Negative is allowed. Blank = £0 |
| `is_active` | No | `true` or `false`. Blank defaults to `true` |
| `stock_MAIN` | No | Replace `MAIN` with your warehouse code. Blank = skip. |

**Stock mode (radio button on upload page):**
- **Set stock (overwrite)** — use for initial setup or stock-takes
- **Add stock (increment)** — use for new deliveries arriving into existing stock

**Export first:** Use the Download button to get the current state as a CSV before making bulk edits — safer than editing blind.

---

## Step 3 — Test warehouse transfers

**Where:** Admin → Inventory → Transfer Stock card (bottom of page)

1. Select a From warehouse and a To warehouse (must be different)
2. Select a product, then a variant
3. Enter quantity (must not exceed available stock in the source warehouse)
4. Click Transfer — both warehouse stock tables update immediately

Available stock = `quantity − reserved_quantity`. You cannot transfer reserved stock.

---

## Adding a second warehouse column to the variant CSV

If you have two warehouses (e.g. MAIN and LONDON), add both columns:

```
...,stock_MAIN,stock_LONDON
...,10,5
...,8,
```

Blank cell = skip that warehouse for that row (does not zero it out).

---

## Error handling

The variant import shows a results panel after every upload:
- Green = all rows processed with no errors
- Amber = processed with warnings (e.g. unknown warehouse code)
- Error table = row number, field name, and exact reason for each failure

Fix the CSV and re-import — it is fully idempotent (re-importing the same rows updates, never duplicates).
