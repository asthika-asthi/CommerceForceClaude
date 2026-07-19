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
  client verticals. New content-blocks are added only where the interaction
  capabilities below require them.
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
just decided to leave alone elsewhere. Instead:

- A new shared component, `frontend-starter/components/ui/pinch-zoom-image.tsx`,
  implements real two-finger pinch-to-zoom and drag-to-pan using the
  browser's native Pointer Events API — no new dependency, consistent with
  every prior phase's "no new dependencies" discipline. Desktop gets
  scroll-to-zoom + drag as the pointer-equivalent interaction, not a dead end.
- `showcase-gallery` gains an opt-in `zoomable?: boolean` prop (block-level,
  applies to every item). When set, tapping/clicking an item opens it through
  `PinchZoomImage` in a full-screen overlay; pinch/scroll zooms, drag pans,
  tap-outside or a close control dismisses. When unset, `showcase-gallery`'s
  behaviour is byte-for-byte what it is today.
- Zoom bounds are clamped (can't pan past the image edge, can't zoom out
  below 1x or past a fixed maximum) so the gesture always feels controlled.
- Degrades gracefully: no pinch support (e.g. keyboard-only) still gets a
  working tap-to-open/close overlay; `prefers-reduced-motion` disables the
  zoom-transition animation but not the zoom function itself.

### 3.3 `scroll-story` — new block, pinned & chaptered

A genuinely new registry block. One media element (image or video) stays
pinned in the viewport and transforms — scale, crop, colour treatment — through
several author-defined "chapters" as the visitor scrolls past the section,
each chapter carrying its own short caption. This is the multi-chapter
evolution of the existing single-stage `scroll-expand-hero` (which stays
unchanged — `scroll-story` is additive, not a replacement).

Config shape (illustrative, exact prop names finalised in the implementation
plan): a list of chapters, each with a caption and the visual treatment for
that stage (crop/scale/tint), plus the shared media source. Built with
framer-motion's scroll utilities, same as `scroll-expand-hero` and
`cta-banner` already do — no new dependency.

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
`scroll-story` gets a full new entry (and a new specimen in the gallery), and
`ScrollReveal` gets a short mention wherever it's used. `docs/backlog.md`
gets a Phase 3 entry in the same Built/Tested-vs-not convention every prior
phase used.

### 3.6 Sourcing process — documented, not executed this round

A new short section is added alongside `docs/add-a-client-ui.md` (or as its
own short doc, decided during the plan) describing the repeatable move for
growing the library ahead of demand: capture a design-system reference
(styles.refero.design or any external source) → slice it into sections →
match each against the existing registry → for anything with no match,
decide enhance-existing vs. build-new (per the precedent set in §3.2 above)
→ naturalise to the shared token/spacing/motion language → document the
result the same way this spec documents §3.1–3.4. This makes "ad-hoc" no
longer true without requiring an actual external source to be pulled in this
session.

## 4. Explicitly out of scope

- Any of the 7 known overlapping block pairs, or Tri Star's live config.
- New content-blocks beyond `scroll-story` (no speculative catalogue).
- Pulling in a real external design-system reference.
- Any change to `components/landing/*` (Tri Star's frozen originals).

## 5. Verification approach

- `npx tsc --noEmit`, `npm run lint` (zero new errors — matches the
  post-lint-fix green baseline), `npm run build`, on every task, same as
  Phase 1/2.
- Restyled placeholders and the `ScrollReveal`/`scroll-story` chapter
  transitions are checkable by Playwright the same way Phase 2's blocks were
  (element presence, class/attribute state, scroll-triggered visibility).
- **Pinch/pan gesture behaviour cannot be meaningfully asserted by
  Playwright** (no real multi-touch simulation available). Verified instead
  by a documented manual test pass: Chrome DevTools mobile emulation
  (touch-emulation pinch via simulated multi-pointer events) plus a real
  phone if available, checked against the zoom-bounds clamping behaviour
  described in §3.2. This is recorded as "Built, NOT automatically tested"
  in the backlog, same convention as every other manual-verification item in
  this project.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hand-rolled pinch/pan gesture math is fiddly and easy to get subtly wrong (jumpy zoom, pan past bounds) | Clamp zoom range and pan bounds explicitly (§3.2); manual test pass before considering it done; if it proves too unreliable, the fallback is a simpler tap-to-zoom-only lightbox (discussed and consciously not chosen — recorded here so a future session doesn't have to re-litigate it) |
| `ScrollReveal` applied too broadly makes the library feel busy instead of tasteful | Applied to exactly 3 named blocks (§3.4), not library-wide; any future addition to that list is a deliberate call, not automatic |
| `scroll-story` duplicates `scroll-expand-hero` conceptually | `scroll-expand-hero` stays exactly as-is; `scroll-story` is additive for the multi-chapter case specifically, documented in `docs/component-library.md` alongside it so a future session doesn't need to re-derive which one is which |
| Documenting a sourcing process without ever running it risks the doc going stale/untested | The first real client-driven Phase 4-equivalent session becomes the process's first real test; if it doesn't hold up, that session corrects the doc — same pattern as `docs/add-a-client-ui.md` being written from the Surkut pilot's actual experience |
