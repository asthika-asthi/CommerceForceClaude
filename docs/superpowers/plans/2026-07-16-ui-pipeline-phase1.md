# Per-Client UI Pipeline — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire the storefront homepage to render through the existing block pipeline (`getFilteredSections()` → `LandingSectionRenderer` → `BLOCK_REGISTRY`) pixel-identically to today's hardcoded page, consolidate the five landing-page config variants, clean the untracked repo clutter, and retire the old hand-edit client procedure.

**Architecture:** The current hardcoded homepage components (`components/landing/*`) are wrapped one-for-one as registered blocks (spec's "coarse wrap" rule) so the visible page cannot change. Server-fetched runtime data (products, categories) flows to the blocks that need it via a new optional `data` prop that `LandingSectionRenderer` passes only to registry entries flagged `acceptsData`. The active config's `sections[]` (a stale mockup-derived list with fake static products — never rendered by anything) is archived and replaced with a 12-entry list matching today's live page exactly.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript, Tailwind v4 tokens, Playwright E2E. No backend changes. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`

---

## Verified facts this plan is built on (do not re-derive)

- `frontend-starter/app/page.tsx` imports 11 hardcoded components from `components/landing/*` and fetches products/categories server-side.
- `frontend-starter/lib/landing-config.ts` already provides `getFilteredSections()` (reads `sections[]`, filters by `requiredPlugin`). Its ONLY consumer today is `getHomepageConfig()` (used by page.tsx). `getTopbarSection`, `getBrandCss`, `getStoreConfig`, `getFontLink` are dead code — nothing renders the config's `topbar`/`header`/`navigation`/`footer` entries. The real navbar/footer come from `components/layout/navbar.tsx` / `footer.tsx` and are untouched by this plan.
- `frontend-starter/components/shop/landing-section.tsx` (`LandingSectionRenderer`) already renders config-sourced sections: if `section.__block` is a string it looks up `BLOCK_REGISTRY[__block]` and spreads the remaining keys as props.
- `frontend-starter/lib/block-registry.ts` has 30 entries. Keys `trust-strip`, `category-grid`, `stats-band`, `how-to-order`, `product-range-table`, `testimonials-carousel`, `newsletter-section` etc. are **divergent implementations** (different line counts, client-side fetching) — NOT the components the live page uses. Do not try to reuse them for pixel-identity; wrap the `components/landing/*` originals instead.
- The active `frontend-starter/landing-page.config.json` has 19 `sections[]` entries with static mockup content (fake products with `imgGradient`s, hardcoded categories). Rendering them would break add-to-cart (fake ids) and change visuals. They are safe to archive: nothing reads `sections[]` today.
- Config keys `store`, `brand`, `theme`, `plugins`, `homepage` in the active config: only `homepage` is consumed (`getHomepageConfig`). Leave all of them in place unchanged — this plan only replaces `sections[]`.
- `components/landing/newsletter.tsx` self-gates via `usePlugin("newsletter")` (client-side) — wrapping preserves this.
- Untracked clutter: root `commerceforce.db` (dev DB; `.gitignore` covers only `backend/commerceforce.db`), root `themes/default/globals.css` (a Tarpaulins-To-Go sage-green token file, unreferenced by any build), and worktree `.claude/worktrees/agent-ace000447e9b122bc` (branch `worktree-agent-ace000447e9b122bc` is MERGED into master; the worktree holds 3 untracked docs: `Design_Competitor.md`, `Tristart_design.md`, `CommerceForceClaude_feature_bug_report.md` — must be salvaged before removal; `frontend-starter/CLAUDE.md` references `Design_Competitor.md` as the TTG design source).
- E2E setup exists: `frontend-starter/e2e/*.spec.ts`, Playwright with baseURL for `:3000`; backend must run on `:8000`. Run: `npx playwright test <file>` from `frontend-starter/`.

**Working branch:** create `feat/ui-pipeline` off `master` (Task 1). All commits go there.

---

### Task 1: Branch + salvage the leftover worktree

**Files:**
- Create: `docs/design-sources/Design_Competitor.md` (moved)
- Create: `docs/design-sources/Tristart_design.md` (moved)
- Create: `docs/design-sources/CommerceForceClaude_feature_bug_report.md` (moved)
- Create: `docs/design-sources/README.md`

- [ ] **Step 1: Create the branch**

```powershell
cd D:\Projects\20260609_Commerceforce
git checkout -b feat/ui-pipeline
```

- [ ] **Step 2: Verify the worktree is safe to remove**

```powershell
git -C .claude\worktrees\agent-ace000447e9b122bc status --short
git merge-base --is-ancestor worktree-agent-ace000447e9b122bc master; echo $?
```
Expected: status shows ONLY the three untracked `.md` files (`?? ...`); merge-base check prints `True`/exit 0. **If either differs, STOP and report — do not remove the worktree.**

- [ ] **Step 3: Salvage the design documents**

```powershell
New-Item -ItemType Directory -Force docs\design-sources
Copy-Item .claude\worktrees\agent-ace000447e9b122bc\Design_Competitor.md docs\design-sources\
Copy-Item .claude\worktrees\agent-ace000447e9b122bc\Tristart_design.md docs\design-sources\
Copy-Item .claude\worktrees\agent-ace000447e9b122bc\CommerceForceClaude_feature_bug_report.md docs\design-sources\
```

- [ ] **Step 4: Write `docs/design-sources/README.md`**

```markdown
# Design sources

Client design references salvaged from a leftover agent worktree (2026-07-16).

- `Design_Competitor.md` — Tarpaulins To Go design source (referenced by
  `frontend-starter/CLAUDE.md`); pairs with the archived TTG config at
  `frontend-starter/config-archive/tarpaulins-to-go/`.
- `Tristart_design.md` — Tri Star design notes.
- `CommerceForceClaude_feature_bug_report.md` — bug/feature notes captured
  during an earlier redesign attempt; review before the Phase 2 pilot.
```

- [ ] **Step 5: Remove the worktree and its merged branch**

```powershell
git worktree remove --force .claude\worktrees\agent-ace000447e9b122bc
git branch -d worktree-agent-ace000447e9b122bc
git worktree list
```
Expected: `git worktree list` shows only the main working tree.

- [ ] **Step 6: Commit**

```powershell
git add docs/design-sources
git commit -m "chore: salvage design docs from leftover agent worktree, remove worktree"
```

---

### Task 2: Characterization E2E — freeze today's homepage

Two specs in one file: (A) a characterization test that must pass BEFORE and AFTER the rewire (this is the pixel-identity guard at the content level), and (B) a pipeline-proof test that must FAIL now and pass after Task 6 (this is the TDD red).

**Files:**
- Create: `frontend-starter/e2e/landing-pipeline.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
/**
 * Landing-page pipeline tests.
 *
 * Prerequisites: backend on :8000, storefront on :3000, seeded Tri Star data.
 *
 * Spec A (characterization): freezes the homepage's section content and ORDER
 * as it exists with the hardcoded components. It must pass before AND after
 * the config-pipeline rewire — any failure after the rewire means the page
 * is not identical.
 *
 * Spec B (pipeline proof): asserts the page is rendered by the config
 * pipeline (data-landing-source attribute added in the rewire). Expected to
 * FAIL until app/page.tsx is rewired.
 */
import { test, expect } from '@playwright/test'

// One stable text anchor per landing section, in on-page order.
const SECTION_ANCHORS = [
  'same-day despatch',                    // PromoBanner
  'Quality protective',                   // Hero h1
  'Free UK Delivery',                     // TrustStrip
  'Shop by',                              // CategoryGrid h2
  'Featured',                             // ProductGridSection 1 h2
  'More from',                            // ProductGridSection 2 h2
  'Years supplying UK trade & retail',    // StatsBand
  'How to',                               // HowToOrder h2
  'Product range',                        // RangeTable h2 ("Product range quick reference")
  'What our',                             // Testimonials h2 ("What our customers say")
  'Stay ahead — trade offers',            // Newsletter h2
]

test.describe('Homepage sections (characterization)', () => {
  test('all sections present, in order', async ({ page }) => {
    await page.goto('/')
    // Wait for hero (server-rendered) to be visible before reading text
    await expect(page.locator('h1').first()).toContainText('Quality protective', { timeout: 15_000 })
    const body = await page.locator('body').innerText()
    let cursor = -1
    for (const anchor of SECTION_ANCHORS) {
      const idx = body.indexOf(anchor)
      expect(idx, `section anchor not found: "${anchor}"`).toBeGreaterThan(-1)
      expect(idx, `section out of order: "${anchor}"`).toBeGreaterThan(cursor)
      cursor = idx
    }
  })

  test('product grids show real products with add buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('a[href^="/products/"]', { timeout: 15_000 })
    const productLinks = page.locator('a[href^="/products/"]')
    expect(await productLinks.count()).toBeGreaterThan(0)
  })
})

test.describe('Config pipeline', () => {
  test('homepage renders via the config pipeline', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-landing-source="config-pipeline"]')).toHaveCount(1)
  })
})
```

- [ ] **Step 2: Run against the CURRENT page**

Start backend and storefront if not running (two terminals):
```powershell
cd D:\Projects\20260609_Commerceforce\backend; .venv\Scripts\python.exe -m uvicorn app.main:app
cd D:\Projects\20260609_Commerceforce\frontend-starter; npm run dev
```
Then:
```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx playwright test e2e/landing-pipeline.spec.ts
```
Expected: the two **characterization** tests PASS; the **pipeline** test FAILS (attribute doesn't exist yet). If a characterization anchor fails, fix the anchor string to match the live page (read the component under `components/landing/`), NOT the page.

- [ ] **Step 3: Commit**

```powershell
git add e2e/landing-pipeline.spec.ts
git commit -m "test(e2e): characterize homepage sections + failing config-pipeline proof"
```

---

### Task 3: Runtime-data plumbing (types + renderer + registry flag)

Blocks that show live products/categories need server-fetched data. Registry entries opt in via `acceptsData: true`; the renderer then passes the page's `data` object as a `data` prop. Existing blocks are untouched (no flag → no new prop).

**Files:**
- Modify: `frontend-starter/lib/types.ts` (append)
- Modify: `frontend-starter/lib/block-registry.ts:33-37` (interface)
- Modify: `frontend-starter/components/shop/landing-section.tsx:6-17`

- [ ] **Step 1: Add the runtime-data type to `lib/types.ts`** (append at end of file)

```typescript
/** Server-fetched data the homepage passes to blocks flagged acceptsData in BLOCK_REGISTRY. */
export interface LandingRuntimeData {
  products: Product[]
  categories: Category[]
  showBestSellersCard: boolean
}
```

- [ ] **Step 2: Extend `BlockRegistryEntry` in `lib/block-registry.ts`**

Replace the existing interface:
```typescript
export interface BlockRegistryEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
  requiredPlugin?: string
  /** When true, LandingSectionRenderer passes the page's LandingRuntimeData as a `data` prop. */
  acceptsData?: boolean
}
```

- [ ] **Step 3: Pass data through in `components/shop/landing-section.tsx`**

Replace the function signature and the config-sourced branch (lines 6–17):
```tsx
import type { LandingSection, LandingRuntimeData } from "@/lib/types"

export function LandingSectionRenderer({ section, data }: { section: LandingSection; data?: LandingRuntimeData }) {
  const style = section.background_color ? { backgroundColor: section.background_color } : undefined

  // Config-sourced section: __block is top-level, not inside section.content
  const asConfig = section as unknown as { __block?: string; requiredPlugin?: string; [key: string]: unknown }
  if (typeof asConfig.__block === 'string') {
    const entry = BLOCK_REGISTRY[asConfig.__block]
    if (!entry) return null
    const { __block: _, requiredPlugin: __, ...props } = asConfig
    const BlockComponent = entry.component
    if (entry.acceptsData) {
      return <BlockComponent {...props} data={data} />
    }
    return <BlockComponent {...props} />
  }
```
(The rest of the file — the DB-section branches — is unchanged. Note the import line replaces the existing `import type { LandingSection } from "@/lib/types"`.)

- [ ] **Step 4: Type-check**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```powershell
git add lib/types.ts lib/block-registry.ts components/shop/landing-section.tsx
git commit -m "feat(blocks): renderer passes runtime data to blocks flagged acceptsData"
```

---

### Task 4: Wrap the 11 landing components as registered blocks

One wrapper file (they change together — they're a transitional shim; spec's coarse-wrap rule). The originals in `components/landing/` stay — they are now block internals. **Do not delete or edit them.**

**Files:**
- Create: `frontend-starter/components/blocks/landing/legacy-landing-blocks.tsx`
- Modify: `frontend-starter/lib/block-registry.ts` (imports + 11 registry entries)
- Modify: `frontend-starter/components/blocks/index.ts` (barrel exports)

- [ ] **Step 1: Create `components/blocks/landing/legacy-landing-blocks.tsx`**

```tsx
/**
 * One-for-one block wrappers around the original hardcoded landing components,
 * so the Tri Star homepage renders pixel-identically through the config
 * pipeline (see docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md,
 * "coarse wrap"). Finer decomposition can happen in the Phase 3 library session.
 */
import type { LandingRuntimeData } from '@/lib/types'
import { Hero } from '@/components/landing/hero'
import { PromoBanner } from '@/components/landing/promo-banner'
import { TrustStrip } from '@/components/landing/trust-strip'
import { CategoryGrid } from '@/components/landing/category-grid'
import { ProductGridSection } from '@/components/landing/product-grid-section'
import { SplitCards } from '@/components/landing/split-cards'
import { StatsBand } from '@/components/landing/stats-band'
import { HowToOrder } from '@/components/landing/how-to-order'
import { RangeTable } from '@/components/landing/range-table'
import { Testimonials } from '@/components/landing/testimonials'
import { Newsletter } from '@/components/landing/newsletter'

interface DataProps {
  data?: LandingRuntimeData
}

export function LandingPromoBannerBlock() {
  return <PromoBanner />
}

export function LandingHeroBlock({ data }: DataProps) {
  return (
    <Hero
      bestSellers={(data?.products ?? []).slice(0, 4)}
      showBestSellersCard={data?.showBestSellersCard ?? true}
    />
  )
}

export function LandingTrustStripBlock() {
  return <TrustStrip />
}

export function LandingCategoryGridBlock({ data }: DataProps) {
  return <CategoryGrid categories={data?.categories ?? []} />
}

interface LandingProductGridProps extends DataProps {
  title: string
  titleHighlight: string
  viewAllHref: string
  viewAllLabel: string
  sliceStart: number
  sliceEnd: number
  whiteBackground?: boolean
}

export function LandingProductGridBlock({
  data, title, titleHighlight, viewAllHref, viewAllLabel, sliceStart, sliceEnd, whiteBackground,
}: LandingProductGridProps) {
  const products = (data?.products ?? []).slice(sliceStart, sliceEnd)
  if (products.length === 0) return null
  const grid = (
    <ProductGridSection
      title={title}
      titleHighlight={titleHighlight}
      products={products}
      viewAllHref={viewAllHref}
      viewAllLabel={viewAllLabel}
      sectionOffset={sliceStart}
    />
  )
  return whiteBackground ? <div className="bg-white">{grid}</div> : grid
}

export function LandingSplitCardsBlock() {
  return <SplitCards />
}

export function LandingStatsBandBlock() {
  return <StatsBand />
}

export function LandingHowToOrderBlock() {
  return <HowToOrder />
}

export function LandingRangeTableBlock({ data }: DataProps) {
  return <RangeTable products={data?.products ?? []} categories={data?.categories ?? []} />
}

export function LandingTestimonialsBlock() {
  return <Testimonials />
}

export function LandingNewsletterBlock() {
  return <Newsletter />
}
```

- [ ] **Step 2: Register them in `lib/block-registry.ts`**

Add to the imports:
```typescript
import {
  LandingPromoBannerBlock, LandingHeroBlock, LandingTrustStripBlock,
  LandingCategoryGridBlock, LandingProductGridBlock, LandingSplitCardsBlock,
  LandingStatsBandBlock, LandingHowToOrderBlock, LandingRangeTableBlock,
  LandingTestimonialsBlock, LandingNewsletterBlock,
} from '@/components/blocks/landing/legacy-landing-blocks'
```

Add to `BLOCK_REGISTRY` (before the closing `}`):
```typescript
  // Coarse-wrapped originals of the hardcoded Tri Star landing sections
  'landing-promo-banner': { component: LandingPromoBannerBlock },
  'landing-hero': { component: LandingHeroBlock, acceptsData: true },
  'landing-trust-strip': { component: LandingTrustStripBlock },
  'landing-category-grid': { component: LandingCategoryGridBlock, acceptsData: true },
  'landing-product-grid': { component: LandingProductGridBlock, acceptsData: true },
  'landing-split-cards': { component: LandingSplitCardsBlock },
  'landing-stats-band': { component: LandingStatsBandBlock },
  'landing-how-to-order': { component: LandingHowToOrderBlock },
  'landing-range-table': { component: LandingRangeTableBlock, acceptsData: true },
  'landing-testimonials': { component: LandingTestimonialsBlock },
  'landing-newsletter': { component: LandingNewsletterBlock },
```

- [ ] **Step 3: Add barrel exports to `components/blocks/index.ts`** (append)

```typescript
export {
  LandingPromoBannerBlock, LandingHeroBlock, LandingTrustStripBlock,
  LandingCategoryGridBlock, LandingProductGridBlock, LandingSplitCardsBlock,
  LandingStatsBandBlock, LandingHowToOrderBlock, LandingRangeTableBlock,
  LandingTestimonialsBlock, LandingNewsletterBlock,
} from './landing/legacy-landing-blocks'
```

- [ ] **Step 4: Type-check and lint**

```powershell
npx tsc --noEmit
npm run lint
```
Expected: clean.

- [ ] **Step 5: Commit**

```powershell
git add components/blocks/landing/legacy-landing-blocks.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): register the 11 hardcoded landing sections as coarse-wrapped blocks"
```

---

### Task 5: Archive stale configs, write the real `sections[]`

**Files:**
- Create: `frontend-starter/config-archive/README.md`
- Create: `frontend-starter/config-archive/tristar/landing-page.config.mockup-sections.json` (copy of current active file)
- Move: `frontend-starter/Original_landing-page.config.json` → `frontend-starter/config-archive/tarpaulins-to-go/landing-page.config.json`
- Move: `frontend-starter/tristar_landing-page.config_1.json` → `frontend-starter/config-archive/tristar/landing-page.config_1.json`
- Move: `frontend-starter/Tristart_landing-page.config_2.json` → `frontend-starter/config-archive/tristar/landing-page.config_2.json`
- Move: `frontend-starter/landing-page.config_3.json` → `frontend-starter/config-archive/tristar/landing-page.config_3.json`
- Modify: `frontend-starter/landing-page.config.json` (replace `sections[]` only)

- [ ] **Step 1: Create the archive and move the variants**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
New-Item -ItemType Directory -Force config-archive\tristar
New-Item -ItemType Directory -Force config-archive\tarpaulins-to-go
Copy-Item landing-page.config.json config-archive\tristar\landing-page.config.mockup-sections.json
Move-Item Original_landing-page.config.json config-archive\tarpaulins-to-go\landing-page.config.json
Move-Item tristar_landing-page.config_1.json config-archive\tristar\
Move-Item Tristart_landing-page.config_2.json config-archive\tristar\
Move-Item landing-page.config_3.json config-archive\tristar\
```

- [ ] **Step 2: Write `config-archive/README.md`**

```markdown
# Config archive

Historical landing-page config variants. **Nothing here is read by any build.**
The single active config is `frontend-starter/landing-page.config.json`.

- `tristar/landing-page.config.mockup-sections.json` — snapshot of the active
  config before 2026-07-16, when its `sections[]` was a mockup-derived plan
  (static fake products) that no code ever rendered. Kept for the section
  prop-shapes it documents (scroll-expand-hero, dual-cta-banner, …).
- `tristar/landing-page.config_1.json`, `_2`, `_3` — earlier Tri Star experiments.
- `tarpaulins-to-go/landing-page.config.json` — the prepared Tarpaulins To Go
  config (sage green, Poppins, scroll-expand-hero first). Candidate input for
  a future client pilot. Pairs with `tarpaulins-to-go/globals.css` (token file)
  and `docs/design-sources/Design_Competitor.md`.
```

- [ ] **Step 3: Replace `sections[]` in the active `landing-page.config.json`**

Leave `store`, `brand`, `theme`, `plugins`, `homepage` untouched. Replace the entire `"sections": [ ... ]` array (currently 19 mockup entries, lines ~411–end) with:

```json
  "sections": [
    { "__block": "landing-promo-banner" },
    { "__block": "landing-hero" },
    { "__block": "landing-trust-strip" },
    { "__block": "landing-category-grid" },
    {
      "__block": "landing-product-grid",
      "title": "Featured",
      "titleHighlight": "products",
      "viewAllHref": "/products",
      "viewAllLabel": "View all products →",
      "sliceStart": 0,
      "sliceEnd": 4,
      "whiteBackground": true
    },
    {
      "__block": "landing-product-grid",
      "title": "More from",
      "titleHighlight": "our range",
      "viewAllHref": "/products",
      "viewAllLabel": "See all products →",
      "sliceStart": 4,
      "sliceEnd": 8
    },
    { "__block": "landing-split-cards" },
    { "__block": "landing-stats-band" },
    { "__block": "landing-how-to-order" },
    { "__block": "landing-range-table" },
    { "__block": "landing-testimonials" },
    { "__block": "landing-newsletter" }
  ]
```

Validate the JSON parses:
```powershell
node -e "JSON.parse(require('fs').readFileSync('landing-page.config.json','utf8')); console.log('valid')"
```
Expected: `valid`.

- [ ] **Step 4: Commit**

```powershell
git add -A config-archive landing-page.config.json
git rm --cached Original_landing-page.config.json tristar_landing-page.config_1.json Tristart_landing-page.config_2.json landing-page.config_3.json 2>$null
git commit -m "feat(config): archive stale config variants; author real sections[] for the live Tri Star page"
```
(The `git rm --cached` may be unnecessary if `Move-Item` + `git add -A` already staged the renames — check `git status` first; skip it if the moves show as renames.)

---

### Task 6: Rewire `app/page.tsx` to the pipeline

**Files:**
- Modify: `frontend-starter/app/page.tsx` (full rewrite)
- Test: `frontend-starter/e2e/landing-pipeline.spec.ts` (already written — Task 2)

- [ ] **Step 1: Replace `app/page.tsx` entirely**

```tsx
import { serverFetch } from "@/lib/api"
import { getFilteredSections, getHomepageConfig } from "@/lib/landing-config"
import type { Category, LandingRuntimeData, LandingSection, PaginatedResponse, Product } from "@/lib/types"
import { LandingSectionRenderer } from "@/components/shop/landing-section"

export default async function HomePage() {
  const [featuredRes, categories] = await Promise.all([
    serverFetch<PaginatedResponse<Product>>("/api/products?featured_only=true&page_size=8"),
    serverFetch<Category[]>("/api/categories").catch(() => [] as Category[]),
  ])

  const products = [...(featuredRes?.items ?? [])]

  // Top up to 8 with other active products so both homepage grids stay populated
  // even when fewer than 8 products are marked as featured.
  if (products.length < 8) {
    const fillRes = await serverFetch<PaginatedResponse<Product>>("/api/products?page_size=16")
    const seen = new Set(products.map(p => p.id))
    for (const p of fillRes?.items ?? []) {
      if (products.length >= 8) break
      if (!seen.has(p.id)) { products.push(p); seen.add(p.id) }
    }
  }

  const data: LandingRuntimeData = {
    products,
    categories: (categories ?? []).filter(c => c.is_active),
    showBestSellersCard: getHomepageConfig().showBestSellersCard !== false,
  }

  const sections = getFilteredSections()

  return (
    <div className="bg-bg" data-landing-source="config-pipeline">
      {sections.map((section, i) => (
        <LandingSectionRenderer
          key={`${section.__block}-${i}`}
          section={section as unknown as LandingSection}
          data={data}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Run the full landing E2E — all three tests must now pass**

(backend `:8000` + storefront `:3000` running, as in Task 2)
```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx playwright test e2e/landing-pipeline.spec.ts
```
Expected: 3/3 PASS. If a characterization test fails, the pipeline output differs from the original page — fix the wiring (wrapper props, section order, config), NEVER the characterization assertions.

- [ ] **Step 3: Visual spot-check**

Open `http://localhost:3000` in a browser. Verify against memory of the old page: promo banner gradient bar → dark hero with best-sellers card → trust strip → 4 category cards → white "Featured products" grid → grey "More from our range" grid → two big CTA cards → dark stats band → how-to-order steps → range table → testimonials → newsletter. No missing sections, no doubled sections, no unstyled regions.

- [ ] **Step 4: Build + lint + full E2E sweep**

```powershell
npm run build
npm run lint
npx playwright test
```
Expected: build and lint clean. E2E: the suite has two pre-existing known flakes unrelated to this work (`theme-colors.spec.ts` 90s poll vs 30s timeout; `pagination.spec.ts` login rate-limit) — those failing is acceptable; anything else failing is not.

- [ ] **Step 5: Commit**

```powershell
git add app/page.tsx
git commit -m "feat(storefront): homepage renders via config sections + block registry, pixel-identical"
```

---

### Task 7: Clean the untracked root clutter

**Files:**
- Modify: `.gitignore` (repo root)
- Create: `frontend-starter/config-archive/tarpaulins-to-go/globals.css` (moved from root `themes/default/globals.css`)
- Delete: root `themes/` directory

- [ ] **Step 1: Ignore the root dev database**

Append to `.gitignore` (root), next to the existing `backend/commerceforce.db` line:
```
/commerceforce.db
```

- [ ] **Step 2: Archive the stray TTG token file and remove root `themes/`**

The root `themes/default/globals.css` is a Tarpaulins-To-Go (sage `#B6C1A1`) token file, referenced by no build (the real one is `frontend-starter/themes/default/globals.css`). First confirm nothing references it:
```powershell
cd D:\Projects\20260609_Commerceforce
Select-String -Path docker-compose.yml -Pattern "themes" -SimpleMatch
```
Expected: no output. **If it matches, STOP and report.** Then:
```powershell
Move-Item themes\default\globals.css frontend-starter\config-archive\tarpaulins-to-go\globals.css
Remove-Item -Recurse -Force themes
```

- [ ] **Step 3: Verify git status is clean**

```powershell
git status --short
```
Expected: only the staged/intended changes; no `??` lines for `commerceforce.db`, `themes/`, or `.claude/` (the `.claude/` noise disappears with the worktree removed in Task 1 — if `.claude/` still shows, inspect what's inside before doing anything).

- [ ] **Step 4: Commit**

```powershell
git add .gitignore frontend-starter/config-archive/tarpaulins-to-go/globals.css
git commit -m "chore: ignore root dev db; archive stray TTG token file; remove stray themes/"
```

---

### Task 8: Retire the old hand-edit procedure in `frontend-starter/CLAUDE.md`

**Files:**
- Modify: `frontend-starter/CLAUDE.md`

- [ ] **Step 1: Replace "Step 3 — Run the bulk class-replace script (first time only)"**

Delete that entire subsection (heading + PowerShell script + trailing grep note) and put this in its place:

```markdown
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
```

- [ ] **Step 2: Fix the Key Files table row for `app/page.tsx`**

Change:
```
| `app/page.tsx` | Home page — landing sections from `/api/landing_page` |
```
to:
```
| `app/page.tsx` | Home page — renders `sections[]` from `landing-page.config.json` via `LandingSectionRenderer`; do not hand-edit per client |
```
And add a row directly under it:
```
| `lib/block-registry.ts` | Block registry — every homepage section type; add new blocks here |
```

- [ ] **Step 3: Fix the Customisation Checklist item**

Change:
```
- [ ] Run bulk class-replace script (Step 3 in Applying a New Client's Design) if starting from template
```
to:
```
- [ ] Author the homepage `sections[]` in `landing-page.config.json` (Step 3 in Applying a New Client's Design)
```

- [ ] **Step 4: Commit**

```powershell
git add CLAUDE.md
git commit -m "docs(storefront): replace hand-edit client procedure with block/config pipeline"
```

---

### Task 9: Update the live backlog

**Files:**
- Modify: `docs/backlog.md`

- [ ] **Step 1: Add a section under "Built + Tested" (or after the latest dated section)**

```markdown
### Per-client UI pipeline — Phase 1 wiring (2026-07-16)

**Branch:** `feat/ui-pipeline`. Spec: `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`.

**Built + Tested (automated):**
- Homepage now renders via `landing-page.config.json` `sections[]` →
  `LandingSectionRenderer` → `BLOCK_REGISTRY` instead of hardcoded imports.
  Pixel-identity guarded by a characterization E2E
  (`frontend-starter/e2e/landing-pipeline.spec.ts`): section content + order
  frozen before the rewire, re-verified after, plus a pipeline-proof assertion.
- 11 original landing components registered as coarse-wrapped `landing-*`
  blocks; live product/category data flows via the new `acceptsData` registry
  flag. Existing blocks untouched.
- Config consolidation: 4 stray variants + the never-rendered 19-section
  mockup list archived under `frontend-starter/config-archive/`; single
  active config remains.
- Clutter: leftover agent worktree removed (design docs salvaged to
  `docs/design-sources/`), root dev DB gitignored, stray TTG token file
  archived.
- `frontend-starter/CLAUDE.md`: bulk find/replace + hand-edit procedure
  replaced with the block/config procedure.

**Built, NOT tested — needs manual browser verification:**
- Side-by-side visual pass of the homepage vs. production (`commerceforce.uk`)
  during the next big test session — the E2E freezes content/order, not pixels.

**Next:** Phase 2 pilot (new client via design-capture) → Phase 3 component
library session (backlog item Q). Item W's config-vs-DB content layering
decision is still deferred.
```

- [ ] **Step 2: In the "Not built — Priority 4" table, update row W**

Change the `W` row's notes to start with:
```
**Engineering half DONE 2026-07-16** (homepage wired to config pipeline, see "Per-client UI pipeline — Phase 1"). Remaining: the admin "Page Content" editor / DB content-layer decision — still needs its own short design session.
```
(keep the rest of the existing W text after it).

- [ ] **Step 3: Commit**

```powershell
git add docs/backlog.md
git commit -m "docs(backlog): record UI pipeline Phase 1 wiring status"
```

---

## Final verification (whole plan)

1. `npx playwright test e2e/landing-pipeline.spec.ts` — 3/3 pass.
2. `npm run build && npm run lint` in `frontend-starter/` — clean.
3. `git status --short` at repo root — no untracked noise.
4. `git worktree list` — main tree only.
5. Browser: homepage visually matches the pre-change page; plugin-gated navbar items (cart, wishlist, trade) unchanged; newsletter section still disappears if the `newsletter` plugin is disabled.
6. Do NOT merge to master — leave `feat/ui-pipeline` for the user's review/test session per repo convention.

## Explicitly out of scope (do not do)

- No visual changes of any kind — pixel-identical is the acceptance bar.
- No changes to `components/landing/*` internals, navbar, footer, or any non-homepage page.
- No DB/`LandingSection`-API changes; the admin "Landing Page Sections" screen stays as-is (its replacement is the deferred half of backlog item W).
- No merging or deleting of the divergent block twins (`trust-strip` vs `landing-trust-strip`, …) — that's the Phase 3 library session.
- No new client work (Phase 2).
