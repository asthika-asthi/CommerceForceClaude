from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from app.plugins.reviews.models import Review
from app.plugins.reviews.schemas import ReviewCreate


async def list_approved_reviews(product_id: str, db: AsyncSession) -> List[dict]:
    from app.plugins.auth.models import User
    # Outer join: a review whose author's account was deleted (GDPR) has
    # user_id=NULL but keeps its body text — it must still show up here.
    result = await db.execute(
        select(Review, User.first_name)
        .outerjoin(User, Review.user_id == User.id)
        .where(Review.product_id == product_id, Review.is_approved == True)
        .order_by(Review.created_at.desc())
    )
    return [
        {
            "id": r.id,
            "product_id": r.product_id,
            "user_id": r.user_id,
            "rating": r.rating,
            "title": r.title,
            "body": r.body,
            "is_approved": r.is_approved,
            "reviewer_name": first_name or "Former customer",
            "created_at": r.created_at,
        }
        for r, first_name in result.all()
    ]


async def get_review_summary(product_id: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id))
        .where(Review.product_id == product_id, Review.is_approved == True)
    )
    avg, count = result.one()
    return {
        "average_rating": round(float(avg or 0), 1),
        "total_reviews": count or 0,
    }


async def list_all_reviews(
    db: AsyncSession,
    is_approved: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[List[dict], int]:
    from app.plugins.auth.models import User
    count_q = select(func.count()).select_from(Review)
    if is_approved is not None:
        count_q = count_q.where(Review.is_approved == is_approved)
    total = (await db.execute(count_q)).scalar_one()

    data_q = (
        select(Review, User.first_name, User.last_name, User.email)
        .outerjoin(User, Review.user_id == User.id)
        .order_by(Review.is_approved, Review.created_at.desc())
    )
    if is_approved is not None:
        data_q = data_q.where(Review.is_approved == is_approved)
    result = await db.execute(data_q.offset((page - 1) * page_size).limit(page_size))
    items = [
        {
            "id": r.id,
            "product_id": r.product_id,
            "user_id": r.user_id,
            "rating": r.rating,
            "title": r.title,
            "body": r.body,
            "is_approved": r.is_approved,
            "reviewer_name": f"{first_name} {last_name}" if first_name else "Former customer (deleted account)",
            "reviewer_email": email,
            "created_at": r.created_at,
        }
        for r, first_name, last_name, email in result.all()
    ]
    return items, total


async def has_purchased(user_id: str, product_id: str, db: AsyncSession) -> bool:
    from app.plugins.orders.models import Order, OrderItem, OrderStatus
    result = await db.execute(
        select(OrderItem.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            Order.user_id == user_id,
            OrderItem.product_id == product_id,
            Order.status == OrderStatus.delivered,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def create_review(user_id: str, data: ReviewCreate, db: AsyncSession) -> Review:
    existing = await db.execute(
        select(Review).where(Review.user_id == user_id, Review.product_id == data.product_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already reviewed this product")
    if not await has_purchased(user_id, data.product_id, db):
        raise HTTPException(status_code=403, detail="Only customers who have purchased this product can leave a review")
    review = Review(user_id=user_id, **data.model_dump())
    db.add(review)
    await db.flush()
    return review


async def update_review(review_id: str, user_id: str, data, db: AsyncSession) -> Review:
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own reviews")
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(review, field, value)
    if updates:
        review.is_approved = False
    await db.flush()
    return review


async def approve_review(review_id: str, db: AsyncSession) -> Review:
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_approved = True
    await db.flush()
    return review


async def delete_review(review_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.delete(review)
