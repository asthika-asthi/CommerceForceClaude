# Scheduling & Provider-Notes Plugin — Design Spec

**Date:** 2026-07-05
**Status:** Approved (v1 scope)

## Context

CommerceForce is a white-label, per-client, plugin-based e-commerce platform. The
current client is a medical practice that needs to (a) let patients book appointments
with doctors and (b) let doctors keep a per-patient journal of what happened at each
visit. Rather than a one-off medical build, we add a **single reusable `scheduling`
plugin** to the existing plugin registry, shipped **configured for the medical client
now** but designed so future verticals (salon, tutoring, consulting) are a
configuration change, not a rebuild — consistent with the platform's reason for
existing (build the backend once, tailor per client).

### Decisions locked with the user
- **One engine, configured per vertical** — not a plugin per industry.
- **v1 scope includes both** the admin back-office *and* a public self-service booking
  page on the storefront.
- **Booking-only** in v1: appointment types can carry a display price, but no online
  payment. Immediate **confirmation email** on booking; scheduled reminders deferred to v1.1.
- **Client (patient)** is a standalone record, **optionally linked** to a customer
  `User` account. Logged-in customers get auto-linked; guests can book (guest-email
  pattern, like existing guest checkout).
- **Journal notes are provider-scoped with an audit log** on every read and write.

## Where it fits (verified against current code)
- Backend plugins live in `backend/app/plugins/<name>/` with `manifest.py`,
  `__init__.py`, `models.py`, `schemas.py`, `router.py`, `service.py`. New plugin =
  `backend/app/plugins/scheduling/`.
- One `users` table discriminated by `role` (`backend/app/plugins/auth/models.py`);
  a customer is a `User` with `role="customer"`. Per-user entities FK to `users.id`
  (pattern in `credit`/`addresses` plugins).
- Models inherit `BaseModel` (`backend/app/core/base_model.py`) → UUID `id` +
  `created_at`/`updated_at`.
- RBAC is role-based via FastAPI deps (`backend/app/core/dependencies.py`:
  `require_admin()`, `require_superadmin()`, `get_current_user_optional`).
- Nav is auto-built from each manifest's `admin_menu` via `/api/menu`
  (`frontend-admin/components/sidebar.tsx`, `ICON_MAP`).
- Email util + Celery/Redis already exist in `backend/app/shared/` for confirmations.
- Concurrency test precedent in `backend/tests/test_concurrent.py` (inventory oversell).

## Terminology model (how "generic" stays high-quality)
The engine is neutral; the medical feel comes from **config, not code**:

| Concept | Code name (neutral) | Default label for this client | Configured where |
|---|---|---|---|
| Person receiving service | `Client` | "Patient" | terms config |
| Person providing service | `Provider` | "Doctor" | terms config |
| A booking | `Appointment` | "Visit" | terms config |
| Visit record | `JournalEntry` | "Clinical Notes" | terms config + note template |

The user already uses "patient" and "client" interchangeably; `Client` is the internal
model name and is free of collision (buyers are `User role=customer`).

A `GET /api/scheduling/config` endpoint returns the active **labels**, the active
**note-template schema**, and the **intake-field schema**, so both frontends render
purpose-built forms without code changes. Defaults chosen per deployment via env
(e.g. note template = SOAP, intake schema = medical).

## Data model (new tables, all inherit `BaseModel`)

| Model | Purpose | Key fields / relationships |
|---|---|---|
| `Provider` | A doctor/practitioner | display name, title, specialty, bio, colour (calendar), `user_id`→`users.id` (nullable — set when the provider logs in as staff), `can_view_all_clients` (clinical-lead flag), `is_active` |
| `AppointmentType` | A bookable service | name, `duration_minutes`, description, price (display only), colour, `is_active`; many-to-many with `Provider` (which providers offer it) |
| `ProviderAvailability` | Recurring weekly hours | `provider_id`, weekday (0–6), `start_time`, `end_time` |
| `AvailabilityException` | One-off block/extra | `provider_id`, date, `is_available` (block vs added), optional time window (time off, holidays) |
| `Client` | Patient record | first/last name, email, phone, date_of_birth, `user_id`→`users.id` (nullable link to customer account), `custom_fields` JSON (intake: allergies, meds, insurance…), `is_active` |
| `Appointment` | A booking | `provider_id`, `client_id`, `appointment_type_id`, `start_at`, `end_at`, `status` (requested/confirmed/completed/cancelled/no_show), `reason` (patient-supplied), `booked_by` (user id or "self"), `cancellation_reason` |
| `JournalEntry` | Visit/encounter note | `client_id`, `provider_id` (treating/author), optional `appointment_id`, `template` name, `content` JSON (fields per template, e.g. SOAP), `created_by`→`users.id` |
| `NoteAccessLog` | Audit trail | `journal_entry_id` (or client_id for list views), `user_id`, action (view/create/edit), timestamp |

Note templates and intake schemas are a **code registry** in
`backend/app/plugins/scheduling/templates.py` for v1 (ships SOAP + a generic
"visit note", and a medical intake schema). DB-defined custom templates are a later
enhancement.

## Permissions & audit (journal privacy)
- **Superadmin**: reads/writes all journals.
- **Provider (admin user linked to a `Provider`)**: reads/writes journals for their own
  clients (clients they have/had an appointment with, or where they are the treating
  provider). A `Provider.can_view_all_clients` flag promotes a clinical lead to full read.
- Every journal **read, create, and edit writes a `NoteAccessLog` row**. Superadmin can
  list the audit log via API.
- Enforced in the service layer (existing RBAC has no fine-grained permission table;
  the unused `required_permissions` manifest key is not relied upon).

## Booking integrity
- Slot computation subtracts booked/blocked time from recurring availability +
  exceptions, using the chosen `AppointmentType.duration_minutes`.
- **No double-booking**: on create, re-check for an overlapping non-cancelled
  appointment for that provider inside the transaction, and add a concurrency test
  mirroring `test_concurrent.py`'s oversell test.

## API surface — `/api/scheduling` (`router.py`, thin; logic in `service.py`)
- Providers, Appointment Types, Availability, Exceptions — CRUD, `require_admin()`.
- `GET /availability` (public) — computed open slots for a provider/type/date range.
- Clients — CRUD (`require_admin()`); a logged-in customer can read/update **their own**
  linked client record.
- Appointments — create (public self-service **and** admin), list/filter (admin;
  customer sees own), get, change status, cancel, reschedule.
- Journal entries — list per client, create, get, update (guarded + audited).
- `GET /config` (public) — labels + active note-template schema + intake schema.
- `GET /audit` (superadmin) — note access log.

## Frontends

### Admin — `frontend-admin/app/(dashboard)/scheduling/…`
New nav group (add icon to `ICON_MAP` in `sidebar.tsx`; `manifest.admin_menu` drives
the items automatically):
- **Calendar** — day/week view of appointments across providers.
- **Appointments** — list/filter, create/reschedule/cancel, mark completed/no-show.
- **Clients (Patients)** — list + **detail hub**: demographics, intake custom-fields,
  appointment history, and the **journal** (SOAP forms), provider-scoped.
- **Providers**, **Appointment Types**, **Availability** — admin management screens.
- Add matching TS types to `frontend-admin/lib/types.ts`.

### Storefront (public self-service) — `frontend-starter/…`
- **Booking flow**: choose service → choose provider (or "any") → pick date → see open
  slots → enter details (logged-in customer prefilled and auto-linked to a `Client`;
  guests provide details → guest `Client` created) → confirm → confirmation email.
- **Account → My appointments**: list, cancel, reschedule.
- All labels pulled from `GET /api/scheduling/config` so the storefront reads "Patient/
  Doctor/Visit" for this client.

## Wiring (must-not-forget, from architecture review)
- Add `scheduling` to `ENABLED_PLUGINS` in `backend/.env` and to the plugin list in
  `backend/tests/conftest.py`.
- Add a model-import line for the new models to `backend/alembic/env.py` **and** to the
  `setup_test_db` import list in `backend/tests/conftest.py`.
- Provide an Alembic migration in `backend/alembic/versions/` for the new tables
  (fresh installs still work via `init_db.py` create_all).
- `manifest.py`: `name="scheduling"`, label, icon, `admin_menu` entries, `depends_on=["auth"]`.

## Suggested build order (single v1, executable in slices)
1. Backend core: models + migration + wiring + config/templates registry.
2. Backend services + routes: providers, types, availability, slot computation.
3. Backend: clients, appointments (admin + public/guest), double-booking guard,
   confirmation email.
4. Backend: journal + provider-scoped access + audit log.
5. Backend tests (integration + one concurrency test) — follow existing async httpx pattern.
6. Admin frontend: providers/types/availability, appointments + calendar, client hub + journal.
7. Storefront: public booking flow + "My appointments".

## Out of scope for v1 (record for later)
- Online payment at booking (reuse existing checkout) — planned next.
- Scheduled email/SMS reminders (Celery) — v1.1.
- DB-defined custom note templates and a per-vertical setup wizard.
- Group/class bookings and room/equipment resource scheduling.

## Verification
- **Backend**: `.venv\Scripts\python.exe -m pytest -q` — new `tests/test_scheduling.py`
  covers CRUD, slot computation, admin + public/guest booking, double-booking prevented
  (concurrent), status transitions, cancel/reschedule, journal access control
  (provider vs non-provider vs superadmin), audit rows written, and the config endpoint
  labels. Full suite must stay green (~200 existing tests).
- **Live API**: start backend (`uvicorn app.main:app`), confirm `scheduling` appears in
  `GET /api/health` and `GET /api/menu`; walk a booking end-to-end via the public
  endpoint and confirm a confirmation email is sent and the slot is no longer offered.
- **Admin UI**: `scheduling` nav group renders; create a provider + availability + type,
  book an appointment, open a client, write and re-open a SOAP journal entry, confirm an
  audit row exists.
- **Storefront**: complete a self-service booking as a logged-in customer (auto-linked
  client) and as a guest; verify "My appointments" shows it and cancel works.
