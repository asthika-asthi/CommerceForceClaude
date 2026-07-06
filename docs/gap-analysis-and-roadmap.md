# CommerceForce — Gap Analysis & Roadmap

> Last updated: 2026-07-06.
> Companion to `backlog.md` (what's built/tested) and `bugs-log.md` (defects). This
> document answers three questions: (1) what's missing to run a **fleet** of clients
> efficiently, (2) what's missing to **win clients** vs Shopify/Woo, and (3) what it
> would take to serve **every Ideal Customer Profile** and/or go **multi-tenant**.

---

## 0. How to read this

- **Part A** — Agency fleet operations (your side: running many clients from one codebase).
- **Part B** — Client-facing commercial readiness (why a client picks you over Shopify).
- **Part C** — Coverage by Ideal Customer Profile (the 12 profiles in `customer-profiles.md`).
- **Part D** — Cross-cutting capability gaps that unlock whole profile groups.
- **Part E** — The multi-tenant question (single-tenant-per-deployment vs true multi-tenant SaaS).
- **Part F** — Prioritized roadmap (phased).

Status language: **Built** = in code and working · **Partial** = foundation exists, gaps remain ·
**Designed** = spec approved, not built · **Not built** = no code.

---

## 1. Where the platform stands today

A deliberate **single-tenant-per-deployment** architecture: each client gets their own
container stack, their own database, their own `.env`, and their own frontend build.
Provisioning is already strong — `deploy-client.sh` does full VPS setup + SSL + seed,
`generate-env.sh` writes per-client config, currency is per-client, HTTPS is prepared,
backup scripts exist. Twenty-plus plugins cover the core commerce surface. So the
remaining work is **not** "getting a client live" — it's fleet operations, storefront
completeness, and a few capability gaps that block specific profiles.

---

## Part A — Agency fleet operations

*(Verified against the codebase 2026-07-06.)*

| Gap | Status | Why it hurts at scale | Priority |
|---|---|---|---|
| **Fleet health dashboard** | Not built | Per-client health endpoints exist, but no single pane showing all clients up/down, error rates, disk, cert expiry. With 10+ clients you learn a store is down when the client calls. | High |
| **Centralized upgrade/rollout** | Not built | You can deploy a client, but there's no "roll this fix to all 12 clients" flow — each VPS is updated by hand. This is the core promise of "one codebase, many clients." | High |
| **Backup verification & restore drill** | Partial | `backup.sh`/`docker-backup.sh` exist, but nothing confirms backups are non-empty, offsite, and *restorable*. Untested backups are the classic agency disaster. | High |
| **Type-drift guard** (backlog T) | Not built | Hand-kept `types.ts` mirrors drift from backend schemas — caused several July bugs. An automated `gen:types` drift-check in CI closes it. | High |
| **Alembic chain repair** (backlog V) | Not built | `alembic upgrade head` fails on a fresh DB; the `init_db.py` + `stamp head` workaround is fragile for reproducible provisioning and future migrations. | High |
| **Per-client version/build stamp** | Not built | No `/api/version` exposing git SHA + build date. When a client reports a bug you can't tell which code they're on. Cheap, high leverage. | Medium |
| **Centralized error/log aggregation** | Not built | No Sentry-equivalent. Errors die in per-VPS logs you never see. | Medium |
| **Staging / preview per client** | Not built | No safe place to preview a client's theme/config before it hits their live store. | Medium |
| **Client billing / subscription tracking** | Not built | Nothing tracks who's paid you, plan tier, or gates features per contract. | Low (business) |

---

## Part B — Client-facing commercial readiness

*(Corrected against the codebase — SEO is more built than a first read suggested.)*

| Gap | Status | Detail | Priority |
|---|---|---|---|
| **SEO essentials** | **Largely built** | `sitemap.ts`, `robots.ts`, and `generateMetadata` (layout + product/category pages) all exist; product pages carry OpenGraph/JSON-LD. **Remaining:** site-wide OG defaults in `layout.tsx`, and confirm JSON-LD coverage on all templates. Downgraded from a High gap to polish. | Low–Med |
| **Abandoned-cart recovery** | Not built | Celery/Redis and email already exist. Abandoned-cart emails are one of the highest-ROI commerce features and a common "why not Shopify?" question. | High |
| **Analytics / GA4 / pixel hooks** | Not built | No standard way to inject Google Analytics / Meta Pixel per client (only mentioned in the cookie/privacy policy text). Clients expect it. | High |
| **Tax / VAT calculation** | Partial | `tax_amount` exists on the order model and flows through checkout, but nothing ever computes it — there's no tax rate config or calculation. Blocks any client who must show VAT. | High |
| **Guest order tracking / status page** | Not built | Guests get a confirmation email but no link to view status without an account. | Medium |
| **GDPR data export & delete** | Partial | Consent banner + cookie/privacy pages exist, but there's no "download / delete my data" flow. Legal requirement for EU clients. | Medium |
| **Storefront search & filtering** | Partial | Admin has search; storefront product discovery (search box, facet filters) is thin vs Shopify. | Medium |
| **Inventory source-of-truth** (backlog U) | Partial | The multi-warehouse system is built but not wired into selling (`deduct_stock_for_variant` unused) — decide single-pool vs multi-warehouse before a client needs real multi-location stock. | Medium |
| **"Contact us" enquiry form** | **Built** | The `contact` plugin + admin Enquiries page already cover this. *(`customer-profiles.md` still lists it as a gap — that doc is stale and should be updated.)* | — |
| **Returns / RMA flow** | Not built | No structured returns process. | Low |
| **Digital file delivery** | Not built | No secure download-link-on-purchase for digital goods. | See Part D |
| **Customer file / artwork upload** | Not built | No file upload on product/RFQ for print-on-demand artwork. | See Part D |
| **Customer-group price tiers** | Not built | Trade buyers can't get tier pricing; only flat prices + credit accounts. | See Part D |
| **Booking / calendar availability** | **Designed** | The scheduling plugin spec (`2026-07-05-scheduling-plugin-design.md`) covers this. | See Part D |

---

## Part C — Coverage by Ideal Customer Profile

Mapping the 12 profiles in `customer-profiles.md` to today's readiness. "Blocked" means a
named capability gap stops full service; "Mostly" means it works with a known rough edge.

| # | Profile | Readiness | What's missing to fully serve them |
|---|---|---|---|
| 1 | Standard e-commerce retailer | **Served** | Polish only: abandoned-cart, analytics hooks (Part B). |
| 2 | Catalogue / display-only | **Served** | `contact` plugin closes the old enquiry-form gap; hiding cart is config. |
| 3 | B2B quoting | **Served** | RFQ workflow built end-to-end. |
| 4 | Wholesale / trade supplier | **Mostly** | Credit + RFQ + multi-warehouse built. Missing: **customer-group price tiers** and hide-prices-from-guests. |
| 5 | Service business w/ catalogue | **Served** | RFQ + newsletter + AI chat + contact cover it; **scheduling plugin** adds real bookings. |
| 6 | Digital goods seller | **Blocked** | Cart/orders/coupons/loyalty built, but **no digital file delivery** (download link on purchase). |
| 7 | Local small retailer | **Served** | Cart/orders/inventory/coupons — the simple stack works. |
| 8 | Event / ticket seller | **Mostly** | Capacity-as-stock works for simple events; **time-slotted events need the scheduling/booking plugin**. |
| 9 | Non-profit / charity | **Served** | Newsletter + cart/orders + loyalty; donations modelled as products (no recurring-donation feature — minor). |
| 10 | Rental / hire | **Blocked → being addressed** | **Booking / date-range availability** is the unlock — exactly what the scheduling plugin design delivers. |
| 11 | Print-on-demand / custom | **Mostly** | Cart/orders/RFQ built; missing **customer file/artwork upload**. |
| 12 | Multi-location retailer | **Mostly** | Multi-warehouse + loyalty built, but **warehouse stock isn't authoritative in selling** (backlog U). |

**Takeaway:** 6 of 12 profiles are fully served today. The **scheduling plugin (already
designed)** is the single highest-leverage build — it unlocks Profiles 5, 8, and 10 at
once. Three discrete capability gaps (digital delivery, file upload, price tiers) each
unlock one more profile.

---

## Part D — Cross-cutting capability gaps (unlock whole profile groups)

| Capability | Unlocks profiles | Status | Shape of the work |
|---|---|---|---|
| **Booking / calendar availability** | 5, 8, 10 | **Designed** | Build the approved scheduling plugin (appointments + availability + no double-booking). Extends naturally to time-slotted events and date-range hire. |
| **Digital file delivery** | 6 | Not built | New plugin: attach downloadable files to a product/variant, issue a signed, expiring download link on paid order, enforce download limits. |
| **Customer file / artwork upload** | 11 | Not built | Add authenticated file upload to product/RFQ; store against the order/RFQ; surface to admin for production. Reuse the existing media-upload validation. |
| **Customer-group price tiers** | 4, (12) | Not built | Add price lists / tiers keyed to a customer group; resolve the buyer's tier at cart/checkout. Sits alongside existing credit accounts. |
| **"Hide prices from guests"** | 4 | Not built | Config flag: gate price display + add-to-cart behind login for trade catalogues. |

---

## Part E — The multi-tenant question

**Today (single-tenant per deployment):** one app + one database + one frontend build
**per client**. Isolation is physical — a bug, a data leak, or a load spike in one client
cannot touch another, and per-client data export/handover is trivial (it's their whole DB).

**Multi-tenant (one deployment serving many stores by domain)** is a different model. It
reduces per-client hosting overhead and enables self-serve signup, but it is a **large,
high-risk re-architecture**. The required work, in plain terms:

| Area | What has to change |
|---|---|
| **Tenant identity** | New Tenant concept; resolve the tenant from the request host/subdomain on every request; carry it through the whole call chain. |
| **Data isolation model** | Choose one: (a) shared DB with a `tenant_id` on every table + enforced filtering; (b) a schema per tenant; (c) a database per tenant behind one app. (a) is least infrastructure but highest code-discipline and leak risk; (c) is strongest isolation but most routing complexity. |
| **Every model & query** | Add tenant scoping to all tables and all reads/writes. Unique constraints become per-tenant (email, product slug, order number all unique *within* a tenant, not globally). |
| **Config that is currently a singleton** | Branding, loyalty config, landing-page config, shipping zones, coupons are today single rows read with "get the one row." Each becomes per-tenant. |
| **Auth** | Tokens must carry the tenant; login is scoped to a tenant; a super-console spans tenants. |
| **Per-tenant secrets** | Stripe keys, SMTP, currency, and enabled-plugins are global env vars today; they must move to per-tenant config + secret storage. |
| **Media** | Per-tenant storage prefixes/buckets with access control so one tenant can't read another's files. |
| **Frontend** | Either one build that themes dynamically by host, or keep per-client builds pointing at the shared backend (hybrid). |
| **Ops & security** | Single DB simplifies migrations but creates a shared blast radius (one bad deploy hits everyone); cross-tenant data leakage becomes the #1 risk and needs defense-in-depth (e.g. Postgres row-level security) plus tenant-boundary tests. |

**Effort & risk:** realistically a multi-month re-architecture touching nearly every
model, service query, auth, config, media, and the frontend — with cross-tenant leakage
as a serious, ongoing security concern.

**Recommendation:** Don't convert by default. The per-deployment model is genuinely
*better* for an **agency** (isolation, per-client customization, no shared failure, easy
data ownership/handover). Most of the operational upside people want from multi-tenancy —
"manage all clients from one place, roll out upgrades centrally" — is delivered by the
**Part A fleet tooling at a fraction of the risk**. Treat true multi-tenant as a
deliberate *business-model* pivot (toward high-volume self-serve SaaS), not a technical
default. **Build the fleet tooling first; revisit multi-tenant only if self-serve signup
becomes the strategy.**

---

## Part F — Prioritized roadmap

Ordered by leverage. Each item already has a home in this doc or the backlog.

### Phase 1 — Integrity & the highest-leverage build *(near term)*
1. **Ship the scheduling plugin** (Designed) — unlocks Profiles 5, 8, 10 in one build.
2. **Backup verification + restore drill** (Part A) — protects every existing client now.
3. **Alembic chain repair** (backlog V) + **type-drift guard** (backlog T) — make
   provisioning and schema changes reproducible before the fleet grows.
4. **`/api/version` build stamp** (Part A) — cheap; makes every future bug report diagnosable.

### Phase 2 — Win more clients *(storefront completeness)*
5. **Abandoned-cart recovery** (reuses Celery/Redis + email).
6. **Analytics / GA4 / pixel injection hooks** (per-client config).
7. **Tax / VAT calculation** (populate the existing `tax_amount`).
8. **SEO polish** — site-wide OG defaults + confirm JSON-LD coverage.

### Phase 3 — Fleet at scale *(agency operations)*
9. **Fleet health dashboard** + **centralized upgrade/rollout** (Part A) — the real
   "one codebase, many clients" operational win.
10. **Centralized error/log aggregation**; **staging/preview per client**.

### Phase 4 — Remaining profile unlocks
11. **Digital file delivery** (Profile 6) · **file/artwork upload** (Profile 11) ·
    **customer-group price tiers + hide-prices** (Profiles 4, 12).
12. **Inventory source-of-truth decision** (backlog U) for true multi-location.
13. **Guest order-status page**, **GDPR export/delete**, **returns/RMA** — compliance/UX depth.

### Deferred — business-model decision
14. **Multi-tenant conversion** (Part E) — only if the strategy shifts to self-serve SaaS.
15. **Client billing/subscription tracking** — when the client base warrants it.

---

## Appendix — Status of older planning docs

- `customer-profiles.md` — **authoritative** for ICPs, but **stale in two places**: the
  "contact us enquiry form" gap is now closed (the `contact` plugin), and the booking gap
  is now Designed. Worth a refresh pass.
- `ClaudePlan4CommercialReadiness*.txt` (several refines) — **superseded**. These are
  pre-build planning drafts (they list sitemap/GDPR/OG as future "Sprint 2/4" work that is
  now largely built). `backlog.md` is the source of truth; keep these only as history.
- `AgencyPointofViewEnhancements.txt` — just the original A/B/C framing prompt; this
  document is its answer.
- `GapAnalyis.txt`, `Server deployment..txt` — **empty placeholders**; safe to delete
  (this file replaces the first; `deployment-guide.md`/`new-client-setup.md` cover the second).
