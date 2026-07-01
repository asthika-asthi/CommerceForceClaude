from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.plugins.contact.models import Enquiry
from app.plugins.contact.schemas import EnquiryCreate, BespokeCreate
from app.plugins.branding.service import get_config
from app.shared.email import send_email


async def create_enquiry(data: EnquiryCreate, db: AsyncSession) -> Enquiry:
    enquiry = Enquiry(
        enquiry_type="general",
        name=data.name,
        email=data.email,
        phone=data.phone,
        subject=data.subject,
        message=data.message,
    )
    db.add(enquiry)
    await db.flush()

    branding = await get_config(db)
    store_email = branding.contact_email or "admin@commerceforce.dev"
    store_name = branding.store_name or "Store"
    subject_line = f"[{store_name}] New contact enquiry from {data.name}"
    body = (
        f"You have a new contact enquiry:\n\n"
        f"Name: {data.name}\n"
        f"Email: {data.email}\n"
        f"Phone: {data.phone or '—'}\n"
        f"Subject: {data.subject or '—'}\n\n"
        f"Message:\n{data.message}\n"
    )
    await send_email(store_email, subject_line, body, db)

    return enquiry


async def create_bespoke(data: BespokeCreate, db: AsyncSession) -> Enquiry:
    enquiry = Enquiry(
        enquiry_type="bespoke",
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        message=data.message,
        material_type=data.material_type,
        quantity_description=data.quantity_description,
        size_spec=data.size_spec,
        deadline=data.deadline,
    )
    db.add(enquiry)
    await db.flush()

    branding = await get_config(db)
    store_email = branding.contact_email or "admin@commerceforce.dev"
    store_name = branding.store_name or "Store"
    subject_line = f"[{store_name}] New bespoke enquiry from {data.name}"
    body = (
        f"You have a new bespoke/bulk order enquiry:\n\n"
        f"Name: {data.name}\n"
        f"Email: {data.email}\n"
        f"Phone: {data.phone or '—'}\n"
        f"Company: {data.company or '—'}\n\n"
        f"What they need:\n{data.message}\n\n"
        f"Material type: {data.material_type or '—'}\n"
        f"Quantity: {data.quantity_description or '—'}\n"
        f"Size/spec: {data.size_spec or '—'}\n"
        f"Deadline: {data.deadline or '—'}\n"
    )
    await send_email(store_email, subject_line, body, db)

    return enquiry


async def list_enquiries(db: AsyncSession, page: int = 1, page_size: int = 20) -> tuple[list[Enquiry], int]:
    total = (await db.execute(select(func.count()).select_from(Enquiry))).scalar_one()
    result = await db.execute(
        select(Enquiry).order_by(Enquiry.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), total


async def toggle_read(enquiry_id: str, db: AsyncSession) -> Enquiry:
    result = await db.execute(select(Enquiry).where(Enquiry.id == enquiry_id))
    enquiry = result.scalar_one_or_none()
    if not enquiry:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enquiry not found")
    enquiry.is_read = not enquiry.is_read
    await db.flush()
    return enquiry
