# Q: Start the backend server
**Date:** 2026-06-10

## Answer

Created `.env` from `.env.example` using SQLite (no PostgreSQL required for dev) with all 16 plugins enabled. Ran Alembic migrations, then started uvicorn with `--reload`.

## Commands run

```powershell
# Check for existing .env
Test-Path "D:\Projects\20260609_Commerceforce\backend\.env"
# → False

# Create .env (SQLite, all plugins enabled)
# Written to: backend\.env

# Run migrations
cd backend
.venv\Scripts\python.exe -m alembic upgrade head
# → INFO [alembic.runtime.migration] Context impl SQLiteImpl.
# → INFO [alembic.runtime.migration] Will assume non-transactional DDL.
# Exit: 0

# Start uvicorn (background, PID 6560)
Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m","uvicorn","app.main:app","--reload","--host","0.0.0.0","--port","8000"

# Health check
Invoke-WebRequest -Uri "http://localhost:8000/api/health"
# → 200 OK
# → {"status":"ok","environment":"development","plugins":["auth","categories","products","cart","orders","checkout","coupons","loyalty","newsletter","branding","landing_page","ai_chat","rfq","credit","inventory"]}
```

## Result

| Endpoint | URL |
|----------|-----|
| Health | http://localhost:8000/api/health |
| Swagger docs | http://localhost:8000/api/docs |
| Database | SQLite — `backend/commerceforce.db` |
| Process ID | 6560 (--reload enabled) |

All 16 plugins active.
