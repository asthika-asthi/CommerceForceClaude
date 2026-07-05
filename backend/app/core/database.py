from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import create_engine, event
from typing import AsyncGenerator
from app.core.config import settings

_IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

# Async engine for application use.
# For SQLite we must enable WAL + a busy timeout, otherwise concurrent async requests
# collide on SQLite's single-writer lock and the server wedges until restarted.
_connect_args = {"timeout": 30} if _IS_SQLITE else {}
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_pre_ping=True,
    connect_args=_connect_args,
)

if _IS_SQLITE:
    @event.listens_for(async_engine.sync_engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")      # concurrent readers + one writer
        cursor.execute("PRAGMA busy_timeout=30000")    # wait up to 30s for a lock, don't fail
        cursor.execute("PRAGMA synchronous=NORMAL")    # safe with WAL, much faster
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Sync engine for Alembic migrations (uses same URL, strips async driver prefix)
def _sync_url(url: str) -> str:
    return (
        url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
           .replace("sqlite+aiosqlite://", "sqlite://")
    )

sync_engine = create_engine(_sync_url(settings.DATABASE_URL))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
