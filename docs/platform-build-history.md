# CommerceForce — Original 7-Phase Platform Build

This is a historical record of the original build plan that produced the
platform's foundation. It predates this repo's git history (the earliest
commit already contains a working platform) and no spec/plan file for it
survived — this document reconstructs it from project notes so the record
exists going forward. For what's happened *since* this foundation was laid,
see `backlog.md` (build status) and `gap-analysis-and-roadmap.md` (forward
roadmap) — this doc is not kept up to date and should not be treated as
current status.

**Why this platform exists:** an earlier single-tenant version bundled every
feature and a custom UI into one codebase per client — too time-consuming to
maintain across clients. This rebuild split the model in two: one backend
built once, and a per-client frontend built per engagement (design.md +
Claude session). That split is why the architecture below treats the backend
plugins as shared infrastructure and the two Next.js apps as templates.

**Architecture:** modular monolith with a plugin registry. Plugins are Python
packages that self-register at startup and are included or excluded per
client via the `ENABLED_PLUGINS` env var at packaging time. Each plugin
follows a fixed shape: `manifest.py` (name, menu items, permissions,
dependencies), `router.py`, `models.py`, `schemas.py`, `service.py`.

**Tech stack at completion:**
- Backend: FastAPI + SQLAlchemy (async) + Alembic + PostgreSQL (SQLite fallback for dev)
- Async tasks: Celery + Redis (present in the stack; not yet wired to real jobs at this point — see phase 7 gaps below)
- Frontend (per client): Next.js + Tailwind CSS + shadcn/ui + Framer Motion + TanStack Query + Zustand + TypeScript
- Deployment: Docker Compose, one compose file per client

**User roles:** superadmin (platform owner/builder) / admin (client's staff) / customer (registered buyer) / guest (unauthenticated).

---

## The 7 phases

### Phase 1 — Core Platform
FastAPI application shell, plugin registry, auth/RBAC, database layer, Docker setup.
**Status at completion:** done, 12 tests passing.

### Phase 2 — Commerce Engine
Products, categories, orders, cart, checkout, payments.
**Status at completion:** done, 19 tests passing (test_commerce.py).

### Phase 3 — B2B Layer
RFQ (request-for-quote) workflow, credit limits, multi-warehouse inventory.
**Status at completion:** done, 18 tests passing (test_b2b.py) — 49 tests cumulative.

### Phase 4 — Marketing
Coupons, loyalty program, newsletter.
**Status at completion:** done, 34 tests passing (test_marketing.py).

### Phase 5 — Content & AI
Landing page builder, AI chat, branding config, CSV import.
**Status at completion:** done, 27 tests passing (test_content.py).

### Phase 6 — Admin Shell
Next.js admin panel (`frontend-admin/`) covering every plugin's admin surface:
products, orders, categories, coupons, loyalty, newsletter, branding,
landing-page, inventory, credit, RFQ.
**Status at completion:** done.

### Phase 7 — Client Storefront Starter
Next.js customer-facing template (`frontend-starter/`): home, products, cart,
checkout, account, login, register.
**Status at completion:** done.

---

## State at the end of this build (2026-06-10)

Captured from the last status check of that build session
(`docs/session-outputs/2026-06-10_003_codebase-status.md`), before the
codebase's history was committed to this git repo:

- Backend: 104 Python files, ~3,479 lines, 15 plugins, 109/109 tests passing
- Admin panel: 17 routes, 0 TypeScript errors, clean build
- Storefront: 10 routes, 0 TypeScript errors, clean build
- **Known gaps at that point** (since closed or superseded — check
  `gap-analysis-and-roadmap.md` for current status): no git commits for most
  of the code yet, no email sending (SMTP unconfigured), Redis/Celery present
  but not wired to real background jobs, no payment gateway (cash/credit
  only), no image upload (product images were URL-only).

## Notable pattern learned during this build

**Async SQLAlchemy relationship-loading gotcha** (surfaced during Phases 2–3):
after `db.add(obj); await db.flush()`, relationship attributes on `obj` are
unloaded. The fix pattern used throughout: capture the ID, call
`db.expire(obj)`, then re-select with an explicit `selectinload()`. Tests
guard against stale reads the same way — `override_get_db` calls
`db.expire_all()` before yielding, so each test request sees fresh DB state.

---

## Where things stand now

All 7 phases above are complete and this plan has been fully superseded.
Current priorities live in `gap-analysis-and-roadmap.md` (Part F, "Prioritized
roadmap") and `backlog.md`. The per-client storefront work (block library,
per-client config pipeline) that followed this foundation is documented
separately in `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`.
