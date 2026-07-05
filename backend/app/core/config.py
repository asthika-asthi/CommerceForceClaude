from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    SECRET_KEY: str = "dev-secret-change-in-production"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./commerceforce.db"

    # Plugins
    ENABLED_PLUGINS: str = "auth"

    # JWT
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Auth policy — when True, customers must verify their email before they can log in.
    REQUIRE_EMAIL_VERIFICATION: bool = True

    # Refresh-cookie Secure flag. Keep True for HTTPS deployments. Set False for an
    # HTTP-only deployment (no TLS yet), otherwise the browser won't send the cookie and
    # sessions can't be refreshed.
    COOKIE_SECURE: bool = True

    # Store currency (ISO 4217 code, e.g. GBP, USD, EUR, INR). Set per client at deploy.
    # Drives the Stripe charge currency and the symbol shown in order emails.
    CURRENCY_CODE: str = "GBP"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # SMTP
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@commerceforce.app"
    SMTP_TLS: bool = True

    # AI (OpenRouter)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-haiku-4.5"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Storefront URL — used for email links (verify email, password reset)
    STOREFRONT_URL: str = "http://localhost:3000"

    # Admin panel URL — used for admin password reset links
    ADMIN_URL: str = "http://localhost:3001"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def enabled_plugins(self) -> List[str]:
        return [p.strip() for p in self.ENABLED_PLUGINS.split(",") if p.strip()]

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
