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
- **Types drift from the API**: `lib/types.ts` is hand-written. Run `npm run gen:types` after backend schema changes to generate `lib/generated-types.ts` from the live OpenAPI spec, then diff it against `lib/types.ts` to find drift. The backend must be running on `localhost:8000`.
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
| Styling | Tailwind v4 + CSS custom properties | Design tokens in `app/globals.css` |
| Types | `lib/types.ts` | Shared TypeScript interfaces |

The backend API runs at `http://localhost:8000` in development. All API calls are proxied via `next.config.ts`.

---

## Design Token System

All client-specific colours and the font are defined as CSS custom properties in `app/globals.css`. Tailwind utilities (`bg-brand`, `text-brand-dark`, etc.) are generated from them via the `@theme inline` block — **do not add Tailwind config files**.

### Current tokens (Tarpaulins To Go)

```css
:root {
  --brand: #B6C1A1;          /* primary buttons, badges */
  --brand-hover: #A3AE8E;    /* primary button hover */
  --brand-dark: #0D3328;     /* links, active nav, emphasis */
  --brand-secondary: #555555;/* secondary buttons */
  --alert: #FF0000;          /* errors, destructive */
  --bg: #ffffff;             /* page background */
  --fg: #000000;             /* body text */
  --muted: #64748b;          /* secondary text */
  --border: #e2e8f0;         /* dividers */
  --card-bg: #f8fafc;        /* card backgrounds */
}
```

### Available Tailwind utilities (generated from tokens)

| CSS token | Tailwind class | Example use |
|-----------|---------------|-------------|
| `--brand` | `bg-brand`, `text-brand`, `border-brand` | Primary buttons |
| `--brand-hover` | `bg-brand-hover` | Primary button `:hover` |
| `--brand-dark` | `bg-brand-dark`, `text-brand-dark` | Links, active states, focus rings |
| `--brand-secondary` | `bg-brand-secondary` | Secondary buttons |
| `--alert` | `bg-alert`, `text-alert` | Error badges, delete buttons |
| `--bg` | `bg-bg` | Page/card backgrounds |
| `--fg` | `text-fg` | Body text |

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

### Step 1 — Update CSS tokens in `app/globals.css`

Map the client's colours to the token names. The token names are semantic (what the colour IS used for), not descriptive (what the colour looks like):

| Token | Maps to |
|-------|---------|
| `--brand` | Primary action colour (main CTA, primary button background) |
| `--brand-hover` | Primary button hover — typically `--brand` darkened by ~10% |
| `--brand-dark` | Emphasis / link colour — the darkest brand colour |
| `--brand-secondary` | Secondary button background |
| `--alert` | Error / destructive action colour |
| `--fg` | Primary body text colour |
| `--bg` | Page background |

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

### Step 3 — Run the bulk class-replace script (first time only)

If starting from a fresh template clone (which uses `blue-*` placeholder classes), run this PowerShell script once to update all components. After this, all colour changes are made only in `globals.css`.

```powershell
$root = "D:\Projects\<project>\frontend-starter"
$files = Get-ChildItem -Path $root -Recurse -Include "*.tsx","*.ts" |
         Where-Object { $_.FullName -notlike "*node_modules*" }

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $updated = $content `
        -replace 'bg-blue-600',           'bg-brand' `
        -replace 'bg-blue-700',           'bg-brand-hover' `
        -replace 'hover:bg-blue-700',     'hover:bg-brand-hover' `
        -replace 'hover:bg-blue-600',     'hover:bg-brand' `
        -replace 'text-blue-600',         'text-brand-dark' `
        -replace 'hover:text-blue-600',   'hover:text-brand-dark' `
        -replace 'border-blue-600',       'border-brand' `
        -replace 'ring-blue-500',         'ring-brand-dark' `
        -replace 'focus:ring-blue-500',   'focus:ring-brand-dark' `
        -replace 'focus:border-blue-500', 'focus:border-brand'
    if ($updated -ne $content) {
        [System.IO.File]::WriteAllText($file.FullName, $updated, (New-Object System.Text.UTF8Encoding $false))
    }
}
```

After running, grep for any remaining `blue-[67]` and fix manually — gradients and tinted status badges need human judgment.

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
| `app/globals.css` | **Design tokens** — change colours/font here first |
| `app/layout.tsx` | Root layout — font import, Navbar/Footer, custom CSS injection |
| `app/page.tsx` | Home page — landing sections from `/api/landing_page` |
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
- [ ] Run bulk class-replace script (Step 3 in Applying a New Client's Design) if starting from template
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
