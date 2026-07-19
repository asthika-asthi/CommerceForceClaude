# Add a Client — UI Build Procedure

The short, repeatable procedure for giving a new client their look. Proven on
the Surkut pilot (branch `client/surkut`, 2026-07). Deployment/server steps live
in `docs/new-client-setup.md`; this doc covers only the visual build.

## The rule

A client's look is exactly two things: **theme token values** + **a config file
listing blocks**. Never hand-edit page code. New visuals become new registered
blocks in the shared library — every client enriches it.

## Steps

1. **Capture the design** → write `docs/design-sources/<Client>_design.md`:
   palette table, fonts, section list, and the block mapping (reuse / NEW).
   Inputs can be a finished page (slice it — see the page-intake procedure in
   `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`),
   reference sites, or a styles.refero.design file.

2. **Branch:** shared block work on a `feat/*` branch off master (merges back);
   the client overlay on `client/<name>` off that branch (**never** merges to
   master — it is the client's living deployment branch).

3. **Tokens** (client branch) — set every value in
   `frontend-starter/themes/default/globals.css`. Dark themes: `--bg` dark, and
   `--brand-dark` must stay readable **as text** on the page background (for
   Surkut it's the light gold, not the near-black); use `--emphasis-surface`
   for dark selected/panel surfaces, and `--heading-family` for a heading font.

4. **Fonts** (client branch) — swap the `next/font/google` imports in
   `app/layout.tsx`. Keep the body font's variable named `--font-poppins`
   (globals.css maps `--font-sans` to it). Add a second variable (e.g.
   `--font-cinzel`) only if the theme file's `--heading-family` references it,
   and add its class to the `<html>` className alongside the body font's.

5. **Blocks** (shared branch) — build any NEW blocks: registered in
   `lib/block-registry.ts`, exported from `components/blocks/index.ts`,
   token-styled (no raw hex; `font-heading` on headings), data-driven props,
   naturalised (shared spacing/radius/motion), gracefully degrading. Blocks that
   call the backend take `requiredPlugin` in the registry AND the config entry.
   Then merge the shared branch into the client branch.

6. **Config** (client branch) — author `landing-page.config.json`: `store`,
   `brand`, `plugins`, and the full `sections[]`. **Section gating is
   config-driven**: `getFilteredSections()` drops any section whose
   `requiredPlugin` is not in the config's `plugins` array (NOT the backend's
   `ENABLED_PLUGINS`). So a gated block needs its plugin listed in BOTH the
   config `plugins` (to show) and the backend `ENABLED_PLUGINS` (so its API
   works). Client images → `public/images/`, videos → `public/videos/`.
   Because the repo `.gitignore` globally ignores `*.jpg`/`*.png`, commit
   branding/portfolio images with `git add -f`.

7. **Seed + env** (client branch + local `.env`) — client products in
   `backend/seed.py` (`_CATEGORIES` + `_products()`); a product's primary image
   can be a `/images/<file>.jpg` URL that resolves to the storefront's `public/`
   dir. Local `backend/.env` (gitignored) gets a per-client
   `DATABASE_URL` (e.g. `sqlite+aiosqlite:///./<client>.db`), an
   `ENABLED_PLUGINS` that matches the config's `plugins`, and
   `STORE_NAME`/`STORE_TAGLINE`/`CONTACT_EMAIL`.

   **Seeding a fresh local DB** (no Docker): the app reads `.env` via pydantic,
   but `seed.py` reads identity vars via `os.getenv` and `python-dotenv` is not
   installed — so export `.env` into the environment first, and a brand-new DB
   file has no schema until migrations run:
   ```bash
   cd backend
   set -a; while IFS= read -r l; do case "$l" in ''|\#*) continue;; esac; export "${l%%=*}=${l#*=}"; done < .env; set +a
   ./.venv/Scripts/python.exe -m alembic upgrade head
   ./.venv/Scripts/python.exe seed.py --demo
   ```
   (Always start the backend from `backend\` so the relative sqlite path
   resolves there — see `docs/local-dev.md`.)

8. **E2E** (client branch) — re-anchor `e2e/landing-pipeline.spec.ts` to the
   client's section text (pick anchors that are UNIQUE on the page — e.g. a hero
   CTA label may repeat lower down). Point the products test at `/products` if
   the homepage has no product grid. Run it plus `cart` + `product-listing`
   (golden path) and any client-specific specs (e.g. `enquiry-form`). The
   `/products/[slug]` route can throw a one-off `ERR_ABORTED`/timeout on its
   first dev-server compile — warm it (curl the URL) or just re-run that test.

9. **Verify** — `npm run build` + `npm run lint` (0 errors); homepage renders
   all sections via the config pipeline in the client theme; full golden-path
   click-through on every page (especially for dark themes — watch for white
   slabs); a real order needs Stripe test keys in `.env`
   (`docs/Testing_stripe_locally.txt`).

## Cost model

Each new client should be faster than the last: steps 3, 4, 6, 7, 8 are
config/data only; step 5 (new blocks) shrinks as the library grows.
