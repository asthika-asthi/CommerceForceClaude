# Superadmin Seed + Client Storefront Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed a superadmin user and apply the Tarpaulins To Go brand design to the storefront, then document the per-client customization workflow in a CLAUDE.md guide.

**Architecture:** Three independent tasks. Superadmin seed is a pure backend change (one function added to `seed.py`). Design application uses Tailwind v4's CSS custom property system — colours and font are defined once in `globals.css`, mapped to Tailwind utilities via `@theme inline`, then applied with a global class-name replacement across 15 components. The CLAUDE.md guide documents the workflow so future client storefronts can be spun up by reading the guide and a new `design.md`.

**Tech Stack:** Python/SQLAlchemy (seed), Next.js 16 / Tailwind v4 / CSS custom properties (design), Markdown (guide).

**Working directory:** `D:\Projects\20260609_Commerceforce`

---

## File Structure

| Task | Files Created / Modified |
|------|--------------------------|
| 1 | `backend/seed.py` (modify — add `seed_superadmin`) |
| 2 | `frontend-starter/app/globals.css` (modify — brand colours + @theme mapping) |
| 2 | `frontend-starter/app/layout.tsx` (modify — swap Geist → Poppins) |
| 2 | 15 component files (bulk replace `blue-*` → `brand-*` Tailwind classes via PowerShell) |
| 3 | `frontend-starter/CLAUDE.md` (replace — full per-client customisation guide) |

---

## Task 1: Seed Superadmin User

**Context:** `backend/seed.py` creates an `admin` user but no `superadmin`. The `UserRole.superadmin` enum value exists in `app/plugins/auth/models.py`. The superadmin role has elevated permissions above `admin` (e.g. plugin management, branding). The seed must be idempotent — check by email before inserting.

`get_password_hash` is already imported at the top of the file from `app.plugins.auth.service`.

**Files:**
- Modify: `backend/seed.py`

- [ ] **Step 1: Add `seed_superadmin` function**

Open `backend/seed.py`. After the `seed_admin` function (around line 32), insert:

```python
async def seed_superadmin(db) -> None:
    result = await db.execute(select(User).where(User.email == "superadmin@commerceforce.dev"))
    if result.scalar_one_or_none():
        print("  Superadmin already exists — skipping.")
        return
    superadmin = User(
        email="superadmin@commerceforce.dev",
        hashed_password=get_password_hash("SuperAdmin1234!"),
        first_name="Super",
        last_name="Admin",
        role=UserRole.superadmin,
        is_active=True,
    )
    db.add(superadmin)
    await db.commit()
    print("  Created superadmin: superadmin@commerceforce.dev / SuperAdmin1234!")
```

- [ ] **Step 2: Call `seed_superadmin` in the `seed()` entry point**

In the `seed()` function (near the bottom of the file), add a call after `seed_admin`:

```python
async def seed() -> None:
    print("Seeding database…")
    async with AsyncSessionLocal() as db:
        await seed_admin(db)

    async with AsyncSessionLocal() as db:
        await seed_superadmin(db)

    async with AsyncSessionLocal() as db:
        await seed_branding(db)

    async with AsyncSessionLocal() as db:
        cat_ids = await seed_categories(db)

    async with AsyncSessionLocal() as db:
        await seed_products(cat_ids, db)

    print("Done.")
```

- [ ] **Step 3: Run seed script**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe seed.py
```

Expected output:
```
Seeding database…
  Admin already exists — skipping.
  Created superadmin: superadmin@commerceforce.dev / SuperAdmin1234!
  Branding already customised — skipping.
  Categories already exist (4) — skipping.
  Products already exist (13) — skipping.
Done.
```

- [ ] **Step 4: Verify via login API**

```powershell
$body = '{"email":"superadmin@commerceforce.dev","password":"SuperAdmin1234!"}'
$r = Invoke-WebRequest -Uri "http://localhost:8000/api/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
($r.Content | ConvertFrom-Json).user.role
```

Expected: `superadmin`

- [ ] **Step 5: Run seed a second time to verify idempotency**

```powershell
.venv\Scripts\python.exe seed.py
```

Expected: `Superadmin already exists — skipping.`

- [ ] **Step 6: Run backend test suite to confirm nothing regressed**

```powershell
.venv\Scripts\python.exe -m pytest --tb=short -q
```

Expected: 114 passed.

- [ ] **Step 7: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add backend/seed.py
git commit -m "feat: seed superadmin account"
```

---

## Task 2: Apply Tarpaulins To Go Design

**Context:** The storefront `frontend-starter` uses Tailwind v4 (CSS-import mode, no `tailwind.config.js`). Colour theming is driven by CSS custom properties in `globals.css`, which maps them to Tailwind utilities via `@theme inline`. Currently all interactive elements use hardcoded Tailwind `blue-*` classes across 15 component files.

**Tarpaulins To Go brand tokens:**
| Token | Value | Use |
|-------|-------|-----|
| `--brand` | `#B6C1A1` | Primary buttons, badges, active accents |
| `--brand-hover` | `#A3AE8E` | Primary button hover state |
| `--brand-dark` | `#0D3328` | Links, active nav, emphasis text |
| `--brand-secondary` | `#555555` | Secondary buttons |
| `--alert` | `#FF0000` | Error, destructive actions |
| `--fg` | `#000000` | Body text (was `#0f172a`) |
| `--bg` | `#ffffff` | Background (unchanged) |

Font: **Poppins** (400, 500, 600, 700) replacing Geist.

**Files:**
- Modify: `frontend-starter/app/globals.css`
- Modify: `frontend-starter/app/layout.tsx`
- Bulk-modify: 15 `.tsx` files (PowerShell replace)

### Step A: Update globals.css

- [ ] **Step 1: Replace globals.css with updated brand tokens**

Overwrite `frontend-starter/app/globals.css` entirely:

```css
@import "tailwindcss";

:root {
  /* Tarpaulins To Go brand */
  --brand: #B6C1A1;
  --brand-hover: #A3AE8E;
  --brand-dark: #0D3328;
  --brand-secondary: #555555;
  --alert: #FF0000;
  /* Neutral */
  --bg: #ffffff;
  --fg: #000000;
  --muted: #64748b;
  --border: #e2e8f0;
  --card-bg: #f8fafc;
}

@theme inline {
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-dark: var(--brand-dark);
  --color-brand-secondary: var(--brand-secondary);
  --color-alert: var(--alert);
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --font-sans: var(--font-poppins), system-ui, sans-serif;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
}

* { box-sizing: border-box; }
```

### Step B: Update layout.tsx to use Poppins

- [ ] **Step 2: Swap Geist font for Poppins in layout.tsx**

Replace the entire content of `frontend-starter/app/layout.tsx`:

```tsx
import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { ChatWidget } from "@/components/chat-widget"
import { serverFetch } from "@/lib/api"
import type { BrandingConfig } from "@/lib/types"

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export async function generateMetadata(): Promise<Metadata> {
  const branding = await serverFetch<BrandingConfig>("/api/branding")
  return {
    title: { default: branding?.store_name ?? "Store", template: `%s | ${branding?.store_name ?? "Store"}` },
    description: branding?.tagline,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await serverFetch<BrandingConfig>("/api/branding")

  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      {branding?.custom_css && (
        <head><style>{branding.custom_css}</style></head>
      )}
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Navbar branding={branding} />
          <main className="flex-1">{children}</main>
          <Footer branding={branding} />
          <ChatWidget />
        </Providers>
      </body>
    </html>
  )
}
```

### Step C: Bulk-replace blue colour classes

- [ ] **Step 3: Run PowerShell replace across all storefront components**

This replaces `blue-*` Tailwind classes with the semantic brand-token equivalents in all `.tsx` and `.ts` files under `frontend-starter` (excluding `node_modules`):

```powershell
$root = "D:\Projects\20260609_Commerceforce\frontend-starter"
$files = Get-ChildItem -Path $root -Recurse -Include "*.tsx","*.ts" |
         Where-Object { $_.FullName -notlike "*node_modules*" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $updated = $content `
        -replace 'bg-blue-600',          'bg-brand' `
        -replace 'bg-blue-700',          'bg-brand-hover' `
        -replace 'hover:bg-blue-700',    'hover:bg-brand-hover' `
        -replace 'hover:bg-blue-600',    'hover:bg-brand' `
        -replace 'text-blue-600',        'text-brand-dark' `
        -replace 'hover:text-blue-600',  'hover:text-brand-dark' `
        -replace 'border-blue-600',      'border-brand' `
        -replace 'border-blue-500',      'border-brand' `
        -replace 'ring-blue-600',        'ring-brand' `
        -replace 'ring-blue-500',        'ring-brand' `
        -replace 'focus:ring-blue-500',  'focus:ring-brand' `
        -replace 'focus:ring-blue-600',  'focus:ring-brand' `
        -replace 'focus:border-blue-500','focus:border-brand'
    if ($updated -ne $content) {
        Set-Content $file.FullName $updated -NoNewline
        Write-Host "Updated: $($file.Name)"
    }
}
```

Expected output: a list of updated filenames (should include `navbar.tsx`, `login/page.tsx`, `register/page.tsx`, `products/page.tsx`, `cart/page.tsx`, `checkout/page.tsx`, and others).

- [ ] **Step 4: Verify no `blue-6` or `blue-7` remain in component files**

```powershell
Select-String -Path "D:\Projects\20260609_Commerceforce\frontend-starter\app","D:\Projects\20260609_Commerceforce\frontend-starter\components" -Recurse -Include "*.tsx" -Pattern "blue-[67]"
```

Expected: no output (zero matches). If any remain, they are intentional design accents — review manually.

- [ ] **Step 5: TypeScript build check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npm run build 2>&1 | Select-Object -Last 10
```

Expected: `✓ Compiled successfully` (or `Route (app) ...` summary with no errors).

- [ ] **Step 6: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add frontend-starter/app/globals.css frontend-starter/app/layout.tsx
git add frontend-starter/app frontend-starter/components
git commit -m "feat: apply Tarpaulins To Go brand — Poppins font, sage green primary, deep green emphasis"
```

---

## Task 3: Per-Client Storefront Customisation Guide (CLAUDE.md)

**Context:** The `frontend-starter/CLAUDE.md` currently contains only `@AGENTS.md` (a pointer to the Next.js 16 warning). This task replaces it with the full per-client customisation guide that future Claude sessions (or developers) will read when deploying the storefront for a new client.

The guide must answer: "I have a `design.md` from a new client — what do I change and in what order?"

**Files:**
- Replace: `frontend-starter/CLAUDE.md`

- [ ] **Step 1: Replace frontend-starter/CLAUDE.md with the customisation guide**

Overwrite `frontend-starter/CLAUDE.md` entirely:

```markdown
# CommerceForce Storefront — Per-Client Customisation Guide

This is the **storefront template** for CommerceForce, a headless modular monolith e-commerce platform. Each client deployment starts as a copy of this directory. Read this guide before making any changes.

> ⚠️ **Next.js 16 notice:** This project uses Next.js 16 (App Router). APIs and conventions differ from older versions. When in doubt, check `node_modules/next/dist/docs/`.

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
| `--brand-dark` | `bg-brand-dark`, `text-brand-dark` | Links, active states |
| `--brand-secondary` | `bg-brand-secondary` | Secondary buttons |
| `--alert` | `bg-alert`, `text-alert` | Error badges, delete buttons |
| `--bg` | `bg-bg` | Page/card backgrounds |
| `--fg` | `text-fg` | Body text |

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
2. Replace the font variable in the `<html>` tag: `className={`${clientFont.variable} h-full`}`

If the client uses a custom/self-hosted font, place it in `public/fonts/` and add an `@font-face` rule in `globals.css` instead of using `next/font/google`.

### Step 3 — Run the bulk class-replace script (first time only)

If starting from the template (which uses `blue-*` placeholder classes), run the PowerShell replacement from the project root to update all components at once:

```powershell
$root = "D:\Projects\<project>\frontend-starter"
$files = Get-ChildItem -Path $root -Recurse -Include "*.tsx","*.ts" |
         Where-Object { $_.FullName -notlike "*node_modules*" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $updated = $content `
        -replace 'bg-blue-600',          'bg-brand' `
        -replace 'bg-blue-700',          'bg-brand-hover' `
        -replace 'hover:bg-blue-700',    'hover:bg-brand-hover' `
        -replace 'hover:bg-blue-600',    'hover:bg-brand' `
        -replace 'text-blue-600',        'text-brand-dark' `
        -replace 'hover:text-blue-600',  'hover:text-brand-dark' `
        -replace 'border-blue-600',      'border-brand' `
        -replace 'ring-blue-500',        'ring-brand' `
        -replace 'focus:ring-blue-500',  'focus:ring-brand' `
        -replace 'focus:border-blue-500','focus:border-brand'
    if ($updated -ne $content) {
        Set-Content $file.FullName $updated -NoNewline
    }
}
```

After a fresh clone from the template, this is done **once** — all subsequent colour changes are made only in `globals.css` by updating the `:root` values.

### Step 4 — Update runtime branding via the admin panel

Store name, logo URL, tagline, and contact info are stored in the backend database. Log in to the admin panel at `http://localhost:3001` as `admin@commerceforce.dev / Admin1234!` and go to **Branding** to set:
- Store name
- Tagline
- Logo URL
- Contact email / phone
- Social links

These are loaded server-side on every request and injected into the Navbar, Footer, and page `<title>`. No code changes needed.

Alternatively, update `backend/seed.py`'s `seed_branding()` function to set the client's values at deployment time.

### Step 5 — Seed demo products for the client category

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

- [ ] Copy `frontend-starter/` to the client's project directory
- [ ] Update `app/globals.css` `:root` tokens with client's colours
- [ ] Update font in `app/layout.tsx`
- [ ] Run bulk class-replace script (Step 3 above) if starting from template
- [ ] Set store name, logo, and contact info via admin panel or `seed.py`
- [ ] Update product categories and demo products in `seed.py`
- [ ] Run `python seed.py` to populate the database
- [ ] Run `npm run build` to verify no TypeScript errors
- [ ] Test golden path: browse → add to cart → checkout → order confirmed
- [ ] Update `backend/.env` `ENABLED_PLUGINS` to match client's purchased plugins
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

- **Brand:** Sage Green (#B6C1A1) primary, Deep Green (#0D3328) emphasis, Poppins font
- **Design source:** `Design_Competitor.md` at project root
- **Admin credentials:** `admin@commerceforce.dev / Admin1234!`
- **Superadmin credentials:** `superadmin@commerceforce.dev / SuperAdmin1234!`
- **Backend API:** `http://localhost:8000`
- **Admin panel:** `http://localhost:3001`
```

- [ ] **Step 2: Verify the file was written**

```powershell
(Get-Content "D:\Projects\20260609_Commerceforce\frontend-starter\CLAUDE.md" | Measure-Object -Line).Lines
```

Expected: 170+ lines.

- [ ] **Step 3: Confirm the build still passes (CLAUDE.md is non-code, but verify)**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npm run build 2>&1 | Select-Object -Last 5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add frontend-starter/CLAUDE.md
git commit -m "docs: add per-client storefront customisation guide to CLAUDE.md"
```

---

## Verification Checklist

- [ ] `superadmin@commerceforce.dev / SuperAdmin1234!` logs in and returns `role: superadmin`
- [ ] Running `seed.py` twice prints `Superadmin already exists — skipping.` on second run
- [ ] Storefront font is Poppins (visible in browser DevTools → Fonts)
- [ ] Primary buttons are Sage Green (`#B6C1A1`), not blue
- [ ] Active nav links use Deep Green (`#0D3328`), not blue
- [ ] `npm run build` passes with 0 TypeScript errors
- [ ] `frontend-starter/CLAUDE.md` covers: token system, per-client checklist, key file reference
- [ ] 114 backend tests still pass
