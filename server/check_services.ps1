# NexusAI Service Diagnostic Tool
# Checks required services

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  NexusAI Service Diagnostic" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$allGood = $true


# --------------------------------------------------
# Check 1: Redis Docker Container
# --------------------------------------------------
Write-Host ""
Write-Host "[1] Checking Redis..." -ForegroundColor Yellow

try {
    $redisStatus = docker ps --filter "name=nexusai-redis" --format "{{.Status}}" 2>&1

    if ($redisStatus -like "*Up*") {
        Write-Host "[OK] Redis container is running" -ForegroundColor Green

        $redisPing = docker exec nexusai-redis redis-cli ping 2>&1

        if ($redisPing -match "PONG") {
            Write-Host "     Connection test: PONG" -ForegroundColor Green
        }
        else {
            Write-Host "[FAIL] Redis connection test failed" -ForegroundColor Red
            $allGood = $false
        }
    }
    else {
        Write-Host "[FAIL] Redis is NOT running" -ForegroundColor Red
        Write-Host "       Start with: docker-compose up -d redis" -ForegroundColor Yellow
        $allGood = $false
    }
}
catch {
    Write-Host "[FAIL] Could not check Redis" -ForegroundColor Red
    Write-Host "       Start with: docker-compose up -d redis" -ForegroundColor Yellow
    $allGood = $false
}


# --------------------------------------------------
# Check 2: FastAPI Server
# --------------------------------------------------
Write-Host ""
Write-Host "[2] Checking FastAPI Server..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:8000/docs" `
        -Method GET `
        -TimeoutSec 3 `
        -UseBasicParsing `
        -ErrorAction Stop

    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] FastAPI is running on http://localhost:8000" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] FastAPI returned status $($response.StatusCode)" -ForegroundColor Red
        $allGood = $false
    }
}
catch {
    Write-Host "[FAIL] FastAPI is NOT running" -ForegroundColor Red
    Write-Host "       Start with: python -m app.main" -ForegroundColor Yellow
    $allGood = $false
}


# --------------------------------------------------
# Check 3: Celery Installation
# --------------------------------------------------
Write-Host ""
Write-Host "[3] Checking Celery installation..." -ForegroundColor Yellow

$celeryPath = ".\venv\Scripts\celery.exe"

try {
    if (Test-Path $celeryPath) {

        $celeryCheck = & $celeryPath --version 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Celery is installed" -ForegroundColor Green
            Write-Host "     Version: $celeryCheck" -ForegroundColor Green
        }
        else {
            Write-Host "[FAIL] Celery executable is not working" -ForegroundColor Red
            $allGood = $false
        }
    }
    else {
        Write-Host "[FAIL] Celery is not installed in venv" -ForegroundColor Red
        Write-Host "       Install with: pip install celery" -ForegroundColor Yellow
        $allGood = $false
    }
}
catch {
    Write-Host "[FAIL] Could not check Celery installation" -ForegroundColor Red
    Write-Host "       Error: $_" -ForegroundColor Yellow
    $allGood = $false
}


# --------------------------------------------------
# Check 4: Celery Worker
# --------------------------------------------------
Write-Host ""
Write-Host "[4] Checking Celery Worker..." -ForegroundColor Yellow

try {
    if (Test-Path $celeryPath) {

        $workers = & $celeryPath `
            -A app.tasks.build_task:celery_app `
            inspect ping 2>&1

        if ($workers -match "pong") {
            Write-Host "[OK] Celery worker is running and responding" -ForegroundColor Green
        }
        else {
            Write-Host "[FAIL] Celery worker is NOT running" -ForegroundColor Red
            Write-Host "       Start with: .\start_celery.ps1" -ForegroundColor Yellow
            $allGood = $false
        }
    }
    else {
        Write-Host "[FAIL] Cannot check worker because Celery is missing" -ForegroundColor Red
        $allGood = $false
    }
}
catch {
    Write-Host "[FAIL] Could not check Celery worker" -ForegroundColor Red
    Write-Host "       Error: $_" -ForegroundColor Yellow
    $allGood = $false
}


# --------------------------------------------------
# Check 5: Pending Tasks
# --------------------------------------------------
Write-Host ""
Write-Host "[5] Checking Task Queue..." -ForegroundColor Yellow

try {
    $queueLength = docker exec nexusai-redis redis-cli LLEN celery 2>&1

    if ($queueLength -match "^\d+$") {

        if ([int]$queueLength -gt 0) {
            Write-Host "[WARN] Found $queueLength pending task(s)" -ForegroundColor Yellow
            Write-Host "       Tasks are waiting for the Celery worker" -ForegroundColor Yellow
        }
        else {
            Write-Host "[OK] Queue is empty" -ForegroundColor Green
        }
    }
    else {
        Write-Host "[WARN] Could not determine queue length" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[WARN] Could not check task queue" -ForegroundColor Yellow
}


# --------------------------------------------------
# Summary
# --------------------------------------------------
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "  [OK] ALL SYSTEMS OPERATIONAL" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You are ready to build!" -ForegroundColor Green
}
else {
    Write-Host "  [FAIL] SOME SERVICES ARE MISSING" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Quick fix:" -ForegroundColor Yellow
    Write-Host "  .\start_all.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or start manually:" -ForegroundColor Yellow
    Write-Host "  1. docker-compose up -d redis" -ForegroundColor White
    Write-Host "  2. python -m app.main" -ForegroundColor White
    Write-Host "  3. .\start_celery.ps1" -ForegroundColor White
}

Write-Host ""