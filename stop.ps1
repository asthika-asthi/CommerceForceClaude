Write-Host "Stopping CommerceForce servers..." -ForegroundColor Cyan

foreach ($port in 8000, 3000, 3001) {
    $lines = netstat -ano | Select-String "[:$port\s].*LISTENING"
    foreach ($line in $lines) {
        $pid = ($line.Line.Trim() -split '\s+')[-1]
        if ($pid -match '^\d+$' -and [int]$pid -gt 0) {
            try {
                Stop-Process -Id ([int]$pid) -Force -ErrorAction Stop
                Write-Host "  Stopped PID $pid (port $port)" -ForegroundColor Green
            } catch {
                $result = taskkill /PID $pid /F 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  Stopped PID $pid (port $port) via taskkill" -ForegroundColor Green
                } else {
                    Write-Host "  Could not stop port $port (PID $pid) — close its window manually" -ForegroundColor Yellow
                }
            }
        }
    }
}

Write-Host "Done." -ForegroundColor Green
