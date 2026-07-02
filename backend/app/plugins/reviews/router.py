from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.plugins.reviews import service
from app.plugins.reviews.schemas import ReviewCreate, ReviewOut, ReviewSummary, ReviewUpdate

router = APIRouter()


@router.get("", response_model=List[ReviewOut])
async def list_reviews(
    product_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await service.list_approved_reviews(product_id, db)


@router.get("/summary", response_model=ReviewSummary)
async def review_summary(product_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_review_summary(product_id, db)


@router.get("/admin/all")
async def list_all_reviews(
    is_approved: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    _=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list_all_reviews(db, is_approved=is_approved, page=page, page_size=page_size)
    pages = max(1, (total + page_size - 1) // page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_review(current_user.id, data, db)


@router.patch("/{review_id}", response_model=ReviewOut)
async def update_review(
    review_id: str,
    data: ReviewUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_review(review_id, current_user.id, data, db)


@router.patch("/{review_id}/approve", response_model=ReviewOut)
async def approve_review(
    review_id: str,
    _=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    return await service.approve_review(review_id, db)


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: str,
    _=Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_review(review_id, db)
