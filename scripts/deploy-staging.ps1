# ============================================
# Staging Deployment Script (PowerShell)
# ============================================
# This script deploys the application to staging environment

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Contract Intelligence - Staging Deployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.staging exists
if (-not (Test-Path .env.staging)) {
    Write-Host "Error: .env.staging file not found" -ForegroundColor Red
    Write-Host "Please create .env.staging from .env.staging template"
    exit 1
}

Write-Host "Step 1: Stopping existing staging containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.staging.yml down

Write-Host "Step 2: Building Docker images..." -ForegroundColor Yellow
docker-compose -f docker-compose.staging.yml build --no-cache

Write-Host "Step 3: Starting staging services..." -ForegroundColor Yellow
docker-compose -f docker-compose.staging.yml up -d

Write-Host "Step 4: Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if postgres is healthy
Write-Host "Checking PostgreSQL..."
$pgCheck = docker-compose -f docker-compose.staging.yml exec -T postgres pg_isready -U postgres -d contract_intelligence_staging
if ($LASTEXITCODE -ne 0) {
    Write-Host "PostgreSQL is not ready" -ForegroundColor Red
    exit 1
}

# Check if redis is healthy
Write-Host "Checking Redis..."
$redisCheck = docker-compose -f docker-compose.staging.yml exec -T redis redis-cli ping
if ($LASTEXITCODE -ne 0) {
    Write-Host "Redis is not ready" -ForegroundColor Red
    exit 1
}

Write-Host "Step 5: Running database migrations..." -ForegroundColor Yellow
docker-compose -f docker-compose.staging.yml exec -T web npx prisma migrate deploy

Write-Host "Step 6: Seeding database (if needed)..." -ForegroundColor Yellow
# Add seed command if you have one
# docker-compose -f docker-compose.staging.yml exec -T web npm run seed

Write-Host "Step 7: Running health checks..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check application health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Application health check passed" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Application health check failed" -ForegroundColor Red
    Write-Host "Check logs with: docker-compose -f docker-compose.staging.yml logs web"
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Staging Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URL: http://localhost:3001"
Write-Host "MinIO Console: http://localhost:9003"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  View logs: docker-compose -f docker-compose.staging.yml logs -f"
Write-Host "  Stop: docker-compose -f docker-compose.staging.yml down"
Write-Host "  Restart: docker-compose -f docker-compose.staging.yml restart"
Write-Host ""
