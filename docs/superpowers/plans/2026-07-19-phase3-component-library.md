# Phase 3 — Component Library Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the 3 placeholder blocks to production tokens; add a real, layered pinch-to-zoom+pan capability to `showcase-gallery`; add optional chaptered scroll-storytelling to `scroll-expand-hero`; add a shared `ScrollReveal` mechanism applied to 3 named blocks; document the block-sourcing process; keep every reference doc in sync as each change lands.

**Architecture:** No new registry blocks. Every capability either enhances an existing block (additive, optional props, zero behaviour change when unset) or is a shared, non-block component (`ScrollReveal`, `PinchZoomImage`). A new dev-only preview route renders every block in isolation with fixture data, since none of these props are wired into any live client config yet — this is what the E2E suite exercises.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 tokens, framer-motion 12 (already a dependency — `useInView`, `useMotionValueEvent`, `useScroll`, `useTransform` all used), native Pointer Events API for gestures, Playwright E2E. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-19-phase3-component-library-design.md`

---

## Verified facts this plan is built on (do not re-derive)

- Branch base: `feat/ui-pipeline-phase2` — NOT master. `showcase-gallery.tsx`, `bento-grid.tsx`'s `font-heading` polish, `docs/component-library.md`, and `docs/component-library-gallery.html` only exist on that branch; master doesn't have them yet.
- framer-motion is `^12.40.0` (confirmed via `node_modules/framer-motion/package.json`) — `useMotionValueEvent` is available (added in v10).
- Tri Star's live `landing-page.config.json` uses only `landing-*` blocks — none of `scroll-expand-hero`, `showcase-gallery`, `bento-grid`, `split-image-text` are wired into any live config on this branch. A dev-only preview page is therefore required to E2E-test these changes at all (Task 1).
- `frontend-starter/public/images/` contains exactly one fixture image on this branch: `hero.jpg`. All preview fixtures use `/images/hero.jpg`.
- `frontend-starter/playwright.config.ts`: `testDir: './e2e'`, `baseURL: 'http://localhost:3000'`. Backend + storefront must already be running (`docs/local-dev.md`).
- `docs/component-library.md` entry line numbers (current, before this plan's edits): `scroll-expand-hero` at line 101, `showcase-gallery` at line 477, `bento-grid` at line 572, `split-image-text` at line 717, `navbar` at line 824, `footer` at line 840, `menu` at line 856.
- `docs/component-library-gallery.html` specimen line numbers (current): `VIS·02` (scroll-expand-hero) at line 418, `CON·01` (showcase-gallery) at line 914, `LAY·03/04/05` (navbar/footer/menu) at lines 1234/1251/1268.
- `docs/add-a-client-ui.md` exists (per-client build procedure); this plan adds a new, separate `docs/component-sourcing-process.md` for the per-library-growth process (different audience/purpose), cross-referenced from it.

**Working branch:** create `feat/component-library-phase3` off `feat/ui-pipeline-phase2` (Task 1). All commits go there.

---

### Task 1: Branch + dev-only block-preview harness

**Files:**
- Create: `frontend-starter/app/dev/block-preview/page.tsx`
- Modify: `frontend-starter/app/robots.ts`

- [ ] **Step 1: Create the branch**

```powershell
cd D:\Projects\20260609_Commerceforce
git checkout feat/ui-pipeline-phase2
git checkout -b feat/component-library-phase3
```

- [ ] **Step 2: Create the preview page** — renders every block this plan touches with fixture data. Not linked from any nav; excluded from the sitemap/robots (Step 3) and marked `noindex`.

```tsx
import type { Metadata } from 'next'
import { ScrollExpandHero } from '@/components/blocks/visual/scroll-expand-hero'
import { ShowcaseGallery } from '@/components/blocks/content/showcase-gallery'
import { BentoGrid } from '@/components/blocks/content/bento-grid'
import { SplitImageText } from '@/components/blocks/content/split-image-text'
import { NavbarBlock } from '@/components/blocks/layout/navbar-block'
import { FooterBlock } from '@/components/blocks/layout/footer-block'
import { MenuBlock } from '@/components/blocks/layout/menu-block'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Dev/QA-only route: renders every block touched by the Phase 3 component-
// library session in isolation, with fixture data. None of these props are
// wired into any live client config yet, so this is what Playwright exercises.
// Not linked from any nav; excluded from robots.ts and the sitemap.
export default function BlockPreviewPage() {
  return (
    <div>
      <div data-testid="preview-navbar">
        <NavbarBlock
          logoText="Preview Store"
          links={[{ label: 'Shop', url: '/products' }, { label: 'About', url: '/faq' }]}
          ctaLabel="Register"
          ctaUrl="/register"
        />
      </div>

      <div data-testid="preview-menu">
        <MenuBlock
          title="Quick Links"
          layout="horizontal"
          items={[{ label: 'Products', url: '/products' }, { label: 'Reviews', url: '/faq' }]}
        />
      </div>

      <div data-testid="preview-scroll-expand-hero">
        <ScrollExpandHero
          mediaType="image"
          mediaSrc="/images/hero.jpg"
          title="Preview Hero"
          subtitle="Default single-stage behaviour"
        />
      </div>

      <div data-testid="preview-bento-grid">
        <BentoGrid
          title="Preview Bento"
          cards={[
            { title: 'Segment One', body: 'Description for segment one.', size: 'large' },
            { title: 'Segment Two', body: 'Description for segment two.', size: 'small' },
            { title: 'Segment Three', body: 'Description for segment three.', size: 'small' },
          ]}
        />
      </div>

      <div data-testid="preview-split-image-text">
        <SplitImageText
          image="/images/hero.jpg"
          imageAlt="Preview image"
          title="Preview Split"
          body="Body copy for the split-image-text preview section."
        />
      </div>

      <div data-testid="preview-showcase-gallery">
        <ShowcaseGallery
          title="Preview Gallery"
          items={[
            { image: '/images/hero.jpg', imageAlt: 'Item one', title: 'Item One', tag: 'Tag One' },
            { image: '/images/hero.jpg', imageAlt: 'Item two', title: 'Item Two', tag: 'Tag Two' },
          ]}
        />
      </div>

      <div data-testid="preview-footer">
        <FooterBlock
          logoText="Preview Store"
          tagline="Dev preview"
          columns={[{ heading: 'Shop', links: [{ label: 'All Products', url: '/products' }] }]}
          copyrightText="© 2026 Preview"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Exclude `/dev` from robots.ts.** Read `frontend-starter/app/robots.ts` first, then update the `disallow` array:

```tsx
import type { MetadataRoute } from "next"

const BASE = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/checkout", "/cart", "/login", "/register", "/reset-password", "/forgot-password", "/dev"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
```

- [ ] **Step 4: Verify it renders.** With backend on `:8000` and storefront on `:3000` running (`docs/local-dev.md`):

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
```
Expected: clean. Then open `http://localhost:3000/dev/block-preview` in a browser — all 7 sections render top to bottom without errors.

- [ ] **Step 5: Commit**

```powershell
git add app/dev/block-preview/page.tsx app/robots.ts
git commit -m "feat(dev): block-preview harness for Phase 3 component-library E2E"
```

---

### Task 2: Restyle the 3 placeholder blocks to production tokens

**Files:**
- Modify: `frontend-starter/components/blocks/layout/navbar-block.tsx`
- Modify: `frontend-starter/components/blocks/layout/footer-block.tsx`
- Modify: `frontend-starter/components/blocks/layout/menu-block.tsx`
- Modify: `docs/component-library.md:824-869` (all three entries)
- Modify: `docs/component-library-gallery.html` (LAY·03/04/05 specimens)
- Test: `frontend-starter/e2e/placeholder-blocks.spec.ts`

- [ ] **Step 1: Restyle `navbar-block.tsx`** — replace the placeholder comment and swap `border-slate-200`/`text-slate-600` for tokens; everything else (props, structure) unchanged:

```tsx
'use client'
interface NavLink {
  label: string
  url: string
}

interface NavbarBlockProps {
  logoText?: string
  logoUrl?: string
  links?: NavLink[]
  ctaLabel?: string
  ctaUrl?: string
}

export function NavbarBlock({
  logoText = 'Store',
  logoUrl = '/',
  links = [],
  ctaLabel,
  ctaUrl,
}: NavbarBlockProps) {
  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between bg-card-bg border-b border-border">
      <a href={logoUrl} className="text-lg font-bold text-brand-dark">{logoText}</a>
      <ul className="hidden md:flex items-center gap-6">
        {links.map((l, i) => (
          <li key={i}>
            <a href={l.url} className="text-sm text-muted hover:text-brand-dark transition-colors">{l.label}</a>
          </li>
        ))}
      </ul>
      {ctaLabel && ctaUrl && (
        <a href={ctaUrl} className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-sm font-semibold transition-colors">
          {ctaLabel}
        </a>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Restyle `footer-block.tsx`** — replace hardcoded slate with tokens (`bg-brand-dark` for the dark footer surface, `text-on-dark-strong`/`text-on-dark`/`text-on-dark-muted` for the text tiers, matching the token vocabulary any other dark section in this library uses):

```tsx
'use client'
interface FooterLink {
  label: string
  url: string
}

interface FooterColumn {
  heading: string
  links: FooterLink[]
}

interface FooterBlockProps {
  logoText?: string
  tagline?: string
  columns?: FooterColumn[]
  copyrightText?: string
}

export function FooterBlock({
  logoText = 'Store',
  tagline,
  columns = [],
  copyrightText,
}: FooterBlockProps) {
  return (
    <footer className="bg-brand-dark text-on-dark px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <p className="text-on-dark-strong font-bold text-lg mb-2">{logoText}</p>
            {tagline && <p className="text-sm text-on-dark-muted">{tagline}</p>}
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <p className="text-on-dark-strong font-semibold text-sm mb-3">{col.heading}</p>
              <ul className="list-none p-0 m-0 space-y-2">
                {(col.links ?? []).map((l, j) => (
                  <li key={j}>
                    <a href={l.url} className="text-sm hover:text-on-dark-strong transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {copyrightText && (
          <p className="border-t border-dark-border pt-6 text-xs text-on-dark-muted">{copyrightText}</p>
        )}
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Restyle `menu-block.tsx`** — this is also the low-contrast dark-theme fix: `text-slate-500`/`text-slate-700` become `text-muted`/`text-fg`, which correctly darken/lighten per the client's own theme instead of being stuck mid-grey on a dark page:

```tsx
'use client'
interface MenuItem {
  label: string
  url: string
  children?: Array<{ label: string; url: string }>
}

interface MenuBlockProps {
  title?: string
  items?: MenuItem[]
  layout?: 'horizontal' | 'vertical' | 'grid'
}

export function MenuBlock({ title, items = [], layout = 'horizontal' }: MenuBlockProps) {
  const wrapClass =
    layout === 'vertical' ? 'flex flex-col gap-2' :
    layout === 'grid'     ? 'grid grid-cols-2 md:grid-cols-4 gap-4' :
    'flex flex-wrap gap-6'

  return (
    <section className="py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">{title}</h3>}
        <ul className={wrapClass}>
          {items.map((item, i) => (
            <li key={i}>
              <a href={item.url} className="text-sm font-medium text-fg hover:text-brand-dark transition-colors">
                {item.label}
              </a>
              {item.children && item.children.length > 0 && (
                <ul className="mt-1 ml-3 space-y-1">
                  {item.children.map((child, j) => (
                    <li key={j}>
                      <a href={child.url} className="text-xs text-muted hover:text-brand-dark transition-colors">
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Verify no raw slate/hex remains in the three files**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
grep -n "slate-" components\blocks\layout\navbar-block.tsx components\blocks\layout\footer-block.tsx components\blocks\layout\menu-block.tsx
grep -n "Placeholder" components\blocks\layout\navbar-block.tsx components\blocks\layout\footer-block.tsx components\blocks\layout\menu-block.tsx
```
Expected: no output from either command.

- [ ] **Step 5: Write the E2E smoke test**

```typescript
import { test, expect } from '@playwright/test'

test('restyled placeholder blocks render their content', async ({ page }) => {
  await page.goto('/dev/block-preview')

  const navbar = page.getByTestId('preview-navbar')
  await expect(navbar.getByText('Preview Store')).toBeVisible()
  await expect(navbar.getByText('Register')).toBeVisible()

  const menu = page.getByTestId('preview-menu')
  await expect(menu.getByText('Quick Links')).toBeVisible()
  await expect(menu.getByText('Products')).toBeVisible()

  const footer = page.getByTestId('preview-footer')
  await expect(footer.getByText('Preview Store')).toBeVisible()
  await expect(footer.getByText('© 2026 Preview')).toBeVisible()
})
```

- [ ] **Step 6: Update `docs/component-library.md`.** Read the file first (entries currently at lines 824–869), then replace all three entries:

Replace:
```markdown
## `navbar` ⚠️ Placeholder
**What it's for:** A basic in-page navbar block (logo, links, one CTA) — explicitly marked in its own source comment as a **placeholder to replace with your final design**, not a finished production component.

**What it looks like:** A plain white bar: bold logo text on the left, a row of grey nav links in the middle (desktop only), and an optional brand-coloured CTA button on the right.

**Theme:** ⚠️ Placeholder — hardcodes `border-slate-200`, otherwise uses tokens for its two real surfaces.
```
with:
```markdown
## `navbar`
**What it's for:** A basic in-page navbar block (logo, links, one CTA) — for building an alternative or supplementary nav directly into a page's `sections[]`. The site's real navbar (`components/layout/navbar.tsx`) is a separate, always-on component and unaffected by this.

**What it looks like:** A card-coloured bar: bold logo text on the left, a row of nav links in the middle (desktop only), and an optional brand-coloured CTA button on the right.

**Theme:** ✅ Fully tokenised.
```

Replace:
```markdown
## `footer` ⚠️ Placeholder
**What it's for:** A basic multi-column footer block — same placeholder status as `navbar`. The site's real footer (`components/layout/footer.tsx`) is what actually ships; this registry entry is for building a standalone footer-shaped block inside a page's `sections[]` if ever needed.

**What it looks like:** A dark slate footer: logo/tagline on the left, up to several link columns to the right, and a thin copyright line along the bottom.

**Theme:** ⚠️ Placeholder — entirely hardcoded slate colours, does not use theme tokens at all.
```
with:
```markdown
## `footer`
**What it's for:** A basic multi-column footer block — same use case as `navbar`. The site's real footer (`components/layout/footer.tsx`) is what actually ships; this registry entry is for a standalone footer-shaped block inside a page's `sections[]` if ever needed.

**What it looks like:** A dark brand-coloured footer: logo/tagline on the left, up to several link columns to the right, and a thin copyright line along the bottom.

**Theme:** ✅ Fully tokenised.
```

Replace:
```markdown
## `menu` ⚠️ Placeholder
**What it's for:** A simple labelled link list — a sitemap-style menu block, or a small in-page nav section (e.g. "Jump to: Products / Reviews / FAQ"). Same placeholder status as `navbar`/`footer`.

**What it looks like:** An optional small uppercase label, then a list of links in one of three layouts (`horizontal`, `vertical`, or a `grid`); each item can optionally have nested sub-links shown indented underneath it.

**Theme:** ⚠️ Placeholder — uses hardcoded `text-slate-500/700`, which will be low-contrast on a dark client theme (grey text on a dark page).
```
with:
```markdown
## `menu`
**What it's for:** A simple labelled link list — a sitemap-style menu block, or a small in-page nav section (e.g. "Jump to: Products / Reviews / FAQ").

**What it looks like:** An optional small uppercase label, then a list of links in one of three layouts (`horizontal`, `vertical`, or a `grid`); each item can optionally have nested sub-links shown indented underneath it.

**Theme:** ✅ Fully tokenised.
```

(Each entry's `**Config usage:**` / `**Props:**` blocks below are unchanged — leave them exactly as they are.)

- [ ] **Step 7: Update the gallery's three glyphs.** In `docs/component-library-gallery.html`, three occurrences of the same pattern — the `glyph--placeholder` span becomes `glyph--full`, title updated. Read the surrounding lines first (currently ~1234, 1251, 1268), then:

Replace (navbar, line ~1234):
```html
          <div class="specimen-code-row"><span class="specimen-code">LAY·03</span><span class="glyph glyph--placeholder" title="Placeholder"></span></div>
          <h3>navbar</h3>
          <p class="purpose">Basic in-page navbar block — logo, links, one CTA. Marked as a placeholder in its own source.</p>
```
with:
```html
          <div class="specimen-code-row"><span class="specimen-code">LAY·03</span><span class="glyph glyph--full" title="Fully tokenised"></span></div>
          <h3>navbar</h3>
          <p class="purpose">Basic in-page navbar block — logo, links, one CTA. For an alternative/supplementary in-page nav.</p>
```

Replace (footer, line ~1251):
```html
          <div class="specimen-code-row"><span class="specimen-code">LAY·04</span><span class="glyph glyph--placeholder" title="Placeholder"></span></div>
          <h3>footer</h3>
          <p class="purpose">Basic multi-column footer block — same placeholder status. The real footer ships separately.</p>
```
with:
```html
          <div class="specimen-code-row"><span class="specimen-code">LAY·04</span><span class="glyph glyph--full" title="Fully tokenised"></span></div>
          <h3>footer</h3>
          <p class="purpose">Basic multi-column footer block. The site's real footer ships separately, always-on.</p>
```

Replace (menu, line ~1268):
```html
          <div class="specimen-code-row"><span class="specimen-code">LAY·05</span><span class="glyph glyph--placeholder" title="Placeholder — grey text may read low-contrast on dark themes"></span></div>
          <h3>menu</h3>
          <p class="purpose">Simple labelled link list, three layouts. Same placeholder status; watch contrast on dark clients.</p>
```
with:
```html
          <div class="specimen-code-row"><span class="specimen-code">LAY·05</span><span class="glyph glyph--full" title="Fully tokenised"></span></div>
          <h3>menu</h3>
          <p class="purpose">Simple labelled link list, three layouts.</p>
```

Also update the three mockup `.stage` `style` blocks (still hardcoded hex from before the restyle) to use the `pv-*` preview-token classes so the gallery's brand switch now actually re-dyes them, matching what the real component does post-fix. Replace navbar's stage:
```html
          <div class="stage" style="background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-weight:800;font-size:11px;color:#1B2A4A">My Store</span>
            <div style="display:flex;gap:10px"><span style="font-size:9px;color:#475569">Shop</span><span style="font-size:9px;color:#475569">About</span></div>
            <span class="pv-btn pv-btn-primary" style="font-size:9px;padding:5px 10px">Register</span>
          </div>
```
with:
```html
          <div class="stage pv-bg-card pv-border-b" style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
            <span class="pv-brand-dark" style="font-weight:800;font-size:11px">My Store</span>
            <div style="display:flex;gap:10px"><span class="pv-muted" style="font-size:9px">Shop</span><span class="pv-muted" style="font-size:9px">About</span></div>
            <span class="pv-btn pv-btn-primary" style="font-size:9px;padding:5px 10px">Register</span>
          </div>
```

Replace footer's stage:
```html
          <div class="stage" style="background:#0f172a;padding:14px;display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px">
            <div><div style="color:#fff;font-weight:800;font-size:10px">Store</div><div style="color:#94a3b8;font-size:7.5px;margin-top:3px">Quality goods since 1995</div></div>
            <div><div style="color:#fff;font-weight:700;font-size:8px">Shop</div><div style="color:#94a3b8;font-size:7.5px;margin-top:4px">All Products</div></div>
            <div><div style="color:#fff;font-weight:700;font-size:8px">Company</div><div style="color:#94a3b8;font-size:7.5px;margin-top:4px">About</div></div>
          </div>
```
with:
```html
          <div class="stage pv-bg-brand-dark" style="padding:14px;display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px">
            <div><div class="pv-on-dark-strong" style="font-weight:800;font-size:10px">Store</div><div class="pv-on-dark-muted" style="font-size:7.5px;margin-top:3px">Quality goods since 1995</div></div>
            <div><div class="pv-on-dark-strong" style="font-weight:700;font-size:8px">Shop</div><div class="pv-on-dark-muted" style="font-size:7.5px;margin-top:4px">All Products</div></div>
            <div><div class="pv-on-dark-strong" style="font-weight:700;font-size:8px">Company</div><div class="pv-on-dark-muted" style="font-size:7.5px;margin-top:4px">About</div></div>
          </div>
```

Replace menu's stage:
```html
          <div class="stage pv-bg-page pv-p">
            <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Quick Links</div>
            <div class="pv-row pv-gap14"><span style="font-size:9.5px;color:#475569;font-weight:600">Products</span><span style="font-size:9.5px;color:#475569;font-weight:600">Reviews</span><span style="font-size:9.5px;color:#475569;font-weight:600">FAQ</span></div>
          </div>
```
with:
```html
          <div class="stage pv-bg-page pv-p">
            <div class="pv-muted" style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Quick Links</div>
            <div class="pv-row pv-gap14"><span class="pv-fg" style="font-size:9.5px;font-weight:600">Products</span><span class="pv-fg" style="font-size:9.5px;font-weight:600">Reviews</span><span class="pv-fg" style="font-size:9.5px;font-weight:600">FAQ</span></div>
          </div>
```

- [ ] **Step 8: Run the gates**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
npm run lint
```
Expected: both clean (0 new errors — lint stays at exactly the 19 pre-existing warnings).

With backend `:8000` + storefront `:3000` running:
```powershell
npx playwright test e2e/placeholder-blocks.spec.ts
```
Expected: 1/1 pass.

- [ ] **Step 9: Commit**

```powershell
git add components/blocks/layout/navbar-block.tsx components/blocks/layout/footer-block.tsx components/blocks/layout/menu-block.tsx e2e/placeholder-blocks.spec.ts
git add -f ../docs/component-library.md ../docs/component-library-gallery.html
git commit -m "fix(blocks): restyle navbar/footer/menu placeholders to production tokens"
```
(`git add -f` is needed for the gallery `.html` file — the repo's root `.gitignore` has a blanket `*.html` scratch-file rule; this is a deliberate, tracked doc, same precedent as previous sessions.)

---

### Task 3: Build the `ScrollReveal` shared component

**Files:**
- Create: `frontend-starter/components/ui/scroll-reveal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

interface ScrollRevealProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  /** Stagger delay in seconds — pass `index * 0.08` for a grid of siblings. */
  delay?: number
}

/**
 * Fades and slides content up the first time it scrolls into view. Renders
 * content immediately visible, with no animation, when the visitor prefers
 * reduced motion. Any other props (className, data-testid, etc.) pass
 * straight through to the wrapping element.
 */
export function ScrollReveal({ children, delay = 0, ...rest }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div {...rest}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      {...rest}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Type-check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
```
Expected: clean (nothing imports it yet, so no functional check possible until Task 4).

- [ ] **Step 3: Commit**

```powershell
git add components/ui/scroll-reveal.tsx
git commit -m "feat(ui): ScrollReveal — shared fade-up-on-scroll wrapper, respects reduced-motion"
```

---

### Task 4: Apply `ScrollReveal` to `bento-grid`

**Files:**
- Modify: `frontend-starter/components/blocks/content/bento-grid.tsx`
- Modify: `frontend-starter/app/dev/block-preview/page.tsx` (no change needed — `preview-bento-grid` already exists from Task 1)
- Test: `frontend-starter/e2e/bento-grid-reveal.spec.ts`
- Modify: `docs/component-library.md:572-578` (bento-grid entry)

- [ ] **Step 1: Wire in `ScrollReveal`.** Read the current file first, then replace the card-rendering block:

Replace:
```tsx
interface BentoCard {
  title: string
  body: string
  image?: string
  linkUrl?: string
  linkText?: string
  size: 'large' | 'small'
}

interface BentoGridProps {
  cards: BentoCard[]
  title?: string
}

export function BentoGrid({ cards, title }: BentoGridProps) {
  const display = cards.slice(0, 4)
  return (
    <section className="py-16 px-4 bg-bg">
      {title && (
        <h2 className="font-heading text-3xl font-bold text-fg text-center mb-10">{title}</h2>
      )}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[180px]">
        {display.map((card, i) => (
          <div
            key={i}
            className={`rounded-2xl overflow-hidden bg-card-bg border border-border p-6 flex flex-col justify-between ${
              card.size === 'large' ? 'col-span-2 row-span-2' : ''
            }`}
          >
```
with:
```tsx
'use client'
import { ScrollReveal } from '@/components/ui/scroll-reveal'

interface BentoCard {
  title: string
  body: string
  image?: string
  linkUrl?: string
  linkText?: string
  size: 'large' | 'small'
}

interface BentoGridProps {
  cards: BentoCard[]
  title?: string
}

export function BentoGrid({ cards, title }: BentoGridProps) {
  const display = cards.slice(0, 4)
  return (
    <section className="py-16 px-4 bg-bg">
      {title && (
        <h2 className="font-heading text-3xl font-bold text-fg text-center mb-10">{title}</h2>
      )}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[180px]">
        {display.map((card, i) => (
          <ScrollReveal
            key={i}
            delay={i * 0.08}
            data-testid="bento-card"
            className={`rounded-2xl overflow-hidden bg-card-bg border border-border p-6 flex flex-col justify-between ${
              card.size === 'large' ? 'col-span-2 row-span-2' : ''
            }`}
          >
```

Then find the matching closing `</div>` for that card (immediately before the `))}` that ends the `.map()`) and replace it with `</ScrollReveal>`:

Replace:
```tsx
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
```
with:
```tsx
            )}
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Type-check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Write the E2E test**

```typescript
import { test, expect } from '@playwright/test'

test('bento-grid cards reveal on scroll', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const firstCard = page.getByTestId('bento-card').first()
  await expect(firstCard).toBeAttached()
  // Below the fold behind the 1.5-screen hero above it — not yet revealed
  await expect(firstCard).not.toHaveCSS('opacity', '1')
  await firstCard.scrollIntoViewIfNeeded()
  await expect(firstCard).toHaveCSS('opacity', '1', { timeout: 2000 })
})
```

- [ ] **Step 4: Run it**

With backend `:8000` + storefront `:3000` running:
```powershell
npx playwright test e2e/bento-grid-reveal.spec.ts
```
Expected: 1/1 pass. If it fails because the card is already opacity 1 before scrolling, check that `preview-scroll-expand-hero` (1.5 screens tall) genuinely sits above `preview-bento-grid` in `app/dev/block-preview/page.tsx` pushing it below the fold — do not weaken the assertion.

- [ ] **Step 5: Update the doc entry.** Read `docs/component-library.md` first (bento-grid at line ~572), then insert a line after the existing "What it looks like" paragraph:

Replace:
```markdown
**What it looks like:** A 2–3 column grid where `size: "large"` cards span two columns and two rows (bigger image, bigger title), and `size: "small"` cards are compact — all in bordered card-coloured tiles with an optional image, a heading, a clamped body paragraph, and an optional "link text →" at the bottom. Maximum 4 cards shown even if more are supplied.

**Theme:** ✅ Fully tokenised.
```
with:
```markdown
**What it looks like:** A 2–3 column grid where `size: "large"` cards span two columns and two rows (bigger image, bigger title), and `size: "small"` cards are compact — all in bordered card-coloured tiles with an optional image, a heading, a clamped body paragraph, and an optional "link text →" at the bottom. Maximum 4 cards shown even if more are supplied. Each card fades and slides up the first time it scrolls into view, staggered slightly card-to-card (`ScrollReveal`).

**Theme:** ✅ Fully tokenised.
```

- [ ] **Step 6: Commit**

```powershell
git add components/blocks/content/bento-grid.tsx e2e/bento-grid-reveal.spec.ts
git add -f ../docs/component-library.md
git commit -m "feat(blocks): bento-grid cards fade up on scroll via ScrollReveal"
```

---

### Task 5: Apply `ScrollReveal` to `split-image-text`

**Files:**
- Modify: `frontend-starter/components/blocks/content/split-image-text.tsx`
- Test: `frontend-starter/e2e/split-image-text-reveal.spec.ts`
- Modify: `docs/component-library.md:717-722` (split-image-text entry)

- [ ] **Step 1: Wire in `ScrollReveal`ontwo independent panels.** Read the current file first, then replace the whole component body:

```tsx
'use client'
import { ScrollReveal } from '@/components/ui/scroll-reveal'

interface SplitImageTextProps {
  image: string
  imageAlt: string
  title: string
  body: string
  ctaText?: string
  ctaUrl?: string
  imagePosition?: 'left' | 'right'
}

export function SplitImageText({
  image,
  imageAlt,
  title,
  body,
  ctaText,
  ctaUrl,
  imagePosition = 'left',
}: SplitImageTextProps) {
  return (
    <section className="py-16 px-4 bg-bg">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <ScrollReveal data-testid="split-image-panel" className={imagePosition === 'right' ? 'md:order-last' : ''}>
          <div className="rounded-2xl overflow-hidden aspect-square bg-slate-100">
            <img src={image} alt={imageAlt} className="w-full h-full object-cover" />
          </div>
        </ScrollReveal>
        <ScrollReveal data-testid="split-text-panel" delay={0.15}>
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4 leading-tight">{title}</h2>
          <p className="text-muted text-base leading-relaxed mb-8">{body}</p>
          {ctaText && ctaUrl && (
            <a
              href={ctaUrl}
              className="inline-block px-6 py-3 rounded-xl bg-brand text-on-brand font-semibold hover:bg-brand-hover transition-colors"
            >
              {ctaText}
            </a>
          )}
        </ScrollReveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Type-check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Write the E2E test**

```typescript
import { test, expect } from '@playwright/test'

test('split-image-text panels reveal independently on scroll', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const imagePanel = page.getByTestId('split-image-panel')
  const textPanel = page.getByTestId('split-text-panel')
  await expect(imagePanel).not.toHaveCSS('opacity', '1')
  await expect(textPanel).not.toHaveCSS('opacity', '1')
  await imagePanel.scrollIntoViewIfNeeded()
  await expect(imagePanel).toHaveCSS('opacity', '1', { timeout: 2000 })
  await expect(textPanel).toHaveCSS('opacity', '1', { timeout: 2000 })
})
```

- [ ] **Step 4: Run it**

```powershell
npx playwright test e2e/split-image-text-reveal.spec.ts
```
Expected: 1/1 pass.

- [ ] **Step 5: Update the doc entry.** Read `docs/component-library.md` first (split-image-text at line ~717), then:

Replace:
```markdown
**What it looks like:** A two-column layout (stacks on mobile): a square rounded photo on one side, and on the other a bold heading, a paragraph of body copy, and an optional button. `imagePosition: "right"` flips which side the photo sits on.

**Theme:** 🌓 Mostly tokenised (image placeholder background is a neutral grey while the photo loads/if broken).
```
with:
```markdown
**What it looks like:** A two-column layout (stacks on mobile): a square rounded photo on one side, and on the other a bold heading, a paragraph of body copy, and an optional button. `imagePosition: "right"` flips which side the photo sits on. The image and text panels fade up independently as each scrolls into view (`ScrollReveal`), text following slightly behind the image.

**Theme:** 🌓 Mostly tokenised (image placeholder background is a neutral grey while the photo loads/if broken).
```

- [ ] **Step 6: Commit**

```powershell
git add components/blocks/content/split-image-text.tsx e2e/split-image-text-reveal.spec.ts
git add -f ../docs/component-library.md
git commit -m "feat(blocks): split-image-text panels fade up independently on scroll"
```

---

### Task 6: `showcase-gallery` — `ScrollReveal` + zoomable Layer 1 (tap-to-zoom lightbox)

**Files:**
- Modify: `frontend-starter/components/blocks/content/showcase-gallery.tsx`
- Modify: `frontend-starter/app/dev/block-preview/page.tsx` (add `zoomable`)
- Test: `frontend-starter/e2e/showcase-gallery-zoom.spec.ts`
- Modify: `docs/component-library.md:477-497` (showcase-gallery entry)
- Modify: `docs/component-library-gallery.html` (CON·01 specimen)

- [ ] **Step 1: Rewrite the component.** Read the current file first, then replace it entirely:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'

interface ShowcaseItem {
  image?: string
  imageAlt?: string
  title: string
  tag?: string
  badge?: string
  comingSoon?: boolean
  comingSoonText?: string
}

interface ShowcaseGalleryProps {
  kicker?: string
  title: string
  subtitle?: string
  items: ShowcaseItem[]
  anchorId?: string
  /** Layer 1: tap/click opens the item full-screen; Escape or outside-click closes it. */
  zoomable?: boolean
}

export function ShowcaseGallery({ kicker, title, subtitle, items, anchorId, zoomable = false }: ShowcaseGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    if (openIndex === null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenIndex(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openIndex])

  const openItem = openIndex !== null ? items[openIndex] : null

  return (
    <section id={anchorId} className="py-20 px-6 bg-surface-alt" aria-label="Showcase gallery">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const canZoom = zoomable && !item.comingSoon && !!item.image
            return (
              <ScrollReveal key={item.title} delay={(i % 4) * 0.08} data-testid="showcase-item">
                <figure className="group relative overflow-hidden rounded-2xl border border-border bg-card-bg">
                  {item.comingSoon || !item.image ? (
                    <div className="aspect-[4/5] flex flex-col items-center justify-center gap-2 p-6 text-center">
                      <span className="font-heading text-lg font-semibold text-brand">{item.title}</span>
                      {item.comingSoonText && <span className="text-sm text-muted">{item.comingSoonText}</span>}
                    </div>
                  ) : canZoom ? (
                    <button
                      type="button"
                      onClick={() => setOpenIndex(i)}
                      className="block w-full aspect-[4/5] cursor-zoom-in"
                      aria-label={`Open ${item.title} full size`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.imageAlt ?? item.title}
                        className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.imageAlt ?? item.title}
                      className="aspect-[4/5] w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                  {!item.comingSoon && item.image && (
                    <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                      <span className="block font-heading font-semibold text-white">{item.title}</span>
                      {item.tag && <span className="block text-sm text-white/70">{item.tag}</span>}
                    </figcaption>
                  )}
                  {item.badge && (
                    <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-on-brand">
                      {item.badge}
                    </span>
                  )}
                </figure>
              </ScrollReveal>
            )
          })}
        </div>
      </div>

      {openItem?.image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${openItem.title} — zoomed view`}
          onClick={() => setOpenIndex(null)}
          data-testid="zoom-overlay"
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20"
            aria-label="Close zoomed view"
            data-testid="zoom-close"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={openItem.image}
            alt={openItem.imageAlt ?? openItem.title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </section>
  )
}
```

(This step ships Layer 1 only — a fixed-size full-screen view, click-outside/`Escape`/close-button to dismiss. Task 7 replaces the plain `<img>` inside the overlay with `<PinchZoomImage>` for real pinch/pan, without changing anything above this point.)

- [ ] **Step 2: Type-check and lint**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
npm run lint
```
Expected: both clean.

- [ ] **Step 3: Turn on `zoomable` in the preview page.** Read `app/dev/block-preview/page.tsx` first, then:

Replace:
```tsx
      <div data-testid="preview-showcase-gallery">
        <ShowcaseGallery
          title="Preview Gallery"
          items={[
            { image: '/images/hero.jpg', imageAlt: 'Item one', title: 'Item One', tag: 'Tag One' },
            { image: '/images/hero.jpg', imageAlt: 'Item two', title: 'Item Two', tag: 'Tag Two' },
          ]}
        />
      </div>
```
with:
```tsx
      <div data-testid="preview-showcase-gallery">
        <ShowcaseGallery
          title="Preview Gallery"
          zoomable
          items={[
            { image: '/images/hero.jpg', imageAlt: 'Item one', title: 'Item One', tag: 'Tag One' },
            { image: '/images/hero.jpg', imageAlt: 'Item two', title: 'Item Two', tag: 'Tag Two' },
          ]}
        />
      </div>
```

- [ ] **Step 4: Write the E2E tests**

```typescript
import { test, expect } from '@playwright/test'

test('showcase-gallery items reveal on scroll', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const firstItem = page.getByTestId('showcase-item').first()
  await expect(firstItem).not.toHaveCSS('opacity', '1')
  await firstItem.scrollIntoViewIfNeeded()
  await expect(firstItem).toHaveCSS('opacity', '1', { timeout: 2000 })
})

test('zoomable gallery: tap opens the lightbox, Escape closes it', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const openButton = page.getByRole('button', { name: 'Open Item One full size' })
  await openButton.scrollIntoViewIfNeeded()
  await openButton.click()
  const overlay = page.getByTestId('zoom-overlay')
  await expect(overlay).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(overlay).not.toBeVisible()
})

test('zoomable gallery: close button and outside-click both dismiss it', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const openButton = page.getByRole('button', { name: 'Open Item One full size' })
  await openButton.scrollIntoViewIfNeeded()

  await openButton.click()
  await expect(page.getByTestId('zoom-overlay')).toBeVisible()
  await page.getByTestId('zoom-close').click()
  await expect(page.getByTestId('zoom-overlay')).not.toBeVisible()

  await openButton.click()
  const overlay = page.getByTestId('zoom-overlay')
  await expect(overlay).toBeVisible()
  await overlay.click({ position: { x: 5, y: 5 } })
  await expect(overlay).not.toBeVisible()
})
```

- [ ] **Step 5: Run them**

```powershell
npx playwright test e2e/showcase-gallery-zoom.spec.ts
```
Expected: 3/3 pass.

- [ ] **Step 6: Update the doc entry.** Read `docs/component-library.md` first (showcase-gallery at line ~477), then:

Replace:
```markdown
**Theme:** ✅ Fully tokenised (the caption gradient/white text sits directly on a photo — a documented, intentional exception).

**Config usage:**
```json
{
  "__block": "showcase-gallery",
  "kicker": "My work",
  "title": "The Portfolio",
  "items": [
    { "image": "/images/portfolio-1.jpg", "title": "RPG Drone Corp", "tag": "Sci-Fi Skirmish", "badge": "Premium Tier" },
    { "title": "Your commission here", "comingSoon": true, "comingSoonText": "Slots Available Now" }
  ]
}
```

**Props:** `kicker?`, `title` (required), `subtitle?`, `anchorId?`, `items: {image?, imageAlt?, title, tag?, badge?, comingSoon?, comingSoonText?}[]` (required).
```
with:
```markdown
**Theme:** ✅ Fully tokenised (the caption gradient/white text sits directly on a photo — a documented, intentional exception). Items fade up on scroll (`ScrollReveal`).

**Zoomable (optional):** set `zoomable: true` and any item with a real image becomes tappable/clickable — opens full-screen at a larger fixed size. Dismiss via the close button, `Escape`, or clicking outside the image. Items with no image or `comingSoon: true` are never zoomable. (Task 7 adds real pinch-to-zoom/pan inside this view — see that task's doc update.)

**Config usage:**
```json
{
  "__block": "showcase-gallery",
  "kicker": "My work",
  "title": "The Portfolio",
  "zoomable": true,
  "items": [
    { "image": "/images/portfolio-1.jpg", "title": "RPG Drone Corp", "tag": "Sci-Fi Skirmish", "badge": "Premium Tier" },
    { "title": "Your commission here", "comingSoon": true, "comingSoonText": "Slots Available Now" }
  ]
}
```

**Props:** `kicker?`, `title` (required), `subtitle?`, `anchorId?`, `items: {image?, imageAlt?, title, tag?, badge?, comingSoon?, comingSoonText?}[]` (required), `zoomable?: boolean` (default false).
```

- [ ] **Step 7: Update the gallery's CON·01 specimen.** Read `docs/component-library-gallery.html` first (CON·01 at line ~914), then add a `plugin-tag`-style badge noting the new capability:

Replace:
```html
          <div class="specimen-code-row"><span class="specimen-code">CON·01</span><span class="glyph glyph--full" title="Fully tokenised"></span></div>
          <h3>showcase-gallery</h3>
          <p class="purpose">Portfolio grid with per-item badges and "coming soon" placeholder slots.</p>
```
with:
```html
          <div class="specimen-code-row"><span class="specimen-code">CON·01</span><span class="glyph glyph--full" title="Fully tokenised"></span><span class="plugin-tag">zoomable</span></div>
          <h3>showcase-gallery</h3>
          <p class="purpose">Portfolio grid with per-item badges, "coming soon" slots, and optional tap-to-zoom.</p>
```

- [ ] **Step 8: Commit**

```powershell
git add components/blocks/content/showcase-gallery.tsx app/dev/block-preview/page.tsx e2e/showcase-gallery-zoom.spec.ts
git add -f ../docs/component-library.md ../docs/component-library-gallery.html
git commit -m "feat(blocks): showcase-gallery — ScrollReveal + zoomable Layer 1 (tap-to-zoom lightbox)"
```

---

### Task 7: `PinchZoomImage` — Layer 2, real pinch/pan

**Files:**
- Create: `frontend-starter/components/ui/pinch-zoom-image.tsx`
- Modify: `frontend-starter/components/blocks/content/showcase-gallery.tsx`
- Test: `frontend-starter/e2e/showcase-gallery-zoom.spec.ts` (append)
- Modify: `docs/component-library.md` (showcase-gallery entry — upgrade the Zoomable line now that Layer 2 exists)
- Modify: `docs/component-library-gallery.html` (CON·01 specimen purpose text)

- [ ] **Step 1: Create the component**

```tsx
'use client'
import { useRef, useState, type PointerEvent, type WheelEvent } from 'react'

interface PinchZoomImageProps {
  src: string
  alt: string
  maxScale?: number
}

const MIN_SCALE = 1

interface Point {
  x: number
  y: number
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Real two-finger pinch-to-zoom + drag-to-pan on touch, wheel-to-zoom + drag
 * on desktop, built on the native Pointer Events API. Scale is clamped
 * between 1x and `maxScale`; pan is clamped so the image edge can never be
 * dragged past the container edge. Zoom always scales around whatever pan
 * offset is already set (not a moving pinch midpoint) — a deliberate
 * simplification that keeps the gesture predictable.
 */
export function PinchZoomImage({ src, alt, maxScale = 4 }: PinchZoomImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, Point>())
  const pinchStart = useRef<{ distance: number; scale: number; pan: Point } | null>(null)
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  function clampPan(nextPan: Point, nextScale: number): Point {
    const el = containerRef.current
    if (!el) return nextPan
    const rect = el.getBoundingClientRect()
    const maxX = (rect.width * (nextScale - 1)) / 2
    const maxY = (rect.height * (nextScale - 1)) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinchStart.current = { distance: distance(a, b), scale, pan }
      dragStart.current = null
    } else if (pointers.current.size === 1 && scale > MIN_SCALE) {
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values())
      const ratio = distance(a, b) / pinchStart.current.distance
      const nextScale = Math.max(MIN_SCALE, Math.min(maxScale, pinchStart.current.scale * ratio))
      setScale(nextScale)
      setPan(clampPan(pinchStart.current.pan, nextScale))
    } else if (pointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPan(clampPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy }, scale))
    }
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    pinchStart.current = null
    dragStart.current = null
    if (scale <= MIN_SCALE) setPan({ x: 0, y: 0 })
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const nextScale = Math.max(MIN_SCALE, Math.min(maxScale, scale - e.deltaY * 0.01))
    setScale(nextScale)
    setPan((prev) => clampPan(prev, nextScale))
  }

  const isGesturing = pointers.current.size > 0

  return (
    <div
      ref={containerRef}
      className="relative flex max-h-[85vh] max-w-[90vw] touch-none select-none items-center justify-center overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      data-testid="pinch-zoom-container"
      data-scale={scale.toFixed(2)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-[85vh] max-w-[90vw] object-contain motion-reduce:transition-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transition: isGesturing ? 'none' : 'transform 0.2s ease-out',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `showcase-gallery.tsx`'s overlay.** Read the current file first, then replace the overlay's `<img>` with `<PinchZoomImage>`:

Replace:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
```
with:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { PinchZoomImage } from '@/components/ui/pinch-zoom-image'
```

Replace:
```tsx
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={openItem.image}
            alt={openItem.imageAlt ?? openItem.title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />
```
with:
```tsx
          <div onClick={(e) => e.stopPropagation()}>
            <PinchZoomImage src={openItem.image} alt={openItem.imageAlt ?? openItem.title} />
          </div>
```

- [ ] **Step 3: Type-check and lint**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
npm run lint
```
Expected: both clean.

- [ ] **Step 4: Append the wheel-zoom E2E test** to `e2e/showcase-gallery-zoom.spec.ts` (this is the one piece of Layer 2 Playwright *can* assert — real multi-touch pinch cannot be simulated, see Step 6). Read the file first (it ends with the "close button and outside-click" test from Task 6 Step 4), then:

Replace:
```typescript
  await openButton.click()
  const overlay = page.getByTestId('zoom-overlay')
  await expect(overlay).toBeVisible()
  await overlay.click({ position: { x: 5, y: 5 } })
  await expect(overlay).not.toBeVisible()
})
```
with:
```typescript
  await openButton.click()
  const overlay = page.getByTestId('zoom-overlay')
  await expect(overlay).toBeVisible()
  await overlay.click({ position: { x: 5, y: 5 } })
  await expect(overlay).not.toBeVisible()
})

test('desktop wheel-zoom scales the zoomed image', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const openButton = page.getByRole('button', { name: 'Open Item One full size' })
  await openButton.scrollIntoViewIfNeeded()
  await openButton.click()

  const container = page.getByTestId('pinch-zoom-container')
  await expect(container).toHaveAttribute('data-scale', '1.00')
  await container.hover()
  await page.mouse.wheel(0, -300)
  await expect(container).not.toHaveAttribute('data-scale', '1.00')
})
```

- [ ] **Step 5: Run the full showcase-gallery E2E file**

```powershell
npx playwright test e2e/showcase-gallery-zoom.spec.ts
```
Expected: 4/4 pass.

- [ ] **Step 6: Manual pinch/pan verification pass** (the one piece this plan cannot automate — do this before considering Task 7 done):

1. Start backend (`:8000`) + storefront (`:3000`).
2. Open Chrome DevTools → toggle device toolbar → select a touch-enabled device preset (e.g. "iPhone 14 Pro").
3. Navigate to `http://localhost:3000/dev/block-preview`, scroll to the gallery, tap an item to open the lightbox.
4. Using DevTools' simulated multi-touch (ctrl/cmd-drag for a second touch point, or a real touch-capable trackpad/phone if available), verify each of the following:
   - Pinching in stops at the maximum zoom (4x) — the image does not keep growing past it.
   - Pinching out returns cleanly to 1x, and tapping outside the image now closes the overlay again (confirms `dragStart`/pan state didn't get stuck).
   - Dragging while zoomed in never reveals empty space beyond the image's edge in any direction.
   - Releasing mid-gesture (lift both fingers abruptly while still zoomed/panned) never leaves the image in a stuck or visually distorted state — a subsequent pinch/drag still works normally.
5. Record the result in `docs/backlog.md`'s Phase 3 entry (Task 10) as "Built, NOT automatically tested — manual pass done on [date]" or "— manual pass still needed," whichever is true when you do this task.

- [ ] **Step 7: Upgrade the doc entry now that Layer 2 exists.** Read `docs/component-library.md` first (showcase-gallery entry, updated by Task 6), then:

Replace:
```markdown
**Zoomable (optional):** set `zoomable: true` and any item with a real image becomes tappable/clickable — opens full-screen at a larger fixed size. Dismiss via the close button, `Escape`, or clicking outside the image. Items with no image or `comingSoon: true` are never zoomable. (Task 7 adds real pinch-to-zoom/pan inside this view — see that task's doc update.)
```
with:
```markdown
**Zoomable (optional):** set `zoomable: true` and any item with a real image becomes tappable/clickable — opens full-screen with real two-finger pinch-to-zoom and drag-to-pan (desktop: scroll-wheel-zoom + drag). Dismiss via the close button, `Escape`, or clicking outside the image. Items with no image or `comingSoon: true` are never zoomable.
```

- [ ] **Step 8: Upgrade the gallery specimen.** Read `docs/component-library-gallery.html` first (CON·01, updated by Task 6), then:

Replace:
```html
          <p class="purpose">Portfolio grid with per-item badges, "coming soon" slots, and optional tap-to-zoom.</p>
```
with:
```html
          <p class="purpose">Portfolio grid with per-item badges, "coming soon" slots, and optional real pinch-to-zoom.</p>
```

- [ ] **Step 9: Commit**

```powershell
git add components/ui/pinch-zoom-image.tsx components/blocks/content/showcase-gallery.tsx e2e/showcase-gallery-zoom.spec.ts
git add -f ../docs/component-library.md ../docs/component-library-gallery.html
git commit -m "feat(ui): PinchZoomImage — real pinch-to-zoom + drag-to-pan, wired into showcase-gallery's lightbox"
```

---

### Task 8: Chaptered scroll storytelling on `scroll-expand-hero`

**Files:**
- Modify: `frontend-starter/components/blocks/visual/scroll-expand-hero.tsx`
- Modify: `frontend-starter/app/dev/block-preview/page.tsx` (add a second, chaptered instance)
- Test: `frontend-starter/e2e/scroll-expand-hero-chapters.spec.ts`
- Modify: `docs/component-library.md:101-121` (scroll-expand-hero entry)
- Modify: `docs/component-library-gallery.html` (VIS·02 specimen)

- [ ] **Step 1: Rewrite the component.** Read the current file first, then replace it entirely:

```tsx
'use client'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'

interface Chapter {
  caption: string
  detail?: string
  /** CSS colour for a per-chapter wash over the media while this chapter is active. */
  tint?: string
}

interface ScrollExpandHeroProps {
  mediaType?: 'video' | 'image'
  mediaSrc: string
  posterSrc?: string
  bgImageSrc?: string
  background?: string
  title: string
  eyebrow?: string | { text?: string; [key: string]: unknown }
  subtitle?: string
  date?: string
  scrollToExpand?: string
  textBlend?: boolean
  /** Omit for today's single-stage behaviour (unchanged). Provide 2+ chapters for the multi-stage pinned-narrative mode. */
  chapters?: Chapter[]
  children?: ReactNode
}

export function ScrollExpandHero({
  mediaType = 'image',
  mediaSrc,
  posterSrc,
  bgImageSrc,
  background = '#0f172a',
  title,
  eyebrow,
  subtitle,
  date,
  scrollToExpand = 'Scroll to explore',
  textBlend = false,
  chapters,
  children,
}: ScrollExpandHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasChapters = !!chapters && chapters.length > 0
  const [chapterIndex, setChapterIndex] = useState(0)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  // Media container: width 60% → 100%, borderRadius 16px → 0px
  const mediaWidth = useTransform(scrollYProgress, [0, 0.6], ['60%', '100%'])
  const mediaBorderRadius = useTransform(scrollYProgress, [0, 0.5], [16, 0])

  // Title: fades/slides up slightly as scroll progresses (single-chapter mode only)
  const titleY = useTransform(scrollYProgress, [0, 0.4], [0, -30])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0])

  // Hint text fades out early
  const hintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0])

  // Chaptered mode: which chapter is active, driven directly by scroll progress —
  // the single-chapter case is this same logic given a list of length one, not a
  // separate code path.
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (!hasChapters || !chapters) return
    const index = Math.min(chapters.length - 1, Math.floor(progress * chapters.length))
    setChapterIndex((current) => (current === index ? current : index))
  })

  const activeChapter = hasChapters && chapters ? chapters[chapterIndex] : null

  return (
    <div
      ref={containerRef}
      className="relative min-h-[150vh]"
      style={
        bgImageSrc
          ? { backgroundImage: `url("${bgImageSrc}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: background }
      }
    >
      {/* Sticky viewport-filling section */}
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col items-center justify-center" style={{ backgroundColor: background }}>
        {/* Background tint */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Title block — above media */}
        {hasChapters ? (
          <div
            className="relative z-20 text-center px-6 mb-8 pointer-events-none max-w-3xl"
            data-testid="chapter-caption"
            data-chapter-index={chapterIndex}
          >
            <p className="text-white/70 text-xs font-semibold uppercase tracking-[0.8px] mb-4">{title}</p>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-4 text-white">
              {activeChapter?.caption}
            </h1>
            {activeChapter?.detail && (
              <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
                {activeChapter.detail}
              </p>
            )}
          </div>
        ) : (
          <motion.div
            className="relative z-20 text-center px-6 mb-8 pointer-events-none max-w-3xl"
            style={{ y: titleY, opacity: titleOpacity }}
          >
            {(eyebrow || date) && (
              <p className="text-white/70 text-xs font-semibold uppercase tracking-[0.8px] mb-4">
                {typeof eyebrow === 'object' ? eyebrow?.text : (eyebrow ?? date)}
              </p>
            )}
            <h1
              className={`text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-4 ${
                textBlend ? 'mix-blend-overlay text-white' : 'text-white'
              }`}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
                {subtitle}
              </p>
            )}
          </motion.div>
        )}

        {/* Expanding media container */}
        <motion.div
          className="relative z-10 overflow-hidden"
          style={{
            width: mediaWidth,
            borderRadius: mediaBorderRadius,
          }}
        >
          <div className="relative aspect-video w-full">
            {mediaType === 'video' ? (
              <video
                src={mediaSrc}
                poster={posterSrc}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={mediaSrc}
                alt={title}
                className="w-full h-full object-cover"
              />
            )}

            {/* Per-chapter colour tint — cross-fades on chapterIndex change via CSS transition */}
            {hasChapters && activeChapter?.tint && (
              <div
                className="absolute inset-0 pointer-events-none opacity-40 transition-colors duration-700 motion-reduce:transition-none"
                style={{ backgroundColor: activeChapter.tint }}
              />
            )}

            {/* Bottom gradient overlay on media */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
          style={{ opacity: hintOpacity }}
        >
          <p className="text-white/70 text-sm tracking-widest uppercase">{scrollToExpand}</p>
          <motion.div
            className="w-0.5 h-8 bg-white/40 rounded-full origin-top"
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>

      {/* Content revealed below sticky section */}
      {children && (
        <div className="relative z-10 bg-bg">
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Add a second, chaptered instance to the preview page.** Read `app/dev/block-preview/page.tsx` first, then insert it right after the existing (unchaptered) hero instance:

Replace:
```tsx
      <div data-testid="preview-scroll-expand-hero">
        <ScrollExpandHero
          mediaType="image"
          mediaSrc="/images/hero.jpg"
          title="Preview Hero"
          subtitle="Default single-stage behaviour"
        />
      </div>
```
with:
```tsx
      <div data-testid="preview-scroll-expand-hero">
        <ScrollExpandHero
          mediaType="image"
          mediaSrc="/images/hero.jpg"
          title="Preview Hero"
          subtitle="Default single-stage behaviour"
        />
      </div>

      <div data-testid="preview-scroll-expand-hero-chapters">
        <ScrollExpandHero
          mediaType="image"
          mediaSrc="/images/hero.jpg"
          title="Preview Story"
          chapters={[
            { caption: 'Chapter One', detail: 'The raw material.', tint: '#C8102E' },
            { caption: 'Chapter Two', detail: 'Shaped by hand.', tint: '#1B2A4A' },
            { caption: 'Chapter Three', detail: 'Ready to ship.', tint: '#059669' },
          ]}
        />
      </div>
```

- [ ] **Step 4: Write the E2E tests**

```typescript
import { test, expect } from '@playwright/test'

test('scroll-expand-hero without chapters keeps its original single-stage caption', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const heading = page.getByTestId('preview-scroll-expand-hero').locator('h1')
  await expect(heading).toHaveText('Preview Hero')
})

test('chaptered scroll-expand-hero swaps captions as the section scrolls', async ({ page }) => {
  await page.goto('/dev/block-preview')
  const chapterSection = page.getByTestId('preview-scroll-expand-hero-chapters')
  const caption = chapterSection.getByTestId('chapter-caption').locator('h1')
  await expect(caption).toHaveText('Chapter One')

  // Scroll to the midpoint of this section's pinned range to reach a later chapter
  await chapterSection.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    window.scrollTo(0, window.scrollY + rect.top + rect.height * 0.5)
  })
  await expect(caption).not.toHaveText('Chapter One', { timeout: 2000 })
})
```

- [ ] **Step 5: Run them**

```powershell
npx playwright test e2e/scroll-expand-hero-chapters.spec.ts
```
Expected: 2/2 pass.

- [ ] **Step 6: Update the doc entry.** Read `docs/component-library.md` first (scroll-expand-hero at line ~101), then:

Replace:
```markdown
**What it looks like:** A tall (1.5 screens) section. While pinned to the viewport: an eyebrow/date line, then a large bold white title and optional subtitle, sitting above a rounded media panel that starts at 60% width and grows to fill the screen (corners squaring off) as you scroll. A "Scroll to explore" hint with an animated pulsing line sits at the bottom, fading out early. Background is either a solid colour (`background`, hex, defaults navy `#0f172a`) or a full-bleed background image (`bgImageSrc`). Supports either an `<img>` or a looping muted `<video>` as the media.

**Theme:** 🌑 Fixed dark by default (background prop is a raw hex, not a token) — set `background` or `bgImageSrc` explicitly per client.

**Config usage:**
```json
{
  "__block": "scroll-expand-hero",
  "mediaType": "image",
  "mediaSrc": "/images/hero.jpg",
  "bgImageSrc": "/images/hero-bg.jpg",
  "title": "Premium Tarpaulins & Covers",
  "eyebrow": "Est. 1995",
  "subtitle": "Heavy-duty protection for industrial, agricultural, and commercial use"
}
```

**Props:** `mediaType?: 'video'|'image'` (default image), `mediaSrc` (required), `posterSrc?` (video poster), `bgImageSrc?`, `background?` (hex, fallback if no bg image), `title` (required), `eyebrow?` (string, or `{text}` object — both accepted), `subtitle?`, `date?` (shown if no eyebrow), `scrollToExpand?` (hint text), `textBlend?` (mix-blend title over media).
```
with:
```markdown
**What it looks like:** A tall (1.5 screens) section. While pinned to the viewport: an eyebrow/date line, then a large bold white title and optional subtitle, sitting above a rounded media panel that starts at 60% width and grows to fill the screen (corners squaring off) as you scroll. A "Scroll to explore" hint with an animated pulsing line sits at the bottom, fading out early. Background is either a solid colour (`background`, hex, defaults navy `#0f172a`) or a full-bleed background image (`bgImageSrc`). Supports either an `<img>` or a looping muted `<video>` as the media.

**Chaptered mode (optional):** pass `chapters` — a list of `{caption, detail?, tint?}` — and the same pinned expand motion becomes a multi-stage narrative: the title/subtitle are replaced by whichever chapter is active as you scroll through the section, each optionally washing the media in its own colour tint. Omit `chapters` entirely and the block behaves exactly as it always has — this is the same single component either way, not a second block.

**Theme:** 🌑 Fixed dark by default (background prop is a raw hex, not a token) — set `background` or `bgImageSrc` explicitly per client.

**Config usage:**
```json
{
  "__block": "scroll-expand-hero",
  "mediaType": "image",
  "mediaSrc": "/images/hero.jpg",
  "bgImageSrc": "/images/hero-bg.jpg",
  "title": "Premium Tarpaulins & Covers",
  "eyebrow": "Est. 1995",
  "subtitle": "Heavy-duty protection for industrial, agricultural, and commercial use"
}
```

Chaptered variant:
```json
{
  "__block": "scroll-expand-hero",
  "mediaType": "image",
  "mediaSrc": "/images/workshop.jpg",
  "title": "Handmade, Start to Finish",
  "chapters": [
    { "caption": "The raw material", "detail": "Sourced from sustainable forestry.", "tint": "#8B5E3C" },
    { "caption": "Shaped by hand", "detail": "Every joint cut and fitted individually." },
    { "caption": "Ready to ship", "tint": "#059669" }
  ]
}
```

**Props:** `mediaType?: 'video'|'image'` (default image), `mediaSrc` (required), `posterSrc?` (video poster), `bgImageSrc?`, `background?` (hex, fallback if no bg image), `title` (required — also shown as the small eyebrow line above the caption in chaptered mode), `eyebrow?` (string, or `{text}` object — both accepted, single-stage mode only), `subtitle?` (single-stage mode only), `date?` (shown if no eyebrow, single-stage mode only), `scrollToExpand?` (hint text), `textBlend?` (mix-blend title over media, single-stage mode only), `chapters?: {caption, detail?, tint?}[]` (omit for single-stage mode).
```

- [ ] **Step 7: Update the gallery's VIS·02 specimen.** Read `docs/component-library-gallery.html` first (VIS·02 at line ~418), then:

Replace:
```html
            <span class="specimen-code">VIS·02</span>
            <span class="glyph glyph--fixed" title="Fixed dark by default"></span>
          </div>
          <h3>scroll-expand-hero</h3>
          <p class="purpose">Media starts small, expands full-width as you scroll; title fades up and away.</p>
```
with:
```html
            <span class="specimen-code">VIS·02</span>
            <span class="glyph glyph--fixed" title="Fixed dark by default"></span>
          </div>
          <h3>scroll-expand-hero</h3>
          <p class="purpose">Media starts small, expands full-width as you scroll. Optional "chapters" turn it into a multi-stage narrative.</p>
```

- [ ] **Step 8: Commit**

```powershell
git add components/blocks/visual/scroll-expand-hero.tsx app/dev/block-preview/page.tsx e2e/scroll-expand-hero-chapters.spec.ts
git add -f ../docs/component-library.md ../docs/component-library-gallery.html
git commit -m "feat(blocks): scroll-expand-hero — optional chapters prop for pinned multi-stage storytelling"
```

---

### Task 9: Document the block-sourcing process

**Files:**
- Create: `docs/component-sourcing-process.md`
- Modify: `docs/add-a-client-ui.md` (cross-reference)

- [ ] **Step 1: Write the process doc**

```markdown
# Growing the Component Library — Sourcing Process

The repeatable move for adding to `lib/block-registry.ts` **ahead of** a
specific client demanding it — as opposed to `docs/add-a-client-ui.md`, which
is the per-client procedure for *using* the library that already exists.

## The move

1. **Capture a design-system reference.** A finished page, a screenshot set,
   or a machine-readable design-system file (e.g. from styles.refero.design)
   — anything that shows a real, coherent visual direction worth having in
   the library.
2. **Slice** it into its natural section boundaries (hero, feature strip,
   gallery, testimonials, footer band, …) — same slicing step as the
   page-intake procedure in
   `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`.
3. **Match each slice against the existing registry.** Read
   `docs/component-library.md` end to end — 48 entries is short enough to
   scan in one sitting. For each slice, ask: does an existing block already
   cover this, maybe with different content?
4. **Decide enhance-existing vs. build-new — prefer enhancing.** Phase 3 set
   this precedent twice (`showcase-gallery`'s `zoomable` prop,
   `scroll-expand-hero`'s `chapters` prop): a new optional prop on a block
   that already covers 80% of the need is almost always better than a new
   registry key that will sit next to it forever as a "which one do I pick"
   problem. Reach for a new block only when the slice genuinely doesn't fit
   any existing shape.
5. **Naturalise.** Whatever you build or extend must use the shared theme
   tokens (never raw hex), the shared spacing/radius scale, and — if
   animated — the shared motion language (`ScrollReveal` for scroll-triggered
   reveals, respecting `prefers-reduced-motion`) so it sits coherently next
   to everything else in the library, not pasted in from somewhere else.
6. **Document it the same day you build it.** Update
   `docs/component-library.md` and `docs/component-library-gallery.html` in
   the same commit as the code — not a follow-up pass. A block that exists in
   code but isn't in the reference doc might as well not exist, for the
   purposes of the next session that goes looking for it.

## When this doesn't apply

If a specific client is waiting on the block right now, follow
`docs/add-a-client-ui.md` instead — capture that client's actual design and
build directly against their real need. This process is for the opposite
situation: growing the library speculatively, ahead of demand, the way
Phase 3 of the UI pipeline work did.
```

- [ ] **Step 2: Cross-reference it from `docs/add-a-client-ui.md`.** Read the file first, then replace:

```markdown
   naturalised (shared spacing/radius/motion), gracefully degrading. Blocks that
   call the backend take `requiredPlugin` in the registry AND the config entry.
   Then merge the shared branch into the client branch.
```
with:
```markdown
   naturalised (shared spacing/radius/motion), gracefully degrading. Blocks that
   call the backend take `requiredPlugin` in the registry AND the config entry.
   Then merge the shared branch into the client branch. Growing the library
   speculatively, ahead of a specific client, follows a different process —
   see `docs/component-sourcing-process.md`.
```

- [ ] **Step 3: Commit**

```powershell
cd D:\Projects\20260609_Commerceforce
git add docs/component-sourcing-process.md
git add -f docs/add-a-client-ui.md
git commit -m "docs: document the block-sourcing process (backlog item Q, no longer ad-hoc)"
```

---

### Task 10: Update the backlog

**Files:**
- Modify: `docs/backlog.md`

- [ ] **Step 1: Add a Phase 3 entry.** Read the file first, then replace:

```markdown
**Note (no-Docker seeding):** `seed.py` reads identity vars via `os.getenv`, so
it needs `.env` present in the process environment. In Docker that's automatic —
`docker-compose.yml` uses `env_file: ./backend/.env`. Running `seed.py` **bare**
(no Docker) just needs `.env` exported into the shell first (see
`docs/add-a-client-ui.md`). No dependency needed.

---

## Not built — Priority 4 (medium, plan before building)
```
with:
```markdown
**Note (no-Docker seeding):** `seed.py` reads identity vars via `os.getenv`, so
it needs `.env` present in the process environment. In Docker that's automatic —
`docker-compose.yml` uses `env_file: ./backend/.env`. Running `seed.py` **bare**
(no Docker) just needs `.env` exported into the shell first (see
`docs/add-a-client-ui.md`). No dependency needed.

---

### Component library session — Phase 3 (2026-07-19)

**Branch:** `feat/component-library-phase3` (off `feat/ui-pipeline-phase2`, unmerged). Spec: `docs/superpowers/specs/2026-07-19-phase3-component-library-design.md`.

**Built + tested (automated):**
- 3 placeholder blocks (`navbar`, `footer`, `menu`) restyled to production
  theme tokens; `menu`'s dark-theme contrast bug fixed as part of the same pass.
- `ScrollReveal` — shared fade-up-on-scroll wrapper (respects
  `prefers-reduced-motion`), applied to `bento-grid`, `split-image-text`, and
  `showcase-gallery`.
- `showcase-gallery` — new opt-in `zoomable` prop: Layer 1 (tap/click →
  full-screen, `Escape`/close-button/outside-click to dismiss) is fully
  E2E-covered.
- `scroll-expand-hero` — new opt-in `chapters` prop for a pinned, multi-stage
  scroll narrative. Default (no `chapters`) behaviour E2E-verified unchanged.
- `docs/component-library.md` + `docs/component-library-gallery.html` updated
  in step with every change above. `docs/component-sourcing-process.md`
  written — growing the library ahead of demand is no longer ad-hoc.

**Built, NOT automatically tested:**
- `PinchZoomImage` (Layer 2 of the zoomable gallery) — real two-finger
  pinch-to-zoom + drag-to-pan. Playwright cannot simulate true multi-touch;
  desktop wheel-zoom *is* covered automatically. Manual pass (Chrome DevTools
  touch emulation, checklist in the Task 7 plan) status: [fill in after
  running Task 7 Step 6 — "done on <date>, all checks passed" or "still
  needed"].

**Explicitly not touched this round:** the 7 known overlapping block pairs
in `docs/component-library.md` ("known overlaps"); Tri Star's live
`landing-page.config.json`; no new registry blocks were added.

**Next:** merge order is `feat/component-library-phase3` →
`feat/ui-pipeline-phase2` → `master`, once the big manual test session
(Phase 1 + Phase 2 + this) is done.

---

## Not built — Priority 4 (medium, plan before building)
```

- [ ] **Step 2: Commit**

```powershell
git add docs/backlog.md
git commit -m "docs(backlog): record Phase 3 component-library session status"
```

---

### Task 11: Final verification sweep

- [ ] **Step 1: Full gates**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
npm run lint
npm run build
```
Expected: `tsc` clean; lint exits 0 with exactly the 19 pre-existing warnings (0 errors — same baseline as the rest of this session); build clean.

- [ ] **Step 2: Full new-test sweep** (backend `:8000` + storefront `:3000` running):

```powershell
npx playwright test e2e/placeholder-blocks.spec.ts e2e/bento-grid-reveal.spec.ts e2e/split-image-text-reveal.spec.ts e2e/showcase-gallery-zoom.spec.ts e2e/scroll-expand-hero-chapters.spec.ts
```
Expected: all pass (1 + 1 + 1 + 4 + 2 = 9 tests).

- [ ] **Step 3: Confirm no regression to the existing suite**

```powershell
npx playwright test e2e/landing-pipeline.spec.ts e2e/cart.spec.ts e2e/product-listing.spec.ts
```
Expected: pass (Tri Star's live homepage never used any of the blocks this plan touched, so this should be a pure regression check).

- [ ] **Step 4: Confirm the manual pinch/pan pass (Task 7 Step 6) is recorded**

```powershell
grep -n "Manual pass (Chrome DevTools" ..\docs\backlog.md
```
Update the `[fill in after running...]` placeholder from Task 10 with the real result if it wasn't already updated at the time.

- [ ] **Step 5: `git status` clean check**

```powershell
cd D:\Projects\20260609_Commerceforce
git status --short
```
Expected: clean (everything committed task-by-task).

---

## Explicitly out of scope (do not do)

- Any of the 7 known overlapping block pairs (`docs/component-library.md`
  "known overlaps") — reconciling them was explicitly ruled out for this
  session.
- Any change to Tri Star's live `landing-page.config.json`.
- Any new registry blocks — every capability here enhances an existing
  block or is a shared non-block component.
- Pulling in a real external design-system reference (styles.refero.design
  or otherwise) — Task 9 documents the process only.
- Deleting the `/dev/block-preview` route after this plan is done — it's a
  useful standing dev tool for testing future block changes without needing
  a live client config, and it's already excluded from robots/sitemap/index.
- Merging any branch to `master` or pushing to any remote — this plan ends
  with everything committed locally on `feat/component-library-phase3`,
  same convention as Phase 1 and Phase 2.
