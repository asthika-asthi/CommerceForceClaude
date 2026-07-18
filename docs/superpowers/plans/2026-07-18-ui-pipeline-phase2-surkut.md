# Per-Client UI Pipeline — Phase 2 Implementation Plan (Pilot Client: Surkut Miniatures)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a second, visually distinct client homepage (Surkut Miniatures — dark gold-on-charcoal, commission miniature painting) entirely through the block pipeline: zero hand-edited page code, all new blocks token-styled and added to the shared library, golden path passing, and the "add a client" procedure written down.

**Architecture:** Shared platform improvements (7 new generic blocks, heading-font support, dark-theme token readiness) land on `feat/ui-pipeline-phase2` (branched off master, mergeable back). The Surkut-specific overlay (theme token values, fonts, config `sections[]`, images, seed data, client E2E anchors) lands on `client/surkut` (branched off the shared branch, **never merged to master** — it is the client's deployment branch). The design source is the client's own repo: https://github.com/asthika-asthi/Surkut (a finished single-page site → page-intake procedure: slice → match → build → naturalise → assemble).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 tokens, Playwright E2E, FastAPI backend (existing `contact` plugin for the commission form). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md` (Phase 2, §4 "externally-designed client" + page-intake procedure)

---

## Verified facts this plan is built on (do not re-derive)

- Phase 1 is **merged into master** (merge commit `941360d`, 2026-07-18, local only — not pushed). The homepage renders `landing-page.config.json` → `sections[]` → `LandingSectionRenderer` → `BLOCK_REGISTRY`. Master's active config is Tri Star's.
- The Surkut design source is one self-contained page (`html/index.html` in the GitHub repo) with 9 sections: hero, services (3 pricing tiers), process (5 numbered steps), portfolio, videos, stream, audience (4 persona cards), faq, commission (form + socials). Real assets exist in the repo: `html/assets/images/{RPG_Drone_Corp.jpg, SawtoothPainted.jpg, SawtoothPlain.jpg, army.jpg}` and `html/assets/videos/{video1.mp4, video2.mp4}`.
- Surkut palette (from the page's CSS variables): gold `#C9A84C`, gold-dark `#9A7A2E`, gold-light `#E8C97A`, bg-deep `#0A0C10`, bg-dark `#10131A`, bg-card `#161B26`, text `#F0EAD6`, text-dim `#B8AE98`, text-muted `#8A8070`, borders `rgba(201,168,76,.2/.5)`, live-green `#22C55E`. Fonts: **Cinzel** (headings, serif) + **Raleway** (body) — both on Google Fonts.
- Block matches (config-only reuse, no new code): process → `how-to-order` (takes `title` + `steps[{number,title,description}]`), audience → `bento-grid` (takes `cards[{title,body,size}]`, `title`).
- No existing block covers: the hero (badge + dual CTA + stat chips), pricing tiers, portfolio gallery with tier badges, video clips grid, stream spotlight, FAQ accordion, enquiry form. → **7 new blocks.**
- Backend `contact` plugin exists: `POST /api/contact` accepts `EnquiryCreate {name, email, phone?, subject?, message}` (201); admin reads enquiries at `/admin/enquiries`. Plugin name for `ENABLED_PLUGINS`: `contact`.
- Fonts today: single font — `layout.tsx` loads Poppins with CSS variable `--font-poppins`; `app/globals.css` maps `--font-sans: var(--font-poppins), …`. **No heading-font mechanism exists yet** (shared improvement in Task 2).
- Dark-theme readiness: **46 storefront files hardcode `bg-white`**; `bg-brand-dark` appears in 8 files. All theme tokens live in `frontend-starter/themes/default/globals.css` (`:root` list, Tri Star values) mapped to utilities in `app/globals.css` `@theme inline`. Admin DB colour overrides are injected as inline style on `<html>` and are irrelevant to this plan (leave empty for Surkut dev).
- E2E: `frontend-starter/e2e/landing-pipeline.spec.ts` freezes **Tri Star** section anchors — it must keep passing on the shared branch, and gets Surkut anchors on the client branch. Backend on `:8000`, storefront on `:3000`. Known pre-existing flakes: `theme-colors.spec.ts` (timeout), `pagination`/login rate-limit.
- Local dev DB: `DATABASE_URL` is a **relative** sqlite path — always start the backend from `backend\` (`docs/local-dev.md`). Seed: `backend/seed.py` — `_CATEGORIES` + `_products()` are the demo source (`--demo` flag); branding comes from env `STORE_NAME` / `STORE_TAGLINE` / `CONTACT_EMAIL`.
- Backend lint/type gates: `.venv\Scripts\ruff.exe check .` and `.venv\Scripts\mypy.exe app/` from `backend/`.
- Design-source clone used while authoring this plan: `https://github.com/asthika-asthi/Surkut` — re-clone it at execution time (Task 12 does this) to copy assets and cross-check copy.

**Branch model for this plan:**

| Branch | Created from | Contains | Merges to master? |
|---|---|---|---|
| `feat/ui-pipeline-phase2` | `master` | 7 new blocks, heading-font + dark-readiness plumbing, procedure doc, backlog update | Yes — after the user's test session |
| `client/surkut` | `feat/ui-pipeline-phase2` | Surkut tokens, fonts, config, images/videos, seed data, Surkut E2E anchors | **Never** (living client branch) |

---

### Task 1: Shared branch + Surkut design-source document

**Files:**
- Create: `docs/design-sources/Surkut_design.md`
- Modify: `docs/design-sources/README.md` (add one bullet)

- [ ] **Step 1: Create the shared branch off master**

```powershell
cd D:\Projects\20260609_Commerceforce
git checkout master
git checkout -b feat/ui-pipeline-phase2
```

- [ ] **Step 2: Write `docs/design-sources/Surkut_design.md`** — the design-capture artifact (spec Phase 2 step 1). Content:

```markdown
# Surkut Miniatures — Design Source

**Client:** Surkut Miniatures (surkut.co.uk) — commission miniature painting, streamed live on Twitch.
**Source:** https://github.com/asthika-asthi/Surkut — finished single-page site (`html/index.html`), built externally. This is the agreed design; intake follows the spec's page-intake procedure.
**Captured:** 2026-07-18

## Palette (CSS variables from the source page)

| Role | Value |
|---|---|
| Gold (primary/CTA) | `#C9A84C` |
| Gold light (hover/emphasis) | `#E8C97A` |
| Gold dark | `#9A7A2E` |
| Page background | `#10131A` |
| Deep background (hero/footer bands) | `#0A0C10` |
| Card background | `#161B26` |
| Body text (cream) | `#F0EAD6` |
| Dim text | `#B8AE98` |
| Muted text | `#8A8070` |
| Borders | gold at 20% / 50% alpha |
| Live/status green | `#22C55E` (status colour — stays hardcoded per token rules) |

## Typography
- Headings: **Cinzel** (serif, 400/600/700)
- Body: **Raleway** (sans, 400/500/600/700)

## Section list (top to bottom) and block mapping

| # | Source section | Block | New? |
|---|---|---|---|
| 1 | Hero: "Commissions Open" badge, "Your Army, Painted Live. With Your Input.", dual CTA, 3 stat chips | `spotlight-hero` | NEW |
| 2 | Services: 3 commission tiers (Tabletop £10 / Premium £20 / Display POA), features, "Most Popular" flag | `pricing-tiers` | NEW |
| 3 | Process: 5 numbered steps | `how-to-order` | reuse |
| 4 | Portfolio: image cards with tier badges + "slots available" card | `showcase-gallery` | NEW |
| 5 | Videos: 2 stream clips with captions | `video-showcase` | NEW |
| 6 | Stream: Twitch spotlight panel + bullets + channel link | `stream-spotlight` | NEW |
| 7 | Audience: 4 persona cards (Wargamers / DMs / Busy professionals / Collectors) | `bento-grid` | reuse |
| 8 | FAQ: 6 Q&A accordion | `faq-accordion` | NEW |
| 9 | Commission: enquiry form + socials sidebar | `enquiry-form` (posts to `/api/contact`) | NEW |

## Naturalisation decisions
- All colours → theme tokens (no raw hex in blocks); the gold/dark values live only in the client branch's `themes/default/globals.css`.
- Cinzel applied via the shared `font-heading` utility (falls back to the client's sans for every other client).
- Persona-card "pain point" chips simplified into the card body text (bento-grid reuse).
- Twitch panel is a styled preview card linking out — no iframe embed (avoids Twitch's `parent` domain restriction in dev).
- Social links (Instagram/Patreon URLs) and `contact_email` are best-guess — **confirm with the client before go-live.**
```

- [ ] **Step 3: Add to `docs/design-sources/README.md`** (append bullet):

```markdown
- `Surkut_design.md` — Surkut Miniatures design capture (from the client's
  GitHub repo); pairs with the `client/surkut` branch.
```

- [ ] **Step 4: Commit**

```powershell
git add docs/design-sources
git commit -m "docs(design-sources): Surkut design capture + block mapping"
```

---

### Task 2: Shared theme plumbing — heading font, emphasis surface, how-to-order flexibility

Zero visual change for Tri Star: every new token defaults to the current behaviour.

**Files:**
- Modify: `frontend-starter/app/globals.css` (two lines in `@theme inline`)
- Modify: `frontend-starter/themes/default/globals.css` (one token, documentation)
- Modify: `frontend-starter/components/blocks/content/how-to-order.tsx`

- [ ] **Step 1: Add to `app/globals.css` `@theme inline`** (after the `--font-sans` line):

```css
  --font-heading: var(--heading-family, var(--font-sans));
  --color-emphasis-surface: var(--emphasis-surface, var(--brand-dark));
```

`font-heading` utility: headings render in the client's heading font when the client's theme file sets `--heading-family`; otherwise identical to today. `bg-emphasis-surface`: a surface colour for "selected/emphasis" UI that dark-theme clients can override without repurposing `--brand-dark`.

- [ ] **Step 2: Document the two optional tokens in `themes/default/globals.css`** (append inside `:root`, keeping Tri Star's rendering identical):

```css
  /* Optional per-client extensions (fall back automatically when unset):
     --heading-family: font stack for headings (defaults to the body font)
     --emphasis-surface: selected/emphasis surface (defaults to --brand-dark) */
```

(Comment only — do NOT set values for Tri Star.)

- [ ] **Step 3: Make `how-to-order` handle 5 steps and dark themes.** In `components/blocks/content/how-to-order.tsx`:
  - Change `className="py-14 px-6 bg-white"` → `className="py-14 px-6 bg-card-bg"` (Tri Star `--card-bg` is `#FFFFFF` — pixel-identical).
  - Change the grid class to size by step count: `` className={`grid grid-cols-2 ${steps.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-8 relative`} ``
  - Change the step circle `bg-white` → `bg-card-bg`.
  - Add `font-heading` to the `<h2>` class list.

- [ ] **Step 4: Type-check, lint, and prove Tri Star is unchanged**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx tsc --noEmit
npm run lint
```
Then with backend `:8000` + storefront `:3000` running (see `docs/local-dev.md` — start backend from `backend\`):
```powershell
npx playwright test e2e/landing-pipeline.spec.ts
```
Expected: 3/3 pass (Tri Star config is active on this branch).

- [ ] **Step 5: Commit**

```powershell
git add app/globals.css themes/default/globals.css components/blocks/content/how-to-order.tsx
git commit -m "feat(theme): optional heading-font and emphasis-surface tokens; how-to-order 5-step + token bg"
```

---

### Task 3: Dark-theme readiness sweep of shared shop surfaces

Surkut is the platform's first dark theme. Shared pages hardcode `bg-white` (46 files); on a dark `--bg` they'd render blinding white slabs. Replace hardcodes with tokens whose **Tri Star defaults equal the current colours** — so Tri Star is pixel-identical and dark themes become possible for every future client.

**Scope rule (important):** sweep `app/**` and `components/{layout,shop,ui}/**` plus `components/blocks/**`. Do NOT touch `components/landing/*` — those are the Tri Star coarse-wrapped block internals; they are never rendered for other clients and pixel-identity protects them.

**Decision table (apply per occurrence):**

| Hardcoded | Replace with | Because |
|---|---|---|
| `bg-white` on a card / panel / modal / dropdown / input | `bg-card-bg` | `--card-bg` is `#FFFFFF` for Tri Star |
| `bg-white` on a page/section wrapper | `bg-card-bg` (if card-like) or `bg-bg` (if page-like) | judgment: does it sit ON the page or IS it the page |
| `bg-brand-dark` paired with light text as a selected/emphasis surface (e.g. variant picker selected state, review widgets) | `bg-emphasis-surface` | new token from Task 2, defaults to `--brand-dark` |
| `text-black` / `text-gray-900` on shared pages | `text-fg` | token default near-black |
| `text-gray-500/600` body copy on shared pages | `text-muted` | token default grey |
| `text-white` on `bg-brand` buttons | `text-on-brand` | existing CLAUDE.md rule |
| `text-white`/slate shades inside decorative dark blocks (cta-banner overlay etc.) | leave as-is | deliberate decorative exception |

- [ ] **Step 1: Enumerate the work**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
grep -rn "bg-white" app components --include=*.tsx | grep -v "components/landing/"
grep -rn "bg-brand-dark" app components --include=*.tsx | grep -v "components/landing/"
```

- [ ] **Step 2: Apply the decision table file by file.** Highest-traffic files first (golden path): `components/layout/navbar.tsx`, `components/shop/product-card.tsx`, `app/products/page.tsx`, `app/products/[slug]/*` (incl. `variant-picker.tsx`, `reviews.tsx`), `app/cart/page.tsx`, `app/checkout/page.tsx`, then account/auth pages, then remaining shared components. Convert every occurrence outside `components/landing/`.

- [ ] **Step 3: Verify zero hardcodes remain in scope**

```powershell
grep -rn "bg-white" app components --include=*.tsx | grep -v "components/landing/"
```
Expected: no output (or only lines you can justify under the decorative exception — record any in the commit message).

- [ ] **Step 4: Prove Tri Star is pixel-identical where it's guarded**

```powershell
npx tsc --noEmit
npm run lint
npx playwright test e2e/landing-pipeline.spec.ts e2e/cart.spec.ts e2e/product-listing.spec.ts
```
Expected: all pass. Also open `http://localhost:3000/products` and a product page in the browser — visually identical to before (whites still white).

- [ ] **Step 5: Commit**

```powershell
git add -A app components
git commit -m "refactor(theme): tokenise hardcoded light-theme colours on shared shop surfaces for dark-theme clients"
```

---

### Task 4: New block — `spotlight-hero`

Generic dark hero: kicker badge, two-part headline, subtitle, dual CTA, stat chips. Token-styled; works for any client.

**Files:**
- Create: `frontend-starter/components/blocks/visual/spotlight-hero.tsx`
- Modify: `frontend-starter/lib/block-registry.ts` (import + entry)
- Modify: `frontend-starter/components/blocks/index.ts` (export)

- [ ] **Step 1: Create the component**

```tsx
interface StatChip {
  value: string
  label: string
}

interface SpotlightHeroProps {
  badge?: string
  title: string
  titleAccent?: string
  lead?: string
  subtitle?: string
  primaryCtaText?: string
  primaryCtaUrl?: string
  secondaryCtaText?: string
  secondaryCtaUrl?: string
  statChips?: StatChip[]
  anchorId?: string
}

export function SpotlightHero({
  badge, title, titleAccent, lead, subtitle,
  primaryCtaText, primaryCtaUrl = '#', secondaryCtaText, secondaryCtaUrl = '#',
  statChips = [], anchorId,
}: SpotlightHeroProps) {
  return (
    <section id={anchorId} className="relative overflow-hidden bg-dark-deep py-24 md:py-32 px-6" aria-label="Hero">
      {/* soft brand glow, token-driven */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,var(--brand-shadow),transparent_60%)]" />
      <div className="relative max-w-5xl mx-auto text-center">
        {badge && (
          <span className="inline-flex items-center gap-2 rounded-full border border-dark-border px-4 py-1.5 text-sm font-semibold text-brand-highlight mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse motion-reduce:animate-none" aria-hidden />
            {badge}
          </span>
        )}
        <h1 className="font-heading text-4xl md:text-6xl font-bold text-on-dark-strong leading-tight tracking-tight">
          {title}
          {titleAccent && <span className="block text-brand-highlight mt-2">{titleAccent}</span>}
        </h1>
        {lead && <p className="mt-6 text-xl text-on-dark max-w-2xl mx-auto">{lead}</p>}
        {subtitle && <p className="mt-4 text-base text-on-dark-muted max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {primaryCtaText && (
            <a href={primaryCtaUrl} className="rounded-lg bg-brand px-8 py-3.5 font-semibold text-on-brand hover:bg-brand-hover transition-colors">
              {primaryCtaText}
            </a>
          )}
          {secondaryCtaText && (
            <a href={secondaryCtaUrl} className="rounded-lg border border-dark-border px-8 py-3.5 font-semibold text-on-dark-strong hover:border-brand hover:text-brand-highlight transition-colors">
              {secondaryCtaText}
            </a>
          )}
        </div>
        {statChips.length > 0 && (
          <dl className="mt-14 flex flex-wrap justify-center gap-x-10 gap-y-4">
            {statChips.map((chip) => (
              <div key={chip.label} className="text-center">
                <dt className="sr-only">{chip.label}</dt>
                <dd className="font-heading text-lg font-semibold text-brand-highlight">{chip.value}</dd>
                <dd className="text-sm text-on-dark-muted">{chip.label}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}
```
(The `bg-green-500` live-dot is a status colour — an allowed hardcode.)

- [ ] **Step 2: Register.** In `lib/block-registry.ts` add `import { SpotlightHero } from '@/components/blocks/visual/spotlight-hero'` and, in the registry (before the `landing-*` group): `'spotlight-hero': { component: SpotlightHero },`. In `components/blocks/index.ts` append `export { SpotlightHero } from './visual/spotlight-hero'`.

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 4: Commit**

```powershell
git add components/blocks/visual/spotlight-hero.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): spotlight-hero — badge/dual-CTA/stat-chip dark hero"
```

---

### Task 5: New block — `pricing-tiers`

**Files:**
- Create: `frontend-starter/components/blocks/commerce/pricing-tiers.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`, `frontend-starter/components/blocks/index.ts`

- [ ] **Step 1: Create the component**

```tsx
interface PricingTier {
  name: string
  tagline?: string
  audience?: string
  pricingBasis?: string
  features?: string[]
  priceNote?: string
  highlight?: boolean
  highlightLabel?: string
  ctaText?: string
  ctaUrl?: string
}

interface PricingTiersProps {
  kicker?: string
  title: string
  subtitle?: string
  tiers: PricingTier[]
  anchorId?: string
}

export function PricingTiers({ kicker, title, subtitle, tiers, anchorId }: PricingTiersProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-bg" aria-label="Pricing tiers">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-8 md:grid-cols-3 items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border bg-card-bg p-8 ${
                tier.highlight ? 'border-brand shadow-lg' : 'border-border'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-xs font-bold text-on-brand">
                  {tier.highlightLabel ?? 'Most Popular'}
                </span>
              )}
              <h3 className="font-heading text-xl font-bold text-fg">{tier.name}</h3>
              {tier.tagline && <p className="mt-1 text-sm font-semibold text-brand">{tier.tagline}</p>}
              {tier.audience && <p className="mt-3 text-sm text-muted">{tier.audience}</p>}
              {tier.pricingBasis && <p className="mt-1 text-xs uppercase tracking-wide text-text-placeholder">{tier.pricingBasis}</p>}
              {tier.features && tier.features.length > 0 && (
                <ul className="mt-6 space-y-2.5 text-sm text-fg/90 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className="text-brand mt-0.5" aria-hidden>✦</span>
                      <span className="text-muted">{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tier.priceNote && <p className="mt-6 font-heading text-lg font-semibold text-fg">{tier.priceNote}</p>}
              {tier.ctaText && (
                <a
                  href={tier.ctaUrl ?? '#'}
                  className={`mt-6 rounded-lg px-6 py-3 text-center font-semibold transition-colors ${
                    tier.highlight
                      ? 'bg-brand text-on-brand hover:bg-brand-hover'
                      : 'border border-border text-fg hover:border-brand hover:text-brand'
                  }`}
                >
                  {tier.ctaText}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register** — import + `'pricing-tiers': { component: PricingTiers },` + barrel export (same pattern as Task 4).

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 4: Commit**

```powershell
git add components/blocks/commerce/pricing-tiers.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): pricing-tiers — service tier cards with highlight flag"
```

---

### Task 6: New block — `showcase-gallery`

**Files:**
- Create: `frontend-starter/components/blocks/content/showcase-gallery.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`, `frontend-starter/components/blocks/index.ts`

- [ ] **Step 1: Create the component**

```tsx
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
}

export function ShowcaseGallery({ kicker, title, subtitle, items, anchorId }: ShowcaseGalleryProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-surface-alt" aria-label="Showcase gallery">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <figure key={item.title} className="group relative overflow-hidden rounded-2xl border border-border bg-card-bg">
              {item.comingSoon || !item.image ? (
                <div className="aspect-[4/5] flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <span className="font-heading text-lg font-semibold text-brand">{item.title}</span>
                  {item.comingSoonText && <span className="text-sm text-muted">{item.comingSoonText}</span>}
                </div>
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
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                  <span className="block font-heading font-semibold text-white">{item.title}</span>
                  {item.tag && <span className="block text-sm text-white/70">{item.tag}</span>}
                </figcaption>
              )}
              {item.badge && (
                <span className="absolute top-3 right-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-on-brand">
                  {item.badge}
                </span>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
```
(The caption gradient/white text sits ON the image — decorative exception, same as cta-banner's overlay.)

- [ ] **Step 2: Register** — `'showcase-gallery': { component: ShowcaseGallery },` + barrel export.

- [ ] **Step 3: Type-check + commit**

```powershell
npx tsc --noEmit
git add components/blocks/content/showcase-gallery.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): showcase-gallery — portfolio cards with badges and coming-soon slots"
```

---

### Task 7: New block — `video-showcase`

**Files:**
- Create: `frontend-starter/components/blocks/content/video-showcase.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`, `frontend-starter/components/blocks/index.ts`

- [ ] **Step 1: Create the component**

```tsx
interface VideoItem {
  src: string
  caption?: string
  tag?: string
}

interface VideoShowcaseProps {
  kicker?: string
  title: string
  subtitle?: string
  videos: VideoItem[]
  anchorId?: string
}

export function VideoShowcase({ kicker, title, subtitle, videos, anchorId }: VideoShowcaseProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-bg" aria-label="Video showcase">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {videos.map((video) => (
            <figure key={video.src} className="overflow-hidden rounded-2xl border border-border bg-card-bg">
              {/* preload=metadata keeps page weight low; controls = keyboard accessible */}
              <video src={video.src} controls preload="metadata" playsInline className="w-full aspect-video object-cover bg-black" />
              {(video.caption || video.tag) && (
                <figcaption className="p-4">
                  {video.caption && <span className="block font-semibold text-fg">{video.caption}</span>}
                  {video.tag && <span className="block text-sm text-muted mt-0.5">{video.tag}</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register** — `'video-showcase': { component: VideoShowcase },` + barrel export.

- [ ] **Step 3: Type-check + commit**

```powershell
npx tsc --noEmit
git add components/blocks/content/video-showcase.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): video-showcase — native-video clip grid with captions"
```

---

### Task 8: New block — `stream-spotlight`

**Files:**
- Create: `frontend-starter/components/blocks/content/stream-spotlight.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`, `frontend-starter/components/blocks/index.ts`

- [ ] **Step 1: Create the component**

```tsx
interface StreamSpotlightProps {
  kicker?: string
  title: string
  bullets?: string[]
  channelName?: string
  channelUrl?: string
  panelTitle?: string
  panelSubtitle?: string
  ctaText?: string
  anchorId?: string
}

export function StreamSpotlight({
  kicker, title, bullets = [], channelName, channelUrl,
  panelTitle, panelSubtitle, ctaText = 'Watch live', anchorId,
}: StreamSpotlightProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-dark-deep" aria-label="Live stream">
      <div className="max-w-6xl mx-auto grid gap-12 md:grid-cols-2 items-center">
        {/* Stylised stream preview panel (link-out; no iframe — Twitch embeds
            require a registered parent domain, which breaks local dev) */}
        <a
          href={channelUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block overflow-hidden rounded-2xl border border-dark-border bg-emphasis-surface aspect-video"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--brand-shadow),transparent_70%)]" />
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-md bg-black/60 px-3 py-1 text-xs font-bold text-white">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" aria-hidden />
            LIVE
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6">
            {panelTitle && <span className="font-heading text-xl font-bold text-on-dark-strong">{panelTitle}</span>}
            {panelSubtitle && <span className="text-sm text-on-dark-muted">{panelSubtitle}</span>}
            <span className="mt-4 rounded-lg bg-brand px-6 py-2.5 font-semibold text-on-brand group-hover:bg-brand-hover transition-colors">
              {ctaText}
            </span>
          </div>
        </a>
        <div>
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand-highlight mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-on-dark-strong">{title}</h2>
          {bullets.length > 0 && (
            <ul className="mt-8 space-y-4">
              {bullets.map((b) => (
                <li key={b} className="flex gap-3 text-on-dark">
                  <span className="text-brand-highlight mt-0.5" aria-hidden>✦</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {channelName && channelUrl && (
            <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-block font-semibold text-brand-highlight hover:underline">
              {channelName} →
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
```
(`bg-red-500` LIVE dot = status colour, allowed.)

- [ ] **Step 2: Register** — `'stream-spotlight': { component: StreamSpotlight },` + barrel export.

- [ ] **Step 3: Type-check + commit**

```powershell
npx tsc --noEmit
git add components/blocks/content/stream-spotlight.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): stream-spotlight — live-channel panel with bullet pitch"
```

---

### Task 9: New block — `faq-accordion`

Native `<details>/<summary>` — keyboard accessible, zero JS, degrades gracefully.

**Files:**
- Create: `frontend-starter/components/blocks/content/faq-accordion.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`, `frontend-starter/components/blocks/index.ts`

- [ ] **Step 1: Create the component**

```tsx
interface FaqItem {
  question: string
  answer: string
}

interface FaqAccordionProps {
  kicker?: string
  title: string
  items: FaqItem[]
  anchorId?: string
}

export function FaqAccordion({ kicker, title, items, anchorId }: FaqAccordionProps) {
  return (
    <section id={anchorId} className="py-20 px-6 bg-surface-alt" aria-label="Frequently asked questions">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <details key={item.question} className="group rounded-xl border border-border bg-card-bg px-6 py-4 open:pb-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg marker:hidden [&::-webkit-details-marker]:hidden">
                {item.question}
                <span className="text-brand transition-transform motion-reduce:transition-none group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-4 text-muted leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Register** — `'faq-accordion': { component: FaqAccordion },` + barrel export.

- [ ] **Step 3: Type-check + commit**

```powershell
npx tsc --noEmit
git add components/blocks/content/faq-accordion.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): faq-accordion — native details/summary FAQ"
```

---

### Task 10: New block — `enquiry-form`

Posts to the existing `contact` plugin (`POST /api/contact`, schema `{name, email, phone?, subject?, message}`). Client component (form state), visible error state per the storefront code rules, gated by `requiredPlugin: "contact"`.

**Files:**
- Create: `frontend-starter/components/blocks/commerce/enquiry-form.tsx`
- Modify: `frontend-starter/lib/block-registry.ts`, `frontend-starter/components/blocks/index.ts`

- [ ] **Step 1: Confirm the endpoint path** (backend running from `backend\`):

```powershell
curl -s -X POST http://localhost:8000/api/contact -H "Content-Type: application/json" -d "{\"name\":\"Plan Probe\",\"email\":\"probe@example.com\",\"message\":\"endpoint check\"}"
```
Expected: `201` JSON with an `id`. If 404, check the router mount prefix in `backend/app/main.py` and adjust the fetch path below to match. If the `contact` plugin is disabled in your current `.env`, add `contact` to `ENABLED_PLUGINS` and restart the backend.

- [ ] **Step 2: Create the component**

```tsx
'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

interface SidebarLink {
  label: string
  href: string
}

interface EnquiryFormProps {
  kicker?: string
  title: string
  subtitle?: string
  sidebarHeading?: string
  sidebarBody?: string
  urgencyNote?: string
  sidebarLinks?: SidebarLink[]
  subjectLabel?: string
  subjectOptions?: string[]
  detailFields?: string[]        // extra one-line inputs folded into the message
  messageLabel?: string
  submitLabel?: string
  successMessage?: string
  footnote?: string
  anchorId?: string
}

export function EnquiryForm({
  kicker, title, subtitle, sidebarHeading, sidebarBody, urgencyNote, sidebarLinks = [],
  subjectLabel = 'Subject', subjectOptions = [], detailFields = [],
  messageLabel = 'Message', submitLabel = 'Send enquiry',
  successMessage = 'Thank you! Your enquiry has been received.', footnote, anchorId,
}: EnquiryFormProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const details = detailFields
      .map((f) => `${f}: ${String(form.get(f) ?? '').trim()}`)
      .filter((line) => !line.endsWith(': '))
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      subject: subjectOptions.length ? String(form.get('subject') ?? '') : undefined,
      message: [...details, '', String(form.get('message') ?? '').trim()].join('\n').trim(),
    }
    setStatus('sending')
    try {
      await api.post('/contact', payload)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-card-bg px-4 py-3 text-fg placeholder:text-text-placeholder focus:outline-none focus:ring-2 focus:ring-brand'

  return (
    <section id={anchorId} className="py-20 px-6 bg-bg" aria-label="Enquiry form">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-brand mb-3">{kicker}</p>}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-4 text-muted max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        <div className="grid gap-12 md:grid-cols-[2fr_3fr]">
          <aside>
            {sidebarHeading && <h3 className="font-heading text-2xl font-bold text-fg">{sidebarHeading}</h3>}
            {sidebarBody && <p className="mt-4 text-muted leading-relaxed">{sidebarBody}</p>}
            {urgencyNote && <p className="mt-4 font-semibold text-brand">{urgencyNote}</p>}
            {sidebarLinks.length > 0 && (
              <ul className="mt-8 space-y-3">
                {sidebarLinks.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-fg hover:text-brand transition-colors">
                      {l.label} →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          {status === 'sent' ? (
            <div role="status" className="rounded-2xl border border-border bg-card-bg p-10 text-center self-start">
              <p className="font-heading text-xl font-semibold text-brand">{successMessage}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">Name *</span>
                  <input name="name" required className={inputCls} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">Email *</span>
                  <input name="email" type="email" required className={inputCls} autoComplete="email" />
                </label>
              </div>
              {subjectOptions.length > 0 && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{subjectLabel} *</span>
                  <select name="subject" required defaultValue="" className={inputCls}>
                    <option value="" disabled>Choose an option</option>
                    {subjectOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              )}
              {detailFields.map((f) => (
                <label key={f} className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{f}</span>
                  <input name={f} className={inputCls} />
                </label>
              ))}
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{messageLabel} *</span>
                <textarea name="message" required rows={5} className={inputCls} />
              </label>
              {status === 'error' && (
                <p role="alert" className="text-alert font-semibold">
                  Something went wrong sending your enquiry. Please try again, or email us directly.
                </p>
              )}
              <button type="submit" disabled={status === 'sending'} className="rounded-lg bg-brand px-8 py-3.5 font-semibold text-on-brand hover:bg-brand-hover transition-colors disabled:opacity-60">
                {status === 'sending' ? 'Sending…' : submitLabel}
              </button>
              {footnote && <p className="text-sm text-muted">{footnote}</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Register with the plugin gate** — `'enquiry-form': { component: EnquiryForm, requiredPlugin: 'contact' },` + barrel export.

- [ ] **Step 4: Type-check + lint + commit**

```powershell
npx tsc --noEmit
npm run lint
git add components/blocks/commerce/enquiry-form.tsx lib/block-registry.ts components/blocks/index.ts
git commit -m "feat(blocks): enquiry-form — contact-plugin form with sidebar, gated by requiredPlugin"
```

---

### Task 11: Shared-branch verification gate

- [ ] **Step 1: Full storefront gates**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npm run build
npm run lint
npx playwright test e2e/landing-pipeline.spec.ts
```
Expected: build + lint clean; landing E2E 3/3 (Tri Star config still active on this branch — proves the shared work changed nothing visible).

- [ ] **Step 2: Add `bento-grid` font-heading polish.** In `components/blocks/content/bento-grid.tsx` add `font-heading` to the section `<h2>` and card `<h3>` class lists (no other change), then:

```powershell
npx tsc --noEmit
git add components/blocks/content/bento-grid.tsx
git commit -m "style(blocks): bento-grid headings use font-heading utility"
```

---

### Task 12: Client branch — theme tokens, fonts, assets

**Files (on `client/surkut`):**
- Modify: `frontend-starter/themes/default/globals.css` (full token replacement)
- Modify: `frontend-starter/app/layout.tsx` (fonts only)
- Create: `frontend-starter/public/images/portfolio-{drone-corp,sawtooth,goblin-warband}.jpg`
- Create: `frontend-starter/public/videos/stream-clip-{1,2}.mp4`

- [ ] **Step 1: Create the client branch and fetch the design assets**

```powershell
cd D:\Projects\20260609_Commerceforce
git checkout -b client/surkut feat/ui-pipeline-phase2
git clone --depth 1 https://github.com/asthika-asthi/Surkut $env:TEMP\surkut-src
New-Item -ItemType Directory -Force frontend-starter\public\videos
Copy-Item $env:TEMP\surkut-src\html\assets\images\RPG_Drone_Corp.jpg frontend-starter\public\images\portfolio-drone-corp.jpg
Copy-Item $env:TEMP\surkut-src\html\assets\images\SawtoothPainted.jpg frontend-starter\public\images\portfolio-sawtooth.jpg
Copy-Item $env:TEMP\surkut-src\html\assets\images\army.jpg frontend-starter\public\images\portfolio-goblin-warband.jpg
Copy-Item $env:TEMP\surkut-src\html\assets\videos\video1.mp4 frontend-starter\public\videos\stream-clip-1.mp4
Copy-Item $env:TEMP\surkut-src\html\assets\videos\video2.mp4 frontend-starter\public\videos\stream-clip-2.mp4
```
(These are the client's own assets from their repo — committed to the client branch only, per the two-lane image rule. Check sizes: `ls frontend-starter\public\videos` — if a clip exceeds ~20 MB, re-encode or leave it out and note it.)

- [ ] **Step 2: Replace the token values in `frontend-starter/themes/default/globals.css`** (keep the file structure/comments; replace the header comment and every value):

```css
/* Theme: Surkut Miniatures
   Primary: Gold (#C9A84C) on charcoal (#10131A), Headings: Cinzel, Body: Raleway

   These are the per-client DEFAULTS (superadmin-owned). At runtime the
   storefront may override any of them with admin-chosen colours stored in
   the backend branding config (theme_colors) — see lib/theme-colors.ts
   and app/layout.tsx. Empty theme_colors = these values apply unchanged. */

:root {
  /* brand family */
  --brand: #C9A84C;
  --brand-hover: #E8C97A;
  --brand-tint: rgba(201, 168, 76, 0.12);
  --brand-highlight: #E8C97A;
  --brand-shadow: rgba(201, 168, 76, 0.25);
  --on-brand: #0A0C10;

  /* dark/emphasis family — this is a dark theme: emphasis text must stay
     readable on the dark page, so --brand-dark is the light gold */
  --brand-dark: #E8C97A;
  --dark-deep: #0A0C10;
  --dark-border: rgba(201, 168, 76, 0.25);
  --on-dark-strong: #F0EAD6;
  --on-dark: #D6CDB4;
  --on-dark-muted: #B8AE98;
  --on-dark-faint: #8A8070;

  /* accent family */
  --accent: #E8C97A;
  --accent-hover: #C9A84C;

  /* neutrals */
  --brand-secondary: #2A3040;
  --alert: #EF4444;
  --bg: #10131A;
  --surface-alt: #161B26;
  --fg: #F0EAD6;
  --muted: #B8AE98;
  --text-placeholder: #8A8070;
  --border: rgba(201, 168, 76, 0.20);
  --border-subtle: rgba(201, 168, 76, 0.10);
  --card-bg: #161B26;

  /* per-client extensions */
  --emphasis-surface: #1B2130;
  --heading-family: var(--font-cinzel), serif;
}
```

- [ ] **Step 3: Swap fonts in `frontend-starter/app/layout.tsx`.** Replace the Poppins import block with:

```tsx
import { Raleway, Cinzel } from "next/font/google"

const raleway = Raleway({
  variable: "--font-poppins",   // keep this variable name — globals.css maps --font-sans to it
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const cinzel = Cinzel({
  variable: "--font-cinzel",    // consumed by --heading-family in themes/default/globals.css
  subsets: ["latin"],
  weight: ["400", "600", "700"],
})
```
and change the `<html>` className from `` `${poppins.variable} h-full` `` to `` `${raleway.variable} ${cinzel.variable} h-full` ``. No other layout change.

- [ ] **Step 4: Look and type-check** — `npx tsc --noEmit` clean; `npm run dev` + open `http://localhost:3000`: the site should now be dark/gold with the Tri Star section content (config not yet swapped — expected).

- [ ] **Step 5: Commit**

```powershell
git add frontend-starter/themes/default/globals.css frontend-starter/app/layout.tsx frontend-starter/public/images frontend-starter/public/videos
git commit -m "feat(surkut): dark gold theme tokens, Cinzel/Raleway fonts, client assets"
```

---

### Task 13: Client branch — Surkut `landing-page.config.json`

**Files:**
- Modify: `frontend-starter/landing-page.config.json` (replace `store`, `brand`, `plugins`, `sections`; keep `theme` and `homepage` keys as-is)

- [ ] **Step 1: Replace the `store`, `brand`, and `plugins` blocks:**

```json
  "store": {
    "name": "Surkut Miniatures",
    "tagline": "Commission-quality miniature painting, streamed live",
    "logo_url": "",
    "favicon_url": "",
    "contact_email": "info@surkut.co.uk"
  },
  "brand": {
    "primary": "#C9A84C",
    "primaryHover": "#E8C97A",
    "dark": "#0A0C10",
    "secondary": "#2A3040",
    "background": "#10131A",
    "text": "#F0EAD6",
    "font": "Raleway",
    "headingFont": "Cinzel"
  },
  "plugins": ["auth", "categories", "products", "cart", "orders", "checkout", "contact"],
```
(`contact_email` is a best-guess — flagged in the design source for client confirmation. Logo/favicon empty: the navbar's logo-only/blank-name handling is already supported; the wordmark is the store name.)

- [ ] **Step 2: Replace `sections[]` entirely:**

```json
  "sections": [
    {
      "__block": "spotlight-hero",
      "badge": "Commissions Open",
      "title": "Your Army, Painted Live.",
      "titleAccent": "With Your Input.",
      "lead": "Watch your miniatures come to life on stream — collaboratively.",
      "subtitle": "No more grey armies. No more wondering what's happening. Just beautiful models, painted live, with you in control.",
      "primaryCtaText": "Request a Commission",
      "primaryCtaUrl": "#commission",
      "secondaryCtaText": "View Portfolio",
      "secondaryCtaUrl": "#portfolio",
      "statChips": [
        { "value": "3", "label": "Service Tiers" },
        { "value": "Live", "label": "On Twitch" },
        { "value": "UK", "label": "Based · London" }
      ]
    },
    {
      "__block": "pricing-tiers",
      "kicker": "What I offer",
      "title": "Choose Your Commission Tier",
      "subtitle": "Every commission is quoted per model, not per hour — so you always know the cost upfront. No surprises, no hidden fees.",
      "anchorId": "services",
      "tiers": [
        {
          "name": "Tabletop Tier",
          "tagline": "Fast. Clean. Battle-Ready.",
          "audience": "Perfect for armies",
          "pricingBasis": "Quoted per model / unit",
          "features": [
            "Solid base colours throughout",
            "Basic shading and highlights",
            "Simple but clean bases",
            "Great for wargames like 40K, Age of Sigmar, Bolt Action, One Page Rules"
          ],
          "priceNote": "Starts at £10 per model",
          "ctaText": "Get a Quote",
          "ctaUrl": "#commission"
        },
        {
          "name": "Premium Tier",
          "tagline": "Highlights. Weathering. Lighting effects.",
          "audience": "For leaders and focus models",
          "pricingBasis": "Quoted per model / unit",
          "features": [
            "Everything in Tabletop, plus:",
            "Complex and detailed shading",
            "Battle damage & weathering effects",
            "More interesting bases with full detail",
            "Ideal for HQ units in wargames, or heroes and PCs in roleplaying games"
          ],
          "priceNote": "Starts at £20 per model",
          "highlight": true,
          "highlightLabel": "Most Popular",
          "ctaText": "Get a Quote",
          "ctaUrl": "#commission"
        },
        {
          "name": "Display Tier",
          "tagline": "Single heroes. Collector pieces. Stream-focused.",
          "audience": "High-ticket, high-impact",
          "pricingBasis": "Quoted per model / project",
          "features": [
            "Competition-level painting",
            "Advanced skin & texture work",
            "Custom sculpted bases",
            "Painted live on stream",
            "Ideal for display, trophies, gifts"
          ],
          "priceNote": "Ask for a quote for pricing!",
          "ctaText": "Get a Quote",
          "ctaUrl": "#commission"
        }
      ]
    },
    {
      "__block": "how-to-order",
      "title": "The Commission Process",
      "steps": [
        { "number": 1, "title": "Submit a Request", "description": "Fill in the commission form with your tier preference, model count, and any reference images or colour inspiration you have in mind." },
        { "number": 2, "title": "Discuss Your Vision", "description": "We'll discuss your project together — colours, lore, basing theme, and timeline. You'll receive a firm quote per model before anything starts." },
        { "number": 3, "title": "Confirm & Schedule", "description": "Once we're agreed, we decide on a deposit. You send the models (or I source them) and we lock in your stream painting date." },
        { "number": 4, "title": "Watch It Painted Live", "description": "Your commission is painted live on Twitch. Watch every highlight and wash happen in real time, discuss colour choices, and chat as I paint." },
        { "number": 5, "title": "Receive Your Model", "description": "Your completed miniatures are professionally photographed, carefully packaged, and shipped directly to you." }
      ]
    },
    {
      "__block": "showcase-gallery",
      "kicker": "My work",
      "title": "The Portfolio",
      "subtitle": "A selection of recent commissions. From sci-fi skirmish pieces to full fantasy armies — each one painted with care.",
      "anchorId": "portfolio",
      "items": [
        { "image": "/images/portfolio-drone-corp.jpg", "title": "RPG Drone Corp", "tag": "Sci-Fi Skirmish", "badge": "Premium Tier" },
        { "image": "/images/portfolio-sawtooth.jpg", "title": "Sawtooth", "tag": "Premium Commission", "badge": "Premium Tier" },
        { "image": "/images/portfolio-goblin-warband.jpg", "title": "Goblin Warband", "tag": "Full Army", "badge": "Tabletop Tier" },
        { "title": "Your commission here", "comingSoon": true, "comingSoonText": "Slots Available Now — All Tiers" }
      ]
    },
    {
      "__block": "video-showcase",
      "kicker": "In action",
      "title": "Watch the Process",
      "subtitle": "Real clips of commissions being painted. This is what you can watch live on Twitch when your models are on the table.",
      "videos": [
        { "src": "/videos/stream-clip-1.mp4", "caption": "Commission in Progress — Sci-Fi Skirmish", "tag": "Live stream clip · Premium Tier" },
        { "src": "/videos/stream-clip-2.mp4", "caption": "Painting Session — Army Commission", "tag": "Live stream clip · Tabletop Tier" }
      ]
    },
    {
      "__block": "stream-spotlight",
      "kicker": "Live Streaming",
      "title": "Your Model, Painted Live. On Stream.",
      "bullets": [
        "Watch your model being painted in real time on Twitch",
        "Vote on colour schemes and highlight choices during the stream",
        "Chat directly with the artist and guide the creative process"
      ],
      "channelName": "twitch.tv/surkutminiatures",
      "channelUrl": "https://twitch.tv/surkutminiatures",
      "panelTitle": "Painting Your Commission Live",
      "panelSubtitle": "surkutminiatures — Twitch",
      "ctaText": "Tune in"
    },
    {
      "__block": "bento-grid",
      "title": "Your People.",
      "cards": [
        { "title": "Warhammer / Wargamers", "body": "You buy armies worth £300–£3000 and you're tired of them sitting grey. You want a force that turns heads at tournaments.", "size": "large" },
        { "title": "D&D Dungeon Masters", "body": "You run campaigns and want your BBEG to terrify the table. Custom-painted boss monsters, NPCs, and party sets painted with love.", "size": "small" },
        { "title": "Busy Professionals", "body": "You have the nostalgia and the income. You don't have hundreds of hours to invest in learning to paint. Let me do the hard work for you.", "size": "small" },
        { "title": "Collectors & Display Buyers", "body": "You want a centrepiece. A showpiece. Art you can hold in your hands. Hand-painted miniatures, sculptures and busts as collectible artwork.", "size": "large" }
      ]
    },
    {
      "__block": "faq-accordion",
      "kicker": "Questions",
      "title": "Frequently Asked.",
      "items": [
        { "question": "How do I request a commission?", "answer": "Fill out the commission form at the bottom of this page with your project details, preferred tier, and any reference images. I'll get back to you within 48 hours with a custom quote." },
        { "question": "How much does it cost?", "answer": "Every commission is quoted per model or per project — never per hour. This means you always know the full cost before work begins. Prices vary by tier, complexity, and quantity. Submit a request and I'll send you a firm quote within 48 hours." },
        { "question": "Can I really watch my models being painted?", "answer": "Yes — that's the whole point. Your commission is scheduled for a live Twitch stream. You'll get a notification before I go live. You can watch, chat, discuss colour choices, and guide the process in real time. If you can't be there for the entire thing, that's okay — I'll still send you detailed updates to make sure you're happy." },
        { "question": "How long does a commission take?", "answer": "Timelines depend on the size of your commission and my current queue. Typically: Tabletop Tier armies — 2 weeks per unit. Premium singles/heroes — 1–2 weeks. Display pieces — 2–4 weeks. I'll give you a specific delivery estimate when we discuss your project." },
        { "question": "Do I need to send you my models?", "answer": "No! If you don't have the models already, just let me know and I'll be happy to source them for you. The price of the models will be added to the deposit — we can discuss details during the quote stage." },
        { "question": "What game systems do you paint?", "answer": "I'm happy to paint for any system, including models that aren't for anything in particular. A battle cruiser for a sci-fi game, a dragon for fantasy, a display bust — all good. If it's a miniature, I'll paint it." }
      ]
    },
    {
      "__block": "enquiry-form",
      "requiredPlugin": "contact",
      "kicker": "Get started",
      "title": "Request a Commission",
      "subtitle": "Ready to field a painted army? Fill in the form and I'll be in touch within 48 hours.",
      "anchorId": "commission",
      "sidebarHeading": "Let's Bring Your Vision to Life",
      "sidebarBody": "Every commission starts with a conversation. Tell me about your project, and I'll build a custom quote that fits your timeline and budget.",
      "urgencyNote": "Limited commission slots are available each month. Don't wait — book early to secure your spot.",
      "sidebarLinks": [
        { "label": "Twitch — surkutminiatures", "href": "https://twitch.tv/surkutminiatures" },
        { "label": "Instagram — @surkut_minis", "href": "https://instagram.com/surkut_minis" },
        { "label": "Patreon — Surkut Miniatures", "href": "https://www.patreon.com/surkutminiatures" }
      ],
      "subjectLabel": "Service Tier",
      "subjectOptions": [
        "Tabletop Tier — Fast & Clean",
        "Premium Tier — Highlights & Effects",
        "Display Tier — Collector Quality",
        "Not Sure — I Need Advice"
      ],
      "detailFields": ["Game System", "Number of Models", "Estimated Budget"],
      "messageLabel": "Project Description",
      "submitLabel": "Submit Commission Request",
      "successMessage": "Thank you! Your request has been received. I'll be in touch within 48 hours to discuss your commission.",
      "footnote": "Slots are limited. I reply within 48 hours. No payment until we agree on scope."
    }
  ]
```

- [ ] **Step 3: Validate and render**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
node -e "JSON.parse(require('fs').readFileSync('landing-page.config.json','utf8')); console.log('valid')"
```
Expected: `valid`. Then `npm run dev` and open `http://localhost:3000`: the full Surkut homepage renders in order (hero → tiers → process → portfolio → videos → stream → audience → FAQ → form). The enquiry-form section only appears after the backend's `ENABLED_PLUGINS` includes `contact` (Task 14).

- [ ] **Step 4: Commit**

```powershell
git add landing-page.config.json
git commit -m "feat(surkut): homepage assembled from block pipeline — zero page code"
```

---

### Task 14: Client branch — backend env + Surkut seed data

**Files:**
- Modify: `backend/seed.py` (`_CATEGORIES` and `_products()` only)
- Modify: `backend/.env` (local only — not committed; it is gitignored)

- [ ] **Step 1: Point local dev at a separate Surkut database** so switching branches never corrupts the Tri Star dev DB. In `backend/.env` set:

```
DATABASE_URL=sqlite+aiosqlite:///./surkut.db
ENABLED_PLUGINS=auth,categories,products,cart,orders,checkout,contact
STORE_NAME=Surkut Miniatures
STORE_TAGLINE=Commission-quality miniature painting, streamed live
CONTACT_EMAIL=info@surkut.co.uk
```
(Keep every other existing line — SECRET_KEY, SMTP, Stripe test keys — unchanged. Remember the `docs/local-dev.md` trap: start the backend from `backend\` so the relative DB path resolves there.)

- [ ] **Step 2: Replace `_CATEGORIES` in `backend/seed.py`:**

```python
_CATEGORIES = [
    {"name": "Commission Painting", "description": "Per-model painting commissions — quoted upfront, painted live on stream"},
    {"name": "Painted Miniatures",  "description": "Ready-to-ship hand-painted display pieces and squads"},
]
```

- [ ] **Step 3: Replace the body of `_products()`** (keep the signature and the `Decimal` import):

```python
def _products(cat: dict[str, str]) -> list[dict]:
    from decimal import Decimal
    return [
        dict(name="Tabletop Tier Commission (per model)", category_id=cat["Commission Painting"],
             price=Decimal("10.00"), stock_quantity=500, is_featured=True,
             description="Fast, clean, battle-ready. Solid base colours, basic shading and highlights, simple clean bases. Quoted per model — order one unit per model in your force.",
             tags="commission,tabletop,army"),
        dict(name="Premium Tier Commission (per model)", category_id=cat["Commission Painting"],
             price=Decimal("20.00"), stock_quantity=500, is_featured=True,
             description="Highlights, weathering, lighting effects. Everything in Tabletop plus complex shading, battle damage, and fully detailed bases. Ideal for HQ units and heroes.",
             tags="commission,premium,hero"),
        dict(name="Display Tier Commission (deposit)", category_id=cat["Commission Painting"],
             price=Decimal("50.00"), stock_quantity=100,
             description="Competition-level painting for single heroes and collector pieces, painted live on stream. This deposit secures your slot; the full project is quoted individually.",
             tags="commission,display,collector"),
        dict(name="Sawtooth — Painted Display Piece", category_id=cat["Painted Miniatures"],
             price=Decimal("120.00"), stock_quantity=1, is_featured=True,
             description="One-of-one premium commission showpiece: advanced texture work, custom base, professionally photographed.",
             tags="painted,display,one-off"),
        dict(name="Goblin Warband — Painted Squad (5 models)", category_id=cat["Painted Miniatures"],
             price=Decimal("60.00"), stock_quantity=3,
             description="Tabletop-tier painted goblin warband, five models with clean bases — ready for the table the day it arrives.",
             tags="painted,squad,fantasy"),
        dict(name="Sci-Fi Skirmish Drone (painted)", category_id=cat["Painted Miniatures"],
             price=Decimal("45.00"), stock_quantity=2,
             description="Premium-tier painted sci-fi drone from the RPG Drone Corp commission line.",
             tags="painted,scifi,drone"),
    ]
```

- [ ] **Step 4: Seed and gate the backend**

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe seed.py --demo
.venv\Scripts\ruff.exe check .
.venv\Scripts\mypy.exe app/
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```
Expected: seed prints the Surkut categories/products; ruff + mypy clean; API up on `:8000` with the `contact` plugin listed at `http://localhost:8000/api/health`.

- [ ] **Step 5: Commit** (seed.py only — `.env` stays local)

```powershell
git add seed.py
git commit -m "feat(surkut): seed commission tiers and painted-miniature products"
```

---

### Task 15: Client branch — Surkut E2E (landing anchors + enquiry form)

**Files:**
- Modify: `frontend-starter/e2e/landing-pipeline.spec.ts` (replace the anchor list + hero wait only)
- Create: `frontend-starter/e2e/enquiry-form.spec.ts`

- [ ] **Step 1: Re-anchor the landing spec for Surkut.** In `e2e/landing-pipeline.spec.ts` replace the `SECTION_ANCHORS` array with:

```typescript
// One stable text anchor per landing section, in on-page order (Surkut).
const SECTION_ANCHORS = [
  'Your Army, Painted Live',            // spotlight-hero
  'Choose Your Commission Tier',        // pricing-tiers
  'The Commission Process',             // how-to-order
  'The Portfolio',                      // showcase-gallery
  'Watch the Process',                  // video-showcase
  'Painted Live. On Stream',            // stream-spotlight
  'Your People',                        // bento-grid (audience)
  'Frequently Asked',                   // faq-accordion
  'Request a Commission',               // enquiry-form
]
```
and change the hero wait assertion from `toContainText('Quality protective', …)` to `toContainText('Your Army, Painted Live', …)`. In the products test, keep the check that product links exist (the Surkut homepage has no product grid, so **change that test** to visit `/products` first: `await page.goto('/products')`). Leave the config-pipeline proof test untouched. Update the file's header comment to say these anchors freeze the **Surkut** page on the `client/surkut` branch.

- [ ] **Step 2: Write `e2e/enquiry-form.spec.ts`:**

```typescript
/**
 * Surkut enquiry form: fills and submits the commission request form,
 * expecting the contact plugin (POST /api/contact) to accept it.
 * Prerequisites: backend on :8000 with ENABLED_PLUGINS including "contact".
 */
import { test, expect } from '@playwright/test'

test('commission enquiry form submits successfully', async ({ page }) => {
  await page.goto('/')
  const section = page.locator('#commission')
  await section.scrollIntoViewIfNeeded()
  await section.getByLabel(/Name \*/).fill('Playwright Tester')
  await section.getByLabel(/Email \*/).fill('playwright@example.com')
  await section.getByLabel(/Service Tier/).selectOption({ index: 1 })
  await section.getByLabel('Game System').fill('Warhammer 40,000')
  await section.getByLabel('Number of Models').fill('12')
  await section.getByLabel(/Project Description/).fill('E2E test enquiry — safe to delete.')
  await section.getByRole('button', { name: 'Submit Commission Request' }).click()
  await expect(section.getByText('Your request has been received')).toBeVisible({ timeout: 10_000 })
})
```
(If `getByLabel` misses because the label wraps the input, the `<label>` element association in `enquiry-form.tsx` already handles it — labels wrap their inputs. If a locator still fails, switch to `section.locator('input[name="name"]')` etc. — do not weaken the success assertion.)

- [ ] **Step 3: Run the client-branch E2E set** (backend from Task 14 running, `npm run dev` on `:3000`):

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npx playwright test e2e/landing-pipeline.spec.ts e2e/enquiry-form.spec.ts e2e/cart.spec.ts e2e/product-listing.spec.ts
```
Expected: all pass. The cart/product tests double as the automated golden-path check against Surkut's seeded products. Verify the submitted enquiry landed: log in to the admin panel (`:3001`, `admin@commerceforce.dev / Admin1234!`) → Enquiries.

- [ ] **Step 4: Commit**

```powershell
git add e2e/landing-pipeline.spec.ts e2e/enquiry-form.spec.ts
git commit -m "test(e2e): Surkut landing anchors + commission enquiry submission"
```

---

### Task 16: Client branch — full verification

- [ ] **Step 1: Build + lint**

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npm run build
npm run lint
```
Expected: clean.

- [ ] **Step 2: Side-by-side visual compare.** Open the design source (`$env:TEMP\surkut-src\html\index.html`) in one browser tab and `http://localhost:3000` in another. Walk section by section. Acceptance is **agreed-design match, not pixel identity** (spec Phase 2): same section order, same copy, same dark/gold feel, Cinzel headings, coherent spacing. Note any deliberate naturalisation differences (they are listed in `Surkut_design.md`).

- [ ] **Step 3: Dark-theme golden-path click-through** (this exercises Task 3's sweep — check EVERY page, not just the first): homepage → `/products` → a product detail (variant picker if shown) → add to cart → `/cart` → `/checkout` → place order (Stripe test card per `docs/Testing_stripe_locally.txt`) → order confirmation → `/account` pages → login/register forms. On each: no white slabs, readable text, gold buttons with dark button text, focus rings visible. Fix any missed hardcode **on the shared branch** (`git checkout feat/ui-pipeline-phase2`, fix, commit, `git checkout client/surkut`, `git merge feat/ui-pipeline-phase2`).

- [ ] **Step 4: Plugin-gating spot-check.** Remove `contact` from `ENABLED_PLUGINS` in `backend/.env`, restart backend, reload homepage: the commission form section disappears cleanly (no gap/error). Restore it and restart.

- [ ] **Step 5: Commit anything amended, with a final status line in the commit body listing what was verified.**

---

### Task 17: Procedure doc + backlog (shared branch)

The pilot proved the steps; now write them down (spec Phase 2 step 5).

**Files (on `feat/ui-pipeline-phase2`):**
- Create: `docs/add-a-client-ui.md`
- Modify: `docs/new-client-setup.md` (Section 8 pointer)
- Modify: `docs/backlog.md`

- [ ] **Step 1: Switch branches** — `git checkout feat/ui-pipeline-phase2`

- [ ] **Step 2: Write `docs/add-a-client-ui.md`:**

```markdown
# Add a Client — UI Build Procedure

The short, repeatable procedure for giving a new client their look. Proven on
the Surkut pilot (branch `client/surkut`, 2026-07). Deployment/server steps
live in `docs/new-client-setup.md`; this doc covers only the visual build.

## The rule
A client's look is exactly two things: **theme token values** + **a config
file listing blocks**. Never hand-edit page code. New visuals become new
registered blocks in the shared library — every client enriches it.

## Steps

1. **Capture the design** → write `docs/design-sources/<Client>_design.md`:
   palette table, fonts, section list, and the block mapping (reuse / NEW).
   Inputs can be a finished page (slice it — see the page-intake procedure in
   the spec), reference sites, or a styles.refero.design file.
2. **Branch:** shared block work on a `feat/*` branch off master (merges
   back); the client overlay on `client/<name>` off that branch (never merges).
3. **Tokens:** on the client branch, set every value in
   `frontend-starter/themes/default/globals.css`. Dark themes: `--bg` dark,
   `--brand-dark` must stay readable as TEXT on the page background; use
   `--emphasis-surface` for dark panel surfaces. Optional
   `--heading-family` for a heading font.
4. **Fonts:** swap the `next/font/google` imports in `app/layout.tsx`; keep
   the `--font-poppins` variable name for the body font; add `--font-cinzel`-style
   second variable only if the theme file references it.
5. **Blocks:** build any NEW blocks on the shared branch — registered in
   `lib/block-registry.ts`, token-styled (no raw hex), data-driven props,
   naturalised (shared spacing/radius/motion, `font-heading` on headings),
   gracefully degrading. Then merge the shared branch into the client branch.
6. **Config:** author `landing-page.config.json` — `store`, `brand`,
   `plugins`, and the full `sections[]`. Images to `public/images/` (client
   branch), videos to `public/videos/`.
7. **Seed + env:** client products in `backend/seed.py`; local `.env` gets a
   per-client `DATABASE_URL` (e.g. `sqlite+aiosqlite:///./<client>.db`),
   matching `ENABLED_PLUGINS`, and `STORE_NAME`/`STORE_TAGLINE`/`CONTACT_EMAIL`.
8. **E2E:** re-anchor `e2e/landing-pipeline.spec.ts` to the client's section
   text (client branch); run it plus cart + product-listing (golden path),
   plus any client-specific specs (e.g. `enquiry-form.spec.ts`).
9. **Verify:** side-by-side vs the agreed design; full golden-path
   click-through on every page (especially for dark themes).

## Cost model
Each new client should be faster than the last: steps 3, 4, 6, 7, 8 are
config-only; step 5 shrinks as the library grows.
```

- [ ] **Step 3: Point `docs/new-client-setup.md` Section 8 (Landing page setup) at the new doc.** At the top of that section add:

```markdown
> The homepage is built with the block pipeline — follow
> `docs/add-a-client-ui.md` (tokens + config, never page edits). The steps
> below cover only the admin-panel content parts.
```

- [ ] **Step 4: Update `docs/backlog.md`.** Add under the latest dated section:

```markdown
### Per-client UI pipeline — Phase 2 pilot: Surkut (2026-07-18)

**Branches:** shared `feat/ui-pipeline-phase2` (off master, mergeable),
client `client/surkut` (off shared branch, NEVER merged — it is the client
deployment). Phase 1 was merged to master 2026-07-18 (local, not pushed).
Spec: `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`.

**Built + tested (automated):**
- 7 new library blocks (spotlight-hero, pricing-tiers, showcase-gallery,
  video-showcase, stream-spotlight, faq-accordion, enquiry-form) — all
  token-styled, registered, reusable by any client. enquiry-form posts to
  the existing contact plugin and is plugin-gated.
- Heading-font (`--heading-family` → `font-heading`) and
  `--emphasis-surface` theme extensions; dark-theme readiness sweep
  (hardcoded whites → tokens) across shared shop pages.
- Surkut homepage: dark gold theme, Cinzel/Raleway, 9 config sections,
  zero hand-edited page code. E2E: Surkut section anchors, pipeline proof,
  enquiry submission, cart + product listing on Surkut seed data.
- `docs/add-a-client-ui.md` — the repeatable procedure (spec Phase 2 step 5).

**Built, NOT tested — needs the big manual session:**
- Visual pass of BOTH clients: Tri Star (master/shared branch — must be
  unchanged after the token sweep) and Surkut (client/surkut — matches the
  design source repo side by side).
- Full golden path in the browser on client/surkut incl. Stripe test payment.
- Contact enquiry visible in admin → Enquiries.

**Pending client input (Surkut):** confirm contact email, Instagram/Patreon
URLs, real logo/favicon if wanted, Display-tier deposit pricing.

**Next:** Phase 3 component library session (backlog item Q) — includes
splitting any coarse blocks and reconciling the divergent block twins.
```

- [ ] **Step 5: Commit**

```powershell
git add docs/add-a-client-ui.md docs/new-client-setup.md docs/backlog.md
git commit -m "docs: add-a-client UI procedure + Phase 2 pilot backlog entry"
```

---

## Final verification (whole plan)

1. On `feat/ui-pipeline-phase2`: `npm run build`, `npm run lint`, `npx playwright test e2e/landing-pipeline.spec.ts` — Tri Star anchors pass (shared work is invisible to Tri Star).
2. On `client/surkut`: `npm run build` clean; `npx playwright test e2e/landing-pipeline.spec.ts e2e/enquiry-form.spec.ts e2e/cart.spec.ts e2e/product-listing.spec.ts` — all pass against the Surkut seed DB.
3. `git log --oneline master..feat/ui-pipeline-phase2` shows only shared/library/docs commits; `git log --oneline feat/ui-pipeline-phase2..client/surkut` shows only Surkut-specific commits (tokens, layout fonts, assets, config, seed, e2e anchors).
4. Browser: Surkut homepage matches the design source side by side; every golden-path page is dark-theme coherent; disabling the contact plugin removes the form section.
5. **Do NOT merge anything.** `feat/ui-pipeline-phase2` waits for the user's test session; `client/surkut` is never merged. Nothing is pushed to origin until the user says so (master's Phase 1 merge is still local-only).

## Explicitly out of scope (do not do)

- No changes to `components/landing/*` (Tri Star block internals) beyond what Phase 1 left.
- No reconciliation of the divergent block twins (`trust-strip` vs `landing-trust-strip`, …) — Phase 3.
- No admin "Page Content" editor / config-vs-DB layering work (backlog item W's deferred half).
- No Twitch iframe embed, no real Stripe live keys, no production deployment, no pushing to origin.
- No scheduling-plugin integration for Surkut (appointment booking is a separate backlog item; the enquiry form is the Phase 2 scope).
