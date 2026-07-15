# CommerceForce Plugin Reference

> Last updated: 2026-07-15

This document covers every plugin available in CommerceForce: what it contributes to the admin panel, what customers see on the storefront, what breaks when it is disabled, and which ideal customer profiles rely on it most.

---

## Table of Contents

1. [Platform Base (Always-On)](#platform-base-always-on)
2. [Plugin Catalogue](#plugin-catalogue)
   - [Cart](#1-cart)
   - [Orders](#2-orders)
   - [Coupons](#3-coupons)
   - [Loyalty Points](#4-loyalty-points)
   - [Newsletter](#5-newsletter)
   - [RFQ (Request for Quote)](#6-rfq-request-for-quote)
   - [AI Chat](#7-ai-chat)
   - [Credit Accounts](#8-credit-accounts-b2b)
   - [Inventory](#9-inventory-warehouse--stock)
3. [Plugin Dependency Map](#plugin-dependency-map)
4. [Validated ENABLED_PLUGINS Combinations](#validated-enabled_plugins-combinations)
5. [Ideal Customer Profiles](#ideal-customer-profiles)
   - [Profile Matrix](#profile-plugin-matrix)
6. [Scenario: Non-E-commerce Site](#scenario-non-e-commerce-site)
7. [Booking & Scheduling](#booking--scheduling)

---

## Platform Base (Always-On)

**Products & Categories** are not plugins — they are permanently enabled and form the foundation of every site.

| Layer | What It Provides |
|---|---|
| **Admin** | Products list, product create/edit, categories, media/image upload, branding config |
| **Customer** | Product listing pages, product detail, category browsing, search |

All plugins build on top of this base. A site with no plugins enabled is a read-only product catalogue.

---

## Plugin Catalogue

---

### 1. Cart

**Type:** Essential — required for any transactional e-commerce flow.

#### Admin Panel
No dedicated admin UI. Cart state is customer-facing only.

#### Customer Storefront

| Element | When It Appears |
|---|---|
| Cart icon + badge in navbar | Always (plugin enabled) |
| "Add to cart" button on product cards and detail pages | Always (plugin enabled) |
| `/cart` page — items, quantities, totals, order summary | Always (plugin enabled) |
| Badge count showing "9+" | When cart has more than 9 items |
| Guest cart (cookie-based, 30-day) | When customer is not logged in |
| Cart merge on login | When guest logs in — guest items merge into account cart |

#### If Disabled
Cart icon and "Add to cart" disappear. The entire purchase flow is broken. Orders plugin also stops working (nothing to check out).

#### Key Technical Details
- Guest cart stored in a secure HttpOnly cookie (`guest_session`, 30-day max age)
- On login, guest cart merges automatically into the user's account cart
- No admin visibility into individual carts

---

### 2. Orders

**Type:** Essential — required alongside Cart for any transactional e-commerce flow.

#### Admin Panel

| Menu Item | Detail |
|---|---|
| Orders list | Paginated (20/page), shows order number, date, customer, total, status |
| Order detail | Full line items, customer info, shipping address, payment method, payment status |
| Status management | Change order status: pending → confirmed → processing → shipped → delivered → cancelled |
| Guest order tracking | Orders tied to guest email, not user account |

#### Customer Storefront

| Element | When It Appears |
|---|---|
| "My Orders" in `/account` | Always (logged-in, plugin enabled) |
| Order history with status badges | Always (logged-in) |
| Individual order detail page | Always (logged-in) |
| Recent orders summary on account home | Always (logged-in, shows last 5) |
| Cancel order button | When order status allows cancellation |

#### Order Data Captured at Time of Purchase
Product name, SKU, unit price, quantity, subtotal — snapshot is preserved even if product is later edited or deleted.

#### If Disabled
Checkout cannot complete. Order history disappears from account page.

---

### 3. Coupons

**Type:** Optional — marketing and conversion enhancement.

#### Admin Panel

| Menu Item | Detail |
|---|---|
| Coupons list | Code, name, type (% or fixed), value, used/max uses, expiry, active status |
| Create coupon | Inline form: code, name, discount type, value, min order value, max uses, expiry |
| Deactivate coupon | Soft disable (no hard delete, usage history preserved) |

#### Customer Storefront

| Element | When It Appears |
|---|---|
| Coupon code input at checkout | Always (plugin enabled) |
| Discount line in order summary | After a valid code is entered |

#### Coupon Rules
- Percentage or fixed amount discount
- Minimum order value threshold (optional)
- Maximum uses across all customers (optional)
- Per-customer usage tracked to prevent reuse
- Expires on a set date (optional)

#### If Disabled
Coupon input field renders (it is part of the checkout page, not the plugin) but validation fails. No discounts can be applied.

---

### 4. Loyalty Points

**Type:** Optional — customer retention and repeat purchase incentive.

#### Admin Panel

| Menu Item | Detail |
|---|---|
| Loyalty config | Current rates: points per £1 spent, redemption rate (e.g., 100 pts = £1), minimum points to redeem |
| Edit rates | Update earning rate, redemption rate, minimum threshold |
| Toggle active/inactive | Pause the programme without deleting data |
| Manual adjust | Add or remove points from a specific customer account |

#### Customer Storefront

| Element | When It Appears |
|---|---|
| Loyalty points card on `/account` home | Always (logged-in, plugin enabled, programme active) |
| Current balance (large display) | Always (logged-in) |
| Total earned / total redeemed stats | Always (logged-in) |
| Points redemption input at checkout | Logged-in users only, programme active |

#### Points Lifecycle
1. Customer places order
2. Order reaches "completed" status
3. Points credited automatically at configured rate
4. Customer redeems points at checkout to reduce total

#### If Disabled
Points card and redemption input disappear. Points are not earned on orders. Existing balances are preserved but inaccessible.

---

### 5. Newsletter

**Type:** Optional — email list building and marketing.

#### Admin Panel

| Menu Item | Detail |
|---|---|
| Subscribers list | Email, first name, status (active / unsubscribed) |
| Filter toggle | Show active only, or all including unsubscribed |
| Subscriber count | Shown in page header |

> Note: The admin panel shows subscriber data only. Email composition and sending is handled by an external tool (e.g. Mailchimp, Brevo) connected via export or API.

#### Customer Storefront

| Element | When It Appears |
|---|---|
| Subscribe form | Where a newsletter block is placed on a landing page (superadmin configures) |
| Unsubscribe link | In every email sent (one-click token URL, safe for email clients) |

#### If Disabled
Subscribe form submissions fail (API returns 404). Admin subscriber list disappears.

---

### 6. RFQ (Request for Quote)

**Type:** Optional — B2B sales workflow and custom quoting.

#### Admin Panel

| Menu Item | Detail |
|---|---|
| Quotes / RFQ list | All customer RFQs, filterable by status |
| Mark as under review | Acknowledge receipt |
| Provide quoted prices | Fill in quoted price per line item |
| Reject RFQ | With optional reason |

#### Customer Storefront

| Element | When It Appears |
|---|---|
| "Request a Quote" entry point | On product pages or account (where placed by superadmin) |
| Create draft RFQ | Add items with requested quantities |
| Submit RFQ for review | Change status from draft to submitted |
| View RFQ status | Track progress in account |
| See quoted prices | When admin provides a quote |
| Accept or reject quote | Customer decision after review |

#### RFQ Status Workflow
```
draft → submitted → under_review → quoted → accepted / rejected / expired
```
Accepting a quote automatically creates an Order record.

#### If Disabled
No quote workflow. B2B customers must use standard cart and checkout (if enabled) or contact the business offline.

---

### 7. AI Chat

**Type:** Optional — customer support and engagement.

#### Admin Panel
None. Conversations are not stored server-side — there is nothing to manage.

#### Customer Storefront

| Element | When It Appears |
|---|---|
| Floating chat widget (bottom-right) | Every page, all users (logged in and guest) |
| AI response | Powered by configured LLM via OpenRouter |

#### Technical Notes
- Stateless: conversation history is held in browser memory only
- Refreshing the page starts a fresh conversation
- Model is configurable via environment variable
- No conversation logging or audit trail

#### If Disabled
Chat widget does not render anywhere on the site.

---

### 8. Credit Accounts (B2B)

**Type:** Optional — B2B invoicing and account-based payment.

#### Admin Panel

| Menu Item | Detail |
|---|---|
| Credit accounts list | Customer name, credit limit, used credit, available credit, active/inactive |
| Create account | Assign to user, set credit limit, add notes |
| Edit account | Adjust limit, toggle active, update notes |

> Available credit is calculated in real time: `credit_limit − used_credit`

#### Customer Storefront

| Element | When It Appears |
|---|---|
| "Credit Account" payment option at checkout | Logged-in users with an active credit account |
| Available credit balance display | Same condition as above |

#### If Disabled
Credit payment option disappears from checkout. Only remaining payment methods are cash (COD) and Stripe. Existing credit account data is preserved.

---

### 9. Inventory (Warehouse & Stock)

**Type:** Optional — multi-location stock management.

#### Admin Panel

| Menu Item | Detail |
|---|---|
| Warehouses list | Name, code, address, active status, default flag |
| Create warehouse | Name, code, address, set as default |
| Stock table per warehouse | Product, quantity on hand, reserved, available, low-stock threshold |
| Set stock | Absolute quantity for a product in a warehouse |
| Adjust stock | Delta (+/-) for quick corrections |

> Available quantity = on hand − reserved (reserved = items in open, unfulfilled orders)

#### Customer Storefront

| Element | When It Appears |
|---|---|
| "In Stock" / "Out of Stock" on product detail | Always (plugin enabled) |
| "Only X left" warning | When available quantity < low-stock threshold |
| Quantity selector capped at available stock | In cart |
| "Add to Cart" disabled | When product is out of stock |

#### If Disabled
No stock checks. Customers can add unlimited quantity of any product. Risk of overselling. No "out of stock" state.

---

## Plugin Dependency Map

The backend enforces plugin dependencies at startup (`app/core/plugin_registry.py`) — if a plugin's `depends_on` isn't also present in `ENABLED_PLUGINS`, the app refuses to boot with a `RuntimeError` naming the missing dependency. This is the authoritative, code-derived dependency graph for every plugin (read from each plugin's `manifest.py`):

| Plugin | Depends on |
|---|---|
| `auth`, `branding`, `categories`, `landing_page`, `ai_chat`, `announcements`, `coupons`, `credit`, `discount_rules`, `loyalty`, `newsletter`, `promotions`, `shipping`, `tax` | *(none)* |
| `products` | `categories` |
| `cart` | `products` |
| `orders` | `products` |
| `inventory` | `products` |
| `contact` | `branding` |
| `addresses` | `auth` |
| `scheduling` | `auth` |
| `wishlist` | `auth`, `products` |
| `rfq` | `orders` |
| `checkout` | `cart`, `orders` |
| `reviews` | `auth`, `products`, `orders` |

Dependencies are transitive — e.g. enabling `checkout` requires `cart` + `orders`, which in turn require `products`, which requires `categories`.

**Minimum configuration for a selling e-commerce site:** `auth,categories,products,cart,orders,checkout`

**Minimum for a B2B quoting site:** `auth,categories,products,orders,rfq`

**Minimum for a brochure / catalogue site:** `auth,categories,products` *(optionally + `newsletter`, `ai_chat`, `landing_page`, `branding`)*

---

## Validated ENABLED_PLUGINS Combinations

Each combination below was booted for real against the plugin registry (`register_plugins()` succeeds — no missing-dependency errors) and every enabled plugin's primary route was probed and confirmed reachable (non-404). Verified 2026-07-15 against `master` (commit `cd28e47`).

| Combination | `ENABLED_PLUGINS` | Use case |
|---|---|---|
| **Minimum viable** | `auth` | Admin-only / pre-launch staging, no storefront content yet |
| **Catalogue only** | `auth,branding,categories,products,landing_page` | Browsable catalogue, no selling — see [Scenario: Non-E-commerce Site](#scenario-non-e-commerce-site) |
| **Catalogue + engagement** | `auth,branding,categories,products,landing_page,newsletter,ai_chat,contact` | Catalogue site that also captures leads and answers questions |
| **Standard B2C** | `auth,branding,categories,products,cart,orders,checkout,addresses,newsletter,coupons` | Full transactional storefront — Profile 1/7/11 (standard e-commerce, local retailer, print-on-demand) |
| **Full retail + loyalty/AI** | `auth,branding,categories,products,cart,orders,checkout,addresses,wishlist,loyalty,reviews,coupons,newsletter,ai_chat,landing_page` | Retailer investing in retention and repeat purchase — Profile 6/8/9 |
| **B2B wholesale** | `auth,branding,categories,products,orders,rfq,credit,inventory,contact` | Quote-driven B2B sales with credit terms and multi-warehouse stock — Profile 3/4 |
| **Service business with booking** | `auth,branding,categories,products,scheduling,contact,landing_page` | Appointment-based service (salons, consultants, photographers) using the `scheduling` plugin instead of the old RFQ workaround — Profile 5 |
| **Multi-location retailer** | `auth,branding,categories,products,cart,orders,checkout,addresses,inventory,loyalty,newsletter,coupons,shipping,tax` | Regional chain needing per-warehouse stock, shipping zones, tax zones — Profile 12 |
| **Kitchen sink (all plugins)** | `auth,branding,categories,products,landing_page,cart,orders,checkout,addresses,wishlist,loyalty,reviews,coupons,newsletter,ai_chat,rfq,credit,inventory,contact,scheduling,shipping,tax,promotions,announcements,discount_rules` | Sanity check that every plugin can be enabled simultaneously with no conflicts |

> **Note:** plugin names in `ENABLED_PLUGINS` are case-sensitive and must exactly match the directory name under `backend/app/plugins/` (e.g. `categories`, not `Categories`) — a mismatch fails startup with `RuntimeError: Plugin '<name>' listed in ENABLED_PLUGINS but not found`.

> **Note:** the live `backend/.env` (as of this writing) enables 20 plugins but predates `scheduling`, `shipping`, `tax`, `promotions`, and `announcements` — none of those five are currently on in production. Add them to `ENABLED_PLUGINS` there if/when a deployment needs them.

---

## Ideal Customer Profiles

| # | Profile | Description |
|---|---|---|
| 1 | **Standard E-commerce** | B2C retailer selling physical or digital goods online. Full transactional stack needed. |
| 2 | **Catalogue / Display Only** | Shows products for awareness only — no online selling. Could be a manufacturer, distributor directory, or portfolio of goods. |
| 3 | **B2B Quoting** | Artists, studios, custom manufacturers, creative agencies. Customers browse, then request a custom quote. No fixed-price cart. |
| 4 | **Wholesale / Trade Supplier** | Sells to registered businesses. Needs credit accounts, RFQ for large orders, multi-warehouse inventory. May hide prices from unregistered visitors. |
| 5 | **Service Business with a Catalogue** | Photographers, interior designers, consultants, wedding planners. "Products" are service packages. No fulfilment or shipping. Lead capture via RFQ or newsletter. |
| 6 | **Digital Goods Seller** | Sells software, music, ebooks, design assets. Full cart and orders but zero inventory management (no physical stock). Coupons for launch promotions; loyalty for repeat buyers. |
| 7 | **Local / Small Retailer Going Online** | Corner shop, butcher, florist, independent boutique. Needs full e-commerce with simple inventory. Not technically sophisticated — simplicity is the priority. |
| 8 | **Event / Ticket Seller** | Products are event tickets (fixed inventory = seat count). No shipping. Loyalty rewards repeat attendees. Newsletter promotes upcoming events. |
| 9 | **Non-Profit / Charity** | Sells branded merchandise or fundraising products. Newsletter for donor communication; loyalty to recognise repeat supporters. |
| 10 | **Rental / Hire Business** | Equipment hire, furniture rental, event staging. "Products" are hire items; "price" is a daily/weekly rate. RFQ for large events; catalogue for standard items. |
| 11 | **Print-on-Demand / Custom Order** | T-shirt printing, engraving, bespoke gifts. Standard items go through cart; custom specifications handled via RFQ. |
| 12 | **Multi-location Retailer** | Regional chain with multiple branches. Inventory per warehouse/branch. Cross-branch loyalty points. Most operationally demanding profile. |

---

### Profile–Plugin Matrix

| Profile | Cart | Orders | RFQ | Credit | Inventory | Loyalty | Newsletter | AI Chat | Coupons |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Standard e-commerce | ✓ | ✓ | — | — | opt | opt | opt | opt | opt |
| Catalogue / display only | — | — | — | — | — | — | opt | opt | — |
| B2B quoting | — | — | ✓ | — | — | — | opt | opt | — |
| Wholesale / trade supplier | opt | opt | ✓ | ✓ | ✓ | — | — | — | — |
| Service business | — | — | ✓ | — | — | — | ✓ | ✓ | — |
| Digital goods seller | ✓ | ✓ | — | — | — | ✓ | ✓ | — | ✓ |
| Local / small retailer | ✓ | ✓ | — | — | ✓ | — | opt | — | opt |
| Event / ticket seller | ✓ | ✓ | — | — | ✓ | opt | ✓ | — | opt |
| Non-profit / charity | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — |
| Rental / hire | — | — | ✓ | — | — | — | ✓ | — | — |
| Print-on-demand | ✓ | ✓ | ✓ | — | opt | — | — | — | — |
| Multi-location retailer | ✓ | ✓ | — | opt | ✓ | ✓ | ✓ | opt | opt |

> **opt** = optional but commonly used by this profile

---

## Scenario: Non-E-commerce Site

> "If only Newsletter + Products + Categories are enabled, does the cart icon appear?"

**No.** The cart icon in the navbar is rendered conditionally — it only appears when the Cart plugin is active.

With only Products + Categories + Newsletter enabled, the customer sees:

- Product listing and detail pages (image, description, reference price)
- Category navigation
- Newsletter signup form (where placed on a landing page)
- No cart icon, no "Add to cart" button, no checkout, no account orders section

This is a valid and complete use case: a **digital catalogue with email list building**.

---

## Booking & Scheduling

> Previously documented here as a platform gap. The `scheduling` plugin (developed on `feat/scheduling-plugin`) has since been merged into `master` and is available today — this section is updated to reflect that.

The `scheduling` plugin covers:

- Providers, appointment types, and provider-scoped availability (with exception windows for time off)
- Open-slot computation and public availability lookup
- Appointment booking with a double-booking guard and DB-enforced slot uniqueness
- Booking confirmation emails, reschedule/cancel lifecycle
- Client records (with customer self-service record access)
- Provider-scoped visit journals + access audit log (medical/consulting note-taking, SOAP-template by default — see `SCHEDULING_NOTE_TEMPLATE`)

It only depends on `auth` (see [Plugin Dependency Map](#plugin-dependency-map)), so it can be combined with a full storefront (cart/checkout) or run standalone alongside just `branding` + `categories` + `products` for a pure booking site — see the **Service business with booking** combination in [Validated ENABLED_PLUGINS Combinations](#validated-enabled_plugins-combinations).

This unlocks the profiles that previously had to fake booking through RFQ:

- Appointment-based services (salons, consultants, photographers) — Profile 5
- Rental / hire businesses can use `scheduling` for date/time slot availability alongside RFQ for large/custom bookings — Profile 10
- Event ticketing with multiple time slots — Profile 8

**Not yet covered:** duration-based / rate pricing (daily or weekly rental rates) — `scheduling` models appointments, not priced rental durations, so rental businesses still need RFQ or manual pricing for that part of the flow.

---

*Document maintained in: `docs/plugin-reference.md`*
