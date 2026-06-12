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
    Write-Host "  No PID file found — falling back to port scan..." -ForegroundColor Yellow
    foreach ($port in 8000, 3000, 3001) {
        $lines = netstat -ano | Select-String "[:$port\s].*LISTENING"
        foreach ($line in $lines) {
            $procId = ($line.Line.Trim() -split '\s+')[-1]
            if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
                taskkill /PID $procId /T /F 2>&1 | Out-Null
                Write-Host "  Killed PID $procId (port $port)" -ForegroundColor Green
            }
        }
    }
}

Write-Host "Done." -ForegroundColor Green
