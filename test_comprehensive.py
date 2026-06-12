"""
Comprehensive API tests for CommerceForce bug fixes.
Tests: cart count, checkout with payment_method, order confirmation, orders listing, cart merge.
"""
import urllib.request
import urllib.parse
import urllib.error
import http.cookiejar
import json
import uuid
import sys

BASE = "http://localhost:8000"
PASS = 0
FAIL = 0


def req(method, path, body=None, token=None, expect_status=None, cookie_jar=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    if cookie_jar is not None:
        cookie_jar.add_cookie_header(request)
    try:
        with urllib.request.urlopen(request) as r:
            status = r.status
            if cookie_jar is not None:
                cookie_jar.extract_cookies(r, request)
            try:
                result = json.loads(r.read())
            except Exception:
                result = {}
            if expect_status and status != expect_status:
                return None, status
            return result, status
    except urllib.error.HTTPError as e:
        status = e.code
        if cookie_jar is not None:
            try:
                cookie_jar.extract_cookies(e, request)
            except Exception:
                pass
        try:
            result = json.loads(e.read())
        except Exception:
            result = {}
        if expect_status and status != expect_status:
            return None, status
        return result, status

def check(label, condition, detail=""):
    global PASS, FAIL
    if condition:
        print(f"  PASS  {label}")
        PASS += 1
    else:
        print(f"  FAIL  {label}{' -- ' + str(detail) if detail else ''}")
        FAIL += 1

# ─── Helpers ────────────────────────────────────────────────────────────────

def get_product():
    """Get first available product."""
    res, _ = req("GET", "/api/products?page_size=5")
    items = res.get("items", []) if res else []
    return items[0] if items else None

def register_user():
    """Create a fresh test user and return (user, token)."""
    uid = uuid.uuid4().hex[:8]
    email = f"test_{uid}@test.com"
    body = {"email": email, "password": "Test1234!", "first_name": "Test", "last_name": "User"}
    res, status = req("POST", "/api/auth/register", body)
    if status not in (200, 201):
        return None, None
    return res.get("user"), res.get("access_token")

def clear_cart(token):
    """Remove all items from the user's cart."""
    cart, _ = req("GET", "/api/cart", token=token)
    for item in (cart or {}).get("items", []):
        req("DELETE", f"/api/cart/items/{item['product_id']}", token=token)

# ─── Test suites ─────────────────────────────────────────────────────────────

def test_cart_count():
    print("\n== Cart count tests ==")
    _, token = register_user()
    if not token:
        check("register user", False, "registration failed")
        return

    product = get_product()
    if not product:
        check("get product", False, "no products found")
        return

    pid = str(product["id"])

    # Add item once
    res, status = req("POST", "/api/cart/items", {"product_id": pid, "quantity": 1}, token=token)
    check("add item (qty=1) -> 2xx", status in (200, 201), f"status={status}")

    cart, _ = req("GET", "/api/cart", token=token)
    item_count = (cart or {}).get("item_count", 0)
    check("item_count = 1 after first add", item_count == 1, f"got {item_count}")

    # Add same item again (simulate double-click race – should be qty=2, count=2)
    res, status = req("POST", "/api/cart/items", {"product_id": pid, "quantity": 1}, token=token)
    check("add same item again -> 2xx", status in (200, 201), f"status={status}")

    cart, _ = req("GET", "/api/cart", token=token)
    item_count = (cart or {}).get("item_count", 0)
    items = (cart or {}).get("items", [])
    total_qty = sum(i["quantity"] for i in items)
    check("item_count = 2 after second add", item_count == 2, f"got {item_count}")
    check("total quantity = 2 after second add", total_qty == 2, f"got {total_qty}")

    # Update to quantity 3
    req("PUT", f"/api/cart/items/{pid}", {"quantity": 3}, token=token)
    cart, _ = req("GET", "/api/cart", token=token)
    item_count = (cart or {}).get("item_count", 0)
    check("item_count = 3 after update to qty 3", item_count == 3, f"got {item_count}")

    # Remove item
    req("DELETE", f"/api/cart/items/{pid}", token=token)
    cart, _ = req("GET", "/api/cart", token=token)
    item_count = (cart or {}).get("item_count", 0)
    check("item_count = 0 after remove", item_count == 0, f"got {item_count}")


def test_checkout_payment_methods():
    print("\n== Checkout + payment method tests ==")
    _, token = register_user()
    if not token:
        check("register user", False, "registration failed"); return

    product = get_product()
    if not product:
        check("get product", False, "no products found"); return

    pid = str(product["id"])
    clear_cart(token)

    # Add item
    req("POST", "/api/cart/items", {"product_id": pid, "quantity": 1}, token=token)

    # Checkout with cash
    body = {
        "payment_method": "cash",
        "shipping_address": "1 Test Street, Test City, TC 1234",
    }
    res, status = req("POST", "/api/checkout", body, token=token)
    check("checkout with payment_method=cash -> 201", status == 201, f"status={status}, body={res}")
    if status == 201:
        check("response has order_id", bool(res.get("order_id")), str(res))
        check("response has order_number", bool(res.get("order_number")), str(res))
        order_number = res.get("order_number", "")
        check("order_number starts with CF-", order_number.startswith("CF-"), order_number)
        check("payment_status = paid (cash-on-delivery)", res.get("payment_status") == "paid", str(res))

    # credit_limit requires a credit account — 404 is expected when none exists
    clear_cart(token)
    req("POST", "/api/cart/items", {"product_id": pid, "quantity": 1}, token=token)
    body2 = {
        "payment_method": "credit_limit",
        "shipping_address": "1 Test Street, Test City, TC 1234",
    }
    res2, status2 = req("POST", "/api/checkout", body2, token=token)
    check("checkout with credit_limit -> 404 (no account) or 201 (has account)", status2 in (201, 404), f"status={status2}, body={res2}")

    # Checkout without payment_method (defaults to cash)
    clear_cart(token)
    req("POST", "/api/cart/items", {"product_id": pid, "quantity": 1}, token=token)
    body3 = {"shipping_address": "1 Test Street, Test City, TC 1234"}
    res3, status3 = req("POST", "/api/checkout", body3, token=token)
    check("checkout without payment_method defaults to cash -> 201", status3 == 201, f"status={status3}")


def test_orders_listing():
    print("\n== Orders listing tests ==")
    _, token = register_user()
    if not token:
        check("register user", False, "registration failed"); return

    product = get_product()
    if not product:
        check("get product", False, "no products found"); return

    pid = str(product["id"])

    # Place an order first
    req("POST", "/api/cart/items", {"product_id": pid, "quantity": 1}, token=token)
    res, status = req("POST", "/api/checkout", {
        "payment_method": "cash",
        "shipping_address": "1 Test Street, TC 1234",
    }, token=token)
    check("place order before listing -> 201", status == 201, f"status={status}")

    order_id = res.get("order_id") if res else None

    # List orders
    list_res, list_status = req("GET", "/api/orders?page_size=50", token=token)
    check("GET /api/orders -> 200", list_status == 200, f"status={list_status}")

    if list_status == 200:
        items = (list_res or {}).get("items", [])
        check("orders list is non-empty", len(items) > 0, f"got {len(items)}")
        if items:
            first = items[0]
            check("order has order_number", bool(first.get("order_number")), str(first))
            check("order has status", bool(first.get("status")), str(first))
            check("order has total", first.get("total") is not None, str(first))

    # Get individual order
    if order_id:
        ord_res, ord_status = req("GET", f"/api/orders/{order_id}", token=token)
        check(f"GET /api/orders/{order_id[:8]}... -> 200", ord_status == 200, f"status={ord_status}")
        if ord_status == 200:
            check("order detail has items", bool((ord_res or {}).get("items")), str(ord_res))
            check("order detail has order_number", bool((ord_res or {}).get("order_number")), str(ord_res))


def test_guest_checkout():
    print("\n== Guest checkout tests ==")
    product = get_product()
    if not product:
        check("get product", False, "no products found"); return

    pid = str(product["id"])
    jar = http.cookiejar.CookieJar()

    # Add to guest cart (no token) — server sets session cookie
    res, status = req("POST", "/api/cart/items", {"product_id": pid, "quantity": 1}, cookie_jar=jar)
    check("add to guest cart -> 2xx", status in (200, 201), f"status={status}")

    # Guest checkout — must send same session cookie so server finds the cart
    body = {
        "payment_method": "cash",
        "guest_email": f"guest_{uuid.uuid4().hex[:6]}@test.com",
        "shipping_address": "1 Guest Street, GC 9999",
    }
    res, status = req("POST", "/api/checkout", body, cookie_jar=jar)
    check("guest checkout -> 201", status == 201, f"status={status}, body={res}")
    if status == 201:
        check("guest order has order_number", bool(res.get("order_number")), str(res))


def test_cart_merge():
    print("\n== Cart merge after login ==")
    product = get_product()
    if not product:
        check("get product", False, "no products found"); return

    pid = str(product["id"])
    jar = http.cookiejar.CookieJar()

    # Register a user first
    uid = uuid.uuid4().hex[:8]
    email = f"merge_{uid}@test.com"
    body = {"email": email, "password": "Test1234!", "first_name": "Merge", "last_name": "Test"}
    res, status = req("POST", "/api/auth/register", body)
    if status not in (200, 201):
        check("register user for merge test", False, f"status={status}"); return
    token = res.get("access_token")
    # Clear any existing cart and logout
    clear_cart(token)
    req("POST", "/api/auth/logout", token=token)

    # Add item as guest — using the same cookie jar to track the session
    guest_res, status = req("POST", "/api/cart/items", {"product_id": pid, "quantity": 2}, cookie_jar=jar)
    check("add to guest cart before login", status in (200, 201), f"status={status}")

    # Login
    login_res, login_status = req("POST", "/api/auth/login", {"email": email, "password": "Test1234!"})
    check("login succeeds", login_status == 200, f"status={login_status}")
    if login_status != 200:
        return
    token = login_res.get("access_token")

    # Merge cart — pass the session cookie so the server can find the guest cart
    merge_res, merge_status = req("POST", "/api/cart/merge", token=token, cookie_jar=jar)
    check("POST /api/cart/merge -> 200", merge_status == 200, f"status={merge_status}")

    cart, _ = req("GET", "/api/cart", token=token)
    item_count = (cart or {}).get("item_count", 0)
    check("merged cart has items", item_count > 0, f"item_count={item_count}")


def test_auth_endpoints():
    print("\n== Auth endpoints ==")
    uid = uuid.uuid4().hex[:8]
    email = f"auth_{uid}@test.com"

    # Register
    res, status = req("POST", "/api/auth/register", {
        "email": email, "password": "Auth1234!",
        "first_name": "Auth", "last_name": "Test"
    })
    check("register -> 200/201", status in (200, 201), f"status={status}")
    token = res.get("access_token") if res else None

    # Me endpoint
    if token:
        me, status = req("GET", "/api/auth/me", token=token)
        check("GET /api/auth/me -> 200", status == 200, f"status={status}")
        check("me.email matches", (me or {}).get("email") == email, str(me))

    # Logout
    if token:
        _, status = req("POST", "/api/auth/logout", token=token)
        check("logout -> 204", status == 204, f"status={status}")

    # Login again
    res2, status2 = req("POST", "/api/auth/login", {"email": email, "password": "Auth1234!"})
    check("login after logout -> 200", status2 == 200, f"status={status2}")

    # Forgot password (no-enumeration — always 204)
    _, fp_status = req("POST", "/api/auth/forgot-password", {"email": email})
    check("forgot-password known email -> 204", fp_status == 204, f"status={fp_status}")
    _, fp_status2 = req("POST", "/api/auth/forgot-password", {"email": "nobody@example.com"})
    check("forgot-password unknown email -> 204 (no enumeration)", fp_status2 == 204, f"status={fp_status2}")


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("CommerceForce — Comprehensive API Tests")
    print("=" * 55)

    # Quick health check
    try:
        res, status = req("GET", "/api/products?page_size=1")
        if status != 200:
            print(f"\nERROR: Backend not reachable (status={status}). Start backend first.")
            sys.exit(1)
        print(f"\nBackend online ({BASE})")
    except Exception as e:
        print(f"\nERROR: Backend not reachable: {e}")
        sys.exit(1)

    test_auth_endpoints()
    test_cart_count()
    test_checkout_payment_methods()
    test_orders_listing()
    test_guest_checkout()
    test_cart_merge()

    print("\n" + "=" * 55)
    total = PASS + FAIL
    print(f"Results: {PASS}/{total} passed", "✅" if FAIL == 0 else "❌")
    if FAIL > 0:
        print(f"         {FAIL} FAILED")
    print("=" * 55)
    sys.exit(0 if FAIL == 0 else 1)
