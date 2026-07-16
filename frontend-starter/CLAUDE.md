# CommerceForce Storefront — Per-Client Customisation Guide

This is the **storefront template** for CommerceForce, a headless modular monolith e-commerce platform. Each client deployment starts as a copy of this directory. Read this guide before making any changes.

> ⚠️ **Next.js 16 notice:** This project uses Next.js 16 (App Router). APIs and conventions differ from older versions. When in doubt, check `node_modules/next/dist/docs/`.

---

## Code Rules — Must Always Be Followed

These rules exist because violations caused bugs in this project. Every new page, component, and API integration must follow them.

### Next.js / React

- **Suspense fallback required**: Any component using `useSearchParams()` must be wrapped in `<Suspense fallback={null}>`. Missing `fallback` causes the page to hang and render blank — this has affected 4+ pages in this project.
- **React keys on all lists**: Every `.map()` returning JSX needs a unique `key` prop on the outermost element. Never use array index as key when items can be reordered or deleted.
- **Error handling on all async calls**: Wrap `fetch`, `api.get`, and `api.post` calls in `try/catch`. Show the user a visible error state — never swallow failures silently.
- **"use client" placement**: Components using hooks, event handlers, or browser APIs must have `"use client"` as the very first line.

### API types (`lib/types.ts`)

- **List vs detail endpoints return different shapes**: `GET /api/products` returns `primary_image: string` per item. `GET /api/products/{slug}` returns `images: ProductImage[]`. A component that works on the detail page will be wrong on the listing page if it only reads `images`.
- **Types drift from the API**: `lib/types.ts` is hand-written. Run `npm run gen:types` after backend schema changes to generate `lib/generated-types.ts` from the live OpenAPI spec, then diff it against `lib/types.ts` to find drift. The backend must be running on `localhost:8000`. **Full process (incl. the admin app, which has no generator): see `docs/type-sync.md`.**
- **Audit all usages**: When you find a type mismatch, search the whole codebase for every place that assumes the same shape before fixing just one.

### Running tests

```powershell
npm run test:e2e   # Playwright storefront tests (backend :8000 + storefront :3000 must be running)
npm run gen:types  # regenerate lib/generated-types.ts from live OpenAPI spec
```

---

## Architecture Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Pages | Next.js 16 App Router (server components by default) | Routing and page rendering |
| Data fetching | `lib/api.ts` → `serverFetch` (server) / `api.get/post` (client) | All API calls go through these helpers |
| State | Zustand stores in `store/` (auth, cart) | Client-side session state |
| Styling | Tailwind v4 + CSS custom properties | Token defaults in `themes/default/globals.css`, Tailwind mapping in `app/globals.css`, DB overrides via `lib/theme-colors.ts` |
| Types | `lib/types.ts` | Shared TypeScript interfaces |

The backend API runs at `http://localhost:8000` in development. All API calls are proxied via `next.config.ts`.

---

## Design Token System

Client colours live in **two layers**:

1. **Theme-file defaults (superadmin, per client branch):** `themes/default/globals.css` defines every token as a CSS custom property. `app/globals.css` imports it and maps the tokens to Tailwind utilities via the `@theme inline` block — **do not add Tailwind config files**.
2. **Database overrides (admin, no code change):** the admin panel's Branding → Colours section stores `theme_colors` on `/api/branding` (5 core colours + optional per-shade overrides). `app/layout.tsx` derives the full shade set via `lib/theme-colors.ts` and injects the CSS variables as an **inline `style` on `<html>`**, which beats the stylesheet `:root` defaults. Empty `theme_colors` = theme-file defaults apply unchanged.

`lib/theme-colors.ts` (derivation rules, contrast helpers) is **duplicated** at `frontend-admin/lib/theme-colors.ts` — the storefront copy is the source of truth; when editing it, re-copy to the admin app (same discipline as type-sync).

### Token vocabulary (Tri Star values shown; full list in `themes/default/globals.css`)

| Family | Tokens | Role |
|---|---|---|
| brand | `--brand` #C8102E, `--brand-hover`, `--brand-tint` (light hover bgs/pills), `--brand-highlight` (on dark), `--brand-shadow`, `--on-brand` (button text — auto white/dark for contrast) | Primary buttons, links, badges |
| dark | `--brand-dark` #1B2A4A, `--dark-deep` (footer), `--dark-border`, `--on-dark-strong/-on-dark/-muted/-faint` (text tiers on dark) | Headings, dark sections |
| accent | `--accent` #D4A017, `--accent-hover` | Special Offers, review stars |
| neutrals | `--bg`, `--surface-alt` (zebra rows), `--fg`, `--muted`, `--text-placeholder`, `--border`, `--border-subtle`, `--card-bg`, `--brand-secondary`, `--alert` | Backgrounds, text, dividers |

Every token has a Tailwind utility (`bg-brand-tint`, `text-on-dark-muted`, `border-border-subtle`, …). **Never hardcode hex colours in components** — the only allowed exceptions are: status greens/ambers/reds (stock/availability badges), Trustpilot green, pastel image-placeholder gradients, the Stripe Elements input theme, and decorative gradients in `components/blocks/*/shiny-button.tsx`.

Buttons with `bg-brand` must use `text-on-brand` (not `text-white`) so light brand colours (e.g. yellow) automatically get dark text.

---

## Image Assets — Two Lanes

There are two distinct image stores with different owners and URL patterns:

| Image type | Where | URL pattern | Who sets it |
|---|---|---|---|
| Logo, favicon, hero, section backgrounds | `public/images/` (committed to git branch) | `/images/filename.ext` | Superadmin |
| Product photos, promo banners | Backend `uploads/` (uploaded via admin panel) | `http://host/uploads/uuid-file.jpg` | Admin |

**Superadmin images** (per-client branding, committed to the client's git branch):

| File | Config key | Purpose |
|---|---|---|
| `public/images/logo.png` | `store.logo_url` | Navbar / footer logo |
| `public/images/favicon.ico` | `store.favicon_url` | Browser tab icon |
| `public/images/hero.jpg` | `sections[scroll-expand-hero].mediaSrc` | Hero foreground image |
| `public/images/hero-bg.jpg` | `sections[scroll-expand-hero].bgImageSrc` | Hero full-bleed background |
| `public/images/cta-bg.jpg` | `sections[cta-banner].backgroundImage` | CTA section background |
| `public/images/newsletter-bg.jpg` | `sections[newsletter-section].backgroundImage` | Newsletter section background |

All `/images/...` paths are relative to the Next.js `public/` directory and work on any host without URL changes. Place image files in `public/images/` and commit them to the client's branch.

**Admin-managed images** (uploaded through the admin panel, stored in the backend):
- These are product photos, promotion banners, and other content the client manages day-to-day.
- URLs are absolute (e.g. `http://localhost:8000/uploads/uuid-file.jpg`) and are stored in the database.
- Do not commit these to git.

---

## Applying a New Client's Design

Given a `design.md` file with the client's brand, follow these steps in order.

### Step 1 — Update CSS tokens in `themes/default/globals.css`

Map the client's colours to the token names (full vocabulary in the Design Token System section above — set at minimum the family bases and let the shades follow the same relationships as the Tri Star values). The token names are semantic (what the colour IS used for), not descriptive (what the colour looks like):

| Token | Maps to |
|-------|---------|
| `--brand` | Primary action colour (main CTA, primary button background) |
| `--brand-hover` | Primary button hover — typically `--brand` darkened by ~10% |
| `--brand-tint` / `--brand-highlight` / `--brand-shadow` | Very light / light / translucent variants of `--brand` |
| `--on-brand` | Button text on `--brand` — white for dark brands, near-black for light ones |
| `--brand-dark` | Emphasis / link colour — the darkest brand colour (plus `--dark-deep`, `--dark-border`, `--on-dark-*` tiers) |
| `--accent` | Highlight colour (offers, stars) + `--accent-hover` |
| `--brand-secondary` | Secondary button background |
| `--alert` | Error / destructive action colour |
| `--fg` | Primary body text colour (plus `--muted`, `--text-placeholder`) |
| `--bg` | Page background (plus `--surface-alt`, `--border`, `--border-subtle`, `--card-bg`) |

Alternatively, skip the code edit entirely: set the colours through the admin panel's Branding → Colours section (stored in the DB, overrides these defaults at render time).

**Example** — converting a client's design.md entry to tokens:
```
Client design.md:   "Primary: #E67E22 (orange)"
→ --brand: #E67E22;
→ --brand-hover: #CA6F1E;   (darken ~10%)
→ --brand-dark: #784212;    (darkest variant for text/links)
```

**Contrast check before committing:**
- `--brand` on white must be ≥ 4.5:1 (WCAG AA normal text) or ≥ 3:1 (large text / UI components)
- `--brand-dark` on white should be ≥ 7:1 for body text use
- Focus rings use `focus:ring-brand-dark` — ensure `--brand-dark` on white is ≥ 3:1

### Step 2 — Update the font in `app/layout.tsx`

1. Change the import to the client's font (must be available on Google Fonts):
   ```tsx
   import { ClientFont } from "next/font/google"
   const clientFont = ClientFont({
     variable: "--font-poppins",   // keep this variable name — globals.css references it
     subsets: ["latin"],
     weight: ["400", "500", "600", "700"],
   })
   ```
2. Replace the font variable in the `<html>` tag: `` className={`${clientFont.variable} h-full`} ``

If the client uses a custom/self-hosted font, place it in `public/fonts/` and add an `@font-face` rule in `globals.css` instead of using `next/font/google`.

### Step 3 — Author the homepage `sections[]`

The homepage is assembled from `landing-page.config.json` → `sections[]`,
rendered through `LandingSectionRenderer` + `BLOCK_REGISTRY`
(`lib/block-registry.ts`). **Never hand-edit `app/page.tsx` for a client
design** — it is a thin data-fetch + loop and stays identical across clients.

Each entry is `{ "__block": "<registry-key>", ...props }`. Optional keys:
- `requiredPlugin` — section is dropped unless the plugin is enabled.
- Blocks flagged `acceptsData` in the registry receive live products/categories
  fetched by the page; all other props come from the config entry.

To give a client a section that has no matching block, follow the page-intake
procedure in
`docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`:
slice → match against the registry → wrap or build new blocks (in
`components/blocks/**`, registered in `lib/block-registry.ts`) → naturalise
(theme tokens, shared spacing/radius/motion) → assemble the config.
New blocks must use named theme tokens — never raw hex values.

Old configs are archived in `config-archive/` (nothing there is read by any
build). The `landing-*` registry keys are coarse wraps of the original Tri
Star sections in `components/landing/` — reuse them where a client wants the
same layout with different branding.

### Step 4 — Update runtime branding via the admin panel

Store name, logo URL, tagline, and contact info are stored in the backend database. Log in to the admin panel at `http://localhost:3001` as `admin@commerceforce.dev / Admin1234!` and go to **Branding** to set:
- Store name
- Tagline
- Logo URL
- Contact email / phone
- Social links

These are loaded server-side on every request and injected into the Navbar, Footer, and page `<title>`. No code changes needed.

Alternatively, update `backend/seed.py`'s `seed_branding()` function to set the client's values at deployment time.

### Step 5 — Seed demo products for the client's category

Update `backend/seed.py`'s `_CATEGORIES` list and `_products()` function with the client's actual product taxonomy and sample products. Run `python seed.py` after deployment.

---

## Key Files Reference

| File | What it does |
|------|-------------|
| `themes/default/globals.css` | **Design token defaults** — per-client colours live here |
| `app/globals.css` | Tailwind `@theme` mapping from tokens to utility classes |
| `lib/theme-colors.ts` | Colour derivation + contrast helpers (copy synced to frontend-admin) |
| `app/layout.tsx` | Root layout — font import, Navbar/Footer, custom CSS injection |
| `app/page.tsx` | Home page — renders `sections[]` from `landing-page.config.json` via `LandingSectionRenderer`; do not hand-edit per client |
| `lib/block-registry.ts` | Block registry — every homepage section type; add new blocks here |
| `app/products/page.tsx` | Product listing with search + filters |
| `app/products/[slug]/page.tsx` | Product detail page |
| `app/cart/page.tsx` | Cart with quantity controls |
| `app/checkout/page.tsx` | Checkout form → `POST /api/checkout` |
| `components/layout/navbar.tsx` | Top navigation — uses `branding.store_name` |
| `components/layout/footer.tsx` | Footer — uses `branding.contact_email`, social links |
| `components/shop/product-card.tsx` | Product card used in listings and landing sections |
| `components/chat-widget.tsx` | AI chat bubble — talks to `POST /api/ai_chat/message` |
| `lib/api.ts` | HTTP client helpers (`serverFetch`, `api`) |
| `lib/types.ts` | TypeScript interfaces mirroring backend schemas |
| `store/auth.ts` | Zustand auth store (login, logout, token refresh) |
| `store/cart.ts` | Zustand cart store (add, update, remove, merge) |
| `next.config.ts` | API proxy — maps `/api/*` to backend `http://localhost:8000` |

---

## Customisation Checklist (new client deployment)

- [ ] Copy `frontend-starter/` to the client's project directory (or create a git branch)
- [ ] Edit `landing-page.config.json`: set `brand` colours + font, `store` name/tagline/contact, `plugins` list
- [ ] Add client image files to `public/images/`: `logo.png`, `favicon.ico`, `hero.jpg`, `hero-bg.jpg`, `cta-bg.jpg`, `newsletter-bg.jpg`
- [ ] Author the homepage `sections[]` in `landing-page.config.json` (Step 3 in Applying a New Client's Design)
- [ ] Update product categories and demo products in `backend/seed.py`
- [ ] Run `python seed.py` to populate the database
- [ ] Run `npm run build` to verify no TypeScript errors
- [ ] Test golden path: browse → add to cart → checkout → order confirmed
- [ ] Update `backend/.env` `ENABLED_PLUGINS` to match the `plugins` list in config
- [ ] Configure SMTP credentials in `backend/.env` for order emails

---

## Development Commands

```powershell
# Backend (from backend/)
.venv\Scripts\python.exe seed.py          # seed demo data
.venv\Scripts\python.exe -m uvicorn app.main:app --reload  # start API
.venv\Scripts\python.exe -m pytest -q     # run tests

# Storefront (from frontend-starter/)
npm run dev                               # start dev server on :3000
npm run build                             # production build check
npm run lint                              # ESLint
```

---

## Current Client: Tarpaulins To Go

- **Brand:** Sage Green (`#B6C1A1`) primary, Deep Green (`#0D3328`) emphasis, Poppins font
- **Design source:** `Design_Competitor.md` at project root
- **Admin credentials:** `admin@commerceforce.dev / Admin1234!`
- **Superadmin credentials:** `superadmin@commerceforce.dev / SuperAdmin1234!`
- **Backend API:** `http://localhost:8000`
- **Admin panel:** `http://localhost:3001`
