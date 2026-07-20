# Phase 3 — Component Library Session — Design Spec

**Date:** 2026-07-19
**Status:** Approved
**Implements:** Phase 3 of `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`
("a dedicated design session to curate and expand the block library
deliberately"), and backlog item Q.

---

## 1. The problem

Phase 1 wired the homepage to the block pipeline; Phase 2 proved it on a real
second client (Surkut). Both were driven by an immediate need. Phase 3 is the
session the original spec called for once the pipeline was proven: harden
what's there and grow the library *ahead* of demand, so the next client is
faster than Surkut was, not just as fast.

Three concrete gaps exist today:

1. Three registry blocks (`navbar`, `footer`, `menu`) are explicitly marked
   "placeholder" in their own source comments — never styled to the library's
   token standard.
2. The library has no answer yet for the interaction capabilities the
   original spec flagged artistic/premium clients will ask for: pinch-to-zoom
   imagery, scroll-driven storytelling, and animated scroll reveals.
3. Growing the library is "currently ad-hoc" (per the backlog's own note) —
   there's no written, repeatable process for how a new block gets sourced,
   evaluated against the existing registry, and added.

The 7 known overlapping block pairs documented in
`docs/component-library.md` ("known overlaps") are explicitly **not** part of
this session — see §6.

## 2. Goal and non-goals

**Goal:** every block in the registry meets the same production-token
standard; the library has a real, demonstrated answer for the three
spec-named interaction capabilities; growing it further is a documented,
repeatable move instead of an ad-hoc one.

**Non-goals:**
- Reconciling any of the 7 overlapping `landing-*`/generic pairs, or touching
  Tri Star's live `landing-page.config.json` in any way. Deferred indefinitely
  — not scheduled for a specific future phase.
- Building a broad, speculative catalogue of new blocks for hypothetical
  client verticals — in fact, no new registry blocks are added at all this
  round (see §4).
- Actually sourcing and adapting a real styles.refero.design design-system
  file. This session documents the *process* for doing that in a future
  client-driven session; it does not execute one.

## 3. Design

### 3.1 Placeholder blocks → production standard

`frontend-starter/components/blocks/layout/{navbar-block,footer-block,menu-block}.tsx`
currently hardcode slate/grey colours and say "Placeholder — replace with your
final TSX" in their own comments. Restyle all three to the same token
vocabulary as every other block (`--brand`, `--brand-dark`, `--card-bg`,
`--border`, `--fg`, `--muted`, per `frontend-starter/CLAUDE.md`'s token table),
remove the placeholder comments, keep every existing prop and structure
unchanged — this is a re-skin, not a redesign. `menu`'s low-contrast grey text
on dark themes (flagged in `docs/component-library.md`) is fixed as part of
this pass.

### 3.2 Zoomable imagery (pinch-to-zoom + pan)

**Decision: enhance an existing block, don't add a new one.** A new
"zoomable gallery" block would be an eighth near-duplicate of
`showcase-gallery`/`image-mosaic` — exactly the overlap problem this project
just decided to leave alone elsewhere.

**Built in two layers, so the feature is never "broken," only more or less
capable — this is the direct answer to the gesture-reliability risk:**

**Layer 1 — tap-to-zoom lightbox (the foundation, ships first, fully
automatable).** `showcase-gallery` gains an opt-in `zoomable?: boolean` prop
(block-level, applies to every item). When set, tapping/clicking an item
opens it full-screen at a fixed larger size; a close control or the
`Escape` key dismisses it. This alone is a complete, shippable feature — it
works identically on desktop and mobile, needs no gesture code, and every
part of it (open, close via click, close via keyboard) is asserted by
Playwright. When `zoomable` is unset, `showcase-gallery`'s behaviour is
byte-for-byte what it is today.

**Layer 2 — real pinch/pan, a progressive enhancement on top of Layer 1.**
A new shared component, `frontend-starter/components/ui/pinch-zoom-image.tsx`,
adds real two-finger pinch-to-zoom and drag-to-pan inside the Layer-1
overlay, using the browser's native Pointer Events API — no new dependency.
Desktop gets scroll-wheel-to-zoom + drag as the pointer-equivalent
interaction (and scroll-wheel *is* something Playwright can dispatch and
assert, unlike a real pinch). Zoom is clamped between 1x and a fixed
maximum; pan is clamped so the image edge can never be dragged past the
viewport edge.

**If Layer 2 proves unreliable during the manual pass, Layer 1 ships alone**
and Layer 2 becomes a follow-up — the feature is never in a half-working
state, because Layer 1 has no dependency on Layer 2 succeeding.

**Concrete manual pass/fail checklist** (recorded in the implementation plan
and run during the big test session, not just "test it feels ok"):
- Pinching in stops at the maximum zoom (image doesn't keep growing past it).
- Pinching out returns cleanly to 1x and re-arms tap-outside-to-close.
- Dragging while zoomed never reveals empty space beyond the image's edge.
- Releasing mid-gesture never leaves the image in a stuck or distorted
  transform (no lingering partial-zoom or off-centre state).
- Chrome DevTools' touch-emulation device mode reproduces all of the above
  before it's considered done; a real phone is a bonus check, not required.

### 3.3 Chaptered scroll storytelling — extend `scroll-expand-hero`, not a new block

**Decision: no new registry block.** A separate `scroll-story` block would be
exactly the "which one do I pick" problem this project just decided to stop
creating for itself elsewhere — two hero blocks with an overlapping,
easy-to-confuse purpose, five minutes after writing down that overlapping
blocks are a problem. Instead, `scroll-expand-hero` itself gains an optional
`chapters` prop:

- **Omitted (default):** `scroll-expand-hero` behaves exactly as it does
  today — single media element, expands 60%→100% width on scroll, one title,
  one subtitle. Zero behaviour change for every existing config that uses it,
  including Tri Star's.
- **Provided:** the same scroll-driven expand motion becomes the base
  animation, and the title/subtitle swap through the given list of chapters
  (each with its own caption and visual treatment — scale/crop/tint) as the
  visitor scrolls through the section, instead of showing one static
  title/subtitle throughout.

There is only one component and one implementation to maintain — the
single-chapter case is the general chapter logic with a list of length one,
not a separate code path bolted alongside it. Built with framer-motion's
scroll utilities, same as the component already uses today — no new
dependency. This is checkable by Playwright the normal way (scroll the page
programmatically, assert the caption text changes at the expected scroll
positions).

### 3.4 `ScrollReveal` — shared mechanism, applied selectively

A reusable wrapper component, `frontend-starter/components/ui/scroll-reveal.tsx`,
using `IntersectionObserver` to fade/slide an element in the first time it
scrolls into view — the same mechanism `animated-counter` already uses for
its count-up trigger, generalised into a standalone wrapper any block can
use. This satisfies the spec's "animated reveals" item directly; it is a
behaviour, not content, so it is **not** its own registry `__block` key.

Applied as an opt-in enhancement to three existing blocks where staggered
reveal reads well: `bento-grid` (each card), `showcase-gallery` (each item,
independent of the zoomable enhancement above — the two compose), and
`split-image-text` (the image and text panels reveal in sequence). Not
applied blanket-wide across all 48 blocks — motion is a deliberate accent,
not a library-wide default, per the project's existing restraint (only
`cta-banner`, `animated-counter`, and a few visual heroes currently animate on
scroll at all). Respects `prefers-reduced-motion` by rendering content
immediately visible, no animation, when set.

### 3.5 Keep the reference docs in sync

`docs/component-library.md` and its visual companion
`docs/component-library-gallery.html` are the record of what's in the
registry — every change in §3.1–3.4 updates both, in the same commit as the
code change, not as an afterthought pass at the end: the 3 restyled
placeholders get their theme-readiness glyph corrected (no longer
"placeholder"), `showcase-gallery`'s entry documents the new `zoomable` prop,
`scroll-expand-hero`'s entry documents the new `chapters` prop (and its
gallery specimen gets a second state showing the chaptered mode), and
`ScrollReveal` gets a short mention wherever it's used. `docs/backlog.md`
gets a Phase 3 entry in the same Built/Tested-vs-not convention every prior
phase used.

### 3.6 Sourcing process — documented, not executed this round

A new short section is added alongside `docs/add-a-client-ui.md` (or as its
own short doc, decided during the plan) describing the repeatable move for
growing the library ahead of demand: capture a design-system reference
(styles.refero.design or any external source) → slice it into sections →
match each against the existing registry → for anything with no match,
decide enhance-existing vs. build-new (per the precedent set twice over in
§3.2 and §3.3 above — prefer enhancing what exists)
→ naturalise to the shared token/spacing/motion language → document the
result the same way this spec documents §3.1–3.4. This makes "ad-hoc" no
longer true without requiring an actual external source to be pulled in this
session.

## 4. Explicitly out of scope

- Any of the 7 known overlapping block pairs, or Tri Star's live config.
- New registry blocks of any kind — every capability in this session either
  enhances an existing block (`showcase-gallery`, `scroll-expand-hero`) or is
  a shared, non-block mechanism (`ScrollReveal`). No speculative catalogue.
- Pulling in a real external design-system reference.
- Any change to `components/landing/*` (Tri Star's frozen originals).

## 5. Verification approach

The manual-only surface is deliberately narrowed to one specific thing —
everything else in this session is automated:

- `npx tsc --noEmit`, `npm run lint` (zero new errors — matches the
  post-lint-fix green baseline), `npm run build`, on every task, same as
  Phase 1/2.
- **Automated (Playwright), same as Phase 1/2's blocks:** the 3 restyled
  placeholders (render + token classes present); `scroll-expand-hero`'s
  chapter captions changing at the expected scroll positions, including the
  unchanged single-chapter default; `ScrollReveal`-driven elements becoming
  visible once scrolled into view; the Layer-1 zoom lightbox opening on
  tap/click, closing on `Escape` and on outside-click, and desktop
  scroll-wheel-zoom (Playwright can dispatch wheel events).
- **Manual-only:** real two-finger pinch and drag-to-pan (Layer 2 of §3.2)
  — no real multi-touch simulation exists in Playwright. Verified against
  the concrete pass/fail checklist in §3.2 via Chrome DevTools touch
  emulation, a real phone as a bonus check. Recorded as "Built, NOT
  automatically tested" in the backlog, same convention as every other
  manual-verification item in this project — but now that convention covers
  one narrow gesture, not the whole feature.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hand-rolled pinch/pan gesture math is fiddly and easy to get subtly wrong (jumpy zoom, pan past bounds), and it's the one piece Playwright can't verify | Built as Layer 2 on top of a fully-automated, independently-shippable Layer 1 (§3.2) — if the gesture proves unreliable in the manual pass, ship Layer 1 alone and follow up later; the feature is never in a half-working state. Concrete pass/fail checklist (§3.2) replaces "test it feels ok" with specific, repeatable checks. |
| `ScrollReveal` applied too broadly makes the library feel busy instead of tasteful | Applied to exactly 3 named blocks (§3.4), not library-wide; any future addition to that list is a deliberate call, not automatic |
| A second scroll-driven hero block repeats the "which one do I pick" overlap problem this session is otherwise avoiding | Resolved by design, not documentation: there is no second block. Chaptering is an optional prop on `scroll-expand-hero` itself (§3.3) — structurally impossible to confuse two blocks when there's only one. |
| Extending `scroll-expand-hero`'s prop surface makes one component do two jobs | The single-chapter (today's) behaviour is implemented as the general chapter logic given a list of length one, not a separate code path bolted alongside it — one implementation, verified by the same E2E either way (§5) |
| Documenting a sourcing process without ever running it risks the doc going stale/untested | The first real client-driven Phase 4-equivalent session becomes the process's first real test; if it doesn't hold up, that session corrects the doc — same pattern as `docs/add-a-client-ui.md` being written from the Surkut pilot's actual experience |
