$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidsFile = "$root\.server-pids.json"

Write-Host "Starting CommerceForce..." -ForegroundColor Cyan

# Kill anything already listening on a given port before we try to bind it — a
# stale survivor from a previous run (or one started outside these scripts) would
# otherwise crash the new server with EADDRINUSE. Same check-by-port approach as
# stop.ps1's cleanup pass, so a fresh start never depends on stop.ps1 having been
# run first, or on it having caught everything.
function Stop-PortIfListening([int]$port) {
    $lines = netstat -ano | Select-String ":$port\s" | Where-Object { $_.Line -match 'LISTENING' }
    $procIds = $lines | ForEach-Object { ($_.Line.Trim() -split '\s+')[-1] } |
        Where-Object { $_ -match '^\d+$' -and [int]$_ -gt 0 } | Select-Object -Unique
    foreach ($procId in $procIds) {
        taskkill /PID $procId /T /F 2>&1 | Out-Null
        Write-Host "  Port $port was already in use -- killed stale PID $procId" -ForegroundColor Yellow
    }
}

# 1. Backend first
Stop-PortIfListening 8000
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
Stop-PortIfListening 3000
$storefrontCmd = "Set-Location '$root\frontend-starter'; npm run dev"
$storefront = Start-Process powershell -ArgumentList "-NoExit", "-Command", $storefrontCmd -PassThru

# 3. Admin panel
Stop-PortIfListening 3001
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
