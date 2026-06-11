import sys
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.base_model import Base

# Import all models so Alembic can detect them
from app.plugins.auth.models import User, RefreshToken  # noqa: F401
from app.plugins.categories.models import Category  # noqa: F401
from app.plugins.products.models import Product, ProductImage  # noqa: F401
from app.plugins.cart.models import Cart, CartItem  # noqa: F401
from app.plugins.orders.models import Order, OrderItem  # noqa: F401
from app.plugins.rfq.models import RFQ, RFQItem  # noqa: F401
from app.plugins.credit.models import CreditAccount  # noqa: F401
from app.plugins.inventory.models import Warehouse, WarehouseStock  # noqa: F401
from app.plugins.coupons.models import Coupon, CouponUsage  # noqa: F401
from app.plugins.loyalty.models import LoyaltyConfig, LoyaltyAccount, LoyaltyTransaction  # noqa: F401
from app.plugins.newsletter.models import NewsletterSubscriber  # noqa: F401
from app.plugins.branding.models import BrandingConfig  # noqa: F401
from app.plugins.landing_page.models import LandingSection  # noqa: F401
from app.shared.email import EmailLog  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_url(url: str) -> str:
    return (
        url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
           .replace("sqlite+aiosqlite://", "sqlite://")
    )


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(settings.DATABASE_URL),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _sync_url(settings.DATABASE_URL)
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
