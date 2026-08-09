# CommerceForce — User Manual & Product Guide

*Your complete trade & retail store, run from one dashboard.*

This guide has two halves:
- **Part 1–2** explain what CommerceForce is and who it's for — ideal source material for a promotional video or sales page.
- **Part 3 onward** is the practical, click-by-click manual for running your store day to day.

---

# Part 1 — What CommerceForce Is

**CommerceForce is a complete online store built for trade and retail businesses.** It gives your customers a fast, modern shopping website, and gives you a single dashboard to manage products, orders, pricing, customers, and marketing — no technical skill required.

It's built for businesses that sell to **both the public and the trade**: retail shoppers who check out and pay by card, and trade/business customers who need wholesale pricing, credit accounts, and bulk ordering.

### Why businesses choose it

- **One dashboard for everything** — products, stock, orders, customers, discounts, and your website's look, all in one place.
- **Built for trade *and* retail** — public checkout with card payments, plus B2B features like credit accounts, trade pricing, and request-a-quote.
- **Looks premium out of the box** — a fast, mobile-friendly storefront that reflects your brand's colours, logo, and style.
- **You stay in control** — change prices, add products, run promotions, and update your homepage yourself, in minutes.
- **Grows with you** — loyalty points, coupons, reviews, wishlists, newsletters, and an AI chat assistant are all included and switch-on-ready.

---

# Part 2 — The Headline Features (great for a video)

Use these as talking points / on-screen captions:

| Capability | What it means for the business |
|------------|-------------------------------|
| **Modern storefront** | A polished, mobile-first shop that loads fast and converts visitors into buyers. |
| **Product variants** | Sell the same product in multiple sizes, colours, or pack sizes — each with its own price and stock. |
| **Card, cash, credit, bank transfer & PayPal** | Take card payments (Stripe), cash on delivery, credit-account orders, or manual bank transfer / PayPal — mark manual payments as paid yourself with one click. |
| **Trade accounts** | Business customers apply for an account; you approve them and unlock wholesale pricing. |
| **Coupons & automatic discounts** | Run promo codes (one per customer) and automatic "spend over £X, save Y" offers. |
| **Loyalty points** | Customers earn points on orders and redeem them for money off. |
| **Order management** | Track every order from placed → confirmed → shipped → delivered, with tracking numbers and email updates. |
| **Guest order tracking** | Shoppers can look up an order's status with just an order number and email — no account needed. |
| **Abandoned-cart recovery** | Shoppers who leave items in their cart get an automatic reminder email, bringing them back to finish the purchase. |
| **Tax / VAT handling** | Set tax rates by country or region; the right rate is applied automatically at checkout. |
| **Built-in analytics** | Connect Google Analytics and/or Meta Pixel with one setting, shown to visitors behind a cookie-consent banner. |
| **Two-factor login security** | You and your customers can opt in to a one-time email code at login, on top of the password. |
| **GDPR data tools** | Customers can self-service export their data or request account deletion, which you review and approve. |
| **Appointment booking & scheduling** | For service businesses: customers book appointments online; you manage providers, availability, and a calendar, with private client visit notes. |
| **Bulk tools** | Import your whole catalogue from a spreadsheet; export orders and products to CSV. |
| **Marketing built in** | Newsletter capture, promotional banners, announcement bar, and product reviews. |
| **AI chat assistant** | An on-site chat widget that answers customer questions automatically. |
| **Sell in any currency** | Each store is set to its own currency (£, $, €, ₹, and more) — prices, checkout, and card payments all use it. |
| **Your brand, your look** | Set your logo and a small set of core brand colours — the rest of the palette (hover states, tints, shades) is generated for you automatically. Build your homepage from a library of nearly 50 ready-made sections: hero banners, pricing tables, image galleries, video showcases, testimonials, FAQs, and more. |
| **Reliable & secure** | Runs on your own server, HTTPS-secured, with automatic nightly backups. |

> **Note:** not every feature suits every business. Your setup is tailored to what you sell — a retail shop typically gets card checkout, coupons, and loyalty; a wholesaler adds trade accounts and credit; a service business (salon, clinic, repair shop) adds appointment booking instead of a product catalogue. Ask your agency which combination fits you.

---

# Part 3 — Getting Started

### The two logins

CommerceForce has two control panels:

| Panel | Who uses it | What it's for | Address |
|-------|-------------|---------------|---------|
| **Admin panel** | You / the store owner | Day-to-day business: products, orders, customers, pricing, marketing | `http://your-domain:3001` (or `/admin`) |
| **Storefront** | Your customers | The public shop | `http://your-domain:3000` (your main domain) |

There is also a **Superadmin** login used by the agency that set up your store (see Part 6) — for branding, theming, and technical setup.

### Logging in

1. Go to the admin panel address.
2. Enter the email and password you were given.
3. You'll land on the **Dashboard**.

*Forgot your password?* Use **Forgot Password** on the login screen — a reset link is emailed to you.

*Two-factor login:* if you've turned on 2FA for your account (see **Account Security** in Part 4), you'll be asked for a one-time code sent to your email after entering your password.

---

# Part 4 — The Admin Dashboard (day-to-day manual)

The left sidebar is your menu. Here's each section and how to use it.

## 4.1 Products

Your catalogue. From **Products** you can:

- **See every product** with a thumbnail image, SKU, price, stock, and status. The image column makes it easy to spot a wrong or missing photo at a glance.
- **Search** the catalogue and page through results.
- **Add a product** (+ New Product): enter name, description, price, optional sale price, stock quantity, category, and images. Tick **Featured** to show it on the homepage.
- **Edit a product**: change any detail, manage its images, and set up **variants** (see below).
- **Import from a spreadsheet** (Import CSV): add or update many products at once, including images.
- **Export to CSV** and **find duplicates** to keep the catalogue clean.

### Variants (sizes, colours, packs)

On a product's edit page, the **Variants** tab lets you offer the same product in options like Size (S/M/L) or Colour. You can:
- Add option types and values, then **generate** all the combinations automatically.
- Give each variant its own **price adjustment** (e.g. XL costs £2 more) and its own SKU.
- Turn individual combinations on or off.
- Assign specific images to specific variants (the storefront swaps the photo when the shopper picks that option).

Simple products with no options work automatically — you don't have to think about variants.

## 4.2 Categories

Organise products into categories (e.g. *Tarpaulins*, *Dust Sheets*). Categories can be **nested** (a category can have sub-categories), and each can have its own image. Customers browse by category from the top navigation and sidebar.

## 4.3 Stock

Each product has a **stock quantity**. The shop checks it before letting a customer add to cart, and reduces it automatically **once an order is paid**. When stock hits zero, the product shows **Out of stock**.
- The **Inventory** section provides advanced warehouse-level stock records and transfers for businesses that track stock by location. *(Note: the shop currently sells against the product's stock quantity — set that on the product itself.)*

## 4.4 Orders

Every order lands here. For each order you can:

- See the customer, items, totals, payment method, and status.
- **Update the status** through its lifecycle: *pending → confirmed → processing → shipped → delivered* (or *cancelled*). Invalid jumps (like reviving a cancelled order) are blocked to keep your records clean.
- **Fulfil an order**: mark it shipped and add a **tracking number** — the customer is emailed automatically.
- **Cancel an order**: stock, store credit, loyalty points, and coupon usage are all automatically reversed.
- **Export orders to CSV** for accounting.
- View **analytics**: revenue over the last 30 days and your top-selling products.

Payments:
- **Cash on delivery** and **credit account** orders are marked paid immediately.
- **Card (Stripe)** orders are only finalised — and stock/points/coupons only applied — once the card payment actually succeeds, so an abandoned checkout never affects your inventory.
- **Bank transfer** and **PayPal** orders come in as pending payment; once you've confirmed the money has arrived, click **Mark as Paid** on the order to finalise it.

## 4.5 Customers & Trade Accounts

The **Users/Customers** section lists everyone who has registered. You can:
- View customer details and order history.
- **Approve trade accounts**: business customers apply via the storefront; you review and approve them, and can deactivate accounts if needed.
- Export the customer list to CSV.

*Email verification:* new customers must confirm their email address before they can sign in (this keeps out fake accounts). Admin and agency logins are exempt.

## 4.6 Credit Accounts (trade credit)

For approved trade customers, create a **credit account** with a spending limit. At checkout those customers can pay "on account" up to their limit. The balance is used when they order and restored automatically if an order is cancelled. You can adjust limits or close accounts at any time.

## 4.7 Coupons & Discounts

**Coupons** — create promo codes that are either a **percentage** or a **fixed amount** off. Options include an expiry date, a minimum order value, a total usage cap, and showing one coupon on the homepage. Coupons are **one redemption per customer**.

**Discount rules** — set **automatic** discounts (e.g. "spend over £50, get 10% off") that apply without a code.

## 4.8 Loyalty Points

Turn on a loyalty scheme where customers **earn points** on every paid order and **redeem** them for money off. You control the earn rate, the redemption value, and the minimum points needed to redeem. You can also view balances and make manual adjustments.

## 4.9 Reviews

Customers can review products they've actually purchased and received. Reviews wait for your **approval** before appearing on the storefront, so you stay in control of what's shown.

## 4.10 Request for Quote (RFQ)

Trade customers can submit a **request for a quote** for bulk or custom orders. You'll see these under **RFQ / Enquiries** and can work through them (draft → submitted → under review).

## 4.11 Marketing

- **Newsletter** — collect subscriber emails from the storefront; view, manage, and export the list.
- **Announcements** — a bar across the top of the shop for time-limited messages (e.g. "Free delivery this week").
- **Promotions** — promotional banners on the storefront.
- **Enquiries** — messages sent through the contact form.

## 4.12 Branding (your look)

Under **Branding** set your **store name, tagline, logo, favicon, brand colours, font, contact email/phone, and social links**. Pick a small set of core brand colours and the rest of the palette (hover states, tints, shades) is generated for you automatically. This is also where your **Stripe payment key**, **bank transfer details**, and **PayPal email** are entered to enable each payment method. Changes appear on the storefront immediately.

## 4.13 Landing Page (homepage builder)

The **Landing Page** section lets you shape your homepage from a library of nearly 50 ready-made **sections/blocks** — hero banners, category grids, featured products, pricing tables, image galleries, video showcases, testimonials, FAQs, stats, and more. Mark products as **Featured** (on the product page) to have them appear in the homepage's featured areas.

## 4.14 Media Library

A central **image library** with folders. Upload images once here and reuse them across products, categories, and banners. Use the **list view** and **filename search** to quickly find a specific image once your library grows.

## 4.15 Settings — Shipping

Under **Settings**, set up **shipping zones** by country with a delivery rate. The correct rate is applied automatically at checkout based on the customer's country.

## 4.16 Settings — Tax / VAT

Set **tax rates by country or region** the same way you set up shipping zones. The correct rate is calculated automatically at checkout based on the customer's address.

## 4.17 Analytics & Cookie Consent

Connect **Google Analytics (GA4)** and/or **Meta Pixel** by entering your tracking IDs — no code required. Visitors see a **cookie-consent banner** first, and tracking only activates once they accept.

## 4.18 Scheduling & Appointments (service businesses)

For businesses that sell time rather than (or alongside) products — salons, clinics, repair shops, consultants — the **Scheduling** section lets you:
- Set up **providers** (staff/practitioners) and their **availability**, including exceptions like holidays.
- Define **appointment types** (e.g. duration, name) customers can book.
- View and manage bookings on a **calendar**, with automatic double-booking prevention and confirmation emails.
- Keep a **client record** per customer with a private visit journal — useful for businesses that need to track notes between visits (e.g. a clinic's SOAP notes).

## 4.19 Account Security (2FA)

From your **Account** settings, turn on **two-factor authentication**: once enabled, logging in requires a one-time code emailed to you after your password. You can turn this on for your own admin login and enable it as an option for customers.

## 4.20 Data & Privacy (GDPR)

Customers can request a **self-service export** of their data or ask to have their **account deleted**, directly from their account settings. Deletion requests land in **Deletion Requests** for you to review and approve or reject before anything is removed.

---

# Part 5 — The Customer Experience (storefront)

This is what your shoppers see — useful to narrate in a demo video:

1. **Browse** the homepage, shop by category, search, and filter by price. A cookie-consent banner appears first if analytics is enabled.
2. **Open a product**, pick a variant (size/colour) — the price and image update live — and **add to cart**.
3. **Cart** — adjust quantities, see the subtotal. If they leave without checking out, an **abandoned-cart reminder email** brings them back later.
4. **Checkout** — sign in or continue as a guest; enter a delivery address; apply a coupon or redeem loyalty points (the total updates to match); tax/VAT is calculated automatically; choose **cash, credit account, card, bank transfer, or PayPal**; place the order.
5. **Account** — customers track orders and tracking numbers, save addresses, keep a **wishlist**, see their loyalty balance, turn on **two-factor login**, and can **export their data** or request account deletion.
6. **Track an order without an account** — anyone can look up an order's status on the public tracking page with just the order number and email.
7. **Book an appointment** *(service businesses)* — customers pick a provider, appointment type, and time slot, and receive a confirmation email; they can view upcoming appointments from their account.
8. **Extras** — leave reviews on delivered items, subscribe to the newsletter, apply for a trade account, and ask the **AI chat assistant** questions.

---

# Part 6 — For the Agency (Superadmin)

The **Superadmin** role is for the agency that deploys and styles stores for clients:

- **Per-client branding & theming** — a small set of core colours per client auto-generates the full palette (tints, shades, hover states), so restyling a new client's site is fast and consistent; fonts, logos, and homepage layout are tailored per client too.
- **Currency** — each store's currency is set at deployment via `CURRENCY_CODE` in the client's config (e.g. `USD`, `EUR`, `INR`; defaults to `GBP`). It drives every price symbol in the storefront and admin **and** the Stripe charge currency. Supported: GBP £, USD $, EUR €, INR ₹, AUD, CAD, AED, SGD, NZD. (It's a build-time setting, so changing it later means a quick rebuild — see `docs/new-client-setup.md`.)
- **Landing-page block system** — assemble each client's homepage from a library of nearly 50 reusable sections (hero banners, pricing tables, galleries, testimonials, FAQs, and more), driven by a per-client config rather than one-off page code — new client sites can be assembled quickly from existing blocks.
- **Plugin selection per client** — switch on only the plugins a client's business needs (e.g. trade/credit for a wholesaler, scheduling for a service business), so each client's admin panel only shows what's relevant to them.
- **Deployment** — each store runs in Docker on its own server, secured with HTTPS, with automatic nightly backups. First-time setup and go-live steps are documented in `docs/new-client-setup.md`.
- **Role separation** — the agency (superadmin) handles build/design; the client (admin) handles business operations only.

---

# Part 7 — Suggested Promotional Video Script (60–90 seconds)

A ready-to-adapt outline for your promo video.

**[0:00–0:08] Hook — the problem**
> "Running a trade and retail business online shouldn't mean juggling five different tools."

*Visual: a cluttered desk / multiple browser tabs.*

**[0:08–0:20] The solution**
> "Meet CommerceForce — one platform that runs your entire store. Products, orders, customers, pricing, and your website — all from a single dashboard."

*Visual: the admin dashboard, then the polished storefront on a phone.*

**[0:20–0:45] Built for trade *and* retail — and services too**
> "Sell to the public with fast card, bank transfer, or PayPal checkout — and to the trade with credit accounts, wholesale pricing, and request-a-quote. Offer products in any size or colour, with their own prices and stock. Running a service business instead? Let customers book appointments online."

*Visual: storefront product page with a variant picker; a trade customer paying 'on account'; a customer booking an appointment slot.*

**[0:45–1:05] Grow sales, on autopilot**
> "Run coupons and automatic discounts, reward customers with loyalty points, collect reviews and newsletter sign-ups, and let an AI assistant answer questions around the clock."

*Visual: quick montage — coupon applied, points redeemed, a 5-star review, the chat widget replying.*

**[1:05–1:20] You're in control**
> "Change prices, add products, and update your homepage yourself — in minutes. Your brand, your colours, your store."

*Visual: dragging a homepage section into place; brand colour changing live.*

**[1:20–1:30] Close**
> "CommerceForce. Your whole business, one dashboard. Book a demo today."

*Visual: logo + call to action.*

**Key selling points to repeat:** one dashboard · trade + retail + services in one · card/cash/credit/bank transfer/PayPal · any currency · variants · loyalty & coupons · booking for service businesses · your brand · secure & backed up.

---

*This manual reflects the features built into the platform. For first-time server setup, migrations, and go-live, see `docs/new-client-setup.md`.*
