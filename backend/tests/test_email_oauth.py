"""send_email: Basic auth stays the default; SMTP_AUTH_MODE=xoauth2 uses a Microsoft token."""
import aiosmtplib
import pytest

from app.core.config import settings
from app.shared import email as email_mod


@pytest.fixture(autouse=True)
def _clean_state(monkeypatch):
    email_mod._reset_msal_app()
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.office365.com")
    monkeypatch.setattr(settings, "SMTP_USER", "kamlesh@tristarltd.co.uk")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(settings, "SMTP_AUTH_MODE", "basic")
    monkeypatch.setattr(settings, "MS_OAUTH_TENANT_ID", "tenant-guid")
    monkeypatch.setattr(settings, "MS_OAUTH_CLIENT_ID", "client-guid")
    monkeypatch.setattr(settings, "MS_OAUTH_CLIENT_SECRET", "s3cret")
    yield
    email_mod._reset_msal_app()


class FakeSend:
    """Stands in for aiosmtplib.send. Like the real one, it asks the token generator
    for a token when one was supplied."""

    def __init__(self, fail_auth_times: int = 0):
        self.calls: list[dict] = []
        self.tokens: list[str] = []
        self._fail_auth_times = fail_auth_times

    async def __call__(self, message, **kwargs):
        self.calls.append(kwargs)
        gen = kwargs.get("oauth_token_generator")
        if gen is not None:
            self.tokens.append(await gen())
        if self._fail_auth_times > 0:
            self._fail_auth_times -= 1
            raise aiosmtplib.SMTPAuthenticationError(535, "5.7.3 Authentication unsuccessful")


async def test_basic_mode_unchanged(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pw")
    fake = FakeSend()
    monkeypatch.setattr(aiosmtplib, "send", fake)

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is True
    (call,) = fake.calls
    assert call["username"] == "kamlesh@tristarltd.co.uk" and call["password"] == "pw"
    assert "oauth_token_generator" not in call


async def test_xoauth2_sends_with_token_and_no_password(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_AUTH_MODE", "xoauth2")
    monkeypatch.setattr(email_mod, "_acquire_token_blocking", lambda: "tok-1")
    fake = FakeSend()
    monkeypatch.setattr(aiosmtplib, "send", fake)

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is True
    (call,) = fake.calls
    assert call["username"] == "kamlesh@tristarltd.co.uk"
    assert "password" not in call
    assert call["hostname"] == "smtp.office365.com" and call["start_tls"] is True
    assert fake.tokens == ["tok-1"]


async def test_xoauth2_retries_once_when_the_token_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_AUTH_MODE", "xoauth2")
    monkeypatch.setattr(email_mod, "_acquire_token_blocking", lambda: "tok")
    fake = FakeSend(fail_auth_times=1)
    monkeypatch.setattr(aiosmtplib, "send", fake)

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is True
    assert len(fake.calls) == 2


async def test_xoauth2_gives_up_after_one_retry(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_AUTH_MODE", "xoauth2")
    monkeypatch.setattr(email_mod, "_acquire_token_blocking", lambda: "tok")
    fake = FakeSend(fail_auth_times=5)
    monkeypatch.setattr(aiosmtplib, "send", fake)

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is False
    assert len(fake.calls) == 2


async def test_token_failure_is_reported_as_a_token_problem(monkeypatch, capsys):
    monkeypatch.setattr(settings, "SMTP_AUTH_MODE", "xoauth2")

    def boom() -> str:
        raise email_mod.EmailTokenError("invalid_client: AADSTS7000215 bad secret")

    monkeypatch.setattr(email_mod, "_acquire_token_blocking", boom)
    monkeypatch.setattr(aiosmtplib, "send", FakeSend())

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is False
    out = capsys.readouterr().out
    assert "token acquisition failed" in out and "AADSTS7000215" in out


async def test_smtp_failure_is_reported_as_an_smtp_problem(monkeypatch, capsys):
    async def refuse(message, **kwargs):
        raise aiosmtplib.SMTPRecipientsRefused([])

    monkeypatch.setattr(aiosmtplib, "send", refuse)

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is False
    assert "SMTP send failed" in capsys.readouterr().out


async def test_xoauth2_without_oauth_settings_fails_clearly(monkeypatch, capsys):
    monkeypatch.setattr(settings, "SMTP_AUTH_MODE", "xoauth2")
    monkeypatch.setattr(settings, "MS_OAUTH_CLIENT_SECRET", "")
    monkeypatch.setattr(aiosmtplib, "send", FakeSend())

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is False
    assert "MS_OAUTH_CLIENT_SECRET" in capsys.readouterr().out


async def test_xoauth2_without_a_sending_mailbox_fails_clearly(monkeypatch, capsys):
    monkeypatch.setattr(settings, "SMTP_AUTH_MODE", "xoauth2")
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(aiosmtplib, "send", FakeSend())

    assert await email_mod.send_email("a@example.com", "Hi", "Body") is False
    assert "SMTP_USER" in capsys.readouterr().out


def test_msal_app_is_built_for_the_clients_tenant(monkeypatch):
    import msal

    seen: dict = {}

    class FakeApp:
        def __init__(self, client_id, authority, client_credential):
            seen.update(client_id=client_id, authority=authority, secret=client_credential)

        def acquire_token_for_client(self, scopes):
            seen["scopes"] = scopes
            return {"access_token": "real-looking-token"}

    monkeypatch.setattr(msal, "ConfidentialClientApplication", FakeApp)

    assert email_mod._acquire_token_blocking() == "real-looking-token"
    assert seen == {
        "client_id": "client-guid",
        "authority": "https://login.microsoftonline.com/tenant-guid",
        "secret": "s3cret",
        "scopes": ["https://outlook.office365.com/.default"],
    }
    # Same app (and so the same cached token) is reused on the next call.
    app = email_mod._msal_app
    email_mod._acquire_token_blocking()
    assert email_mod._msal_app is app
