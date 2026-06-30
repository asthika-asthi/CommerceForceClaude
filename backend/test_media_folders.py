"""
Tests for directory-based media upload, listing, and delete.
"""
import io
import os
import sys
import shutil
from pathlib import Path
from types import SimpleNamespace

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_media_run.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Define test upload dir early — must exist before app.main imports it
TEST_UPLOAD_DIR = Path(__file__).parent / "test_uploads_tmp"
TEST_UPLOAD_DIR.mkdir(exist_ok=True)

# Import all plugin models so Base.metadata includes them all (no app.main yet)
import app.plugins.auth.models  # noqa
import app.plugins.branding.models  # noqa
import app.plugins.categories.models  # noqa
import app.plugins.products.models  # noqa
import app.plugins.orders.models  # noqa
import app.plugins.cart.models  # noqa
import app.plugins.coupons  # noqa
import app.plugins.loyalty.models  # noqa
import app.plugins.newsletter.models  # noqa
import app.plugins.landing_page  # noqa
import app.plugins.rfq.models  # noqa
import app.plugins.credit.models  # noqa
import app.plugins.inventory.models  # noqa
import app.plugins.contact  # noqa
import app.plugins.addresses  # noqa
import app.plugins.wishlist  # noqa
import app.plugins.reviews  # noqa
import app.plugins.discount_rules  # noqa
import app.shared.email  # noqa

# Patch UPLOAD_DIR BEFORE importing app.main.
# main.py does `from app.routers.media import UPLOAD_DIR as _UPLOAD_DIR` and immediately
# uses it for the StaticFiles mount.  Patching here means both the endpoint functions
# *and* the StaticFiles mount end up pointing at our test directory.
import app.routers.media as media_module
media_module.UPLOAD_DIR = TEST_UPLOAD_DIR

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402  (imports after patch intentional)
from app.core.dependencies import get_current_user  # noqa: E402

# Override the auth dependency so all admin endpoints accept requests without a real token.
# require_admin() → require_role(...) → _check(current_user=Depends(get_current_user))
# Replacing get_current_user breaks the entire auth chain cleanly.
app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
    id="test-admin", role="admin", is_active=True
)

client = TestClient(app)

# ──────────────────────────────────────────────────────────
# PASS / FAIL helper (sync — TestClient is synchronous)
# ──────────────────────────────────────────────────────────
PASS = "PASS"
FAIL = "FAIL"
results: list[tuple[str, str, str]] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    suffix = f"  ({detail})" if detail else ""
    print(f"  {status}  {label}{suffix}")


# ──────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────
def run_tests() -> None:

    # ── [1] Upload to root (no folder) ────────────────────
    print("\n[1] Upload to root (no folder)")
    img = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    resp = client.post("/api/media/upload", files={"file": ("root-test.png", img, "image/png")})
    check("Status 200", resp.status_code == 200, str(resp.status_code))
    url = resp.json().get("url", "")
    check("URL contains /uploads/root-test.png", "/uploads/root-test.png" in url, url)
    check("File exists on disk", (TEST_UPLOAD_DIR / "root-test.png").exists())

    # ── [2] Upload to folder=products ─────────────────────
    print("\n[2] Upload to folder=products")
    img2 = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    resp2 = client.post(
        "/api/media/upload?folder=products",
        files={"file": ("tshirt.png", img2, "image/png")},
    )
    check("Status 200", resp2.status_code == 200, str(resp2.status_code))
    url2 = resp2.json().get("url", "")
    check("URL contains /uploads/products/tshirt.png", "/uploads/products/tshirt.png" in url2, url2)
    check(
        "File exists at products/tshirt.png",
        (TEST_UPLOAD_DIR / "products" / "tshirt.png").exists(),
    )

    # ── [3] Invalid folder name rejected ──────────────────
    print("\n[3] Invalid folder name rejected")
    img3 = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    resp3 = client.post(
        "/api/media/upload?folder=../../etc",
        files={"file": ("hack.png", img3, "image/png")},
    )
    check("Status 400 for traversal folder", resp3.status_code == 400, str(resp3.status_code))

    # ── [4] List files — recursive ────────────────────────
    print("\n[4] File listing is recursive")
    resp4 = client.get("/api/media/files")
    check("Status 200", resp4.status_code == 200, str(resp4.status_code))
    files = resp4.json()
    filenames = [f["filename"] for f in files]
    check("root-test.png in listing", "root-test.png" in filenames, str(filenames))
    check("products/tshirt.png in listing", "products/tshirt.png" in filenames, str(filenames))

    # ── [5] Direct file copy appears in listing ───────────
    print("\n[5] Direct file copy appears in listing")
    brands_dir = TEST_UPLOAD_DIR / "brands"
    brands_dir.mkdir(exist_ok=True)
    (brands_dir / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)

    resp5 = client.get("/api/media/files")
    filenames5 = [f["filename"] for f in resp5.json()]
    check("brands/logo.png appears without upload", "brands/logo.png" in filenames5, str(filenames5))

    # ── [6] Static file serving ───────────────────────────
    print("\n[6] Copied file served via StaticFiles")
    resp6 = client.get("/uploads/brands/logo.png")
    check(
        "File served at /uploads/brands/logo.png",
        resp6.status_code == 200,
        str(resp6.status_code),
    )

    # ── [7] Directory listing blocked ─────────────────────
    print("\n[7] Directory listing blocked")
    resp7 = client.get("/uploads/")
    check(
        "/uploads/ returns 404 (not directory listing)",
        resp7.status_code == 404,
        str(resp7.status_code),
    )
    resp7b = client.get("/uploads/products/")
    check(
        "/uploads/products/ returns 404",
        resp7b.status_code == 404,
        str(resp7b.status_code),
    )

    # ── [8] Delete file in subfolder ──────────────────────
    print("\n[8] Delete file in subfolder")
    resp8 = client.delete("/api/media/files/products/tshirt.png")
    check("Delete returns 200", resp8.status_code == 200, str(resp8.status_code))
    check(
        "File removed from disk",
        not (TEST_UPLOAD_DIR / "products" / "tshirt.png").exists(),
    )

    resp8b = client.get("/api/media/files")
    filenames8 = [f["filename"] for f in resp8b.json()]
    check(
        "Deleted file not in listing",
        "products/tshirt.png" not in filenames8,
        str(filenames8),
    )

    # ── [9] Delete non-existent file returns 404 ──────────
    print("\n[9] Delete non-existent file")
    resp9 = client.delete("/api/media/files/products/ghost.png")
    check("404 for non-existent file", resp9.status_code == 404, str(resp9.status_code))

    # ── [10] Path traversal in delete blocked ─────────────
    print("\n[10] Path traversal in delete blocked")
    resp10 = client.delete("/api/media/files/../../../etc/passwd")
    check(
        "Traversal attempt blocked",
        resp10.status_code in (400, 404),
        str(resp10.status_code),
    )

    # ── [11] Overwrite — re-upload same filename replaces it
    print("\n[11] Overwrite existing file")
    img11a = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"ORIGINAL")
    client.post(
        "/api/media/upload?folder=products",
        files={"file": ("ow-test.png", img11a, "image/png")},
    )
    original_content = (TEST_UPLOAD_DIR / "products" / "ow-test.png").read_bytes()

    img11b = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"REPLACED")
    client.post(
        "/api/media/upload?folder=products",
        files={"file": ("ow-test.png", img11b, "image/png")},
    )
    new_content = (TEST_UPLOAD_DIR / "products" / "ow-test.png").read_bytes()

    check("File content replaced on re-upload", original_content != new_content, "content unchanged")
    check("New content is correct", b"REPLACED" in new_content, str(new_content[:30]))

    # ── SUMMARY ───────────────────────────────────────────
    print("\n" + "=" * 54)
    passed = sum(1 for s, _, _ in results if s == PASS)
    failed = sum(1 for s, _, _ in results if s == FAIL)
    print(f"  {passed} passed   {failed} failed")
    print("=" * 54)

    # Clean up test uploads dir and test DB
    if TEST_UPLOAD_DIR.exists():
        shutil.rmtree(TEST_UPLOAD_DIR)
    if os.path.exists("test_media_run.db"):
        os.remove("test_media_run.db")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
