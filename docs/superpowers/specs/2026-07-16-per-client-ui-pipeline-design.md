# Per-Client Storefront UI Pipeline — Design Spec

**Date:** 2026-07-16
**Status:** Awaiting user approval
**Supersedes:** the "Phase 2 landing-page wiring" note (backlog item W, engineering half) and overlaps backlog item Q (component library).

---

## 1. The problem

CommerceForce is an agency platform: one shared engine (products, cart, checkout,
accounts, admin, plugins) with a visually distinct storefront per client. Every
attempt so far at giving a client a distinct look (Tri Star live today, Tarpaulins
To Go prepared, Surkut built externally) has meant hand-editing the storefront's
hardcoded homepage components — slow, error-prone, and thrown away when the next
client arrives. That is the root cause of the repeat cycles and recurring bugs.

The frustrating part: **a better system was already built and then abandoned.**
The repo contains ~30 reusable, self-contained page sections ("blocks" — including
a working scroll-driven hero), a renderer that can assemble any page from a list
of blocks, a block registry, a backend sections API, and an admin screen. None of
it is connected to the live homepage. Git history shows it was wired once, hit a
bug, and the homepage was rebuilt by hand instead — which is why every client
since has been a hand-edit job.

## 2. Market validation (why this architecture, not another experiment)

This is the same architecture the market leaders use:

| Platform | Their version of it |
|---|---|
| Shopify | Themes are "sections" (reusable components) + JSON templates (per-store config listing which sections appear, in what order, with what settings) |
| WooCommerce / WordPress | Block themes: reusable blocks + per-site templates |
| Duda (agency white-label specialist) | Shared widget library + per-client site configuration, built by the agency |
| Wix Studio / Webflow (agency plans) | Reusable components + per-client instances |

CommerceForce's difference from all of them: **only the agency builds sites, never
the end client.** That removes the hardest part of their products (the customer
drag-and-drop editor) and keeps only the part we need: a block library plus a
per-client config file that the agency edits. We are adopting the proven model
and skipping its most expensive component.

## 3. Goal and non-goals

**Goal:** every client's distinct look is expressed as (a) their colours/fonts via
the admin theme system already in master, plus (b) a small per-client config file
listing which blocks make up their pages — never as bespoke hand-edited page code.
Each new client should be faster to build than the last, because the block library
only ever grows.

**Non-goals (deliberately out of scope):**
- No end-client page editor. Clients never edit structure; that is the agency's job.
- No decision yet on whether admin-editable DB content layers on top of the config
  file (the "3-layer" question, backlog item W's remaining half). Deferred to its
  own short session after Phase 1 proves the pipeline. Nothing in Phase 1 blocks
  either answer.
- No visual redesign of existing clients in Phase 1. The live Tri Star site must
  look pixel-identical when Phase 1 lands.

## 4. The design

### Two layers with a hard boundary

1. **Platform shell — never touched per client:** product listing/detail, cart,
   checkout, account pages, plugin-gated navigation, backend, admin. Already shared,
   already works. Plugin-driven menu items are already decoupled and survive any
   redesign untouched.
2. **Visual layer — fully swappable per client, always assembled from the block
   library:** homepage/landing sections, hero, colours, fonts. One rendering path
   (the existing renderer + block registry) assembles the page from the client's
   config. No client ever gets a hand-written page again.

### How an externally-designed client (the Surkut/Claude-Desktop workflow) fits

When a design is produced outside this repo, the deliverable brought back is
**new blocks + a config file** — never a finished hardcoded page. The design gets
decomposed: sections that match existing blocks reuse them; genuinely new visuals
become new blocks added to the library (styled with the named colour tokens so
they re-skin automatically per client). Every client's custom design permanently
enriches the shared library.

### How a "just an idea of the look" client fits (the next pilot)

Phase 2 begins with a short **design-capture step**: reference sites/screenshots
the user likes → agreed colour palette + font (entered through the existing admin
theme system) → agreed section list (chosen from the block library, with gaps
identified). Then the config file is written and any missing blocks are built.
No design document is required up front — the capture step produces it.

## 5. Phases

### Phase 1 — Finish the wiring (one-time, benefits every future client)

1. Connect the homepage to the block pipeline: the page renders from the client's
   config section list through the existing renderer/registry, instead of importing
   eleven hardcoded components.
2. Recreate the current Tri Star homepage through that pipeline so the live site
   is **pixel-identical** on day one — proof with zero visual risk. Any of the old
   hardcoded sections that don't yet exist as blocks get converted into blocks
   (they become library assets, not waste).
3. Consolidate the five landing-page config file variants in `frontend-starter/`
   into one active file; archive the rest in a clearly-named folder (the Tarpaulins
   To Go variant is a future asset, not junk).
4. Clean the untracked clutter so git status stops crying wolf: ignore the local
   dev database, resolve the stray root `themes/` file (it duplicates, with drift,
   the real one inside the storefront), remove the leftover agent worktree if its
   work is confirmed merged.
5. Retire the old "find/replace + hand-edit the page" client procedure from the
   storefront's instructions file, replacing it with the block/config procedure,
   so no future session (human or AI) falls back to hand-editing.

**Phase 1 acceptance:** live homepage renders via the block pipeline and is
visually identical to before; plugin-gated menu items unchanged; storefront build
and lint pass; git status clean.

### Phase 2 — Pilot on the next real client (design from an idea of the look)

1. Design-capture session: references → palette/font → section list (as in §4).
2. Enter colours/fonts via the admin theme system; write the client's config file.
3. Build any blocks the design needs that don't exist yet (each one added to the
   shared library, token-styled).
4. Verify: the client's homepage matches the agreed design purely through config +
   theme settings — zero hand-edited page code.
5. Write down the resulting steps as the new short "add a client" procedure.

**Phase 2 acceptance:** a second, visually distinct client homepage exists with no
bespoke page code; the golden path (browse → cart → checkout → order) passes on
that client's build; the procedure document exists.

### Phase 3 — Component library session (backlog item Q)

After the pipeline is proven: a dedicated design session to curate and expand the
block library deliberately — informed by the gaps Phase 2 exposed, the existing
unused blocks (bento grid, marquee ticker, parallax banner, glassmorphism hero,
tubelight navbar), and the kinds of looks target clients will ask for.

## 6. Verification approach

- Phase 1: side-by-side visual comparison of the homepage before/after (must be
  identical); confirm the render path is the block renderer, not the old hardcoded
  components; storefront build + lint pass; plugin menu behaviour unchanged.
- Phase 2: visual compare against the agreed design; full golden-path click-through.
- All new blocks must use named colour tokens (no raw colour values), verified in
  review, so the admin colour system keeps working for every client.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The block pipeline hits the same bug that caused the original abandonment | Phase 1 step 2 rebuilds the *current* live page through it first — any pipeline bug surfaces against a known-good reference with zero design ambiguity |
| Pixel-identical rebuild is hard for a few complex sections | Old hardcoded components can be wrapped as blocks one-for-one initially; decomposition into finer blocks can come later |
| Config file sprawl returns (five variants again) | One active config per client branch + an explicit archive folder + the documented procedure |
| Future sessions fall back to hand-editing | The old procedure is deleted from the instructions file, not just deprecated |
