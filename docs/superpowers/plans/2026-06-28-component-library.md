# Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise `components/blocks/` into four categorised subdirectories, add 8 new visual/content blocks to the registry, and replace the `<select>` variant picker with clickable pill buttons that show out-of-stock values as greyed strikethrough.

**Architecture:** All block components live in `frontend-starter/components/blocks/{layout,visual,commerce,content}/`. The registry (`lib/block-registry.ts`) maps string keys to components; the config JSON and admin panel are unaffected by the directory change. The variant picker refactor is isolated to two files in `app/products/[slug]/`.

**Tech Stack:** Next.js 16 App Router, React 18, Tailwind v4, framer-motion (already installed), TypeScript.

---

## File map

### Modified (reorganisation)
- `frontend-starter/lib/block-registry.ts` — update all 22 import paths to subdirectory form
- `frontend-starter/components/blocks/index.ts` — update re-exports to subdirectory form
- `frontend-starter/lib/block-defaults.ts` — add 8 new block entries; sync 3 missing entries
- `frontend-admin/lib/block-defaults.ts` — same additions (kept in sync with storefront)

### Moved (existing blocks)
```
components/blocks/ → components/blocks/layout/
  navbar-block.tsx, footer-block.tsx, menu-block.tsx,
  tubelight-navbar-block.tsx, announcement-bar.tsx

components/blocks/ → components/blocks/visual/
  scroll-expand-hero.tsx, glowing-shadow.tsx, glowing-shadow.css,
  shiny-button.tsx, promotions-banner.tsx

components/blocks/ → components/blocks/commerce/
  featured-products-grid.tsx, category-grid.tsx, coupon-spotlight.tsx,
  trust-strip.tsx, product-range-table.tsx, loyalty-widget-section.tsx

components/blocks/ → components/blocks/content/
  testimonials-carousel.tsx, newsletter-section.tsx, cta-banner.tsx,
  dual-cta-banner.tsx, stats-band.tsx, how-to-order.tsx, button-group.tsx
```

### Created (new blocks)
- `frontend-starter/components/blocks/visual/glassmorphism-hero.tsx`
- `frontend-starter/components/blocks/visual/parallax-banner.tsx`
- `frontend-starter/components/blocks/visual/marquee-ticker.tsx`
- `frontend-starter/components/blocks/visual/gradient-text-section.tsx`
- `frontend-starter/components/blocks/visual/image-mosaic.tsx`
- `frontend-starter/components/blocks/content/split-image-text.tsx`
- `frontend-starter/components/blocks/content/animated-counter.tsx`
- `frontend-starter/components/blocks/content/bento-grid.tsx`

### Modified (variant picker)
- `frontend-starter/app/products/[slug]/variant-picker.tsx` — replace `<select>` with pills
- `frontend-starter/app/products/[slug]/add-to-cart-button.tsx` — handle inactive variant display

---

## Task 1: Directory reorganisation

**Files:**
- Move: all files listed in the "Moved" section above
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/components/blocks/index.ts`

- [ ] **Step 1: Create the four subdirectories**

Run in PowerShell from the repo root:
```powershell
$b = "frontend-starter\components\blocks"
New-Item -ItemType Directory -Path "$b\layout" -Force
New-Item -ItemType Directory -Path "$b\visual" -Force
New-Item -ItemType Directory -Path "$b\commerce" -Force
New-Item -ItemType Directory -Path "$b\content" -Force
```

- [ ] **Step 2: Move layout blocks**

```powershell
$b = "frontend-starter\components\blocks"
Move-Item "$b\navbar-block.tsx"         "$b\layout\"
Move-Item "$b\footer-block.tsx"         "$b\layout\"
Move-Item "$b\menu-block.tsx"           "$b\layout\"
Move-Item "$b\tubelight-navbar-block.tsx" "$b\layout\"
Move-Item "$b\announcement-bar.tsx"     "$b\layout\"
```

- [ ] **Step 3: Move visual blocks**

```powershell
$b = "frontend-starter\components\blocks"
Move-Item "$b\scroll-expand-hero.tsx"   "$b\visual\"
Move-Item "$b\glowing-shadow.tsx"       "$b\visual\"
Move-Item "$b\glowing-shadow.css"       "$b\visual\"
Move-Item "$b\shiny-button.tsx"         "$b\visual\"
Move-Item "$b\promotions-banner.tsx"    "$b\visual\"
```

- [ ] **Step 4: Move commerce blocks**

```powershell
$b = "frontend-starter\components\blocks"
Move-Item "$b\featured-products-grid.tsx" "$b\commerce\"
Move-Item "$b\category-grid.tsx"          "$b\commerce\"
Move-Item "$b\coupon-spotlight.tsx"       "$b\commerce\"
Move-Item "$b\trust-strip.tsx"            "$b\commerce\"
Move-Item "$b\product-range-table.tsx"    "$b\commerce\"
Move-Item "$b\loyalty-widget-section.tsx" "$b\commerce\"
```

- [ ] **Step 5: Move content blocks**

```powershell
$b = "frontend-starter\components\blocks"
Move-Item "$b\testimonials-carousel.tsx" "$b\content\"
Move-Item "$b\newsletter-section.tsx"    "$b\content\"
Move-Item "$b\cta-banner.tsx"            "$b\content\"
Move-Item "$b\dual-cta-banner.tsx"       "$b\content\"
Move-Item "$b\stats-band.tsx"            "$b\content\"
Move-Item "$b\how-to-order.tsx"          "$b\content\"
Move-Item "$b\button-group.tsx"          "$b\content\"
```

- [ ] **Step 6: Fix the CSS import inside glowing-shadow.tsx**

The file at `frontend-starter/components/blocks/visual/glowing-shadow.tsx` currently imports `'./glowing-shadow.css'`. That path is still correct after the move (both files are now in `visual/`), so verify the import line reads:
```tsx
import './glowing-shadow.css'
```
If it does not have this import at all, add it as the first line.

- [ ] **Step 7: Replace `frontend-starter/lib/block-registry.ts` with updated import paths**

Write the complete new file:

```typescript
import type { ComponentType } from 'react'
import { ScrollExpandHero } from '@/components/blocks/visual/scroll-expand-hero'
import { FeaturedProductsGrid } from '@/components/blocks/commerce/featured-products-grid'
import { TestimonialsCarousel } from '@/components/blocks/content/testimonials-carousel'
import { NewsletterSection } from '@/components/blocks/content/newsletter-section'
import { LoyaltyWidgetSection } from '@/components/blocks/commerce/loyalty-widget-section'
import { CTABanner } from '@/components/blocks/content/cta-banner'
import { ButtonGroup } from '@/components/blocks/content/button-group'
import { NavbarBlock } from '@/components/blocks/layout/navbar-block'
import { FooterBlock } from '@/components/blocks/layout/footer-block'
import { MenuBlock } from '@/components/blocks/layout/menu-block'
import { ShinyButtonBlock } from '@/components/blocks/visual/shiny-button'
import { GlowingShadow } from '@/components/blocks/visual/glowing-shadow'
import { TubelightNavbarBlock } from '@/components/blocks/layout/tubelight-navbar-block'
import { PromotionsBanner } from '@/components/blocks/visual/promotions-banner'
import { AnnouncementBar } from '@/components/blocks/layout/announcement-bar'
import { CouponSpotlight } from '@/components/blocks/commerce/coupon-spotlight'
import { TrustStrip } from '@/components/blocks/commerce/trust-strip'
import { CategoryGrid } from '@/components/blocks/commerce/category-grid'
import { DualCtaBanner } from '@/components/blocks/content/dual-cta-banner'
import { StatsBand } from '@/components/blocks/content/stats-band'
import { HowToOrder } from '@/components/blocks/content/how-to-order'
import { ProductRangeTable } from '@/components/blocks/commerce/product-range-table'

export interface BlockRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
  requiredPlugin?: string
}

export const BLOCK_REGISTRY: Record<string, BlockRegistryEntry> = {
  'scroll-expand-hero': { component: ScrollExpandHero },
  'featured-products-grid': { component: FeaturedProductsGrid },
  'testimonials-carousel': { component: TestimonialsCarousel },
  'newsletter-section': { component: NewsletterSection },
  'loyalty-widget': { component: LoyaltyWidgetSection },
  'cta-banner': { component: CTABanner },
  'button-group': { component: ButtonGroup },
  'navbar': { component: NavbarBlock },
  'footer': { component: FooterBlock },
  'menu': { component: MenuBlock },
  'shiny-button': { component: ShinyButtonBlock },
  'glowing-shadow': { component: GlowingShadow },
  'tubelight-navbar': { component: TubelightNavbarBlock },
  'promotions-banner': { component: PromotionsBanner },
  'announcement-bar': { component: AnnouncementBar },
  'coupon-spotlight': { component: CouponSpotlight },
  'trust-strip': { component: TrustStrip },
  'category-grid': { component: CategoryGrid },
  'dual-cta-banner': { component: DualCtaBanner },
  'stats-band': { component: StatsBand },
  'how-to-order': { component: HowToOrder },
  'product-range-table': { component: ProductRangeTable },
}
```

- [ ] **Step 8: Update `frontend-starter/components/blocks/index.ts`**

```typescript
// Barrel re-exports — grouped by category
export { NavbarBlock } from './layout/navbar-block'
export { FooterBlock } from './layout/footer-block'
export { MenuBlock } from './layout/menu-block'
export { TubelightNavbarBlock } from './layout/tubelight-navbar-block'
export { AnnouncementBar } from './layout/announcement-bar'

export { ScrollExpandHero } from './visual/scroll-expand-hero'
export { GlowingShadow } from './visual/glowing-shadow'
export { GlowButton, ShinyButtonBlock } from './visual/shiny-button'
export { PromotionsBanner } from './visual/promotions-banner'

export { FeaturedProductsGrid } from './commerce/featured-products-grid'
export { CategoryGrid } from './commerce/category-grid'
export { CouponSpotlight } from './commerce/coupon-spotlight'
export { TrustStrip } from './commerce/trust-strip'
export { ProductRangeTable } from './commerce/product-range-table'
export { LoyaltyWidgetSection } from './commerce/loyalty-widget-section'

export { TestimonialsCarousel } from './content/testimonials-carousel'
export { NewsletterSection } from './content/newsletter-section'
export { CTABanner } from './content/cta-banner'
export { DualCtaBanner } from './content/dual-cta-banner'
export { StatsBand } from './content/stats-band'
export { HowToOrder } from './content/how-to-order'
export { ButtonGroup } from './content/button-group'
```

- [ ] **Step 9: Run the build — must pass with zero errors**

```powershell
cd frontend-starter
npm run build
```

Expected: `✓ Compiled successfully` with no TypeScript errors. If there are import errors, they will name the exact file and line — fix those first before proceeding.

- [ ] **Step 10: Commit**

```powershell
git add frontend-starter/components/blocks/ frontend-starter/lib/block-registry.ts
git commit -m "refactor: reorganise blocks into layout/visual/commerce/content subdirectories"
```

---

## Task 2: glassmorphism-hero block

**Files:**
- Create: `frontend-starter/components/blocks/visual/glassmorphism-hero.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/visual/glassmorphism-hero.tsx`:

```tsx
interface GlassmorphismHeroProps {
  backgroundImage: string
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
  overlayOpacity?: number
}

export function GlassmorphismHero({
  backgroundImage,
  title,
  subtitle,
  ctaText,
  ctaUrl,
  overlayOpacity = 0.4,
}: GlassmorphismHeroProps) {
  return (
    <section
      className="relative min-h-[500px] flex items-center justify-center px-4 py-20"
      style={{
        backgroundImage: `url("${backgroundImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
      />
      <div className="relative z-10 max-w-xl w-full mx-auto backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-10 text-center shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">{title}</h1>
        {subtitle && <p className="text-white/80 text-lg mb-8">{subtitle}</p>}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-white/90 transition-colors"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add the import after the last existing import line:
```typescript
import { GlassmorphismHero } from '@/components/blocks/visual/glassmorphism-hero'
```

Add the registry entry inside `BLOCK_REGISTRY` after `'product-range-table'`:
```typescript
'glassmorphism-hero': { component: GlassmorphismHero },
```

- [ ] **Step 3: Add defaults to `frontend-starter/lib/block-defaults.ts`**

Add at the end of the `BLOCK_DEFAULTS` object (before the closing `}`):
```typescript
'glassmorphism-hero': {
  backgroundImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&auto=format&fit=crop',
  title: 'Built for your business',
  subtitle: 'Premium quality, delivered fast.',
  ctaText: 'Shop Now',
  ctaUrl: '/products',
  overlayOpacity: 0.4,
},
```

- [ ] **Step 4: Add same defaults to `frontend-admin/lib/block-defaults.ts`**

Add the same entry to the admin file. Also add the three missing entries that are in the storefront but not the admin (fix the sync gap):
```typescript
'promotions-banner': {},
'announcement-bar': {},
'coupon-spotlight': {},
'glassmorphism-hero': {
  backgroundImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&auto=format&fit=crop',
  title: 'Built for your business',
  subtitle: 'Premium quality, delivered fast.',
  ctaText: 'Shop Now',
  ctaUrl: '/products',
  overlayOpacity: 0.4,
},
```

- [ ] **Step 5: Build check**

```powershell
cd frontend-starter && npm run build
```
Expected: zero errors.

- [ ] **Step 6: Manual verification**

Temporarily add to `frontend-starter/landing-page.config.json` in the `sections` array:
```json
{
  "__block": "glassmorphism-hero",
  "backgroundImage": "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&auto=format&fit=crop",
  "title": "Built for your business",
  "subtitle": "Premium quality, delivered fast.",
  "ctaText": "Shop Now",
  "ctaUrl": "/products"
}
```
Start dev server (`npm run dev`), visit `http://localhost:3000`, confirm the frosted glass card renders over the background image. Remove the test entry from `landing-page.config.json` after verification.

- [ ] **Step 7: Commit**

```powershell
git add frontend-starter/components/blocks/visual/glassmorphism-hero.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add glassmorphism-hero block; sync admin block-defaults"
```

---

## Task 3: parallax-banner block

**Files:**
- Create: `frontend-starter/components/blocks/visual/parallax-banner.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/visual/parallax-banner.tsx`:

```tsx
interface ParallaxBannerProps {
  backgroundImage: string
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
  overlayOpacity?: number
  minHeight?: string
}

export function ParallaxBanner({
  backgroundImage,
  title,
  subtitle,
  ctaText,
  ctaUrl,
  overlayOpacity = 0.5,
  minHeight = '400px',
}: ParallaxBannerProps) {
  return (
    <section
      className="relative flex items-center justify-center px-4 py-20"
      style={{
        backgroundImage: `url("${backgroundImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight,
      }}
    >
      {/* iOS does not support background-attachment:fixed — it falls back to scroll (static bg, no parallax). This is acceptable. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
      />
      <div className="relative z-10 text-center max-w-3xl">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{title}</h2>
        {subtitle && <p className="text-white/80 text-lg mb-8">{subtitle}</p>}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-hover transition-colors"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add import:
```typescript
import { ParallaxBanner } from '@/components/blocks/visual/parallax-banner'
```

Add registry entry:
```typescript
'parallax-banner': { component: ParallaxBanner },
```

- [ ] **Step 3: Add defaults to both defaults files**

In `frontend-starter/lib/block-defaults.ts`:
```typescript
'parallax-banner': {
  backgroundImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&auto=format&fit=crop',
  title: 'Quality you can count on',
  subtitle: 'Trusted by businesses across the UK.',
  ctaText: 'Get a quote',
  ctaUrl: '/contact',
  overlayOpacity: 0.5,
  minHeight: '400px',
},
```

In `frontend-admin/lib/block-defaults.ts` (same entry):
```typescript
'parallax-banner': {
  backgroundImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&auto=format&fit=crop',
  title: 'Quality you can count on',
  subtitle: 'Trusted by businesses across the UK.',
  ctaText: 'Get a quote',
  ctaUrl: '/contact',
  overlayOpacity: 0.5,
  minHeight: '400px',
},
```

- [ ] **Step 4: Build check, manual verify, commit**

Build: `cd frontend-starter && npm run build` — zero errors expected.

Manual: add `{ "__block": "parallax-banner", "backgroundImage": "...", "title": "Test" }` temporarily to config, verify parallax effect on desktop scroll (note: on mobile/iOS the bg will be static — that is expected). Remove after verify.

```powershell
git add frontend-starter/components/blocks/visual/parallax-banner.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add parallax-banner block"
```

---

## Task 4: marquee-ticker block

**Files:**
- Create: `frontend-starter/components/blocks/visual/marquee-ticker.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/visual/marquee-ticker.tsx`:

```tsx
interface MarqueeTickerProps {
  items: string[]
  speed?: number
  backgroundColor?: string
  textColor?: string
  separator?: string
}

export function MarqueeTicker({
  items,
  speed = 40,
  backgroundColor,
  textColor,
  separator = '·',
}: MarqueeTickerProps) {
  if (!items || items.length === 0) return null
  // Duplicate items for seamless loop: animation translates -50% (= one full set width)
  const doubled = [...items, ...items]
  const duration = `${Math.max(5, Math.round(items.length * (80 / speed)))}s`

  return (
    <div
      className="overflow-hidden py-3 whitespace-nowrap"
      style={{
        backgroundColor: backgroundColor ?? 'var(--brand-dark)',
        color: textColor ?? '#ffffff',
      }}
    >
      <style>{`
        @keyframes cf-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div
        className="inline-flex items-center"
        style={{ animation: `cf-marquee ${duration} linear infinite` }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center">
            <span className="text-sm font-medium tracking-wide px-4">{item}</span>
            <span className="opacity-40 text-sm">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add import:
```typescript
import { MarqueeTicker } from '@/components/blocks/visual/marquee-ticker'
```

Add registry entry:
```typescript
'marquee-ticker': { component: MarqueeTicker },
```

- [ ] **Step 3: Add defaults to both defaults files**

```typescript
'marquee-ticker': {
  items: [
    'Free delivery over £150',
    'UK-stocked products',
    '30-day returns',
    'Rated 4.9 ★ by 2,000+ customers',
    'Trade accounts welcome',
  ],
  speed: 40,
},
```

Add this entry to both `frontend-starter/lib/block-defaults.ts` and `frontend-admin/lib/block-defaults.ts`.

- [ ] **Step 4: Build check, manual verify, commit**

Build: `cd frontend-starter && npm run build` — zero errors.

Manual: add `{ "__block": "marquee-ticker", "items": ["Free delivery", "30-day returns", "Rated 4.9★"] }` to config. Verify strip scrolls smoothly and loops seamlessly. Remove after verify.

```powershell
git add frontend-starter/components/blocks/visual/marquee-ticker.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add marquee-ticker block"
```

---

## Task 5: gradient-text-section block

**Files:**
- Create: `frontend-starter/components/blocks/visual/gradient-text-section.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/visual/gradient-text-section.tsx`:

```tsx
interface GradientTextSectionProps {
  title: string
  subtitle?: string
  ctaText?: string
  ctaUrl?: string
  gradientFrom?: string
  gradientTo?: string
}

export function GradientTextSection({
  title,
  subtitle,
  ctaText,
  ctaUrl,
  gradientFrom,
  gradientTo,
}: GradientTextSectionProps) {
  return (
    <section className="py-20 px-4 text-center bg-bg">
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(to right, ${gradientFrom ?? 'var(--brand)'}, ${gradientTo ?? 'var(--brand-dark)'})`,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted text-lg mb-8 max-w-xl mx-auto leading-relaxed">{subtitle}</p>
        )}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-hover transition-colors"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add import:
```typescript
import { GradientTextSection } from '@/components/blocks/visual/gradient-text-section'
```

Add registry entry:
```typescript
'gradient-text-section': { component: GradientTextSection },
```

- [ ] **Step 3: Add defaults to both defaults files**

```typescript
'gradient-text-section': {
  title: 'Where quality meets value',
  subtitle: 'Trusted by trade professionals across the UK since 1995.',
  ctaText: 'Explore our range',
  ctaUrl: '/products',
},
```

Add to both `frontend-starter/lib/block-defaults.ts` and `frontend-admin/lib/block-defaults.ts`.

- [ ] **Step 4: Build check, manual verify, commit**

Build: `cd frontend-starter && npm run build` — zero errors.

Manual: add `{ "__block": "gradient-text-section", "title": "Where quality meets value" }` to config, verify the gradient text renders. Remove after verify.

```powershell
git add frontend-starter/components/blocks/visual/gradient-text-section.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add gradient-text-section block"
```

---

## Task 6: image-mosaic block

**Files:**
- Create: `frontend-starter/components/blocks/visual/image-mosaic.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/visual/image-mosaic.tsx`:

```tsx
interface MosaicImage {
  src: string
  alt: string
  linkUrl?: string
}

interface ImageMosaicProps {
  images: MosaicImage[]
  title?: string
}

export function ImageMosaic({ images, title }: ImageMosaicProps) {
  const display = images.slice(0, 6)

  return (
    <section className="py-16 px-4 bg-bg">
      {title && (
        <h2 className="text-3xl font-bold text-fg text-center mb-10">{title}</h2>
      )}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-[200px]">
        {display.map((img, i) => {
          const isTall = i % 3 === 0
          const content = (
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          )
          return (
            <div
              key={i}
              className={`overflow-hidden rounded-xl bg-slate-100 ${isTall ? 'row-span-2' : ''}`}
            >
              {img.linkUrl ? (
                <a href={img.linkUrl} className="block w-full h-full">{content}</a>
              ) : (
                content
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add import:
```typescript
import { ImageMosaic } from '@/components/blocks/visual/image-mosaic'
```

Add registry entry:
```typescript
'image-mosaic': { component: ImageMosaic },
```

- [ ] **Step 3: Add defaults to both defaults files**

```typescript
'image-mosaic': {
  title: 'Our products in action',
  images: [
    { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop', alt: 'Product 1' },
    { src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop', alt: 'Product 2' },
    { src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop', alt: 'Product 3' },
    { src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop', alt: 'Product 4' },
    { src: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&auto=format&fit=crop', alt: 'Product 5' },
    { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop', alt: 'Product 6' },
  ],
},
```

Add to both defaults files.

- [ ] **Step 4: Build check, manual verify, commit**

Build: `cd frontend-starter && npm run build` — zero errors.

Manual: add the block to config with the default images, verify the staggered mosaic grid renders and images fill their cells. Remove after verify.

```powershell
git add frontend-starter/components/blocks/visual/image-mosaic.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add image-mosaic block"
```

---

## Task 7: split-image-text block

**Files:**
- Create: `frontend-starter/components/blocks/content/split-image-text.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/content/split-image-text.tsx`:

```tsx
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
        <div className={imagePosition === 'right' ? 'md:order-last' : ''}>
          <div className="rounded-2xl overflow-hidden aspect-square bg-slate-100">
            <img src={image} alt={imageAlt} className="w-full h-full object-cover" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4 leading-tight">{title}</h2>
          <p className="text-muted text-base leading-relaxed mb-8">{body}</p>
          {ctaText && ctaUrl && (
            <a
              href={ctaUrl}
              className="inline-block px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-hover transition-colors"
            >
              {ctaText}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add import:
```typescript
import { SplitImageText } from '@/components/blocks/content/split-image-text'
```

Add registry entry:
```typescript
'split-image-text': { component: SplitImageText },
```

- [ ] **Step 3: Add defaults to both defaults files**

```typescript
'split-image-text': {
  image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop',
  imageAlt: 'Our products',
  title: 'Trusted by trade professionals',
  body: 'For over 30 years we have supplied quality products to businesses across the UK. Our team is on hand to help you find exactly what you need.',
  ctaText: 'Learn more',
  ctaUrl: '/about',
  imagePosition: 'left',
},
```

Add to both defaults files.

- [ ] **Step 4: Build check, manual verify, commit**

Build: `cd frontend-starter && npm run build` — zero errors.

Manual: add block to config, verify two-column layout with image on left. Change `imagePosition` to `"right"` in config, verify image moves to right on desktop. Remove after verify.

```powershell
git add frontend-starter/components/blocks/content/split-image-text.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add split-image-text block"
```

---

## Task 8: animated-counter block

**Files:**
- Create: `frontend-starter/components/blocks/content/animated-counter.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/content/animated-counter.tsx`:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

interface Stat {
  value: number
  label: string
  prefix?: string
  suffix?: string
}

interface AnimatedCounterProps {
  stats: Stat[]
  title?: string
}

function Counter({ value, prefix = '', suffix = '' }: Pick<Stat, 'value' | 'prefix' | 'suffix'>) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    let current = 0
    const duration = 1500
    const intervalMs = 16
    const increment = value / (duration / intervalMs)
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, intervalMs)
    return () => clearInterval(timer)
  }, [isInView, value])

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

export function AnimatedCounter({ stats, title }: AnimatedCounterProps) {
  const display = stats.slice(0, 4)
  return (
    <section className="py-16 px-4 bg-bg">
      <div className="max-w-5xl mx-auto">
        {title && (
          <h2 className="text-3xl font-bold text-fg text-center mb-12">{title}</h2>
        )}
        <div className={`grid gap-8 text-center grid-cols-2 ${display.length >= 3 ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
          {display.map((stat, i) => (
            <div key={i}>
              <div className="text-4xl md:text-5xl font-extrabold text-brand-dark mb-2">
                <Counter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <p className="text-muted text-sm font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add import:
```typescript
import { AnimatedCounter } from '@/components/blocks/content/animated-counter'
```

Add registry entry:
```typescript
'animated-counter': { component: AnimatedCounter },
```

- [ ] **Step 3: Add defaults to both defaults files**

```typescript
'animated-counter': {
  title: 'By the numbers',
  stats: [
    { value: 30, label: 'Years in business', suffix: '+' },
    { value: 2000, label: 'Happy customers', suffix: '+' },
    { value: 500, label: 'Products in range', suffix: '+' },
    { value: 99, label: 'Satisfaction rate', suffix: '%' },
  ],
},
```

Add to both defaults files.

- [ ] **Step 4: Build check, manual verify, commit**

Build: `cd frontend-starter && npm run build` — zero errors.

Manual: add block to config. Scroll away from the section then scroll back — numbers should count up from 0 when the section comes into view. Remove after verify.

```powershell
git add frontend-starter/components/blocks/content/animated-counter.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add animated-counter block"
```

---

## Task 9: bento-grid block

**Files:**
- Create: `frontend-starter/components/blocks/content/bento-grid.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`
- Modify: `frontend-starter/lib/block-defaults.ts`
- Modify: `frontend-admin/lib/block-defaults.ts`

- [ ] **Step 1: Create the component**

Create `frontend-starter/components/blocks/content/bento-grid.tsx`:

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
        <h2 className="text-3xl font-bold text-fg text-center mb-10">{title}</h2>
      )}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[180px]">
        {display.map((card, i) => (
          <div
            key={i}
            className={`rounded-2xl overflow-hidden bg-card-bg border border-border p-6 flex flex-col justify-between ${
              card.size === 'large' ? 'col-span-2 row-span-2' : ''
            }`}
          >
            {card.image && (
              <div className={`overflow-hidden rounded-xl mb-4 ${card.size === 'large' ? 'h-40' : 'h-20'}`}>
                <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1">
              <h3 className={`font-bold text-fg mb-2 ${card.size === 'large' ? 'text-2xl' : 'text-base'}`}>
                {card.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed line-clamp-3">{card.body}</p>
            </div>
            {card.linkUrl && card.linkText && (
              <a
                href={card.linkUrl}
                className="mt-3 text-brand-dark font-semibold text-sm hover:underline inline-flex items-center gap-1 shrink-0"
              >
                {card.linkText} →
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register in `frontend-starter/lib/block-registry.ts`**

Add import:
```typescript
import { BentoGrid } from '@/components/blocks/content/bento-grid'
```

Add registry entry:
```typescript
'bento-grid': { component: BentoGrid },
```

- [ ] **Step 3: Add defaults to both defaults files**

```typescript
'bento-grid': {
  title: 'Why choose us',
  cards: [
    {
      size: 'large',
      title: 'Trade prices, direct to you',
      body: 'We import directly and pass the savings on. No middlemen, no markups — just quality products at the price you deserve.',
      linkUrl: '/products',
      linkText: 'Browse our range',
    },
    {
      size: 'small',
      title: 'Fast dispatch',
      body: 'Orders placed before 2pm ship the same day.',
    },
    {
      size: 'small',
      title: '30-day returns',
      body: 'Not happy? Return it, no questions asked.',
    },
  ],
},
```

Add to both defaults files.

- [ ] **Step 4: Build check, manual verify, commit**

Build: `cd frontend-starter && npm run build` — zero errors.

Manual: add block to config. Verify the large card spans 2 columns and 2 rows, small cards fill the remaining cells. Remove after verify.

```powershell
git add frontend-starter/components/blocks/content/bento-grid.tsx \
        frontend-starter/lib/block-registry.ts \
        frontend-starter/lib/block-defaults.ts \
        frontend-admin/lib/block-defaults.ts
git commit -m "feat: add bento-grid block"
```

---

## Task 10: Variant picker refactor

**Files:**
- Modify: `frontend-starter/app/products/[slug]/variant-picker.tsx`
- Modify: `frontend-starter/app/products/[slug]/add-to-cart-button.tsx`

- [ ] **Step 1: Rewrite `variant-picker.tsx`**

Replace the entire file with:

```tsx
"use client"

import { useState, useEffect, useMemo } from "react"

interface OptionValue {
  id: string
  label: string
  sort_order: number
}

interface OptionType {
  id: string
  name: string
  sort_order: number
  values: OptionValue[]
}

interface Variant {
  id: string
  is_default: boolean
  is_active: boolean
  option_values: Array<{ option_type_name: string; option_value_label: string }>
  label: string
}

interface VariantPickerProps {
  optionTypes: OptionType[]
  variants: Variant[]
  onSelect: (variantId: string | null) => void
}

export function VariantPicker({ optionTypes, variants, onSelect }: VariantPickerProps) {
  const [selections, setSelections] = useState<Record<string, string>>({})

  // Pre-compute which option values appear in at least one ACTIVE variant.
  // A value absent from this set is shown as out-of-stock.
  const availableValues = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const ot of optionTypes) {
      map.set(ot.name, new Set())
    }
    for (const v of variants) {
      if (v.is_active) {
        for (const ov of v.option_values) {
          map.get(ov.option_type_name)?.add(ov.option_value_label)
        }
      }
    }
    return map
  }, [optionTypes, variants])

  useEffect(() => {
    const allSelected = optionTypes.every(ot => selections[ot.name])
    if (!allSelected) {
      onSelect(null)
      return
    }
    const matched = variants.find(v =>
      v.option_values.every(ov => selections[ov.option_type_name] === ov.option_value_label)
    )
    // Pass the variant ID whether active or not.
    // add-to-cart-button.tsx checks is_active and shows "Out of stock" if inactive.
    onSelect(matched?.id ?? null)
  }, [selections, variants, optionTypes, onSelect])

  if (optionTypes.length === 0) return null

  return (
    <div className="space-y-5 my-4">
      {[...optionTypes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(optionType => (
          <div key={optionType.id} role="group" aria-label={optionType.name}>
            <p className="text-sm font-semibold text-fg mb-2">
              {optionType.name}
              {selections[optionType.name] && (
                <span className="ml-2 font-normal text-muted">— {selections[optionType.name]}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {[...optionType.values]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(val => {
                  const isSelected = selections[optionType.name] === val.label
                  const isAvailable = availableValues.get(optionType.name)?.has(val.label) ?? false

                  return (
                    <button
                      key={val.id}
                      aria-pressed={isSelected}
                      onClick={() =>
                        setSelections(prev => ({ ...prev, [optionType.name]: val.label }))
                      }
                      className={[
                        'px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-brand-dark text-white border-brand-dark'
                          : isAvailable
                            ? 'bg-bg text-fg border-border hover:border-brand-dark hover:text-brand-dark'
                            : 'bg-slate-100 text-muted border-border line-through opacity-60 cursor-pointer',
                      ].join(' ')}
                    >
                      {val.label}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
    </div>
  )
}
```

- [ ] **Step 2: Update `add-to-cart-button.tsx` to handle inactive variant**

In `frontend-starter/app/products/[slug]/add-to-cart-button.tsx`, make two targeted edits.

**Edit 1:** Find this block (around line 49):
```tsx
const hasOptions = optionTypes.length > 0
const isVariantRequired = hasOptions && !selectedVariantId
```

Replace it with:
```tsx
const hasOptions = optionTypes.length > 0
const isVariantRequired = hasOptions && !selectedVariantId
const selectedVariantInactive =
  !!selectedVariantId &&
  variants.find(v => v.id === selectedVariantId)?.is_active === false
```

**Edit 2:** Find the `<button onClick={handleAdd}` block and replace the full button JSX with:
```tsx
<button
  onClick={handleAdd}
  disabled={status !== "idle" || isVariantRequired || selectedVariantInactive}
  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${
    status === "added" ? "bg-green-600 text-white"
    : status === "error" ? "bg-red-500 text-white"
    : (isVariantRequired || selectedVariantInactive) ? "bg-slate-100 text-slate-400"
    : "bg-brand hover:bg-brand-hover text-white"
  }`}
>
  {status === "added" ? <><Check size={18} /> Added!</>
   : status === "error" ? <><X size={18} /> Failed — try again</>
   : selectedVariantInactive ? <>Out of stock</>
   : isVariantRequired ? <>Select options above</>
   : <><ShoppingCart size={18} /> Add to cart</>}
</button>
```

Do NOT add an early return for `selectedVariantInactive` — the VariantPicker manages its own internal selection state and would lose it if unmounted and remounted by an early return.

- [ ] **Step 3: Build check**

```powershell
cd frontend-starter && npm run build
```
Expected: zero TypeScript errors.

- [ ] **Step 4: Manual verification**

Start the dev server (`npm run dev`). Open a product that has variants (one with Size and Colour options).

Verify:
- No `<select>` dropdowns appear — pill buttons render instead
- Clicking a pill highlights it (dark background, white text)
- The option type label shows the selected value: `Size — M`
- Selecting all options enables the Add to Cart button
- Deactivate one variant via the admin panel (`http://localhost:3001`), reload the product page — that value appears greyed with strikethrough
- Click the greyed pill and select the full out-of-stock combination — the button changes to "Out of stock"

- [ ] **Step 5: Commit**

```powershell
git add frontend-starter/app/products/[slug]/variant-picker.tsx \
        frontend-starter/app/products/[slug]/add-to-cart-button.tsx
git commit -m "feat: replace variant select dropdowns with pill picker; show out-of-stock inline"
```

---

## Task 11: Final checks

- [ ] **Step 1: Full build**

```powershell
cd frontend-starter && npm run build
```
Expected: `✓ Compiled successfully`, zero errors.

- [ ] **Step 2: Lint**

```powershell
cd frontend-starter && npm run lint
```
Expected: no errors or warnings introduced by this sprint.

- [ ] **Step 3: Verify all 22 existing blocks still render**

Start the dev server (`npm run dev`). Load `http://localhost:3000`. Scroll through the entire landing page and confirm every section that was there before still renders correctly — the directory reorganisation should be invisible to the user.

- [ ] **Step 4: Update backlog**

In `docs/backlog.md`, move item Q (Storefront component library) from "Not built — Priority 4" to "Built + Tested" and add a brief summary of what was built.

- [ ] **Step 5: Final commit**

```powershell
git add docs/backlog.md
git commit -m "docs: mark component library (Q) as built and tested in backlog"
```
