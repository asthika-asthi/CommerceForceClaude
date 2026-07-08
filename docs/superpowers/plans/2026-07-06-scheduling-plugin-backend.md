# Scheduling & Provider-Notes Plugin — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

> **Format note:** Per the project owner's standing preference, this plan is written in
> plain language + tables rather than code snippets. Each step names exact files, exact
> fields/endpoints, exact test assertions, and exact commands. The executing developer
> (skilled, but new to this codebase) writes the actual code from these precise descriptions,
> following the existing plugin patterns cited in each task.

**Goal:** Build the backend of a reusable `scheduling` plugin — appointment booking plus
per-client visit journals — shipped configured for the current medical client but neutral
at the code level so future verticals are configuration, not a rebuild.

**Architecture:** A standard CommerceForce plugin at `backend/app/plugins/scheduling/`
(manifest / router / models / schemas / service), following the exact patterns of the
existing `credit` and `orders` plugins. Neutral core entities (Provider, Client,
AppointmentType, Appointment, JournalEntry) with medical labels + note templates supplied
as **config**, not hardcoded. Journals are provider-scoped with an audit row on every
read/write. Booking-only in v1 (no online payment); immediate confirmation email.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async (`Mapped`/`mapped_column`), Pydantic v2,
Alembic, pytest + httpx `AsyncClient`. SQLite in dev/test, Postgres in prod.

**Scope of THIS plan:** Backend only (spec build-order slices 1–5). The admin frontend and
storefront booking flow are separate follow-up plans that consume this API.

---

## Reference patterns (read before starting)

- **Spec:** `docs/superpowers/specs/2026-07-05-scheduling-plugin-design.md` (the source of truth).
- **Base model:** `backend/app/core/base_model.py` — every model inherits `BaseModel`
  (UUID `id`, `created_at`, `updated_at`). Do not redefine these.
- **A representative plugin to mirror:** `backend/app/plugins/credit/` (one-to-one-with-user
  entity + admin CRUD) and `backend/app/plugins/orders/` (service with cross-plugin calls,
  status transitions, email).
- **Auth guards:** `backend/app/core/dependencies.py` — `require_admin()`,
  `require_superadmin()`, `get_current_user_optional`. There is one `users` table; a
  customer is a `User` with `role="customer"`.
- **Manifest + nav:** `backend/app/plugins/products/manifest.py` shows the MANIFEST dict shape.
- **CRITICAL async rule** (`backend/CLAUDE.md`): every `db.*` coroutine
  (`flush`/`commit`/`execute`/`delete`/`refresh`) MUST be `await`ed. `db.add` is sync.
- **Email helper:** `backend/app/shared/email.py` `send_email(to, subject, body, db)`.
- **Pagination helper:** `backend/app/shared/pagination.py` (`Page`, `paginate`).
- **Test patterns:** `backend/tests/test_order_lifecycle.py` and `backend/tests/test_commerce.py`
  (helpers `make_admin`, `register_and_token`, `CUSTOMER_DATA`). Concurrency pattern:
  `backend/tests/test_concurrent.py` (oversell test) — mirror it for double-booking.

**Three wiring files that MUST be touched when models are added** (easy to forget):
1. `backend/.env` — add `scheduling` to `ENABLED_PLUGINS`.
2. `backend/tests/conftest.py` — add `scheduling` to the enabled-plugins string AND import
   the new models in the `setup_test_db` import block.
3. `backend/alembic/env.py` — import the new models so autogenerate/`create_all` sees them.

**Run commands** (from `backend/`):
- Tests: `.venv\Scripts\python.exe -m pytest -q`
- Single file: `.venv\Scripts\python.exe -m pytest tests/test_scheduling.py -q`
- Lint/type: `.venv\Scripts\ruff.exe check .` and `.venv\Scripts\mypy.exe app/`

---

## File structure (created by this plan)

| File | Responsibility |
|---|---|
| `backend/app/plugins/scheduling/__init__.py` | Re-export `MANIFEST` and `router`. |
| `backend/app/plugins/scheduling/manifest.py` | Plugin manifest: name, label, icon, `admin_menu`, `depends_on=["auth"]`. |
| `backend/app/plugins/scheduling/templates.py` | Config registry: terminology labels, note-template schemas (SOAP + generic visit note), medical intake schema. Chosen by env with medical defaults. |
| `backend/app/plugins/scheduling/models.py` | All 8 SQLAlchemy models. |
| `backend/app/plugins/scheduling/schemas.py` | Pydantic request/response schemas (`*Create`/`*Update`/`*Out`/`*ListOut`). |
| `backend/app/plugins/scheduling/service.py` | Business logic (providers, types, availability, slots, clients, appointments, email). |
| `backend/app/plugins/scheduling/journal_service.py` | Journal + provider-scoped access + audit logging (kept separate so the sensitive path is isolated and easy to review). |
| `backend/app/plugins/scheduling/router.py` | FastAPI routes; thin, delegates to services. |
| `backend/alembic/versions/<rev>_add_scheduling.py` | Migration creating the 8 tables. |
| `backend/tests/test_scheduling.py` | Integration tests (CRUD, slots, booking, journals, audit, config). |
| `backend/tests/test_scheduling_concurrent.py` | Double-booking concurrency test. |

---

## Task 1: Plugin skeleton that loads and appears in the menu

**Files:**
- Create: `backend/app/plugins/scheduling/__init__.py`, `manifest.py`, `router.py`
- Modify: `backend/.env`, `backend/tests/conftest.py`
- Test: `backend/tests/test_scheduling.py`

- [ ] **Step 1: Write the failing test.** In a new `tests/test_scheduling.py`, add
  `test_plugin_registered`: GET `/api/health` and assert `"scheduling"` is in the returned
  `plugins` list; GET `/api/menu` and assert an `admin_menu` entry exists with plugin name
  `scheduling`. Use the existing `client` fixture.
- [ ] **Step 2: Run it, confirm it fails** with scheduling absent.
  Run: `.venv\Scripts\python.exe -m pytest tests/test_scheduling.py::test_plugin_registered -q`.
  Expected: FAIL (plugin not enabled / not registered).
- [ ] **Step 3: Create the manifest** (`manifest.py`) mirroring
  `products/manifest.py`: `name="scheduling"`, `label="Scheduling"`, `icon="calendar"`,
  `depends_on=["auth"]`, `superadmin_menu=[]`, `required_permissions=[]`, and an
  `admin_menu` list with entries for Calendar (`/admin/scheduling`), Appointments,
  Clients, Providers, Appointment Types, Availability (paths under `/admin/scheduling/...`,
  icons as short strings).
- [ ] **Step 4: Create `router.py`** with an empty `APIRouter()` named `router` (routes
  added in later tasks). Create `__init__.py` re-exporting `MANIFEST` and `router`
  (mirror `products/__init__.py`).
- [ ] **Step 5: Enable the plugin.** Add `scheduling` to `ENABLED_PLUGINS` in `backend/.env`
  and to the enabled-plugins string set in `tests/conftest.py` (before app import).
- [ ] **Step 6: Run the test, confirm it passes.** Then run the FULL suite to confirm no
  regression from enabling a new plugin: `.venv\Scripts\python.exe -m pytest -q`.
  Expected: all pass.
- [ ] **Step 7: Commit** — message: `feat(scheduling): plugin skeleton registered in menu`.

---

## Task 2: Config/terminology + note-template registry and the public config endpoint

**Files:**
- Create: `backend/app/plugins/scheduling/templates.py`
- Modify: `backend/app/plugins/scheduling/router.py`
- Test: `backend/tests/test_scheduling.py`

**Design of `templates.py`** (pure Python constants + lookup functions — no DB):
- `TERMS` — a dict of neutral→label strings for the active deployment: `client_singular`
  ("Patient"), `client_plural` ("Patients"), `provider_singular` ("Doctor"),
  `appointment_singular` ("Visit"), `journal_singular` ("Clinical Note"). Default = medical.
- `NOTE_TEMPLATES` — a dict keyed by template name. Ship two: `"soap"` (fields:
  Subjective, Objective, Assessment, Plan — each a labelled multiline text field) and
  `"visit_note"` (a single "Notes" multiline field). Each template is a small schema: an
  ordered list of `{key, label, type}` where type is `"textarea"` for v1.
- `INTAKE_SCHEMA` — the client custom-fields form: an ordered list of
  `{key, label, type}` for medical intake (allergies, current_medications,
  insurance_provider, insurance_number, emergency_contact — types `"text"`/`"textarea"`).
- `ACTIVE_NOTE_TEMPLATE` — default `"soap"`; overridable via an env var
  (`SCHEDULING_NOTE_TEMPLATE`) read through the existing `settings` object. Add the setting
  to `backend/app/core/config.py` with default `"soap"`.
- Helper `get_active_config()` returns a dict `{terms, note_template, intake_schema}`.

- [ ] **Step 1: Write the failing test** `test_config_endpoint`: GET
  `/api/scheduling/config` (public, no auth). Assert HTTP 200; body has `terms` with
  `client_singular == "Patient"` and `provider_singular == "Doctor"`; `note_template.name == "soap"`
  with 4 fields whose keys are exactly `subjective, objective, assessment, plan`; and
  `intake_schema` is a non-empty list including a field keyed `allergies`.
- [ ] **Step 2: Run it, confirm 404** (endpoint not defined yet).
- [ ] **Step 3: Implement `templates.py`** as described above.
- [ ] **Step 4: Add the config setting** `SCHEDULING_NOTE_TEMPLATE: str = "soap"` to
  `Settings` in `backend/app/core/config.py`.
- [ ] **Step 5: Add the route** `GET /config` in `router.py` returning
  `templates.get_active_config()`. No auth guard (public — the storefront reads it).
- [ ] **Step 6: Run the test, confirm it passes.**
- [ ] **Step 7: Commit** — `feat(scheduling): config + note-template registry endpoint`.

---

## Task 3: Data models + migration + wiring

**Files:**
- Create: `backend/app/plugins/scheduling/models.py`,
  `backend/alembic/versions/<rev>_add_scheduling.py`
- Modify: `backend/alembic/env.py`, `backend/tests/conftest.py`
- Test: `backend/tests/test_scheduling.py`

**Models (all inherit `BaseModel`; use `Mapped`/`mapped_column`; FKs `String(36)` with
explicit `ondelete`; relationships `back_populates` + `lazy="selectin"`; computed values as
Python `@property`).** Fields per the spec:

| Model / table | Columns (beyond id/created_at/updated_at) | Relationships |
|---|---|---|
| `Provider` / `scheduling_providers` | `display_name` (req), `title`, `specialty`, `bio` (text), `color`, `user_id`→`users.id` nullable `SET NULL`, `can_view_all_clients` bool default False, `is_active` bool default True | `availability`, `exceptions`, `appointment_types` (m2m) |
| `AppointmentType` / `scheduling_appointment_types` | `name` (req), `duration_minutes` int (req), `description` text, `price` Numeric(12,2) nullable, `color`, `is_active` bool default True | `providers` (m2m via assoc table `scheduling_provider_types`) |
| `ProviderAvailability` / `scheduling_availability` | `provider_id`→providers `CASCADE`, `weekday` int (0–6), `start_time` Time, `end_time` Time | `provider` |
| `AvailabilityException` / `scheduling_availability_exceptions` | `provider_id`→providers `CASCADE`, `date` Date, `is_available` bool (False=block, True=extra), `start_time` Time nullable, `end_time` Time nullable | `provider` |
| `Client` / `scheduling_clients` | `first_name` (req), `last_name` (req), `email`, `phone`, `date_of_birth` Date nullable, `user_id`→`users.id` nullable `SET NULL`, `custom_fields` JSON default `{}`, `is_active` bool default True | `appointments`, `journal_entries` |
| `Appointment` / `scheduling_appointments` | `provider_id`→providers, `client_id`→clients, `appointment_type_id`→types, `start_at` DateTime(tz), `end_at` DateTime(tz), `status` Enum(requested/confirmed/completed/cancelled/no_show) default requested, `reason` text, `booked_by` (user id or `"self"`), `cancellation_reason` text | `provider`, `client`, `appointment_type` |
| `JournalEntry` / `scheduling_journal_entries` | `client_id`→clients `CASCADE`, `provider_id`→providers, `appointment_id`→appointments nullable, `template` str, `content` JSON default `{}`, `created_by`→`users.id` | `client` |
| `NoteAccessLog` / `scheduling_note_access_log` | `journal_entry_id`→journal_entries nullable, `client_id`→clients (for list-view reads), `user_id`→`users.id`, `action` str (view/create/edit) | — |

Use a `str, enum.Enum` for `AppointmentStatus` (mirror `OrderStatus` in `orders/models.py`).
The provider↔type m2m uses a plain association table (mirror how any existing m2m is done;
if none exists, a simple `Table(...)` with two FK columns).

- [ ] **Step 1: Write the failing test** `test_models_create_tables`: in the test session,
  create a `Provider`, an `AppointmentType`, link them, create a `Client`, and an
  `Appointment` referencing all three; `await db.flush()`; assert each has an `id` and the
  appointment's `provider.display_name` / `client.first_name` load. (This proves the schema
  and relationships are valid.)
- [ ] **Step 2: Run it, confirm it fails** (no such tables / import error).
- [ ] **Step 3: Implement `models.py`** with all 8 models + the enum + the assoc table.
- [ ] **Step 4: Wire model discovery.** Add an import line for the scheduling models to
  `backend/alembic/env.py` (mirror the other plugin import lines) AND to the `setup_test_db`
  import block in `backend/tests/conftest.py`.
- [ ] **Step 5: Run the test, confirm it passes** (test DB builds tables from models via
  `create_all`).
- [ ] **Step 6: Author the Alembic migration** in `backend/alembic/versions/` — a new
  revision whose `down_revision` is the current head (find with
  `.venv\Scripts\alembic.exe heads`). `op.create_table` for all 8 tables + the assoc table,
  each including `id`/`created_at`/`updated_at` columns explicitly (mirror an existing
  migration like the addresses/wishlist/reviews one). `downgrade` drops them in reverse.
- [ ] **Step 7: Run the full suite**, confirm green. Commit —
  `feat(scheduling): data models + migration + wiring`.

---

## Task 4: Providers CRUD

**Files:** Modify `service.py` (create), `schemas.py` (create), `router.py`. Test: `test_scheduling.py`.

**Schemas:** `ProviderCreate` (display_name req; title/specialty/bio/color/user_id/can_view_all_clients/is_active optional), `ProviderUpdate` (all optional), `ProviderOut` (all fields, `from_attributes`), `ProviderListOut` (flat summary: id, display_name, title, specialty, is_active).

**Service functions** (async, `await` all db calls, raise `HTTPException(404)` on miss):
`create_provider`, `get_provider`, `list_providers` (paginated, optional `active_only`),
`update_provider`, `deactivate_provider` (soft: set `is_active=False`, don't delete —
preserves appointment history).

**Routes** (all admin-guarded with `Depends(require_admin())` except none are public here):
`POST /providers`, `GET /providers` (`Page[ProviderListOut]`), `GET /providers/{id}`,
`PATCH /providers/{id}`, `DELETE /providers/{id}` (calls deactivate).

- [ ] **Step 1: Write failing tests** `test_provider_crud`: as admin (use `make_admin`),
  POST a provider → 201 with an id; GET list → contains it; PATCH title → reflected on GET;
  DELETE → provider now `is_active=False` (GET still returns it, list with `active_only`
  excludes it). Also `test_provider_requires_admin`: a customer token POSTing a provider → 403.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement** schemas + service + routes as above.
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** — `feat(scheduling): providers CRUD`.

---

## Task 5: Appointment types CRUD + provider assignment

**Files:** Modify `service.py`, `schemas.py`, `router.py`. Test: `test_scheduling.py`.

**Schemas:** `AppointmentTypeCreate` (name, duration_minutes req; description/price/color/is_active optional; `provider_ids` optional list to assign offering providers), `AppointmentTypeUpdate` (all optional incl. `provider_ids`), `AppointmentTypeOut` (includes assigned provider ids/names), `AppointmentTypeListOut` (id, name, duration_minutes, price, is_active).

**Service:** `create_appointment_type` (creates + links providers), `list_appointment_types`
(optional `active_only`, optional `provider_id` filter), `get_appointment_type`,
`update_appointment_type` (replace provider links when `provider_ids` given),
`deactivate_appointment_type` (soft). Validate every `provider_id` exists (404 otherwise).

**Routes** (admin-guarded): `POST /appointment-types`, `GET /appointment-types`
(`Page[...]`, supports `?provider_id=` and `?active_only=`), `GET /appointment-types/{id}`,
`PATCH /appointment-types/{id}`, `DELETE /appointment-types/{id}`.

- [ ] **Step 1: Write failing tests** `test_appointment_type_crud`: create a provider; POST
  a type with `duration_minutes=30` and `provider_ids=[that provider]` → 201; GET by id shows
  the provider linked; GET list filtered by `provider_id` returns it; PATCH duration → 45
  reflected; DELETE → soft-deactivated. `test_type_rejects_unknown_provider`: POST with a
  random provider_id → 404.
- [ ] **Step 2–4:** run-fail, implement, run-pass.
- [ ] **Step 5: Commit** — `feat(scheduling): appointment types + provider assignment`.

---

## Task 6: Provider availability + exceptions CRUD

**Files:** Modify `service.py`, `schemas.py`, `router.py`. Test: `test_scheduling.py`.

**Schemas:** `AvailabilityCreate` (provider_id, weekday 0–6, start_time, end_time — validate
`end_time > start_time` with a Pydantic `model_validator`), `AvailabilityOut`;
`ExceptionCreate` (provider_id, date, is_available, optional start/end time — if
`is_available` is True and no times given, reject: an "extra availability" needs a window),
`ExceptionOut`.

**Service:** `set_availability` (add a weekly slot), `list_availability(provider_id)`,
`delete_availability(id)`; `add_exception`, `list_exceptions(provider_id, from_date, to_date)`,
`delete_exception(id)`. All admin operations.

**Routes** (admin-guarded): `POST /providers/{provider_id}/availability`,
`GET /providers/{provider_id}/availability`, `DELETE /availability/{id}`;
`POST /providers/{provider_id}/exceptions`, `GET /providers/{provider_id}/exceptions`
(supports `?from=&to=`), `DELETE /exceptions/{id}`.

- [ ] **Step 1: Write failing tests** `test_availability_crud`: create provider; POST Monday
  09:00–17:00 → 201; GET list returns one row; POST with end before start → 422; add a block
  exception for a date (`is_available=false`) → 201; DELETE the availability → gone.
- [ ] **Step 2–4:** run-fail, implement, run-pass.
- [ ] **Step 5: Commit** — `feat(scheduling): provider availability + exceptions`.

---

## Task 7: Slot computation (public availability endpoint)

**Files:** Modify `service.py`, `router.py`. Test: `test_scheduling.py`.

**Function `compute_open_slots(provider_id, appointment_type_id, date_from, date_to, db)`**
returns an ordered list of open start-times. Algorithm, stated precisely:
1. Load the appointment type → `duration = duration_minutes` (404 if missing/inactive).
2. For each date in `[date_from, date_to]` (cap the range at, say, 31 days — reject wider with 400):
   a. Determine the day's base windows: the provider's `ProviderAvailability` rows whose
      `weekday` matches, UNLESS an exception with `is_available=False` covers that date
      (whole-day block removes all windows; a timed block subtracts that sub-window).
      Add any `is_available=True` exception windows for that date as extra windows.
   b. Within each window, generate candidate start-times stepping by `duration` from
      `start_time` while `start + duration <= window end`.
   c. Remove candidates that overlap any existing non-cancelled `Appointment` for that
      provider (overlap = candidate `[start, start+duration)` intersects
      `[appt.start_at, appt.end_at)`).
3. Return the surviving start-times (as tz-aware datetimes) in chronological order.

**Route:** `GET /availability` (PUBLIC, no auth) with query params `provider_id`,
`appointment_type_id`, `date_from`, `date_to`; returns `{slots: [...]}`.

- [ ] **Step 1: Write failing tests** in `test_scheduling.py`:
  - `test_slots_basic`: provider with Mon 09:00–11:00, a 30-min type → for a Monday,
    expect exactly 4 slots (09:00, 09:30, 10:00, 10:30).
  - `test_slots_excludes_booked`: with one appointment booked 09:30–10:00, expect the
    09:30 slot absent (3 slots remain).
  - `test_slots_respects_block_exception`: a whole-day block on that Monday → 0 slots.
  - `test_slots_range_cap`: `date_to - date_from > 31 days` → 400.
  (Pick a concrete future Monday date in the tests to keep them deterministic.)
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement `compute_open_slots`** and the route.
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** — `feat(scheduling): open-slot computation + public availability`.

---

## Task 8: Clients (patients) CRUD + customer self-record

**Files:** Modify `service.py`, `schemas.py`, `router.py`. Test: `test_scheduling.py`.

**Schemas:** `ClientCreate` (first_name, last_name req; email/phone/date_of_birth/custom_fields/user_id optional), `ClientUpdate` (all optional), `ClientOut` (all fields), `ClientListOut` (id, first_name, last_name, email, phone, is_active).

**Service:** `create_client`, `get_client`, `list_clients` (paginated, optional search on
name/email), `update_client`, `deactivate_client` (soft). Plus
`get_or_create_client_for_user(user_id, defaults, db)` — used later by public booking to
link/reuse a customer's client record (find by `user_id`; else create with the user's name/email).

**Routes:** admin-guarded CRUD: `POST /clients`, `GET /clients` (`Page[ClientListOut]`,
`?search=`), `GET /clients/{id}`, `PATCH /clients/{id}`, `DELETE /clients/{id}`. Plus a
customer-scoped `GET /clients/me` and `PATCH /clients/me` (uses `get_current_user`; reads/updates
only the caller's own linked client record — 404 if none yet).

- [ ] **Step 1: Write failing tests** `test_client_crud` (admin creates/reads/updates/soft-deletes,
  search by surname works) and `test_client_me_scoped` (a logged-in customer with a linked
  client record can GET `/clients/me`; another customer cannot see it).
- [ ] **Step 2–4:** run-fail, implement, run-pass.
- [ ] **Step 5: Commit** — `feat(scheduling): clients CRUD + customer self-record`.

---

## Task 9: Appointments — booking (admin + public/guest), double-booking guard, lifecycle

**Files:** Modify `service.py`, `schemas.py`, `router.py`. Test: `test_scheduling.py`.

**Schemas:** `AppointmentCreate` (provider_id, appointment_type_id, start_at req; plus EITHER
`client_id` (admin path) OR guest/self client details: first_name/last_name/email/phone/reason);
`AppointmentOut` (full, incl. provider/client/type summaries + status); `AppointmentListOut`
(id, start_at, end_at, status, provider_name, client_name, type_name);
`RescheduleRequest` (new start_at); `StatusChangeRequest` (target status + optional reason).

**Service:**
- `create_appointment(...)` — resolve `end_at = start_at + type.duration`; determine the
  `client_id`: admin passes an explicit `client_id`; a logged-in customer →
  `get_or_create_client_for_user`; a guest → create a guest `Client` from supplied details
  (require email for guests). **Double-booking guard:** inside the transaction, re-query for
  any non-cancelled appointment for that provider overlapping `[start_at, end_at)` and raise
  `HTTPException(409)` if found (mirror the locking re-check style of
  `products/service.py:deduct_stock`). Set `booked_by` to the user id or `"self"`/`"guest"`.
- `list_appointments(...)` — admin sees all (filters: provider_id, client_id, status, date
  range); a customer sees only appointments whose client is linked to their user_id.
- `get_appointment`, `reschedule_appointment` (recompute end_at; re-run the double-booking
  guard; only from non-terminal statuses), `change_status` (enforce a transition table like
  `orders/service.py:_ALLOWED_TRANSITIONS` — cancelled/completed/no_show terminal),
  `cancel_appointment` (customer can cancel their own future appointment; sets cancelled +
  reason).

**Routes:** `POST /appointments` (PUBLIC via `get_current_user_optional` — supports admin,
logged-in customer, and guest), `GET /appointments` (`Page[AppointmentListOut]`, admin full
/ customer own — use `get_current_user`), `GET /appointments/{id}` (owner-or-admin check like
`orders/service.get_order`), `PATCH /appointments/{id}/status` (admin), `POST /appointments/{id}/reschedule`
(admin or owner), `POST /appointments/{id}/cancel` (admin or owner).

- [ ] **Step 1: Write failing tests** `test_appointment_booking`:
  - admin books an appointment for an existing client → 201, `end_at` = start + duration;
  - a logged-in customer books (no client_id) → a client record is auto-created/linked to
    their user and the appointment is theirs;
  - a guest books with email → 201, guest client created;
  - booking an overlapping slot for the same provider → 409;
  - customer cancels their own appointment → status cancelled; a different customer cannot
    cancel it (403);
  - illegal status jump (cancelled → confirmed) → 409.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement** schemas + service + routes.
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** — `feat(scheduling): appointment booking + lifecycle + double-booking guard`.

---

## Task 10: Double-booking concurrency test

**Files:** Create `backend/tests/test_scheduling_concurrent.py`.

Mirror `backend/tests/test_concurrent.py` (the oversell test): use the `concurrent_client`
fixture (fresh session per request) to fire TWO simultaneous `POST /appointments` for the
**same provider + same slot** via `asyncio.gather`, then assert **exactly one** returns 201
and the other returns 409, and that the DB holds exactly one non-cancelled appointment for
that slot.

- [ ] **Step 1: Write the test** as described.
- [ ] **Step 2: Run it.** If both succeed (race not closed), the guard needs a row lock on
  the provider (or a unique/exclusion constraint) — tighten `create_appointment` until the
  test passes. Expected final: PASS.
- [ ] **Step 3: Commit** — `test(scheduling): concurrent double-booking prevented`.

---

## Task 11: Confirmation email on booking

**Files:** Modify `service.py` (create-appointment path). Test: `test_scheduling.py`.

On successful `create_appointment`, send a confirmation email (reuse
`app/shared/email.send_email`) to the client's email (guest email or linked user email),
wrapped in try/except that logs but never fails the booking (mirror the checkout email
pattern in `checkout/service.py`). Body includes provider name, appointment type, and
`start_at` formatted, using the configured terminology labels from `templates.TERMS`
(e.g. "Your Visit with Dr …"). Do NOT block on email.

- [ ] **Step 1: Write the failing test** `test_booking_sends_confirmation`: monkeypatch
  `app.plugins.scheduling.service.send_email` (or the imported symbol) to record calls; book
  an appointment with a guest email; assert `send_email` was called once with that recipient.
- [ ] **Step 2–4:** run-fail, implement, run-pass.
- [ ] **Step 5: Commit** — `feat(scheduling): booking confirmation email`.

---

## Task 12: Journal entries — provider-scoped access + audit log

**Files:** Create `backend/app/plugins/scheduling/journal_service.py`. Modify `schemas.py`,
`router.py`. Test: `test_scheduling.py`.

**Access rule (enforced in `journal_service`, not the router):** given the acting user,
- superadmin → full read/write on any client's journal;
- an admin user linked to a `Provider` → read/write journals for clients they are or have
  been the treating provider of (i.e., a client with an appointment with that provider, or a
  journal they authored), OR any client if that provider's `can_view_all_clients` is True;
- anyone else → 403.
Provide a helper `assert_can_access_client_journal(user, client_id, db)` used by every
journal function.

**Audit:** every read (list or get), create, and edit writes a `NoteAccessLog` row
(`user_id`, `action`, `journal_entry_id`/`client_id`). Provide `_log_access(...)`.

**Schemas:** `JournalEntryCreate` (client_id, optional appointment_id, template name,
`content` dict matching the template's field keys), `JournalEntryUpdate` (content), `JournalEntryOut`,
`JournalEntryListOut`. Validate `content` keys against the named template from `templates.py`
(reject unknown template or missing required fields → 422).

**Routes** (all `require_admin()` PLUS the finer service-level access check):
`GET /clients/{client_id}/journal` (list), `POST /clients/{client_id}/journal` (create),
`GET /journal/{id}`, `PATCH /journal/{id}` (edit → re-log). Plus superadmin-only
`GET /audit` returning recent `NoteAccessLog` rows (`Depends(require_superadmin())`).

- [ ] **Step 1: Write failing tests** `test_journal_access_and_audit`:
  - a provider-linked admin creates a SOAP note for a client they have an appointment with →
    201; a `NoteAccessLog` "create" row exists;
  - the same provider GETs it → 200 and a "view" audit row is written;
  - a second provider-linked admin with no relationship to that client and
    `can_view_all_clients=False` → 403 on read;
  - a superadmin can read it (and `GET /audit` returns the accumulated rows);
  - POSTing a note with a bad template name or missing SOAP fields → 422.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement `journal_service.py`** (access helper + audit + CRUD) and wire the routes.
- [ ] **Step 4: Run, confirm pass.**
- [ ] **Step 5: Commit** — `feat(scheduling): provider-scoped journals + audit log`.

---

## Task 13: Final verification + backlog update

**Files:** Modify `docs/backlog.md`.

- [ ] **Step 1: Full suite green** — `.venv\Scripts\python.exe -m pytest -q`. Every existing
  test plus the new scheduling tests pass.
- [ ] **Step 2: Lint + type-check** — `.venv\Scripts\ruff.exe check .` and
  `.venv\Scripts\mypy.exe app/` clean on the new files.
- [ ] **Step 3: Live smoke** — start `uvicorn app.main:app`; confirm `scheduling` in
  `GET /api/health` and `GET /api/menu`; walk one booking end-to-end via the public
  `POST /api/scheduling/appointments` and confirm the slot disappears from
  `GET /api/scheduling/availability` and a confirmation is logged.
- [ ] **Step 4: Update `docs/backlog.md`** — move the scheduling backend from "Designed" to
  "Built, not tested (needs manual browser/session test)", noting the admin + storefront
  plans are the remaining pieces.
- [ ] **Step 5: Commit** — `docs(backlog): scheduling backend built`.

---

## Spec coverage self-check

| Spec requirement | Task |
|---|---|
| One neutral engine + medical config (terms, note template, intake) | 2 |
| 8 data models incl. NoteAccessLog | 3 |
| Providers / types / availability / exceptions CRUD | 4, 5, 6 |
| Public computed availability (slots) | 7 |
| Clients standalone + auto-link to customer + guest | 8, 9 |
| Appointment booking (admin + public/guest), no double-booking | 9, 10 |
| Booking-only + confirmation email | 9, 11 |
| Journals provider-scoped + audit on every read/write | 12 |
| `GET /config` (public) and `GET /audit` (superadmin) | 2, 12 |
| Wiring: `.env`, `conftest`, `alembic/env.py`, migration | 1, 3 |
| Concurrency-tested double-booking | 10 |
| Full suite stays green | 1, 13 |

**Out of scope (separate plans, per spec):** admin frontend pages, storefront booking flow,
scheduled reminders (v1.1), online payment.
