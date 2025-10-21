#!/usr/bin/env pwsh

Write-Host ""
Write-Host "🧪 Testing Complete Data Flow Integration" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Must run from project root" -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Running pnpm install..." -ForegroundColor Yellow
    pnpm install
}

# Run the test
Write-Host "🚀 Running data flow test..." -ForegroundColor Green
Write-Host ""

try {
    & npx tsx scripts/test-data-flow.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ All tests passed!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Tests failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host ""
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error running tests: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
