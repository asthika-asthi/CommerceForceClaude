# Running CommerceForce locally (no Docker)

Local development runs the three parts of the app directly on Windows —
no Docker involved. You need three PowerShell windows, one per part.
(Docker is only used on the production VPS; see `docs/new-client-setup.md`.)

---

## Window 1 — Backend API (port 8000)

```powershell
cd D:\Projects\20260609_Commerceforce\backend
.venv\Scripts\python.exe -m pip install -e .        # only if dependencies changed
.venv\Scripts\python.exe -m alembic upgrade head    # only after new migrations
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

> ⚠️ **Always `cd` into `backend\` first.** `DATABASE_URL` uses a relative
> path (`./commerceforce.db`), so starting the backend from the project root
> silently creates a fresh, EMPTY database there — products vanish and the
> superadmin login breaks. The real local database is
> `backend\commerceforce.db`.

First-time setup only (no `.venv` yet):

```powershell
cd D:\Projects\20260609_Commerceforce\backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e .
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe seed.py
```

## Window 2 — Storefront (port 3000)

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-starter
npm install         # only if dependencies changed
npm run dev
```

## Window 3 — Admin panel (port 3001)

```powershell
cd D:\Projects\20260609_Commerceforce\frontend-admin
npm install         # only if dependencies changed
npm run dev -- -p 3001
```

---

## Which steps you need, when

| Situation | What to run |
|---|---|
| Restart after a reboot | Only the last command in each window |
| Pulled new code / switched branches | `npm install` in both frontends, `pip install -e .` + `alembic upgrade head` in backend, then start everything |
| Stale/broken behaviour | Close all windows, delete `frontend-starter\.next` and `frontend-admin\.next`, run the full sequence |
| Superadmin login broken | `cd backend` → `.venv\Scripts\python.exe reset_superadmin_password.py` (details in that file's header) |
| Production-style build check | `npm run build` in each frontend folder (a check only — dev still uses `npm run dev`) |

## Verify everything is up

- Backend: <http://localhost:8000/api/health> → `"status":"ok"` plus plugin list
- Storefront: <http://localhost:3000>
- Admin: <http://localhost:3001>

Stop everything with `Ctrl+C` in each window (or close the windows).

## Configuration files that drive local dev

| File | What it controls |
|---|---|
| `backend\.env` | Plugins (`ENABLED_PLUGINS`), superadmin credentials, SMTP, Stripe, DB URL |
| `frontend-starter\.env.local`, `frontend-admin\.env.local` | Frontend → backend URLs and public keys |
| `frontend-starter\landing-page.config.json` | Homepage structure (`sections[]`) — see `frontend-starter/CLAUDE.md` Step 3 |

## Running tests locally

```powershell
# Backend unit/API tests (from backend\)
.venv\Scripts\python.exe -m pytest -q

# Storefront E2E (backend :8000 + storefront :3000 must both be running)
cd frontend-starter; npm run test:e2e
```
