import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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


async def subscriber_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.is_active == True)
    )
    return len(result.scalars().all())
