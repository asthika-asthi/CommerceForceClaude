# CI "Backend — lint + type check + tests" failing (investigated 2026-10-05)

**Status: fixed** (see "Fix" below). Written so it can be re-read later without the chat.

## Symptom
GitHub Actions emailed "CI / Backend — lint + type check + tests failed" after each
push on 2026-10-05, which looked like it was caused by that day's changes.

## Short answer
**It was not caused by 2026-10-05's changes.** The backend job had been red on every run
since 2026-07-08 (the Storefront and Admin build jobs were green). The emails were simply
noticed that day. Two independent problems were behind it, one hiding the other.

## How it was checked
- GitHub Actions API (no login needed for a public repo):
  - runs: `https://api.github.com/repos/asthika-asthi/CommerceForceClaude/actions/runs?per_page=100`
  - steps of one run: `.../actions/runs/<run id>/jobs` (each step has a `conclusion`)
  - Raw logs need a GitHub login, so older failures can't be read from here.
- Re-ran CI's exact steps locally (`.github/workflows/ci.yml`): `ruff check .`,
  `mypy app/ --ignore-missing-imports`, then pytest with CI's env vars
  (`SECRET_KEY`, `ENABLED_PLUGINS=auth,categories,products,cart,orders,checkout,coupons,loyalty,newsletter,branding,landing_page,ai_chat,rfq,credit,inventory`, `ANTHROPIC_API_KEY`).

## Timeline (from the Actions API)
| Date | Backend job |
|---|---|
| 2026-07-04 (first CI run) | **passed** (only Storefront failed, on `npm install`) |
| 2026-07-08 onward, every run | **failed at "Lint (ruff)"** |
| 2026-10-05, all 7 pushes | failed at "Lint (ruff)" (same as before) |

## What is ruff?
Ruff is a fast Python **linter**. It reads source code without running it and flags
likely bugs and style problems against a rule list. Ours is in `backend/pyproject.toml`
(`[tool.ruff.lint]`, rule families `E`, `F`, `ASYNC`, `RUF`). CI runs `ruff check .` first
and stops the whole backend job on any finding, so the mypy and test steps never ran.

## Cause 1 — lint finding (the step that failed)
- `ruff check .` reported `ASYNC250 Blocking call to input() in async context` at
  `backend/reconcile_variant_stock.py:61` (a one-off script from 2026-07-13).
- **Environment angle:** `pyproject.toml` had `ruff>=0.5.0` (unpinned) and CI does a fresh
  `pip install` every run, so CI always used the newest ruff. A new ruff release can add
  rules inside the enabled families (`ASYNC`, `RUF`), so unchanged code can start failing
  with no code change. My earlier local check only linted `app/` + changed tests, so it
  missed this file; CI lints all of `backend/`.
- The failures between 2026-07-08 and 2026-07-12 predate that script, so they were a
  different finding that no longer exists (logs not viewable).

## Cause 2 — test time-bomb (hidden behind cause 1)
- 6 tests in `backend/tests/test_scheduling.py` failed with `400 != 201`:
  `test_customer_books_self`, `test_guest_books_with_email`,
  `test_customer_cancels_own_and_cannot_cancel_others`, `test_customer_list_excludes_others`,
  `test_booking_sends_confirmation`, `test_booking_email_failure_does_not_break_booking`.
- The fixtures hardcoded `2026-08-03` as a "future" Monday. Customers/guests can't book in
  the past (`scheduling/service.py` → 400 "cannot book an appointment in the past"), so
  these failed from 2026-08-03 onward. They failed identically with the day's changes removed.

## Cause 3 — `stripe` was never declared as a dependency (found only after 1 and 2 were fixed)
- After causes 1 and 2 were fixed, CI's lint and mypy passed and the **Run tests** step
  then failed in 4 seconds with **exit code 2** (pytest "interrupted": collection errors,
  not test failures). Reproduced locally with a clean virtualenv and a fresh
  `pip install -e ".[dev]"`: `ModuleNotFoundError: No module named 'stripe'` in
  `tests/test_checkout_deferral.py` and `tests/test_currency.py`.
- `stripe` was installed on the dev laptop but is **not in `backend/pyproject.toml`**.
  `app/plugins/checkout/service.py` and `orders/service.py` import it lazily, so nothing
  failed until a card payment or the Stripe webhook is used.
- **This is also a production bug, not just a CI one:** the VPS backend image is built from
  `pyproject.toml` only, and `import stripe` there fails (`No module named 'stripe'`,
  checked 2026-10-06). Card payments are currently off (no Stripe keys), so nobody hit it,
  but turning them on would have failed. The fix reaches the VPS the next time the backend
  image is rebuilt.

## Fix
0. `backend/pyproject.toml`: added `stripe>=15.0.0` to the dependencies.
1. `backend/pyproject.toml`: pinned `ruff==0.16.2`, so CI no longer changes underneath us.
   Upgrade deliberately (change the pin, run `ruff check .`, fix any new findings).
2. `backend/reconcile_variant_stock.py`: `input()` now runs via `asyncio.to_thread(input, …)`
   (real fix, no `noqa`/ignore).
3. `backend/tests/scheduling_dates.py` (new): derives the booking-fixture dates from today
   (first Monday ≥ 14 days away, plus Tuesday and a range end). `test_scheduling.py` and
   `test_scheduling_concurrent.py` use it instead of the `2026-08-*` literals.

Verified in a clean virtualenv with a fresh `pip install -e ".[dev]"` (what CI does): `ruff check .` clean, mypy clean (171 files),
pytest **470 passed**.

## Lessons / how to avoid a repeat
- Lint the **whole** `backend/` before pushing, as CI does: `cd backend && .venv\Scripts\ruff.exe check .`
  (not just `app` and the files you touched).
- Never hardcode "future" dates in tests; derive them from `date.today()`.
- Check CI status after a push (Actions API above) instead of waiting for emails; a job that
  stops at its first step hides every later step.
- Tool versions in CI should be pinned (ruff now is; mypy and pytest are still `>=`).
