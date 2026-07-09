import traceback
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Optional
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


async def send_email(
    recipient: str,
    subject: str,
    body: str,
    db: Optional[AsyncSession] = None,
) -> bool:
    success = False
    error_msg = None

    try:
        import aiosmtplib
        message = EmailMessage()
        message["From"] = settings.SMTP_FROM
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            start_tls=settings.SMTP_TLS,
        )
        success = True
    except Exception:
        error_msg = traceback.format_exc()
        print(f"[Email] Failed to send to {recipient}: {error_msg}")

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
