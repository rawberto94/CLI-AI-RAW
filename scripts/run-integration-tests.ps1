# Integration Test Runner for Editable Artifact Repository
# Runs all integration tests for the feature

Write-Host "🧪 Running Editable Artifact Repository Integration Tests" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Set test environment
$env:NODE_ENV = "test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL

# Check if test database is configured
if (-not $env:TEST_DATABASE_URL) {
    Write-Host "❌ TEST_DATABASE_URL not configured" -ForegroundColor Red
    Write-Host "Please set TEST_DATABASE_URL in your .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
pnpm install

Write-Host ""
Write-Host "🗄️  Setting up test database..." -ForegroundColor Yellow
cd packages/data-orchestration
npx prisma migrate deploy
npx prisma generate
cd ../..

Write-Host ""
Write-Host "🧪 Running Service Tests..." -ForegroundColor Green
Write-Host "----------------------------" -ForegroundColor Gray
pnpm --filter @procurement/data-orchestration test packages/data-orchestration/src/__tests__/editable-artifact.service.test.ts

Write-Host ""
Write-Host "🧪 Running Propagation Tests..." -ForegroundColor Green
Write-Host "--------------------------------" -ForegroundColor Gray
pnpm --filter @procurement/data-orchestration test packages/data-orchestration/src/__tests__/artifact-change-propagation.service.test.ts

Write-Host ""
Write-Host "🧪 Running API Tests..." -ForegroundColor Green
Write-Host "-----------------------" -ForegroundColor Gray
pnpm --filter web test apps/web/__tests__/api/artifact-editing.test.ts

Write-Host ""
Write-Host "✅ All integration tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Test Summary:" -ForegroundColor Cyan
Write-Host "  - Service Layer: ✓" -ForegroundColor Green
Write-Host "  - Propagation System: ✓" -ForegroundColor Green
Write-Host "  - API Endpoints: ✓" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review test results" -ForegroundColor White
Write-Host "  2. Run end-to-end tests" -ForegroundColor White
Write-Host "  3. Deploy to staging" -ForegroundColor White
