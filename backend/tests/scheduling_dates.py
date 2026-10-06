"""Booking-fixture dates for the scheduling tests, derived from today.

Customers and guests can't book in the past, so the fixtures must always be in the
future. These used to be hardcoded (2026-08-03) and every booking test started failing
the day that date passed. A Monday is needed because the weekly-availability fixtures
use a Monday rule.
"""
from datetime import date, datetime, timedelta, timezone

# First Monday at least two weeks from today — always in the future, always a Monday.
_earliest = date.today() + timedelta(days=14)
MONDAY_D: date = _earliest + timedelta(days=(7 - _earliest.weekday()) % 7)
TUESDAY_D: date = MONDAY_D + timedelta(days=1)
RANGE_END_D: date = MONDAY_D + timedelta(days=58)  # the old 2026-08-03 -> 2026-09-30 span

MONDAY = MONDAY_D.isoformat()
TUESDAY = TUESDAY_D.isoformat()
RANGE_END = RANGE_END_D.isoformat()


def monday_at(hour: int, minute: int = 0) -> datetime:
    """A tz-aware UTC datetime on the fixture Monday."""
    return datetime(MONDAY_D.year, MONDAY_D.month, MONDAY_D.day, hour, minute, tzinfo=timezone.utc)
