from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.plugins.branding.models import BrandingConfig
from app.plugins.branding.schemas import BrandingConfigUpdate


async def get_config(db: AsyncSession) -> BrandingConfig:
    result = await db.execute(select(BrandingConfig))
    config = result.scalar_one_or_none()
    if not config:
        config = BrandingConfig()
        db.add(config)
        await db.flush()
    return config


async def update_config(data: BrandingConfigUpdate, db: AsyncSession) -> BrandingConfig:
    config = await get_config(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    await db.flush()
    return config
