$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidsFile = "$root\.server-pids.json"

Write-Host "Stopping CommerceForce servers..." -ForegroundColor Cyan

if (Test-Path $pidsFile) {
    $saved = Get-Content $pidsFile | ConvertFrom-Json
    foreach ($name in @("backend", "storefront", "admin")) {
        $procId = $saved.$name
        if ($procId) {
            # /T kills the window AND all its child processes (uvicorn, node, etc.)
            $result = taskkill /PID $procId /T /F 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  Stopped $name (PID $procId)" -ForegroundColor Green
            } else {
                Write-Host "  $name (PID $procId) already stopped" -ForegroundColor Gray
            }
        }
    }
    Remove-Item $pidsFile -Force
} else {
    Write-Host "  No PID file found." -ForegroundColor Yellow
}

# Always follow up with a port scan, regardless of whether the PID file existed or
# the taskkill above reported success. A tracked PID's real listener can end up
# outside the process tree taskkill /T walks (e.g. a detached/re-parented Next.js
# server process), or a server may have been started outside start.ps1 entirely —
# either way it silently squats the port forever unless we check by port directly,
# not just by the PIDs we happen to remember.
Write-Host "  Verifying ports are free..." -ForegroundColor Gray
foreach ($port in 8000, 3000, 3001) {
    $lines = netstat -ano | Select-String ":$port\s" | Where-Object { $_.Line -match 'LISTENING' }
    $procIds = $lines | ForEach-Object { ($_.Line.Trim() -split '\s+')[-1] } |
        Where-Object { $_ -match '^\d+$' -and [int]$_ -gt 0 } | Select-Object -Unique
    foreach ($procId in $procIds) {
        taskkill /PID $procId /T /F 2>&1 | Out-Null
        Write-Host "  Killed orphaned PID $procId (port $port)" -ForegroundColor Green
    }
}

Write-Host "Done." -ForegroundColor Green
