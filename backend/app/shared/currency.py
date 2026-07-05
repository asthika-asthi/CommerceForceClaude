"""Store currency helpers. The currency is set per client via settings.CURRENCY_CODE."""
from app.core.config import settings

# Symbol per ISO 4217 code. Unknown codes fall back to "<CODE> " (e.g. "ZAR 12.00").
_SYMBOLS = {
    "GBP": "£", "USD": "$", "EUR": "€", "INR": "₹",
    "AUD": "A$", "CAD": "C$", "AED": "د.إ", "SGD": "S$", "NZD": "NZ$",
}


def currency_symbol() -> str:
    code = settings.CURRENCY_CODE.upper()
    return _SYMBOLS.get(code, f"{code} ")


def format_money(amount) -> str:
    """Format an amount with the store's currency symbol, e.g. '£12.00' / '$12.00'."""
    return f"{currency_symbol()}{float(amount):.2f}"
