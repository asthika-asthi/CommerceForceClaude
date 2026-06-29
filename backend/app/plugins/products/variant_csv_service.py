import csv
import io
from decimal import Decimal, InvalidOperation
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.plugins.products.models import (
    Product, ProductOptionType, ProductOptionValue, ProductVariant, ProductVariantOption,
)
from app.plugins.inventory.models import Warehouse, WarehouseStock
from app.plugins.products.schemas import VariantCsvImportError, VariantCsvImportResult


def _csv_safe(s) -> str:
    if s is None:
        return ""
    s = str(s)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


async def _find_or_create_option_type(
    product_id: str,
    name: str,
    db: AsyncSession,
    cache: dict,
) -> ProductOptionType:
    if product_id not in cache:
        result = await db.execute(
            select(ProductOptionType)
            .where(ProductOptionType.product_id == product_id)
            .options(selectinload(ProductOptionType.values))
        )
        cache[product_id] = list(result.scalars().all())

    for opt_type in cache[product_id]:
        if opt_type.name.lower() == name.lower():
            return opt_type

    new_type = ProductOptionType(
        product_id=product_id,
        name=name,
        sort_order=len(cache[product_id]),
    )
    db.add(new_type)
    await db.flush()

    reloaded_result = await db.execute(
        select(ProductOptionType)
        .where(ProductOptionType.id == new_type.id)
        .options(selectinload(ProductOptionType.values))
    )
    reloaded = reloaded_result.scalar_one()
    cache[product_id].append(reloaded)
    return reloaded


async def _find_or_create_option_value(
    opt_type: ProductOptionType,
    label: str,
    db: AsyncSession,
) -> ProductOptionValue:
    for val in opt_type.values:
        if val.label.lower() == label.lower():
            return val

    new_val = ProductOptionValue(
        option_type_id=opt_type.id,
        label=label,
        sort_order=len(opt_type.values),
    )
    db.add(new_val)
    await db.flush()
    opt_type.values.append(new_val)
    return new_val


async def import_variants_from_csv(
    content: str,
    db: AsyncSession,
    stock_mode: str,
) -> VariantCsvImportResult:

    # Phase 0 — File-level guards (no DB calls)

    # Strip UTF-8 BOM
    content = content.lstrip("﻿")

    reader = csv.DictReader(io.StringIO(content))
    fieldnames = list(reader.fieldnames or [])

    missing_cols = []
    if "product_sku" not in fieldnames:
        missing_cols.append("product_sku")
    if "variant_sku" not in fieldnames:
        missing_cols.append("variant_sku")

    if missing_cols:
        return VariantCsvImportResult(
            rows_processed=0,
            variants_created=0,
            variants_updated=0,
            stock_records_set=0,
            stock_records_incremented=0,
            warnings=[],
            errors=[VariantCsvImportError(
                row=0,
                field="headers",
                message="Missing required column: " + " / ".join(missing_cols),
            )],
        )

    rows = list(reader)

    if len(rows) == 0:
        return VariantCsvImportResult(
            rows_processed=0,
            variants_created=0,
            variants_updated=0,
            stock_records_set=0,
            stock_records_incremented=0,
            warnings=["Empty file — no data rows"],
            errors=[],
        )

    if len(rows) > 10_000:
        return VariantCsvImportResult(
            rows_processed=0,
            variants_created=0,
            variants_updated=0,
            stock_records_set=0,
            stock_records_incremented=0,
            warnings=[],
            errors=[VariantCsvImportError(
                row=0,
                field="file",
                message=f"File exceeds 10,000 row limit ({len(rows)} rows)",
            )],
        )

    # Identify dynamic stock columns: col_name -> warehouse_code
    raw_stock_cols: dict[str, str] = {
        col: col[6:] for col in fieldnames if col.startswith("stock_")
    }

    # Phase 1 — DB pre-loads

    wh_result = await db.execute(select(Warehouse))
    warehouses_by_code: dict[str, Warehouse] = {
        wh.code: wh for wh in wh_result.scalars().all()
    }

    warnings: list[str] = []
    errors: list[VariantCsvImportError] = []

    # Validate stock columns; build valid_stock_cols: col_name -> warehouse_id
    valid_stock_cols: dict[str, str] = {}
    for col_name, wh_code in raw_stock_cols.items():
        if wh_code not in warehouses_by_code:
            warnings.append(
                f"Column '{col_name}': no warehouse with code '{wh_code}' found — column ignored"
            )
        else:
            valid_stock_cols[col_name] = warehouses_by_code[wh_code].id

    prod_result = await db.execute(select(Product))
    products_by_sku: dict[str, Product] = {
        p.sku: p for p in prod_result.scalars().all()
    }

    # Phase 2 — Pre-scan (single pass, no DB writes)

    seen_variant_skus: dict[str, int] = {}  # sku -> first row number (rows start at 2)
    dup_skus: set[str] = set()
    product_option_fingerprints: dict[str, set] = {}  # product_sku -> set of frozensets
    bad_product_skus: set[str] = set()

    for idx, row in enumerate(rows):
        row_num = idx + 2
        v_sku = row.get("variant_sku", "").strip()
        p_sku = row.get("product_sku", "").strip()

        if v_sku:
            if v_sku in seen_variant_skus:
                dup_skus.add(v_sku)
            else:
                seen_variant_skus[v_sku] = row_num

        if p_sku:
            opt_names = frozenset(
                row.get(f"option{n}_name", "").strip()
                for n in range(1, 4)
                if row.get(f"option{n}_name", "").strip()
            )
            if p_sku not in product_option_fingerprints:
                product_option_fingerprints[p_sku] = set()
            product_option_fingerprints[p_sku].add(opt_names)
            if len(product_option_fingerprints[p_sku]) > 1:
                bad_product_skus.add(p_sku)

    # Phase 3 — Row loop

    rows_processed = 0
    variants_created = 0
    variants_updated = 0
    stock_records_set = 0
    stock_records_incremented = 0

    deactivated_default: set[str] = set()
    bad_product_reported: set[str] = set()
    option_type_cache: dict[str, list[ProductOptionType]] = {}

    for idx, row in enumerate(rows):
        row_num = idx + 2
        rows_processed += 1

        # a. Read product_sku and variant_sku
        p_sku = row.get("product_sku", "").strip()
        v_sku = row.get("variant_sku", "").strip()

        if not p_sku:
            errors.append(VariantCsvImportError(
                row=row_num, field="product_sku", message="must not be blank"
            ))
            continue
        if not v_sku:
            errors.append(VariantCsvImportError(
                row=row_num, field="variant_sku", message="must not be blank"
            ))
            continue

        # b. Duplicate variant_sku check
        if v_sku in dup_skus and seen_variant_skus.get(v_sku) != row_num:
            errors.append(VariantCsvImportError(
                row=row_num,
                field="variant_sku",
                message=f"SKU '{v_sku}' appears more than once in this file — duplicate row skipped",
            ))
            continue

        # c. Product lookup
        product = products_by_sku.get(p_sku)
        if not product:
            errors.append(VariantCsvImportError(
                row=row_num,
                field="product_sku",
                message=f"Product '{p_sku}' not found",
            ))
            continue

        # d. Inconsistent option names check
        if p_sku in bad_product_skus:
            if p_sku not in bad_product_reported:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field="options",
                    message=f"Inconsistent option names for product '{p_sku}' — all rows for this product skipped",
                ))
                bad_product_reported.add(p_sku)
            continue

        # e. Parse option pairs
        options: list[tuple[str, str]] = []
        row_error = False
        for n in range(1, 4):
            opt_name = row.get(f"option{n}_name", "").strip()
            opt_val = row.get(f"option{n}_value", "").strip()
            if opt_name and opt_val:
                options.append((opt_name, opt_val))
            elif opt_name and not opt_val:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field=f"option{n}_name",
                    message=f"'{opt_name}' provided without a value",
                ))
                row_error = True
                break
            elif opt_val and not opt_name:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field=f"option{n}_value",
                    message=f"value '{opt_val}' provided without a name",
                ))
                row_error = True
                break
            else:
                break  # Both blank — no more options

        if row_error:
            continue

        # f. Parse price_adjustment
        raw_price = row.get("price_adjustment", "").strip()
        price_adjustment: Decimal | None = None
        if raw_price:
            try:
                price_adjustment = Decimal(raw_price)
            except InvalidOperation:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field="price_adjustment",
                    message=f"'{raw_price}' is not a valid decimal",
                ))
                continue

        # g. Parse is_active
        raw_active = row.get("is_active", "").strip()
        if not raw_active:
            is_active = True
            warnings.append(f"Row {row_num}: is_active blank — defaulting to true")
        elif raw_active.lower() in {"true", "1", "yes"}:
            is_active = True
        elif raw_active.lower() in {"false", "0", "no"}:
            is_active = False
        else:
            is_active = True
            warnings.append(f"Row {row_num}: is_active '{raw_active}' not recognised — defaulting to true")

        # h. Look up existing variant
        variant_result = await db.execute(
            select(ProductVariant)
            .where(ProductVariant.sku == v_sku)
            .options(
                selectinload(ProductVariant.option_links)
                .selectinload(ProductVariantOption.option_value)
                .selectinload(ProductOptionValue.option_type)
            )
        )
        existing_variant = variant_result.scalar_one_or_none()
        variant_id: str

        if existing_variant is not None:
            # Verify ownership
            if existing_variant.product_id != product.id:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field="variant_sku",
                    message=f"SKU '{v_sku}' belongs to a different product",
                ))
                continue

            # Verify option combination is unchanged
            existing_combo = {
                link.option_value.option_type.name.lower(): link.option_value.label.lower()
                for link in existing_variant.option_links
                if link.option_value and link.option_value.option_type
            }
            expected_combo = {name.lower(): val.lower() for name, val in options}
            if existing_combo != expected_combo:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field="options",
                    message=(
                        f"Variant '{v_sku}' exists with a different option combination"
                        " — options cannot be changed via CSV import"
                    ),
                ))
                continue

            # Update mutable fields
            existing_variant.price_adjustment = price_adjustment
            existing_variant.is_active = is_active
            await db.flush()
            variants_updated += 1
            variant_id = existing_variant.id

        else:
            # Deactivate the default variant for this product (once per product)
            if product.id not in deactivated_default:
                default_result = await db.execute(
                    select(ProductVariant).where(
                        ProductVariant.product_id == product.id,
                        ProductVariant.is_default == True,
                    )
                )
                default_v = default_result.scalar_one_or_none()
                if default_v:
                    default_v.is_active = False
                    await db.flush()
                deactivated_default.add(product.id)

            # Create new variant
            new_v = ProductVariant(
                product_id=product.id,
                sku=v_sku,
                is_default=False,
                is_active=is_active,
                price_adjustment=price_adjustment,
            )
            db.add(new_v)
            await db.flush()

            # Create option links
            for opt_name, opt_val in options:
                opt_type = await _find_or_create_option_type(
                    product.id, opt_name, db, option_type_cache
                )
                opt_val_obj = await _find_or_create_option_value(opt_type, opt_val, db)
                link = ProductVariantOption(
                    variant_id=new_v.id,
                    option_value_id=opt_val_obj.id,
                )
                db.add(link)
                await db.flush()

            variants_created += 1
            variant_id = new_v.id

        # i. Stock columns
        for col_name, warehouse_id in valid_stock_cols.items():
            raw_qty = row.get(col_name, "").strip()
            if not raw_qty:
                continue  # Blank = skip

            try:
                qty = int(raw_qty)
            except ValueError:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field=col_name,
                    message=f"Stock value '{raw_qty}' is not a valid integer",
                ))
                continue

            if qty < 0:
                errors.append(VariantCsvImportError(
                    row=row_num,
                    field=col_name,
                    message=f"Stock value {qty} cannot be negative",
                ))
                continue

            stock_result = await db.execute(
                select(WarehouseStock).where(
                    WarehouseStock.warehouse_id == warehouse_id,
                    WarehouseStock.variant_id == variant_id,
                )
            )
            stock = stock_result.scalar_one_or_none()

            if stock_mode == "set":
                if stock:
                    stock.quantity = qty
                else:
                    db.add(WarehouseStock(
                        warehouse_id=warehouse_id,
                        variant_id=variant_id,
                        quantity=qty,
                    ))
                await db.flush()
                stock_records_set += 1
            else:  # add
                if stock:
                    stock.quantity += qty
                else:
                    db.add(WarehouseStock(
                        warehouse_id=warehouse_id,
                        variant_id=variant_id,
                        quantity=qty,
                    ))
                await db.flush()
                stock_records_incremented += 1

    # Phase 4 — Return
    return VariantCsvImportResult(
        rows_processed=rows_processed,
        variants_created=variants_created,
        variants_updated=variants_updated,
        stock_records_set=stock_records_set,
        stock_records_incremented=stock_records_incremented,
        warnings=warnings,
        errors=errors,
    )


async def export_variants_to_csv(db: AsyncSession) -> str:
    # 1. Load all warehouses ordered by code
    wh_result = await db.execute(select(Warehouse).order_by(Warehouse.code))
    all_warehouses = list(wh_result.scalars().all())

    # 2. Load all WarehouseStock rows → stock_map: (warehouse_id, variant_id) -> quantity
    stock_result = await db.execute(select(WarehouseStock))
    stock_map: dict[tuple[str, str], int] = {
        (ws.warehouse_id, ws.variant_id): ws.quantity
        for ws in stock_result.scalars().all()
    }

    # 3. Find which warehouse_ids have at least one stock record
    warehouses_with_stock: set[str] = {wh_id for wh_id, _ in stock_map.keys()}

    # 4. active_warehouses = warehouses that have at least one stock record
    active_warehouses = [wh for wh in all_warehouses if wh.id in warehouses_with_stock]

    # 5+6. Load products for SKU lookup, then load non-default variants
    prod_result = await db.execute(select(Product))
    products_by_id: dict[str, Product] = {
        p.id: p for p in prod_result.scalars().all()
    }

    variant_result = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.is_default == False)
        .options(
            selectinload(ProductVariant.option_links)
            .selectinload(ProductVariantOption.option_value)
            .selectinload(ProductOptionValue.option_type)
        )
    )
    variants = list(variant_result.scalars().all())

    # Sort by product sku then variant sku
    variants.sort(key=lambda v: (
        products_by_id[v.product_id].sku if v.product_id in products_by_id else "",
        v.sku,
    ))

    # 7. Fieldnames
    fieldnames = [
        "product_sku", "variant_sku",
        "option1_name", "option1_value",
        "option2_name", "option2_value",
        "option3_name", "option3_value",
        "price_adjustment", "is_active",
    ] + [f"stock_{wh.code}" for wh in active_warehouses]

    # 8. Write CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, restval="")
    writer.writeheader()

    for variant in variants:
        product = products_by_id.get(variant.product_id)
        product_sku = product.sku if product else ""

        # Sort option links by option_type.sort_order
        sorted_links = sorted(
            variant.option_links,
            key=lambda lnk: (
                lnk.option_value.option_type.sort_order
                if lnk.option_value and lnk.option_value.option_type
                else 0
            ),
        )

        row: dict = {
            "product_sku": _csv_safe(product_sku),
            "variant_sku": _csv_safe(variant.sku),
            "option1_name": "",
            "option1_value": "",
            "option2_name": "",
            "option2_value": "",
            "option3_name": "",
            "option3_value": "",
            "price_adjustment": (
                str(variant.price_adjustment) if variant.price_adjustment is not None else ""
            ),
            "is_active": "true" if variant.is_active else "false",
        }

        # Emit up to 3 option pairs
        for i, link in enumerate(sorted_links[:3]):
            n = i + 1
            if link.option_value and link.option_value.option_type:
                row[f"option{n}_name"] = _csv_safe(link.option_value.option_type.name)
                row[f"option{n}_value"] = _csv_safe(link.option_value.label)

        # Stock columns
        for wh in active_warehouses:
            row[f"stock_{wh.code}"] = stock_map.get((wh.id, variant.id), "")

        writer.writerow(row)

    return output.getvalue()
