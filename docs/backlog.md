# CommerceForce — Deferred Items Backlog

Conscious decisions to leave items out of scope. Check here before auditing the codebase for "what's missing."

---

## Security / Infrastructure (ops responsibility, not Superadmin config)

- `SECRET_KEY` — must be randomly generated per deployment, never in a committed file
- `DATABASE_URL` — SQLite for dev only; PostgreSQL required for production (concurrent writes corrupt SQLite)
- `SMTP_*` credentials — per-client email provider, set by hosting/ops
- `OPENROUTER_API_KEY` — per-client billing account, never committed to git
- `CORS_ORIGINS` — depends on hosting domain, set at deploy time

---

## Backend gaps

- **Plugin dependency validation** — if `auth` is disabled while `orders` is enabled, server crashes at startup with an unclear error; no dependency check in `plugin_registry.py`
- **Media upload: magic bytes check** — `content_type` header is client-supplied and can be spoofed; real fix is sniffing file bytes with `python-magic`; accepted trade-off for now (internal tool)
- **Media management page** — no admin UI to list or delete uploaded files; files accumulate in `/uploads/` with no cleanup mechanism
- **seed.py hardcoded categories and products** — `_CATEGORIES` and `_products()` in `backend/seed.py` contain demo data (`Electronics`, `Clothing`, etc.); needs a `seed-data.json` approach per client
- **Admin credentials in seed.py** — `admin@commerceforce.dev / Admin1234!` and superadmin equivalent are hardcoded; must be changed before any real deployment

---

## Frontend storefront gaps

- **Component library not built** — new visual styles (glowing buttons, glassmorphism, parallax cards, custom animations) must be built as React components and registered in `block-registry.ts` before `landing-page.config.json` can reference them; config alone cannot create new visual effects
- **Font via `next/font/google`** — the config `"brand.font"` key injects a runtime Google Fonts `<link>` tag (works, no code change needed); for maximum performance a Superadmin should also update the `next/font/google` import in `layout.tsx` and rebuild
- **WCAG contrast validation** — no automated check that brand colours in config meet WCAG AA (4.5:1 ratio for normal text, 3:1 for UI components); manual check required when setting new colours
- **Bulk class-replace script** — one-time step when cloning the storefront template; PowerShell script in `frontend-starter/CLAUDE.md` Step 3 replaces `blue-*` placeholder Tailwind classes with `brand-*`; must be run on fresh clones before any client work

---

## Admin panel gaps

- **No image management** — uploaded images cannot be browsed, renamed, or deleted from the admin panel; `/uploads/` directory accumulates indefinitely
- **No `show_on_homepage` enforcement on coupons** — admin UI warns "only one coupon at a time" via tooltip, but allows multiple coupons to have `show_on_homepage=true` simultaneously; no server-side constraint enforces the single-coupon rule

---

## Developer experience / tooling

- **Per-client git branch creation** — still manual (`git checkout -b client-name`); no script or automation
- **`ENABLED_PLUGINS` in `.env` must match config `"plugins"` list** — the frontend `getEnabledPlugins()` reads from config first (so frontend filtering is correct), but the backend still reads `ENABLED_PLUGINS` from `.env` for router registration; if they diverge, a block may appear but its API call returns 404 (handled gracefully by try/catch)
- **No deployment pipeline** — no CI/CD, no one-command deploy; out of scope until product is ready for market

---

## Future features (not started)

- **`seed-data.json`** — per-client product catalogue, categories, and initial branding as a JSON file read by `seed.py` instead of hardcoded values
- **Visual preview tool** — live preview of `landing-page.config.json` changes without running the full dev stack
- **Component library builder** — systematic process for sourcing, building, and cataloguing new block components (from 21st.dev or custom); currently ad-hoc
- **Admin media gallery** — browse, preview, copy URL, and delete uploaded files from the admin panel
- **Per-client font optimisation** — automate the `next/font/google` import update as part of client branch setup
