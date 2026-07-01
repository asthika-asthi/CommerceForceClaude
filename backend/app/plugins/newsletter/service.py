import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.plugins.newsletter.models import NewsletterSubscriber
from app.plugins.newsletter.schemas import SubscribeRequest


async def subscribe(data: SubscribeRequest, db: AsyncSession) -> NewsletterSubscriber:
    result = await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == data.email.lower())
    )
    subscriber = result.scalar_one_or_none()
    if subscriber:
        if subscriber.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already subscribed")
        subscriber.is_active = True
        subscriber.first_name = data.first_name or subscriber.first_name
        await db.flush()
        return subscriber

    subscriber = NewsletterSubscriber(
        email=data.email.lower(),
        first_name=data.first_name,
        unsubscribe_token=str(uuid.uuid4()),
    )
    db.add(subscriber)
    await db.flush()
    return subscriber


async def unsubscribe(token: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.unsubscribe_token == token)
    )
    subscriber = result.scalar_one_or_none()
    if not subscriber:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid unsubscribe token")
    subscriber.is_active = False
    await db.flush()


async def list_subscribers(db: AsyncSession, active_only: bool = True) -> list[NewsletterSubscriber]:
    query = select(NewsletterSubscriber)
    if active_only:
        query = query.where(NewsletterSubscriber.is_active == True)
    result = await db.execute(query.order_by(NewsletterSubscriber.created_at.desc()))
    return list(result.scalars().all())


async def get_subscriber(subscriber_id: str, db: AsyncSession) -> NewsletterSubscriber:
    result = await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.id == subscriber_id)
    )
    subscriber = result.scalar_one_or_none()
    if not subscriber:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found")
    return subscriber


async def update_subscriber(subscriber_id: str, data: dict, db: AsyncSession) -> NewsletterSubscriber:
    subscriber = await get_subscriber(subscriber_id, db)
    for field, value in data.items():
        setattr(subscriber, field, value)
    await db.flush()
    return subscriber


async def delete_subscriber(subscriber_id: str, db: AsyncSession) -> None:
    subscriber = await get_subscriber(subscriber_id, db)
    await db.delete(subscriber)
    await db.flush()


async def list_subscribers_paged(
    db: AsyncSession, active_only: bool = True, page: int = 1, page_size: int = 20
) -> tuple[list[NewsletterSubscriber], int]:
    count_q = select(func.count()).select_from(NewsletterSubscriber)
    if active_only:
        count_q = count_q.where(NewsletterSubscriber.is_active == True)
    total = (await db.execute(count_q)).scalar_one()

    data_q = select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())
    if active_only:
        data_q = data_q.where(NewsletterSubscriber.is_active == True)
    result = await db.execute(data_q.offset((page - 1) * page_size).limit(page_size))
    return list(result.scalars().all()), total


async def subscriber_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.is_active == True)
    )
    return len(result.scalars().all())
