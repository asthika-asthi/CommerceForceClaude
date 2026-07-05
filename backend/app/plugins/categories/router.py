from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.categories.schemas import CategoryCreate, CategoryUpdate, CategoryOut
from app.plugins.categories import service

router = APIRouter()


class CsvImportError(BaseModel):
    row: int
    error: str


class CsvImportResult(BaseModel):
    created: int
    updated: int
    errors: list[CsvImportError]


@router.get("/export/csv", dependencies=[Depends(require_admin())])
async def export_categories_csv(db: AsyncSession = Depends(get_db)):
    content = await service.export_to_csv(db)
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="categories.csv"'},
    )


@router.post("/import/csv", response_model=CsvImportResult,
             dependencies=[Depends(require_admin())])
async def import_categories_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    content = (await file.read()).decode("utf-8")
    result = await service.import_from_csv(content, db)
    return result


@router.get("", response_model=list[CategoryOut])
async def list_categories(include_empty: bool = False, db: AsyncSession = Depends(get_db)):
    # include_empty=true (admin) returns every category, even those with no products yet;
    # the default (storefront) hides empty categories from shoppers.
    if include_empty:
        return await service.list_all_categories(db)
    return await service.list_root_categories(db)


@router.get("/{category_id}", response_model=CategoryOut)
async def get_category(category_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_category(category_id, db)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_category(data, db)


@router.put("/{category_id}", response_model=CategoryOut,
            dependencies=[Depends(require_admin())])
async def update_category(category_id: str, data: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_category(category_id, data, db)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def delete_category(category_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_category(category_id, db)
