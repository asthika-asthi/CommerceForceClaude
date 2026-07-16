# Config archive

Historical landing-page config variants. **Nothing here is read by any build.**
The single active config is `frontend-starter/landing-page.config.json`.

- `tristar/landing-page.config.mockup-sections.json` — snapshot of the active
  config before 2026-07-16, when its `sections[]` was a mockup-derived plan
  (static fake products) that no code ever rendered. Kept for the section
  prop-shapes it documents (scroll-expand-hero, dual-cta-banner, …).
- `tristar/landing-page.config_3.json` — an earlier Tri Star experiment.
  (Two further variants, `_1` and `_2`, turned out to be identical,
  already-corrupted duplicates — invalid JSON predating the 2026-07-16
  archive work — and were dropped; they were never git-tracked, so no
  valid version exists to recover.)
- `tarpaulins-to-go/landing-page.config.json` — the prepared Tarpaulins To Go
  config (sage green, Poppins, scroll-expand-hero first). Candidate input for
  a future client pilot. Pairs with `tarpaulins-to-go/globals.css` (token file)
  and `docs/design-sources/Design_Competitor.md`.
