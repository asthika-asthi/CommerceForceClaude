import asyncio
import traceback
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import String, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base_model import BaseModel
from app.core.config import settings


class EmailLog(BaseModel):
    __tablename__ = "email_logs"

    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailTokenError(Exception):
    """Getting the Microsoft OAuth2 access token failed (Entra / AADSTS…), as opposed
    to the SMTP server rejecting the message."""


# One MSAL app for the process: it keeps the access token in memory and only asks
# Microsoft for a new one when the cached one is about to expire.
_msal_app: Any = None


def _get_msal_app() -> Any:
    global _msal_app
    if _msal_app is None:
        missing = [
            name for name in ("MS_OAUTH_TENANT_ID", "MS_OAUTH_CLIENT_ID", "MS_OAUTH_CLIENT_SECRET")
            if not getattr(settings, name)
        ]
        if missing:
            raise EmailTokenError(f"SMTP_AUTH_MODE=xoauth2 but not configured: {', '.join(missing)}")
        import msal
        _msal_app = msal.ConfidentialClientApplication(
            settings.MS_OAUTH_CLIENT_ID,
            authority=f"{settings.MS_OAUTH_AUTHORITY.rstrip('/')}/{settings.MS_OAUTH_TENANT_ID}",
            client_credential=settings.MS_OAUTH_CLIENT_SECRET,
        )
    return _msal_app


def _reset_msal_app() -> None:
    """Drop the cached app (and its cached token), e.g. after the server rejected a token."""
    global _msal_app
    _msal_app = None


def _acquire_token_blocking() -> str:
    result = _get_msal_app().acquire_token_for_client(scopes=[settings.MS_OAUTH_SCOPE])
    token = result.get("access_token")
    if not token:
        raise EmailTokenError(f"{result.get('error')}: {result.get('error_description')}")
    return str(token)


async def _oauth_token() -> str:
    # MSAL does blocking HTTP, so keep it off the event loop.
    return await asyncio.to_thread(_acquire_token_blocking)


async def _send_via_smtp(message: EmailMessage) -> None:
    import aiosmtplib

    common: dict[str, Any] = dict(
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        start_tls=settings.SMTP_TLS,
    )
    if settings.SMTP_AUTH_MODE.strip().lower() != "xoauth2":
        await aiosmtplib.send(
            message,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            **common,
        )
        return

    if not settings.SMTP_USER:
        raise EmailTokenError("SMTP_AUTH_MODE=xoauth2 but SMTP_USER (the sending mailbox) is not set")
    try:
        await aiosmtplib.send(
            message, username=settings.SMTP_USER, oauth_token_generator=_oauth_token, **common
        )
    except aiosmtplib.SMTPAuthenticationError:
        # A rejected token may just be stale: start from a clean cache and try once more.
        _reset_msal_app()
        await aiosmtplib.send(
            message, username=settings.SMTP_USER, oauth_token_generator=_oauth_token, **common
        )


async def send_email(
    recipient: str,
    subject: str,
    body: str,
    db: Optional[AsyncSession] = None,
) -> bool:
    success = False
    error_msg = None

    try:
        message = EmailMessage()
        message["From"] = settings.SMTP_FROM
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        await _send_via_smtp(message)
        success = True
    except Exception as exc:
        error_msg = traceback.format_exc()
        kind = "token acquisition failed (Microsoft sign-in)" if isinstance(exc, EmailTokenError) else "SMTP send failed"
        print(f"[Email] {kind} for {recipient}: {error_msg}")

    if not success:
        print(f"[Email fallback] To: {recipient} | Subject: {subject}\n{body}")

    if db is not None:
        log = EmailLog(
            recipient=recipient,
            subject=subject,
            body=body,
            success=success,
            error=error_msg,
            sent_at=datetime.now(timezone.utc) if success else None,
        )
        db.add(log)

    return success
