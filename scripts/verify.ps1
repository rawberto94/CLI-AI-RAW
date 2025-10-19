# System Health Verification Script
# Checks all components of the platform

$ErrorActionPreference = "Continue"

Write-Host "🔍 Verifying System Health..." -ForegroundColor Cyan
Write-Host ""

$allHealthy = $true

# Check Docker
Write-Host "1. Docker..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "   ✅ Installed" -ForegroundColor Green
} else {
    Write-Host "   ❌ Not installed" -ForegroundColor Red
    $allHealthy = $false
}

# Check Chroma DB
Write-Host "2. Chroma DB..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "http://localhost:8000/api/v1/heartbeat" -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host "   ✅ Running and healthy" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Not responding" -ForegroundColor Red
    $allHealthy = $false
}

# Check MySQL
Write-Host "3. MySQL..." -ForegroundColor Yellow
try {
    docker exec mysql-rag mysql -u root -pragpassword -e "SELECT 1;" 2>&1 | Out-Null
    Write-Host "   ✅ Running and healthy" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Not responding" -ForegroundColor Red
    $allHealthy = $false
}

# Check .env
Write-Host "4. Configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "OPENAI_API_KEY=sk-") {
        Write-Host "   ✅ OpenAI API key configured" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  OpenAI API key needs update" -ForegroundColor Yellow
        $allHealthy = $false
    }
} else {
    Write-Host "   ❌ .env file missing" -ForegroundColor Red
    $allHealthy = $false
}

# Check dependencies
Write-Host "5. Dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ Installed" -ForegroundColor Green
} else {
    Write-Host "   ❌ Not installed" -ForegroundColor Red
    $allHealthy = $false
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($allHealthy) {
    Write-Host "✅ All systems healthy!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Start the application: npm run dev" -ForegroundColor Green
    Write-Host "Visit: http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "⚠️  Issues found - run: .\scripts\setup.ps1" -ForegroundColor Yellow
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
