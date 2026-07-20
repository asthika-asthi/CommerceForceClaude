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
