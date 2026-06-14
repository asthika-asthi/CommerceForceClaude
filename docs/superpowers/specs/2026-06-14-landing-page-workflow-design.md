# Landing Page Creation Workflow — Design Spec

**Date:** 2026-06-14  
**Status:** Approved  
**Scope:** Simplified, AI-assisted landing page creation for per-client deployments

---

## Problem Statement

The existing landing page system requires Superadmin to manually edit raw JSON in a textarea, block by block. This is too slow, too technical, and produces no visual feedback. The goal is an AI-assisted workflow where Superadmin generates a client's full landing page in one step, with admin able to update live content independently without any redeploy.

---

## Roles and Responsibilities

| Role | Responsibility | Changes via |
|---|---|---|
| **Superadmin** | Page structure, layout, visual design, initial placeholder content | `landing-page.config.json` in git branch + AI tooling |
| **Admin** | Day-to-day content: products, promotions, announcements, coupons | Admin UI → database, instant, no redeploy |

---

## Three-Layer Architecture

All three layers are active simultaneously at runtime.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Structure (Superadmin / AI-authored, file-based)      │
│  landing-page.config.json  in client git branch                 │
│  Which blocks, their order, visual variants, static copy        │
│  Changes: infrequent — requires redeploy                        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Admin-editable live content (database)                │
│  PromotionBanner, Announcement, Coupon (show_on_homepage)       │
│  Updated by admin via admin UI — instant, no redeploy           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: Transactional data (existing, unchanged)              │
│  Products (is_featured), Orders, Newsletter, Loyalty, Coupons   │
│  Continuous updates, instant                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Superadmin Workflow (at client onboarding)

1. Consult with client — business type, brand personality, which plugins they want
2. Open Claude Desktop (or similar AI tool)
3. Prompt: *"Generate landing-page.config.json for [client profile], plugins: [list], tone: [description]"*
4. AI generates config with appropriate blocks, placeholder text, and Unsplash URLs for images
5. Superadmin reviews in IDE, swaps in real image URLs (from `/api/media/upload`), adjusts copy
6. Commits `landing-page.config.json` to client's git branch
7. Sets `ENABLED_PLUGINS` in `.env` to match chosen plugins
8. Deploys — client receives a complete, fully styled, working site

---

## Admin Workflow (day-to-day, no redeploy ever)

| Admin action | Effect on storefront |
|---|---|
| Tick product as `is_featured` | Appears in `featured-products-grid` block automatically |
| Add/edit product with image URL | Product catalogue and featured grid update live |
| Create/edit `PromotionBanner` record | `promotions-banner` block shows it |
| Create/edit `Announcement` record | `announcement-bar` block shows it |
| Tick coupon `show_on_homepage` | `coupon-spotlight` block shows that coupon |
| Manage orders, loyalty, newsletter | Existing pages, unchanged |

---

## Config File Specification

**Path:** `frontend-starter/landing-page.config.json`  
**Read:** Once at server startup, cached in module memory — zero disk I/O per request  
**Format:**

```json
{
  "sections": [
    {
      "__block": "scroll-expand-hero",
      "title": "Your Headline",
      "subtitle": "Your subheading",
      "mediaSrc": "http://host/uploads/hero.jpg",
      "bgImageSrc": "http://host/uploads/bg.jpg",
      "mediaType": "image"
    },
    {
      "__block": "featured-products-grid",
      "title": "Our Best Sellers",
      "subtitle": "Handpicked for you",
      "maxProducts": 8,
      "cardStyle": "rounded-shadow"
    },
    {
      "__block": "promotions-banner"
    },
    {
      "__block": "announcement-bar"
    },
    {
      "__block": "cta-banner",
      "title": "Ready to shop?",
      "ctaText": "Browse All Products",
      "ctaUrl": "/products"
    },
    {
      "__block": "newsletter-section",
      "requiredPlugin": "newsletter",
      "title": "Get Weekly Updates"
    },
    {
      "__block": "loyalty-widget",
      "requiredPlugin": "loyalty"
    }
  ]
}
```

### What the config contains
- Block type (`__block`)
- Static display text (titles, subtitles, CTA text)
- Image URLs (uploaded to server, referenced by URL)
- Layout/variant options (`cardStyle`, `maxProducts`, `mediaType`)
- Optional `requiredPlugin` for blocks that need a specific plugin

### What the config does NOT contain
- Product data (comes from DB)
- Promotions/announcement text (admin manages in DB)
- Coupon codes (admin manages in DB)
- Customer or order data

---

## Performance

### Config caching (module-level)
```typescript
// lib/landing-config.ts
let _config: LandingConfig | null = null
export function getLandingConfig(): LandingConfig {
  if (!_config) _config = JSON.parse(fs.readFileSync('landing-page.config.json', 'utf-8'))
  return _config
}
```
File is read once when the process starts. Subsequent requests use the in-memory object. Server restart (on structural deploy) clears the cache.

### Next.js optimisation
The structural shell (from config) can be statically generated at build time. Only dynamic-data blocks (`featured-products-grid`, `promotions-banner`, `announcement-bar`) make per-request DB/API calls.

---

## Design Principle: Data vs. Style Separation

Admin provides **data only** — never style. The component enforces all visual treatment.

- `featured-products-grid` card style is defined in the config and component. Admin ticks which products are featured. All featured products render identically in the same card style.
- `promotions-banner` headline, body, and CTA are from the DB. Background colour, typography, and animation come from the component and brand CSS variables.
- Brand colours (`--brand`, `--brand-dark`, etc.) flow into every component automatically. Admin cannot accidentally break visual consistency.

**Placeholder content at onboarding:** Superadmin/AI generates placeholder testimonials, a sample promotion banner, and an example announcement in the config. Client receives a complete-looking site from day one. Admin replaces placeholder data through the admin UI — design never deviates.

---

## Plugin-Block Integration

`ENABLED_PLUGINS` env var (set at deployment time) lists active plugins.

Each block in the registry has an optional `requiredPlugin` field. At render time, blocks whose `requiredPlugin` is not in `ENABLED_PLUGINS` are silently omitted.

When Superadmin generates the config with AI, they pass the enabled plugins as context — so the AI naturally includes only applicable blocks. The `requiredPlugin` filter is a safety net.

---

## Image Upload

Images are uploaded to the server's local filesystem and referenced by URL.

**Backend endpoint:** `POST /api/media/upload`
- Accepts multipart file upload
- Saves to `/uploads/{uuid}-{filename}`
- Returns `{ "url": "http://host/uploads/{uuid}-{filename}" }`
- FastAPI serves `/uploads/` as a static directory

**Where URLs are used:**
- Product images: stored in `ProductImage.url`
- Category images: stored in `Category.image_url`
- Landing page: Superadmin puts URL in `landing-page.config.json`
- Promotion banners: admin stores in `PromotionBanner.image_url`

---

## New Blocks (Layer 2 — admin-editable)

Three new blocks read from the database. Superadmin places them in the config; admin manages their content.

### `promotions-banner`
- Fetches active `PromotionBanner` from `GET /api/promotions/active`
- Displays: headline, body, CTA button, optional expiry countdown
- Admin manages: headline, body, CTA text/URL, expiry date, active toggle, optional image
- If no active promotion: renders nothing (graceful omission)

### `announcement-bar`
- Fetches active `Announcement` from `GET /api/announcements/active`
- Displays: compact banner with short text and optional link
- Admin manages: text, link, active toggle, start/end dates
- If no active announcement: renders nothing

### `coupon-spotlight`
- Fetches coupon where `show_on_homepage=true` and `is_active=true`
- Displays: coupon code, discount value, expiry date
- Admin manages: tick `show_on_homepage` on any coupon in the Coupons admin page

---

## Code Changes Required

### Backend

| File | Change |
|---|---|
| `app/routers/media.py` | New: file upload endpoint, static file serving |
| `app/plugins/promotions/models.py` | New: `PromotionBanner` model |
| `app/plugins/promotions/router.py` | New: CRUD admin + `/active` storefront endpoint |
| `app/plugins/promotions/__init__.py` | New: plugin manifest |
| `app/plugins/announcements/models.py` | New: `Announcement` model |
| `app/plugins/announcements/router.py` | New: CRUD admin + `/active` storefront endpoint |
| `app/plugins/announcements/__init__.py` | New: plugin manifest |
| `app/plugins/coupons/models.py` | Add `show_on_homepage: bool = False` field |
| `app/plugins/coupons/router.py` | Add `GET /api/coupons/featured` endpoint |
| `app/main.py` | Register media router + new plugins |

### Frontend Storefront (`frontend-starter`)

| File | Change |
|---|---|
| `landing-page.config.json` | New: default/example layout for master branch |
| `lib/landing-config.ts` | New: config reader with module-level cache + plugin filter |
| `lib/types.ts` | Add `LandingConfig`, `LandingConfigSection` types |
| `app/page.tsx` | Read from config instead of API; combine with DB-driven blocks |
| `lib/block-registry.ts` | Add `requiredPlugin` field; register 3 new blocks |
| `lib/block-defaults.ts` | Add defaults for 3 new blocks |
| `components/blocks/promotions-banner.tsx` | New block |
| `components/blocks/announcement-bar.tsx` | New block |
| `components/blocks/coupon-spotlight.tsx` | New block |

### Admin (`frontend-admin`)

| File | Change |
|---|---|
| `components/ui/image-upload.tsx` | New: reusable file upload widget → POST /api/media/upload → returns URL |
| `app/(dashboard)/products/new/page.tsx` | Add image upload widget to image URL fields |
| `app/(dashboard)/products/[id]/edit/page.tsx` | Same |
| `app/(dashboard)/promotions/page.tsx` | New: manage PromotionBanner records |
| `app/(dashboard)/announcements/page.tsx` | New: manage Announcement records |
| `app/(dashboard)/coupons/page.tsx` | Add `Show on homepage` toggle per coupon |
| `components/layout/sidebar.tsx` | Add Promotions + Announcements to nav |

---

## Fallback Strategy

If `landing-page.config.json` does not exist, fall back to `GET /api/landing_page` (existing DB-driven system). Existing deployments are unaffected until they add the config file.

---

## What Stays Unchanged

- All existing block components (`components/blocks/*.tsx`)
- Block registry structure (additive change only)
- `LandingSection` DB table (kept as fallback)
- All existing admin pages (products, orders, loyalty, newsletter, coupons)
- Plugin self-registration system
- Branding config system
- Per-client git branch deployment model

---

## Verification

After implementation, verify end-to-end:

1. Add `landing-page.config.json` to `frontend-starter/` with a hero + featured-products + newsletter block
2. Start the dev server — homepage should render from the config file, not the admin DB
3. In admin, mark two products as featured — they should appear in the grid without redeploy
4. In admin, create a PromotionBanner — it should appear on the homepage immediately
5. In admin, create an Announcement — it should appear without redeploy
6. Mark a coupon `show_on_homepage=true` — it should appear in coupon-spotlight
7. Set `ENABLED_PLUGINS` without `newsletter` — newsletter block should be absent from page
8. Upload an image via the product edit form — URL should be returned and saved to product
9. Remove `landing-page.config.json` — page should fall back to existing DB-driven sections
