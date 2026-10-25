Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting ReachInbox Full-Stack Email Job Scheduler" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Redis Server
$redisBin = "C:\Users\Asus\.gemini\antigravity\scratch\redis\redis-server.exe"
$redisConf = "C:\Users\Asus\.gemini\antigravity\scratch\redis\redis.windows.conf"

$existingRedis = Get-Process -Name *redis* -ErrorAction SilentlyContinue
if (-not $existingRedis) {
    if (Test-Path $redisBin) {
        Write-Host "Starting Portable Redis Server on port 6379..." -ForegroundColor Yellow
        Start-Process -FilePath $redisBin -ArgumentList $redisConf -WindowStyle Minimized
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "Redis server is already active." -ForegroundColor Green
}

# 2. Start Backend API & Worker
Write-Host "Launching Backend API Server on http://localhost:5000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd C:\Users\Asus\.gemini\antigravity\scratch\reachinbox-scheduler\backend; npm run dev" -WindowStyle Minimized

# 3. Start Frontend Dashboard
Write-Host "Launching Frontend Dashboard on http://localhost:3000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd C:\Users\Asus\.gemini\antigravity\scratch\reachinbox-scheduler\frontend; npm run dev" -WindowStyle Minimized

Start-Sleep -Seconds 3

Write-Host "`n✅ All ReachInbox services started successfully!" -ForegroundColor Green
Write-Host "👉 Frontend Dashboard : http://localhost:3000" -ForegroundColor Cyan
Write-Host "👉 BullMQ Queue Board : http://localhost:5000/admin/queues" -ForegroundColor Cyan
Write-Host "👉 Backend Health Check: http://localhost:5000/api/health" -ForegroundColor Cyan
