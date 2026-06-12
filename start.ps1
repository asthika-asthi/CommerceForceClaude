$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidsFile = "$root\.server-pids.json"

Write-Host "Starting CommerceForce..." -ForegroundColor Cyan

# 1. Backend first
$backendCmd = "Set-Location '$root\backend'; .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -PassThru

# Poll until backend is ready
Write-Host "  Waiting for backend..." -ForegroundColor Gray
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    try {
        Invoke-WebRequest "http://localhost:8000/api/products" -UseBasicParsing -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch {}
}
if ($ready) {
    Write-Host "  Backend ready." -ForegroundColor Green
} else {
    Write-Host "  Backend slow to start - continuing anyway." -ForegroundColor Yellow
}

# 2. Storefront
$storefrontCmd = "Set-Location '$root\frontend-starter'; npm run dev"
$storefront = Start-Process powershell -ArgumentList "-NoExit", "-Command", $storefrontCmd -PassThru

# 3. Admin panel
$adminCmd = "Set-Location '$root\frontend-admin'; npm run dev -- --port 3001"
$admin = Start-Process powershell -ArgumentList "-NoExit", "-Command", $adminCmd -PassThru

# Save PIDs so stop.ps1 can kill the windows and their children
@{ backend = $backend.Id; storefront = $storefront.Id; admin = $admin.Id } | ConvertTo-Json | Set-Content $pidsFile

Write-Host "  Waiting for frontends to compile (~20s)..." -ForegroundColor Gray
Start-Sleep -Seconds 20

Write-Host "Opening browsers..." -ForegroundColor Green
Start-Process "http://localhost:3000"
Start-Process "http://localhost:3001"

Write-Host "All servers running. Run stop.ps1 to shut down." -ForegroundColor Green
