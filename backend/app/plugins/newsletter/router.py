import csv
import io
from fastapi import APIRouter, Depends, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.newsletter.schemas import (
    SubscribeRequest, UnsubscribeRequest, SubscriberOut, SubscribeResponse, SubscriberUpdate,
)
from app.plugins.newsletter import service
from app.shared.pagination import Page, paginate

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


@router.get("/subscribers", response_model=Page[SubscriberOut], dependencies=[Depends(require_admin())])
async def list_subscribers(
    active_only: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    subscribers, total = await service.list_subscribers_paged(db, active_only=active_only, page=page, page_size=page_size)
    return paginate([SubscriberOut.model_validate(s) for s in subscribers], total, page, page_size)


@router.patch("/subscribers/{subscriber_id}", response_model=SubscriberOut, dependencies=[Depends(require_admin())])
async def update_subscriber(
    subscriber_id: str,
    data: SubscriberUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await service.update_subscriber(subscriber_id, data.model_dump(exclude_unset=True), db)


@router.delete("/subscribers/{subscriber_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin())])
async def delete_subscriber(subscriber_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_subscriber(subscriber_id, db)


@router.get("/subscribers/export/csv", dependencies=[Depends(require_admin())])
async def export_subscribers_csv(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    subscribers = await service.list_subscribers(db, active_only=active_only)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["email", "first_name", "is_active"])
    writer.writeheader()
    for s in subscribers:
        writer.writerow({"email": s.email, "first_name": s.first_name or "", "is_active": s.is_active})
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="subscribers.csv"'},
    )


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    count = await service.subscriber_count(db)
    return {"active_subscribers": count}
