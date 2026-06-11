# Q: Start the frontend
**Date:** 2026-06-10

## Answer

Created `.env.local` for both frontends (pointing to `http://localhost:8000`), then started each in a separate PowerShell window on different ports.

## Commands run

```powershell
# Created frontend-starter\.env.local  → NEXT_PUBLIC_API_URL=http://localhost:8000
# Created frontend-admin\.env.local    → NEXT_PUBLIC_API_URL=http://localhost:8000

# Start storefront (port 3000, PID 5012)
Start-Process powershell -ArgumentList "-NoExit","-Command","npm run dev -- -p 3000" -WorkingDirectory "frontend-starter"

# Start admin (port 3001, PID 18252)
Start-Process powershell -ArgumentList "-NoExit","-Command","npm run dev -- -p 3001" -WorkingDirectory "frontend-admin"

# Verify
Invoke-WebRequest http://localhost:3000  # → 200 OK
Invoke-WebRequest http://localhost:3001  # → 200 OK
```

## Result

| App | URL | PID |
|-----|-----|-----|
| Storefront | http://localhost:3000 | 5012 |
| Admin panel | http://localhost:3001 | 18252 |
| Backend API | http://localhost:8000 | 6560 |
| API Docs | http://localhost:8000/api/docs | — |

Both running with hot-reload in separate terminal windows.
