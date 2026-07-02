from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.plugins.discount_rules.models import DiscountRule
from app.plugins.discount_rules.schemas import DiscountRuleCreate, DiscountRuleUpdate


async def list_rules(db: AsyncSession) -> list[DiscountRule]:
    result = await db.execute(select(DiscountRule).order_by(DiscountRule.priority.desc()))
    return list(result.scalars().all())


async def get_rule(rule_id: str, db: AsyncSession) -> DiscountRule:
    result = await db.execute(select(DiscountRule).where(DiscountRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


async def create_rule(data: DiscountRuleCreate, db: AsyncSession) -> DiscountRule:
    rule = DiscountRule(**data.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def update_rule(rule_id: str, data: DiscountRuleUpdate, db: AsyncSession) -> DiscountRule:
    result = await db.execute(select(DiscountRule).where(DiscountRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return rule


async def delete_rule(rule_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(DiscountRule).where(DiscountRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if rule:
        await db.delete(rule)
        await db.commit()


async def evaluate_rules(subtotal: Decimal, db: AsyncSession) -> Decimal:
    """Return the best auto-discount for the given subtotal. Returns 0 if none apply."""
    result = await db.execute(
        select(DiscountRule)
        .where(DiscountRule.is_active == True)
        .where(DiscountRule.discount_value > 0)
        .where(
            (DiscountRule.min_order_value == None) |
            (DiscountRule.min_order_value <= subtotal)
        )
        .order_by(DiscountRule.priority.desc())
    )
    rules = result.scalars().all()
    valid_rules = [r for r in rules if r.discount_type in ("percentage", "fixed")]
    if not valid_rules:
        return Decimal("0")
    rule = valid_rules[0]
    if rule.discount_type == "percentage":
        raw = subtotal * rule.discount_value / Decimal("100")
        return min(raw, subtotal).quantize(Decimal("0.01"))
    return min(rule.discount_value, subtotal)
