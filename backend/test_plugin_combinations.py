"""
Plugin combination tests.

Verifies that:
- Enabled plugins have their API routes accessible (non-404) when DB is available
- Disabled plugins return 404 for every route under /api/<plugin>
- /api/health always works and reflects the active plugin list
- Plugin dependency enforcement raises at startup
- Five real-world client profiles work end-to-end

Run with:
    cd backend
    python test_plugin_combinations.py
"""
import asyncio
import os
import sys

# Must be set BEFORE any app module is imported (settings uses @lru_cache)
os.environ["ENABLED_PLUGINS"] = "auth,categories,products,cart,orders,checkout,coupons,loyalty,newsletter,branding,ai_chat,rfq,credit,inventory,contact,addresses,wishlist,reviews,discount_rules"
os.environ.setdefault("SECRET_KEY", "test-secret-key-combos")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_combos.db"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core import config as _config
_config.get_settings.cache_clear()

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.core.plugin_registry import register_plugins
from app.core.base_model import Base
from app.core.database import get_db

PASS = "PASS"
FAIL = "FAIL"
results: list[tuple[str, str, str]] = []

TEST_DB_URL = "sqlite+aiosqlite:///./test_combos.db"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    suffix = f"  ({detail})" if detail else ""
    print(f"  {status}  {label}{suffix}")


def build_app(plugins: list[str]) -> FastAPI:
    """Create a fresh FastAPI app with exactly the given plugins enabled."""
    original = settings.ENABLED_PLUGINS
    settings.ENABLED_PLUGINS = ",".join(plugins)

    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    plugin_snapshot = list(plugins)

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "plugins": plugin_snapshot}

    register_plugins(app)

    # Override DB dependency so all routes use the test database
    async def override_get_db():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    settings.ENABLED_PLUGINS = original
    return app


async def probe(app: FastAPI, path: str) -> int:
    """GET <path> against the app, return HTTP status code."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get(path)
        return r.status_code


async def setup_db() -> None:
    """Create all tables in the test database."""
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
    from app.plugins.addresses.models import Address  # noqa
    from app.plugins.ai_chat.models import ChatSession, ChatMessage  # noqa
    from app.plugins.reviews.models import Review  # noqa
    from app.plugins.wishlist.models import WishlistItem  # noqa
    from app.shared.email import EmailLog  # noqa

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def teardown_db() -> None:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


async def run_tests() -> None:
    print("Setting up test database...")
    await setup_db()

    # ──────────────────────────────────────────────────────────────
    # SECTION 1: /api/health always works
    # ──────────────────────────────────────────────────────────────
    print("\n[1] /api/health is always reachable")

    for plugin_set, label in [
        (["auth"], "auth only"),
        (["auth", "products", "categories"], "core trio"),
        (["auth", "cart", "products", "categories", "orders", "checkout",
          "branding", "newsletter", "ai_chat", "wishlist", "reviews"], "large set"),
    ]:
        app = build_app(plugin_set)
        code = await probe(app, "/api/health")
        check(f"/api/health -> 200  [{label}]", code == 200, str(code))

    app_health = build_app(["auth", "products", "categories"])
    transport = httpx.ASGITransport(app=app_health)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        body = (await client.get("/api/health")).json()
    check("health body contains plugins list", "plugins" in body, str(body.get("plugins", "missing")))
    check("health plugins matches what was enabled",
          set(body["plugins"]) == {"auth", "products", "categories"},
          str(body["plugins"]))

    # ──────────────────────────────────────────────────────────────
    # SECTION 2: Enabled plugins -> routes exist (non-404)
    # ──────────────────────────────────────────────────────────────
    print("\n[2] Enabled plugins have accessible routes")

    full_plugins = [
        "auth", "branding", "categories", "products", "cart", "orders",
        "checkout", "coupons", "loyalty", "newsletter", "ai_chat", "rfq",
        "credit", "inventory", "contact", "addresses", "wishlist",
        "reviews", "discount_rules",
    ]
    full_app = build_app(full_plugins)

    # All enabled routes must return non-404 (200, 401, 422, or 500 all prove the route exists)
    for path, plugin in [
        ("/api/categories", "categories"),
        ("/api/products", "products"),
        ("/api/branding", "branding"),
        ("/api/health", "system"),
        ("/api/cart", "cart"),
        ("/api/orders", "orders"),
        ("/api/addresses", "addresses"),
        ("/api/wishlist", "wishlist"),
        ("/api/loyalty/me", "loyalty"),
        ("/api/reviews", "reviews"),
        ("/api/ai_chat/history/test-session", "ai_chat"),
        ("/api/newsletter/subscribe", "newsletter"),
        ("/api/rfq", "rfq"),
        ("/api/credit/me", "credit"),
        ("/api/inventory/warehouses", "inventory"),
    ]:
        code = await probe(full_app, path)
        check(f"GET {path} -> non-404 when enabled", code != 404, f"got {code}")

    # ──────────────────────────────────────────────────────────────
    # SECTION 3: Disabled plugins -> 404 for every route
    # ──────────────────────────────────────────────────────────────
    print("\n[3] Disabled plugins return 404")

    core_only = build_app(["auth", "branding", "categories", "products"])

    for path, plugin in [
        ("/api/cart", "cart"),
        ("/api/orders", "orders"),
        ("/api/checkout", "checkout"),
        ("/api/addresses", "addresses"),
        ("/api/wishlist", "wishlist"),
        ("/api/wishlist/ids", "wishlist"),
        ("/api/loyalty/me", "loyalty"),
        ("/api/reviews", "reviews"),
        ("/api/ai_chat/history/x", "ai_chat"),
        ("/api/newsletter/subscribe", "newsletter"),
        ("/api/rfq", "rfq"),
        ("/api/credit/me", "credit"),
        ("/api/coupons/featured", "coupons"),
        ("/api/inventory/warehouses", "inventory"),
        ("/api/contact", "contact"),
        ("/api/discount_rules", "discount_rules"),
    ]:
        code = await probe(core_only, path)
        check(f"GET {path} -> 404 when {plugin} disabled", code == 404, f"got {code}")

    # ──────────────────────────────────────────────────────────────
    # SECTION 4: Client profile - Simple B2C shop
    # ──────────────────────────────────────────────────────────────
    print("\n[4] Profile: Simple B2C shop")

    b2c = build_app(["auth", "branding", "categories", "products",
                     "cart", "orders", "checkout", "addresses", "newsletter"])

    for path, expected_enabled in [
        ("/api/cart", True),
        ("/api/orders", True),
        ("/api/addresses", True),
        ("/api/newsletter/subscribe", True),
        ("/api/wishlist", False),
        ("/api/loyalty/me", False),
        ("/api/ai_chat/history/x", False),
        ("/api/rfq", False),
        ("/api/reviews", False),
    ]:
        code = await probe(b2c, path)
        if expected_enabled:
            check(f"B2C: {path} -> enabled (non-404)", code != 404, f"got {code}")
        else:
            check(f"B2C: {path} -> disabled (404)", code == 404, f"got {code}")

    # ──────────────────────────────────────────────────────────────
    # SECTION 5: Client profile - B2B enquiry-only (no cart)
    # ──────────────────────────────────────────────────────────────
    print("\n[5] Profile: B2B enquiry-only (no shopping cart)")

    # B2B has orders (for accepted quotes) but no cart / checkout / addresses
    b2b = build_app(["auth", "branding", "categories", "products",
                     "orders", "rfq", "contact", "inventory"])

    for path, expected_enabled in [
        ("/api/rfq", True),
        ("/api/contact", True),
        ("/api/inventory/warehouses", True),
        ("/api/orders", True),
        ("/api/cart", False),
        ("/api/checkout", False),
        ("/api/addresses", False),
        ("/api/wishlist", False),
        ("/api/newsletter/subscribe", False),
    ]:
        code = await probe(b2b, path)
        if expected_enabled:
            check(f"B2B: {path} -> enabled", code != 404, f"got {code}")
        else:
            check(f"B2B: {path} -> disabled", code == 404, f"got {code}")

    # ──────────────────────────────────────────────────────────────
    # SECTION 6: Client profile - Full loyalty + AI shop
    # ──────────────────────────────────────────────────────────────
    print("\n[6] Profile: Full loyalty + AI shop")

    loyalty_ai = build_app([
        "auth", "branding", "categories", "products", "cart", "orders",
        "checkout", "addresses", "wishlist", "loyalty", "reviews",
        "ai_chat", "newsletter", "coupons",
    ])

    for path, expected_enabled in [
        ("/api/ai_chat/history/x", True),
        ("/api/loyalty/me", True),
        ("/api/wishlist", True),
        ("/api/reviews", True),
        ("/api/coupons/featured", True),
        ("/api/rfq", False),
        ("/api/inventory/warehouses", False),
        ("/api/credit/me", False),
    ]:
        code = await probe(loyalty_ai, path)
        if expected_enabled:
            check(f"Loyalty+AI: {path} -> enabled", code != 404, f"got {code}")
        else:
            check(f"Loyalty+AI: {path} -> disabled", code == 404, f"got {code}")

    # ──────────────────────────────────────────────────────────────
    # SECTION 7: Client profile - Minimum viable (auth only)
    # ──────────────────────────────────────────────────────────────
    print("\n[7] Profile: Minimum viable (auth only)")

    minimum = build_app(["auth"])

    for path in [
        "/api/products", "/api/categories", "/api/cart", "/api/orders",
        "/api/branding", "/api/wishlist", "/api/newsletter/subscribe",
    ]:
        code = await probe(minimum, path)
        check(f"Min: {path} -> 404", code == 404, f"got {code}")

    code = await probe(minimum, "/api/health")
    check("Min: /api/health still 200", code == 200, str(code))

    # ──────────────────────────────────────────────────────────────
    # SECTION 8: Plugin dependency enforcement
    # ──────────────────────────────────────────────────────────────
    print("\n[8] Plugin dependency enforcement")

    # checkout depends on cart -- enabling checkout without cart must raise
    raised = False
    try:
        build_app(["auth", "products", "categories", "checkout"])
    except RuntimeError as e:
        raised = "cart" in str(e).lower() or "depends" in str(e).lower() or "checkout" in str(e).lower()
    check("checkout without cart raises RuntimeError", raised)

    # Enabling both cart + checkout is fine
    ok = False
    try:
        build_app(["auth", "products", "categories", "cart", "orders", "checkout"])
        ok = True
    except RuntimeError:
        ok = False
    check("cart + checkout together is valid", ok)

    # ──────────────────────────────────────────────────────────────
    # SECTION 9: Partial plugin sets - individual toggle tests
    # ──────────────────────────────────────────────────────────────
    print("\n[9] Individual plugin enable/disable toggle")

    base = ["auth", "branding", "categories", "products", "cart", "orders",
            "checkout", "addresses"]

    toggle_cases = [
        ("wishlist",   "/api/wishlist"),
        ("loyalty",    "/api/loyalty/me"),
        ("ai_chat",    "/api/ai_chat/history/x"),
        ("newsletter", "/api/newsletter/subscribe"),
        ("reviews",    "/api/reviews"),
        ("coupons",    "/api/coupons/featured"),
        ("rfq",        "/api/rfq"),
        ("inventory",  "/api/inventory/warehouses"),
        ("credit",     "/api/credit/me"),
        ("contact",    "/api/contact"),
    ]

    for plugin, path in toggle_cases:
        app_off = build_app(base)
        code_off = await probe(app_off, path)
        check(f"{plugin} OFF -> {path} is 404", code_off == 404, f"got {code_off}")

        app_on = build_app(base + [plugin])
        code_on = await probe(app_on, path)
        check(f"{plugin} ON  -> {path} is non-404", code_on != 404, f"got {code_on}")

    # ──────────────────────────────────────────────────────────────
    # SUMMARY
    # ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    passed = sum(1 for s, _, _ in results if s == PASS)
    failed = sum(1 for s, _, _ in results if s == FAIL)
    print(f"  {passed} passed   {failed} failed")
    print("=" * 60)

    await teardown_db()

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
