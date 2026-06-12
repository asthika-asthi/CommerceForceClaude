$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting CommerceForce..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$root\backend'; Write-Host 'BACKEND — http://localhost:8000' -ForegroundColor Cyan; .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

Write-Host "  Waiting for backend..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$root\frontend-starter'; Write-Host 'STOREFRONT — http://localhost:3000' -ForegroundColor Cyan; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$root\frontend-admin'; Write-Host 'ADMIN — http://localhost:3001' -ForegroundColor Cyan; npm run dev -- --port 3001"

Write-Host "  Waiting for frontends to compile (~15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

Write-Host "Opening browsers..." -ForegroundColor Green
Start-Process "http://localhost:3000"
Start-Process "http://localhost:3001"

Write-Host ""
Write-Host "All servers running. Close their windows or run stop.ps1 to shut down." -ForegroundColor Green
