# CommerceForce Plugin Reference

> Last updated: 2026-06-14

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
4. [Ideal Customer Profiles](#ideal-customer-profiles)
   - [Profile Matrix](#profile-plugin-matrix)
5. [Scenario: Non-E-commerce Site](#scenario-non-e-commerce-site)
6. [Platform Gap: Booking & Scheduling](#platform-gap-booking--scheduling)

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

```
Cart ──────────────────► Orders (checkout creates order)
                              │
                              ├──► Coupons      (discount applied at checkout)
                              ├──► Loyalty       (points earned on order completion)
                              └──► Credit        (payment method at checkout)

Products + Categories ──► Cart               (to purchase)
                      └──► RFQ               (to request a quote instead of buying)
                      └──► Newsletter         (standalone, no purchase needed)
                      └──► AI Chat            (standalone, no purchase needed)

Orders ────────────────► Inventory           (reserved qty tracked per order)
```

**Minimum configuration for a selling e-commerce site:** Products + Categories + Cart + Orders

**Minimum for a B2B quoting site:** Products + Categories + RFQ

**Minimum for a brochure / catalogue site:** Products + Categories *(optionally + Newsletter + AI Chat)*

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

## Platform Gap: Booking & Scheduling

The current plugin set has no native concept of:

- Date/time slots (event sessions, appointment booking)
- Duration-based pricing (daily/weekly rental rates)
- Availability calendars

This gap affects:

- Rental / hire businesses (equipment, furniture, venues)
- Event ticketing with multiple time slots
- Appointment-based services (salons, consultants, photographers)

These profiles can partially work using RFQ (customer requests a date, admin confirms manually), but a dedicated **Booking plugin** would unlock them properly.

**Potential Booking plugin scope:**
- Products can have "slots" with capacity limits
- Customer selects date/time at checkout
- Admin manages availability calendar
- Orders confirm the booking slot

---

*Document maintained in: `docs/plugin-reference.md`*
