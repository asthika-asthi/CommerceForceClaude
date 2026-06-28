# Component Library — Design Spec

**Date:** 2026-06-28
**Status:** Approved

---

## Goal

Two deliverables in one sprint:

1. Reorganise `components/blocks/` into categorised subdirectories and add 8 new visual/content blocks to the registry.
2. Replace the plain `<select>` variant picker on the product detail page with clickable pill buttons, with out-of-stock values shown as greyed strikethrough pills.

---

## Part 1 — Block directory reorganisation

### Current state

22 block files sit flat in `components/blocks/`. The registry (`lib/block-registry.ts`) imports them all directly. At 30+ blocks this becomes hard to navigate.

### New structure

Move all existing blocks into four subdirectories. No block is renamed, no registry key changes, no config JSON changes — this is a file-system-only change.

```
components/blocks/
  layout/
    navbar-block.tsx
    footer-block.tsx
    menu-block.tsx
    tubelight-navbar-block.tsx
    announcement-bar.tsx
  visual/
    scroll-expand-hero.tsx
    glowing-shadow.tsx
    shiny-button.tsx
    promotions-banner.tsx
    glassmorphism-hero.tsx       ← new
    parallax-banner.tsx          ← new
    marquee-ticker.tsx           ← new
    gradient-text-section.tsx    ← new
    image-mosaic.tsx             ← new
  commerce/
    featured-products-grid.tsx
    category-grid.tsx
    coupon-spotlight.tsx
    trust-strip.tsx
    product-range-table.tsx
    loyalty-widget-section.tsx
  content/
    testimonials-carousel.tsx
    newsletter-section.tsx
    cta-banner.tsx
    dual-cta-banner.tsx
    stats-band.tsx
    how-to-order.tsx
    button-group.tsx
    split-image-text.tsx         ← new
    animated-counter.tsx         ← new
    bento-grid.tsx               ← new
```

### What changes

- Every import path in `lib/block-registry.ts` updates to use the subdirectory prefix (e.g. `@/components/blocks/layout/navbar-block`).
- `lib/block-defaults.ts` gains entries for all 8 new blocks (import paths unchanged — block-defaults does not import components).
- `components/blocks/index.ts` is updated or removed depending on whether anything imports from it directly.
- `components/blocks/glowing-shadow.css` moves to `components/blocks/visual/glowing-shadow.css` alongside its component file. The import path inside `glowing-shadow.tsx` updates accordingly.
- No other file changes.

### What does NOT change

- Registry keys in `BLOCK_REGISTRY` (e.g. `'navbar'`, `'featured-products-grid'`)
- `landing-page.config.json` structure or values
- `lib/block-defaults.ts` existing entries
- `components/shop/landing-section.tsx` (the renderer)
- Admin panel block picker

### Note on data-fetching blocks

Five blocks make their own API calls internally. Their behaviour is unchanged by this reorganisation — the fetch calls live inside the component file and move with it.

| Block | Fetches |
|---|---|
| `featured-products-grid` | `GET /api/products` |
| `category-grid` | `GET /api/categories` |
| `loyalty-widget-section` | `GET /api/loyalty/me` |
| `coupon-spotlight` | `GET /api/coupons/featured` |
| `promotions-banner` | `GET /api/landing_page` |

All other blocks are fully static (config props only).

---

## Part 2 — 8 new blocks

All new blocks are static (no API calls). All receive their data as props from `landing-page.config.json`. All must be registered in both `lib/block-registry.ts` and `lib/block-defaults.ts`.

framer-motion is already installed in the project and used by `scroll-expand-hero`. New blocks that need animation may use it.

### 1. `glassmorphism-hero` → `visual/`

Full-bleed background image with a frosted-glass card centred over it. Card contains a title, optional subtitle, and optional CTA button.

Props: `backgroundImage: string`, `title: string`, `subtitle?: string`, `ctaText?: string`, `ctaUrl?: string`, `overlayOpacity?: number` (default `0.4`)

Implementation: background image via inline `style`, card uses `backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl` (Tailwind).

### 2. `parallax-banner` → `visual/`

A banner section where the background image scrolls at a slower rate than the page, creating a depth effect. Text and optional CTA are overlaid.

Props: `backgroundImage: string`, `title: string`, `subtitle?: string`, `ctaText?: string`, `ctaUrl?: string`, `overlayOpacity?: number` (default `0.5`), `minHeight?: string` (default `'400px'`)

Implementation: CSS `background-attachment: fixed; background-size: cover` on the section element. Falls back gracefully on mobile (iOS does not support `background-attachment: fixed` — use `background-attachment: scroll` via a `@media` query or detect touch).

### 3. `marquee-ticker` → `visual/`

A horizontal strip with continuously scrolling items. Useful for trust signals ("Free delivery over £50 · 30-day returns · Rated 4.9★"), brand names, or certifications.

Props: `items: string[]`, `speed?: number` (default `40`, pixels/second equivalent via CSS `animation-duration`), `backgroundColor?: string`, `textColor?: string`, `separator?: string` (default `'·'`)

Implementation: CSS `@keyframes marquee` animation on a duplicated list (items repeated twice for seamless loop). `'use client'` directive not required — pure CSS animation.

### 4. `gradient-text-section` → `visual/`

Centred impact statement where the heading text is rendered with a CSS linear gradient fill. Subtitle and optional CTA below.

Props: `title: string`, `subtitle?: string`, `ctaText?: string`, `ctaUrl?: string`, `gradientFrom?: string` (default `var(--brand)`), `gradientTo?: string` (default `var(--brand-dark)`)

Implementation: heading uses `bg-gradient-to-r from-[gradientFrom] to-[gradientTo] bg-clip-text text-transparent` pattern.

### 5. `image-mosaic` → `visual/`

An irregular image grid — two columns with alternating tall/short cards, suitable for lifestyle or product showcase sections.

Props: `images: Array<{ src: string; alt: string; linkUrl?: string }>`, `title?: string`

Implementation: CSS grid with `grid-template-rows` to create the staggered height effect. Minimum 4 images; if fewer supplied the remaining cells render as empty (no broken layout). Each image is wrapped in a Next.js `<Link>` if `linkUrl` is provided.

### 6. `split-image-text` → `content/`

Two-column layout: image on one side, heading + body text + optional CTA on the other. Config controls which side the image appears on.

Props: `image: string`, `imageAlt: string`, `title: string`, `body: string`, `ctaText?: string`, `ctaUrl?: string`, `imagePosition?: 'left' | 'right'` (default `'left'`)

Implementation: CSS grid `grid-cols-1 md:grid-cols-2`. On mobile both columns stack vertically, image first. `imagePosition: 'right'` uses `md:order-last` on the image column.

### 7. `animated-counter` → `content/`

A stats row (3–4 figures) where each number counts up from zero when the section scrolls into the viewport.

Props: `stats: Array<{ value: number; label: string; prefix?: string; suffix?: string }>`, `title?: string`

Implementation: `'use client'` component. Uses framer-motion's `useInView` to trigger counting when section enters the viewport. Each counter animates via framer-motion's `animate` on a local state value over `1.5s` with an `easeOut` curve.

### 8. `bento-grid` → `content/`

An asymmetric card grid — one large feature card plus two or three smaller cards arranged in a bento-box layout.

Props: `cards: Array<{ title: string; body: string; image?: string; linkUrl?: string; linkText?: string; size: 'large' | 'small' }>`

Implementation: CSS grid with `grid-cols-2 md:grid-cols-3`. Cards with `size: 'large'` span 2 columns (`col-span-2`). Cards include title, body, optional image at top, optional link at bottom. Maximum 4 cards; additional cards are ignored.

---

## Part 3 — Variant picker refactor

**File:** `app/products/[slug]/variant-picker.tsx`

**Interface unchanged:** the component still accepts `optionTypes`, `variants`, and `onSelect(variantId: string | null)`. `add-to-cart-button.tsx` and `page.tsx` are not modified.

### Visual design

Each option type renders as a labelled row of pill buttons:

```
Size
[ S ]  [ M ]  [ L ]  [ ~~XL~~ ]

Colour
[ Red ]  [ Blue ]  [ ~~Green~~ ]
```

**Selected pill:** `bg-brand-dark text-white border-brand-dark`
**Unselected pill:** `bg-bg text-fg border-border hover:border-brand-dark`
**Out-of-stock pill:** `bg-slate-100 text-muted line-through cursor-pointer opacity-60`

Out-of-stock pills remain clickable. If the user selects an out-of-stock combination, `onSelect(null)` is called — the cart button already handles this by showing "Out of stock" (the existing `inStock` prop on `AddToCartButton`).

### Out-of-stock detection

A value is considered out-of-stock for display purposes if no active variant exists that includes that option value — regardless of what other options are selected. This is a pre-computation: before rendering, build a set of `{ optionTypeName, optionValueLabel }` pairs that appear in at least one active variant. Any value not in that set gets the out-of-stock pill style.

### No `<select>` elements remain

The refactor removes all `<select>` and `<option>` elements from the component. Accessibility is maintained via `role="group"` on each option type row and `aria-pressed` on each pill button.

---

## Testing approach

No automated tests. TypeScript build + manual browser verification.

**Order:** reorganise directories and pass build check first. Then add new blocks one at a time.

| Check | How |
|---|---|
| All 22 existing blocks still render | Load Tri Star UK landing page in dev — every section appears unchanged |
| Build passes after reorganisation | `npm run build` — zero TypeScript errors |
| Each new block renders with defaults | Add block to `landing-page.config.json` temporarily, reload, verify, remove |
| Variant picker pills render | Open a product with variants — no `<select>` elements, pill rows appear |
| Out-of-stock pill renders | Deactivate a variant in admin, reload product — that value greyed with strikethrough |
| Out-of-stock combo blocks add-to-cart | Select the greyed pill combination, confirm button shows "Out of stock" |
| Lint passes | `npm run lint` — no errors |
