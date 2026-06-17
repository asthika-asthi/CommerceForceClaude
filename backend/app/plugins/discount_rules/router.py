from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.discount_rules.schemas import DiscountRuleCreate, DiscountRuleUpdate, DiscountRuleOut
from app.plugins.discount_rules import service

router = APIRouter()


@router.get("", response_model=list[DiscountRuleOut], dependencies=[Depends(require_admin())])
async def list_rules(db: AsyncSession = Depends(get_db)):
    return await service.list_rules(db)


@router.post("", response_model=DiscountRuleOut, status_code=201, dependencies=[Depends(require_admin())])
async def create_rule(data: DiscountRuleCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_rule(data, db)


@router.patch("/{rule_id}", response_model=DiscountRuleOut, dependencies=[Depends(require_admin())])
async def update_rule(rule_id: str, data: DiscountRuleUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_rule(rule_id, data, db)


@router.delete("/{rule_id}", status_code=204, dependencies=[Depends(require_admin())])
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_rule(rule_id, db)
