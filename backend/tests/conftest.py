import os

# Set env vars BEFORE any app module is imported — config uses @lru_cache
os.environ["ENABLED_PLUGINS"] = "auth,categories,products,cart,orders,checkout,rfq,credit,inventory,coupons,loyalty,newsletter,branding,landing_page,ai_chat,contact,shipping"
os.environ["ANTHROPIC_API_KEY"] = "test-key"
os.environ["ENVIRONMENT"] = "development"  # keep refresh cookies non-secure for HTTP test client

import pytest  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession  # noqa: E402

# Clear the settings cache so it re-reads with our env overrides
from app.core import config as _config  # noqa: E402
_config.get_settings.cache_clear()

from app.core.base_model import Base  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402

TEST_DB_URL = "sqlite+aiosqlite:///./test_commerceforce.db"
assert "test_" in TEST_DB_URL, (
    f"Safety check: tests must use test_commerceforce.db, got: {TEST_DB_URL}"
)

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    from app.plugins.auth.models import User, RefreshToken  # noqa
    from app.plugins.categories.models import Category  # noqa
    from app.plugins.products.models import Product, ProductImage  # noqa
    from app.plugins.cart.models import Cart, CartItem  # noqa
    from app.plugins.orders.models import Order, OrderItem  # noqa
    from app.plugins.rfq.models import RFQ, RFQItem  # noqa
    from app.plugins.credit.models import CreditAccount  # noqa
    from app.plugins.inventory.models import Warehouse, WarehouseStock  # noqa
    from app.plugins.coupons.models import Coupon, CouponUsage  # noqa
    from app.plugins.loyalty.models import LoyaltyConfig, LoyaltyAccount, LoyaltyTransaction  # noqa
    from app.plugins.newsletter.models import NewsletterSubscriber  # noqa
    from app.plugins.branding.models import BrandingConfig  # noqa
    from app.plugins.landing_page.models import LandingSection  # noqa
    from app.plugins.contact.models import Enquiry  # noqa
    from app.plugins.discount_rules.models import DiscountRule  # noqa
    from app.plugins.shipping.models import ShippingZone  # noqa
    from app.shared.email import EmailLog  # noqa

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables():
    async with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    yield
    async with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    from app.core.limiter import limiter
    yield
    limiter._storage.reset()


@pytest.fixture
async def db() -> AsyncSession:
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture
async def client(db: AsyncSession) -> AsyncClient:
    async def override_get_db():
        # Expire all cached instances so each request sees fresh DB data
        db.expire_all()
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def concurrent_client() -> AsyncClient:
    """AsyncClient whose get_db override creates a fresh session per request.

    Unlike the default ``client`` fixture (which pins every request to a single
    shared ``db`` session), this fixture lets each request open and commit its
    own session.  That is required for asyncio.gather() tests where two
    concurrent requests must not share a session; sharing a session causes
    SQLAlchemy to raise ``Session is already flushing``.
    """
    async def override_get_db():
        async with TestSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
