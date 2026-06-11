from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.newsletter.schemas import (
    SubscribeRequest, UnsubscribeRequest, SubscriberOut, SubscribeResponse,
)
from app.plugins.newsletter import service

router = APIRouter()


@router.post("/subscribe", response_model=SubscribeResponse, status_code=status.HTTP_201_CREATED)
async def subscribe(data: SubscribeRequest, db: AsyncSession = Depends(get_db)):
    subscriber = await service.subscribe(data, db)
    return SubscribeResponse(
        message="Successfully subscribed to the newsletter",
        unsubscribe_token=subscriber.unsubscribe_token,
    )


@router.post("/unsubscribe")
async def unsubscribe(data: UnsubscribeRequest, db: AsyncSession = Depends(get_db)):
    await service.unsubscribe(data.token, db)
    return {"message": "Successfully unsubscribed"}


@router.get("/subscribers", response_model=list[SubscriberOut], dependencies=[Depends(require_admin())])
async def list_subscribers(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    return await service.list_subscribers(db, active_only=active_only)


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    count = await service.subscriber_count(db)
    return {"active_subscribers": count}
