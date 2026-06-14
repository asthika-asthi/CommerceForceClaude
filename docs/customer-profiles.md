# CommerceForce — Ideal Customer Profiles (ICPs)

> Last updated: 2026-06-14

This document describes the types of businesses CommerceForce is built to serve. Each profile covers who they are, what they need from the platform, which plugins they use, and how to identify them during sales or onboarding.

---

## Table of Contents

1. [Profile 1 — Standard E-commerce Retailer](#profile-1--standard-e-commerce-retailer)
2. [Profile 2 — Catalogue / Display-Only Site](#profile-2--catalogue--display-only-site)
3. [Profile 3 — B2B Quoting Business](#profile-3--b2b-quoting-business)
4. [Profile 4 — Wholesale / Trade Supplier](#profile-4--wholesale--trade-supplier)
5. [Profile 5 — Service Business with a Catalogue](#profile-5--service-business-with-a-catalogue)
6. [Profile 6 — Digital Goods Seller](#profile-6--digital-goods-seller)
7. [Profile 7 — Local / Small Retailer Going Online](#profile-7--local--small-retailer-going-online)
8. [Profile 8 — Event / Ticket Seller](#profile-8--event--ticket-seller)
9. [Profile 9 — Non-Profit / Charity](#profile-9--non-profit--charity)
10. [Profile 10 — Rental / Hire Business](#profile-10--rental--hire-business)
11. [Profile 11 — Print-on-Demand / Custom Order](#profile-11--print-on-demand--custom-order)
12. [Profile 12 — Multi-location Retailer](#profile-12--multi-location-retailer)
13. [Quick Comparison Table](#quick-comparison-table)
14. [Plugin Selection by Profile](#plugin-selection-by-profile)

---

## Profile 1 — Standard E-commerce Retailer

### Who They Are
A business selling physical products directly to consumers (B2C) through an online storefront. Could be a fashion brand, electronics shop, health & beauty store, home goods seller, or any general merchandise retailer.

### Business Characteristics
- Sells to individual end customers, not businesses
- Products have fixed prices with occasional promotions
- Fulfilment involves physical shipping
- Customer acquisition via social media, SEO, email campaigns
- Repeat purchase is important — loyalty drives lifetime value

### What They Need From the Platform
- Smooth add-to-cart and checkout experience
- Coupon codes for sales events and first-order discounts
- Loyalty programme to reward returning customers
- Order management and status updates for customers
- Stock management to avoid overselling
- Newsletter to keep customers engaged between purchases

### Pain Points Without the Platform
- Manually processing orders over WhatsApp or email
- No way to track stock across products
- No customer accounts or order history
- Promotions managed by hand with no tracking

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Cart | ✓ Essential | Core purchase flow |
| Orders | ✓ Essential | Order tracking and fulfilment |
| Inventory | Recommended | Prevents overselling |
| Coupons | Recommended | Promotional campaigns |
| Loyalty | Recommended | Repeat purchase incentive |
| Newsletter | Optional | Customer retention |
| AI Chat | Optional | Support and product questions |

### Identifying This Profile During Onboarding
- Asks about payment gateway integration
- Wants to bulk-upload product CSV
- Asks "how do customers track their orders?"
- Has or wants a returns policy

---

## Profile 2 — Catalogue / Display-Only Site

### Who They Are
A business or individual that wants to showcase products online without selling through the website. Sales happen offline (via phone, in-person, or third-party channels). Examples: manufacturers, distributors, trade showrooms, architects showing material options, suppliers whose sales team handles orders.

### Business Characteristics
- No online transactions — the site is a marketing and discovery tool
- Products may have reference prices, or prices may be hidden ("contact us for pricing")
- The goal is to generate leads, not complete sales
- May update catalogue infrequently

### What They Need From the Platform
- Clean product display with images, descriptions, specifications
- Category navigation for easy browsing
- Newsletter to capture visitor contact details
- AI Chat to answer product questions and capture leads
- No checkout, no cart, no payment processing

### Pain Points Without the Platform
- Product catalogue exists only in a PDF or printed brochure
- No way for prospects to browse independently
- Sales team spends time on basic product queries

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Newsletter | Recommended | Lead capture |
| AI Chat | Recommended | Self-serve product queries |
| Cart | ✗ Not needed | No online selling |
| Orders | ✗ Not needed | No online selling |

### Identifying This Profile During Onboarding
- Says "we don't sell online, we just want to display our products"
- Asks about hiding the cart button
- Asks about "contact us" forms (currently a gap — see Newsletter as substitute)
- Has a sales team that handles all transactions

---

## Profile 3 — B2B Quoting Business

### Who They Are
Businesses where pricing is bespoke, negotiated, or depends on specifications provided by the customer. The customer browses the catalogue to understand what is available, then submits a request with their requirements. Examples: custom fabricators, print studios, creative agencies offering packages, freelance artists selling commissions, bespoke furniture makers.

### Business Characteristics
- No single fixed price per product — price depends on quantity, spec, or negotiation
- Customer needs to communicate requirements before a price is given
- Sales cycle: browse → enquire → quote → approve → order
- Relationship and trust are central to conversion

### What They Need From the Platform
- RFQ workflow so customers can describe what they want
- Product catalogue to set context (what can be ordered)
- Admin tools to review requests and respond with quoted prices
- Newsletter to keep warm leads engaged
- No checkout needed until quote is accepted (RFQ acceptance auto-creates an order)

### Pain Points Without the Platform
- Quoting happens over email with no tracking
- No audit trail of what was quoted to whom
- Leads get lost if not followed up manually

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| RFQ | ✓ Essential | Core sales workflow |
| Newsletter | Recommended | Lead nurturing |
| AI Chat | Recommended | Pre-qualification and guidance |
| Cart | ✗ Not needed | Quoting replaces direct purchase |
| Orders | Created automatically | When a quote is accepted |

### Identifying This Profile During Onboarding
- Says "our prices depend on the job" or "every order is different"
- Asks about quote management or enquiry forms
- Mentions they currently quote via email or phone
- May be an artist, maker, studio, or custom manufacturer

---

## Profile 4 — Wholesale / Trade Supplier

### Who They Are
A business selling to other businesses (B2B), typically in bulk, with account-based relationships. Examples: food wholesalers, building material suppliers, uniform suppliers to schools and hospitals, parts distributors. Buyers are usually registered trade accounts, not members of the public.

### Business Characteristics
- Buyers are businesses, not individuals
- Large, recurring orders with negotiated pricing
- Payment is typically on account (30/60-day invoice terms), not immediate
- Catalogue may be visible only to logged-in trade accounts
- Pricing may vary by customer tier

### What They Need From the Platform
- Credit accounts so trade buyers can purchase on invoice
- RFQ for large or non-standard orders
- Multi-warehouse inventory across depots or fulfilment centres
- Orders management for fulfilment tracking
- No loyalty programme (B2B relationship is contract-based, not points-based)
- Potential to hide prices from non-registered visitors

### Pain Points Without the Platform
- Managing credit limits in spreadsheets
- No self-service ordering for trade accounts
- Manual stock-checking across locations
- No order history for buyers to reference

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Credit Accounts | ✓ Essential | Trade payment on account |
| RFQ | ✓ Essential | Large or custom order quoting |
| Orders | ✓ Essential | Fulfilment tracking |
| Inventory | ✓ Essential | Multi-location stock |
| Cart | Optional | For standard in-catalogue orders |
| Newsletter | ✗ Rarely needed | Relationship is managed by sales team |
| Loyalty | ✗ Not needed | Contract relationships replace loyalty |

### Identifying This Profile During Onboarding
- Mentions "trade accounts" or "account customers"
- Asks about invoice payment or payment terms
- Has multiple warehouses, depots, or fulfilment locations
- Talks about buyer tiers or negotiated pricing

---

## Profile 5 — Service Business with a Catalogue

### Who They Are
A business or individual that sells services, not physical products. The "catalogue" shows service packages or past work. Examples: photographers, videographers, interior designers, event planners, marketing agencies, wedding planners, personal trainers, consultants.

### Business Characteristics
- Services are the product — no physical fulfilment
- Every client engagement is potentially unique in scope and price
- New clients discover them via portfolio, social media, or referrals
- Sales process involves consultation, not an instant checkout

### What They Need From the Platform
- Portfolio / service catalogue (products used as service listings)
- RFQ so potential clients can describe their project
- Newsletter to nurture an audience and announce availability
- AI Chat to handle initial enquiries at any hour
- No cart, no physical inventory

### Pain Points Without the Platform
- Enquiries arrive via DM, email, WhatsApp — no central tracking
- No professional web presence to reference
- Leads go cold with no follow-up mechanism

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| RFQ | ✓ Essential | Client enquiry and project scoping |
| Newsletter | Recommended | Audience building |
| AI Chat | Recommended | 24/7 initial enquiry handling |
| Cart | ✗ Not needed | No instant-purchase services |
| Inventory | ✗ Not needed | No physical stock |

### Identifying This Profile During Onboarding
- Is a creative professional or service provider
- Asks about displaying a portfolio or past work
- Wants clients to be able to "get in touch" or "request a consultation"
- Has no current website or uses only social media

---

## Profile 6 — Digital Goods Seller

### Who They Are
A business or creator selling intangible, downloadable products. Examples: software developers selling apps or plugins, musicians selling tracks or sample packs, designers selling templates or asset packs, authors selling ebooks, educators selling course materials.

### Business Characteristics
- No physical fulfilment — delivery is instant (download link)
- Unlimited inventory (digital goods cannot be "out of stock")
- High margin, scalable — one product sold to thousands with no added cost
- Launch events and promotional pricing are common
- Repeat buyers need a reason to come back (new releases, bundles)

### What They Need From the Platform
- Full cart and order flow
- Coupon codes for launch discounts and bundles
- Loyalty points to reward frequent buyers
- Newsletter for new product announcements
- No inventory management (no physical stock)
- No RFQ (prices are fixed)

### Pain Points Without the Platform
- Selling through marketplaces (Gumroad, Etsy) with high fees and no customer data ownership
- No ability to run their own promotions
- No repeat-purchase mechanism

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Cart | ✓ Essential | Purchase flow |
| Orders | ✓ Essential | Order and delivery tracking |
| Coupons | ✓ Essential | Launch promotions and discounts |
| Loyalty | Recommended | Reward prolific buyers |
| Newsletter | Recommended | New product announcements |
| Inventory | ✗ Not needed | Digital goods have no stock |

### Identifying This Profile During Onboarding
- Mentions selling downloadable files, software, courses, or digital art
- Asks about download delivery after purchase (currently a gap — see note below)
- Plans to run discount codes for launches
- Wants to own their customer list

> **Platform gap to note:** CommerceForce does not currently have a built-in digital delivery mechanism (secure download link on order completion). This would need to be a future plugin or custom integration for this profile.

---

## Profile 7 — Local / Small Retailer Going Online

### Who They Are
A small, established bricks-and-mortar business taking their first steps online. Examples: local bakeries, independent bookshops, butchers, florists, independent clothing boutiques, toy shops, hardware stores.

### Business Characteristics
- Physical shop is primary channel; online is secondary or growing
- Owner-operated — not a technical team, needs simplicity
- Limited product range compared to large retailers
- Customers are often local and already know the brand
- May offer click-and-collect alongside delivery

### What They Need From the Platform
- Simple, reliable cart and checkout
- Basic inventory to track stock levels
- Occasional discount codes (seasonal sales)
- Low maintenance — set it up and leave it running
- No B2B complexity, no RFQ, no credit accounts

### Pain Points Without the Platform
- Taking orders over the phone or by hand
- No visibility into what stock is left without physically counting
- Losing sales to larger retailers who have online presence

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Cart | ✓ Essential | Core purchase flow |
| Orders | ✓ Essential | Order management |
| Inventory | Recommended | Stock tracking |
| Coupons | Optional | Seasonal promotions |
| Newsletter | Optional | Local customer updates |
| Loyalty | ✗ Rarely needed | Relationship is personal, not points-based |
| RFQ | ✗ Not needed | Prices are fixed |
| Credit | ✗ Not needed | B2C, not B2B |

### Identifying This Profile During Onboarding
- Has a physical shop and wants to "put it online"
- Not confident with technology — needs hand-holding
- Asks about simple product upload and pricing
- Does not need complex features

---

## Profile 8 — Event / Ticket Seller

### Who They Are
An individual or organisation selling access to events. Examples: music promoters, theatre companies, comedy clubs, sports clubs, conference organisers, workshop providers, cinema operators.

### Business Characteristics
- Products are tickets — each product represents an event or session
- Inventory is capacity (number of seats/spaces), not physical stock
- No physical shipping — confirmation is digital
- Newsletter is critical for promoting upcoming events
- Loyalty can reward repeat attendees (season ticket holders equivalent)

### What They Need From the Platform
- Cart and orders for ticket purchase
- Inventory to track remaining capacity per event
- Newsletter to announce upcoming events
- Loyalty to reward regular attendees
- Coupons for early bird pricing or group discounts

### Pain Points Without the Platform
- Selling tickets via social media posts with manual tracking
- Overbooking events because no stock control
- No mailing list to promote future events

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Cart | ✓ Essential | Ticket purchase |
| Orders | ✓ Essential | Booking confirmation |
| Inventory | ✓ Essential | Seat/space capacity control |
| Newsletter | ✓ Essential | Event announcements |
| Loyalty | Recommended | Reward regular attendees |
| Coupons | Optional | Early bird and group pricing |

> **Platform gap:** No native concept of date/time slots or availability calendars. Events are modelled as products with inventory = seat count. A **Booking plugin** is needed to handle time-slotted events properly.

### Identifying This Profile During Onboarding
- Mentions selling tickets, seats, or spaces
- Asks about setting capacity limits per product
- Has recurring events (weekly, monthly)
- Promotes events via social media and email

---

## Profile 9 — Non-Profit / Charity

### Who They Are
A charitable organisation or cause-driven entity that raises funds, sells branded merchandise, or runs awareness campaigns through a web presence. Examples: local charities, animal shelters, environmental organisations, community sports clubs, school fundraising groups.

### Business Characteristics
- Revenue is secondary to mission
- Audience includes donors, volunteers, and supporters — not just buyers
- Newsletter is a primary communication channel
- Loyalty rewards can acknowledge supporter generosity (non-financial recognition)
- May run limited merchandise campaigns alongside donation drives

### What They Need From the Platform
- Cart and orders for merchandise sales or "donation products"
- Newsletter as the main communication tool with supporters
- Loyalty to acknowledge repeat supporters
- AI Chat to answer questions about the cause
- Low cost, low complexity — resource-constrained organisations

### Pain Points Without the Platform
- No central place to manage merchandise and supporter communication
- Fundraising campaigns managed across multiple disconnected tools
- Supporter data scattered across different systems

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Newsletter | ✓ Essential | Supporter and donor communication |
| Cart | Recommended | Merchandise and donation products |
| Orders | Recommended | Fulfilment tracking |
| Loyalty | Optional | Recognise repeat supporters |
| AI Chat | Optional | Cause awareness and FAQ |
| RFQ | ✗ Not needed | Prices are fixed |
| Credit | ✗ Not needed | B2C audience |

### Identifying This Profile During Onboarding
- Mentions charity, cause, fundraising, or community
- Asks about newsletter and donor communication
- Has a small or volunteer-run team
- May ask about free or discounted pricing (worth noting)

---

## Profile 10 — Rental / Hire Business

### Who They Are
A business that lends items for a defined period rather than selling them permanently. Examples: equipment hire (construction, AV, catering), furniture and prop rental (events, film), party hire, vehicle hire, luxury goods rental.

### Business Characteristics
- "Sale" is a temporary loan — item is returned
- Pricing is time-based (per day, per week)
- Availability depends on existing bookings, not physical stock depletion
- Large or complex hires need custom quoting
- Standard catalogue items can be booked directly

### What They Need From the Platform
- RFQ for large or complex hire requests (event staging, large equipment packs)
- Catalogue to display available items with rental pricing
- Newsletter to promote seasonal availability
- Booking/calendar availability (currently a platform gap)

### Pain Points Without the Platform
- Managing hire bookings in a paper diary or spreadsheet
- Double-bookings when two customers request the same item
- No professional web presence for customers to self-serve

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| RFQ | ✓ Essential | Custom hire quotes |
| Newsletter | Recommended | Seasonal promotions and availability |
| Cart | Limited use | Standard hire items with fixed pricing |
| Inventory | ✗ Limited | Stock concept doesn't map to hire availability |

> **Platform gap:** No native booking/date-range or calendar availability plugin. Without this, rental businesses must use RFQ for everything or manage availability manually. A **Booking plugin** is the highest-priority gap for this profile.

### Identifying This Profile During Onboarding
- Says "hire", "rental", "loan", or "temporary use"
- Asks about date-based pricing or availability calendars
- Worried about double-bookings
- Items have a "return date" concept

---

## Profile 11 — Print-on-Demand / Custom Order

### Who They Are
A business producing personalised or customised goods where the customer provides specifications at order time. Examples: T-shirt printing, promotional merchandise, personalised gifts, engraving, custom embroidery, bespoke stationery.

### Business Characteristics
- Some products are standard (fixed price, from stock)
- Some products require customer input (text, colours, sizes, artwork)
- Custom items need review and approval before production
- Turnaround time is longer than off-the-shelf goods

### What They Need From the Platform
- Cart for standard products that are ready to ship
- RFQ for custom items requiring specification
- Orders for tracking both standard and custom fulfilment
- Inventory for standard ready-made stock

### Pain Points Without the Platform
- Custom orders arriving without full specifications
- Mixing up standard and custom order workflows
- No way for customers to upload artwork or describe requirements online

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Cart | ✓ Essential | Standard product purchases |
| Orders | ✓ Essential | Order tracking and fulfilment |
| RFQ | ✓ Essential | Custom specification orders |
| Inventory | Optional | For ready-made stock items |
| Coupons | Optional | Trade or bulk discounts |

> **Platform gap:** No native file upload on product pages (e.g., artwork upload for printing). Custom specifications are handled via RFQ notes field only.

### Identifying This Profile During Onboarding
- Mentions personalisation, customisation, or "made to order"
- Has a mix of standard and custom products
- Asks about artwork submission or specification forms
- Has a production lead time (not instant dispatch)

---

## Profile 12 — Multi-location Retailer

### Who They Are
An established retail business operating multiple physical branches or fulfilment centres, going online with a unified storefront. Examples: regional clothing chains, pharmacy groups, garden centres with multiple sites, sports retailers.

### Business Characteristics
- Multiple physical locations, each holding different stock
- Customers may want to know local availability
- Cross-branch loyalty programme (points earned at any branch)
- Central management but per-location operations
- More complex operationally than single-location retailers

### What They Need From the Platform
- Multi-warehouse inventory (one warehouse per branch or fulfilment centre)
- Full e-commerce stack (cart, orders, coupons)
- Loyalty programme active across all locations
- Newsletter for chain-wide promotions

### Pain Points Without the Platform
- No unified view of stock across branches
- Loyalty cards or stamps managed per-branch with no sync
- No online ordering across the chain
- Manual coordination between branches for order fulfilment

### Plugins Required

| Plugin | Required? | Reason |
|---|---|---|
| Cart | ✓ Essential | Online purchase |
| Orders | ✓ Essential | Fulfilment tracking |
| Inventory | ✓ Essential | Per-location stock management |
| Loyalty | ✓ Essential | Cross-branch points programme |
| Newsletter | Recommended | Chain-wide promotions |
| Coupons | Optional | Seasonal and regional promotions |
| Credit | Optional | Corporate accounts |

### Identifying This Profile During Onboarding
- Mentions multiple branches, locations, or warehouses
- Asks about stock transfers between locations
- Already has a loyalty card scheme they want to digitise
- Has an existing back-office or ERP system (integration may be needed)

---

## Quick Comparison Table

| Profile | Sells Online? | Fixed Prices? | B2B? | Physical Goods? | Key Differentiator |
|---|:-:|:-:|:-:|:-:|---|
| Standard e-commerce | ✓ | ✓ | — | ✓ | Full transactional B2C |
| Catalogue only | — | ref only | — | ✓ | Browse without buying |
| B2B quoting | ✓ (via RFQ) | — | ✓ | varies | Custom pricing per job |
| Wholesale / trade | ✓ | negotiated | ✓ | ✓ | Account credit and bulk orders |
| Service business | ✓ (via RFQ) | — | — | — | Services, not products |
| Digital goods | ✓ | ✓ | — | — | No inventory, instant delivery |
| Local small retailer | ✓ | ✓ | — | ✓ | Simplicity first |
| Event / tickets | ✓ | ✓ | — | — | Capacity = inventory |
| Non-profit / charity | ✓ | ✓ | — | varies | Mission-driven, donor comms |
| Rental / hire | ✓ (via RFQ) | time-based | — | ✓ | Returns, date availability |
| Print-on-demand | ✓ | mixed | — | ✓ | Spec at order time |
| Multi-location | ✓ | ✓ | — | ✓ | Per-branch stock + loyalty |

---

## Plugin Selection by Profile

| Profile | Cart | Orders | RFQ | Credit | Inventory | Loyalty | Newsletter | AI Chat | Coupons |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Standard e-commerce | ✓ | ✓ | — | — | opt | opt | opt | opt | opt |
| Catalogue only | — | — | — | — | — | — | opt | opt | — |
| B2B quoting | — | auto | ✓ | — | — | — | opt | opt | — |
| Wholesale / trade | opt | opt | ✓ | ✓ | ✓ | — | — | — | — |
| Service business | — | — | ✓ | — | — | — | ✓ | ✓ | — |
| Digital goods | ✓ | ✓ | — | — | — | ✓ | ✓ | — | ✓ |
| Local small retailer | ✓ | ✓ | — | — | ✓ | — | opt | — | opt |
| Event / tickets | ✓ | ✓ | — | — | ✓ | opt | ✓ | — | opt |
| Non-profit / charity | opt | opt | — | — | — | opt | ✓ | opt | — |
| Rental / hire | opt | — | ✓ | — | — | — | ✓ | — | — |
| Print-on-demand | ✓ | ✓ | ✓ | — | opt | — | — | — | opt |
| Multi-location | ✓ | ✓ | — | opt | ✓ | ✓ | ✓ | opt | opt |

> **✓** = core to this profile &nbsp;|&nbsp; **opt** = optional but common &nbsp;|&nbsp; **auto** = created automatically (RFQ acceptance) &nbsp;|&nbsp; **—** = not applicable

---

## Identified Platform Gaps by Profile

| Gap | Affects |
|---|---|
| **Booking / calendar availability** | Rental, Event ticketing, Service businesses |
| **Digital file delivery** | Digital goods sellers |
| **Customer file / artwork upload** | Print-on-demand |
| **Price tiers by customer group** | Wholesale / trade |
| **"Contact us" / general enquiry form** | Catalogue only, Service businesses |

---

*Document maintained in: `docs/customer-profiles.md`*
