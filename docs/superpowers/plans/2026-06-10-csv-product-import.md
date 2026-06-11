# CSV Product Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `POST /api/products/import/csv` endpoint that lets admins bulk-create products from a CSV file and returns a per-row result summary.

**Architecture:** A single UploadFile endpoint in the existing products plugin reads CSV bytes, parses them with the stdlib `csv` module, and delegates row-by-row creation to the existing `create_product` service function. Errors are collected per-row and returned in the response rather than rolling back the whole batch.

**Tech Stack:** FastAPI `UploadFile`/`File`, Python stdlib `csv` + `io`, existing `ProductCreate` schema, pytest `httpx` multipart upload via `files=`.

---

## File Structure

| File | Change |
|------|--------|
| `backend/app/plugins/products/schemas.py` | Add `CsvImportError` and `CsvImportResult` schemas |
| `backend/app/plugins/products/service.py` | Add `import_from_csv(content, db)` function |
| `backend/app/plugins/products/router.py` | Add `POST /import/csv` endpoint (before `/{product_id}` routes) |
| `backend/tests/test_content.py` | Add CSV import tests at the bottom |

---

### Task 1: Add response schemas

**Files:**
- Modify: `backend/app/plugins/products/schemas.py`

- [ ] **Step 1: Write the failing test**

Add these tests to `backend/tests/test_content.py` (append at the bottom of the file):

```python
# ── CSV IMPORT ────────────────────────────────────────────────────────────────

async def test_csv_import_creates_products(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv_content = "name,price,stock_quantity,description\nWidget Alpha,10.00,5,A widget\nGadget Beta,20.00,3,"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert body["errors"] == []


async def test_csv_import_missing_required_fields_reported(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv_content = "name,price\nGood Product,5.00\n,\nNo Price,"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 1
    assert len(body["errors"]) == 2
    error_rows = [e["row"] for e in body["errors"]]
    assert 3 in error_rows  # empty name+price row
    assert 4 in error_rows  # missing price row


async def test_csv_import_non_admin_rejected(client: AsyncClient, db):
    await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    csv_content = "name,price\nHack,1.00"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {cust_token}"},
    )
    assert r.status_code == 403


async def test_csv_import_partial_errors_continue(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    # Row 3: valid. Row 4: bad price. Row 5: valid.
    csv_content = "name,price\nProduct One,15.00\nBad Price,not-a-number\nProduct Three,25.00"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert len(body["errors"]) == 1
    assert body["errors"][0]["row"] == 3


async def test_csv_import_empty_file(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    csv_content = "name,price\n"
    r = await client.post(
        "/api/products/import/csv",
        files={"file": ("products.csv", csv_content.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 0
    assert body["errors"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd backend
.venv\Scripts\python.exe -m pytest tests/test_content.py::test_csv_import_creates_products -v
```

Expected: FAIL with `404` (route not found yet).

- [ ] **Step 3: Add schemas to `backend/app/plugins/products/schemas.py`**

Append at the bottom of the file:

```python
class CsvImportError(BaseModel):
    row: int
    error: str


class CsvImportResult(BaseModel):
    created: int
    errors: list[CsvImportError]
```

- [ ] **Step 4: Confirm schemas import without errors**

```
cd backend
.venv\Scripts\python.exe -c "from app.plugins.products.schemas import CsvImportResult; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```
git add backend/app/plugins/products/schemas.py backend/tests/test_content.py
git commit -m "feat: add CsvImportResult schema and failing csv import tests"
```

---

### Task 2: Implement the import service function

**Files:**
- Modify: `backend/app/plugins/products/service.py`

- [ ] **Step 1: Add `import_from_csv` to `backend/app/plugins/products/service.py`**

Add the following imports at the top of the file (after existing imports):

```python
import csv
import io
from decimal import Decimal, InvalidOperation
```

Then append the function at the bottom of the file:

```python
async def import_from_csv(
    content: str,
    db: AsyncSession,
) -> dict:
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        name = (row.get("name") or "").strip()
        price_raw = (row.get("price") or "").strip()

        if not name or not price_raw:
            errors.append({"row": i, "error": "name and price are required"})
            continue

        try:
            price = Decimal(price_raw)
        except InvalidOperation:
            errors.append({"row": i, "error": f"invalid price: {price_raw!r}"})
            continue

        sale_price_raw = (row.get("sale_price") or "").strip()
        sale_price = None
        if sale_price_raw:
            try:
                sale_price = Decimal(sale_price_raw)
            except InvalidOperation:
                errors.append({"row": i, "error": f"invalid sale_price: {sale_price_raw!r}"})
                continue

        weight_raw = (row.get("weight") or "").strip()
        weight = None
        if weight_raw:
            try:
                weight = Decimal(weight_raw)
            except InvalidOperation:
                errors.append({"row": i, "error": f"invalid weight: {weight_raw!r}"})
                continue

        stock_raw = (row.get("stock_quantity") or "0").strip()
        try:
            stock_quantity = int(stock_raw)
        except ValueError:
            errors.append({"row": i, "error": f"invalid stock_quantity: {stock_raw!r}"})
            continue

        true_values = {"true", "1", "yes"}
        data = ProductCreate(
            name=name,
            price=price,
            description=(row.get("description") or None),
            stock_quantity=stock_quantity,
            category_id=(row.get("category_id") or None),
            sale_price=sale_price,
            is_on_sale=(row.get("is_on_sale") or "").lower() in true_values,
            is_featured=(row.get("is_featured") or "").lower() in true_values,
            weight=weight,
            tags=(row.get("tags") or None),
        )

        try:
            await create_product(data, db)
            created += 1
        except Exception as exc:
            errors.append({"row": i, "error": str(exc)})

    return {"created": created, "errors": errors}
```

- [ ] **Step 2: Verify the function imports correctly**

```
cd backend
.venv\Scripts\python.exe -c "from app.plugins.products.service import import_from_csv; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```
git add backend/app/plugins/products/service.py
git commit -m "feat: implement import_from_csv service function"
```

---

### Task 3: Wire up the router endpoint

**Files:**
- Modify: `backend/app/plugins/products/router.py`

- [ ] **Step 1: Add the import at the top of `backend/app/plugins/products/router.py`**

The file currently starts with:

```python
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
```

Replace that with:

```python
from typing import Optional
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
```

- [ ] **Step 2: Add the import schema import**

The file currently imports from schemas:

```python
from app.plugins.products.schemas import (
    ProductCreate, ProductUpdate, ProductOut, ProductListOut, ProductImageCreate, ProductImageOut
)
```

Replace with:

```python
from app.plugins.products.schemas import (
    ProductCreate, ProductUpdate, ProductOut, ProductListOut, ProductImageCreate, ProductImageOut,
    CsvImportResult,
)
```

- [ ] **Step 3: Add the endpoint to `backend/app/plugins/products/router.py`**

Insert the following block **before** the `@router.get("/{product_id}", ...)` endpoint (i.e., after the `list_products` GET endpoint on line ~42):

```python
@router.post("/import/csv", response_model=CsvImportResult,
             dependencies=[Depends(require_admin())])
async def import_products_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    content = (await file.read()).decode("utf-8")
    result = await service.import_from_csv(content, db)
    return result
```

- [ ] **Step 4: Run all CSV import tests**

```
cd backend
.venv\Scripts\python.exe -m pytest tests/test_content.py -k "csv" -v
```

Expected: all 5 CSV tests PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```
cd backend
.venv\Scripts\python.exe -m pytest --tb=short -q
```

Expected: all tests pass (currently 104 + 5 new = 109 total).

- [ ] **Step 6: Commit**

```
git add backend/app/plugins/products/router.py
git commit -m "feat: add POST /api/products/import/csv endpoint for bulk product import"
```
