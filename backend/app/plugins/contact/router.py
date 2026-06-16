from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.contact.schemas import EnquiryCreate, BespokeCreate, EnquiryOut
from app.plugins.contact import service

router = APIRouter()


@router.post("", response_model=EnquiryOut, status_code=status.HTTP_201_CREATED)
async def submit_enquiry(data: EnquiryCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_enquiry(data, db)


@router.post("/bespoke", response_model=EnquiryOut, status_code=status.HTTP_201_CREATED)
async def submit_bespoke(data: BespokeCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_bespoke(data, db)


@router.get("", response_model=list[EnquiryOut], dependencies=[Depends(require_admin())])
async def list_enquiries(db: AsyncSession = Depends(get_db)):
    return await service.list_enquiries(db)


@router.patch("/{enquiry_id}/read", response_model=EnquiryOut, dependencies=[Depends(require_admin())])
async def toggle_read(enquiry_id: str, db: AsyncSession = Depends(get_db)):
    return await service.toggle_read(enquiry_id, db)
