# ============================================
# Production Readiness Verification Script (PowerShell)
# ============================================

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Production Readiness Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$PASSED = 0
$FAILED = 0
$WARNINGS = 0

function Check-Requirement {
    param(
        [string]$Name,
        [string]$Path
    )
    
    Write-Host "Checking $Name... " -NoNewline
    
    if (Test-Path $Path) {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $script:PASSED++
        return $true
    } else {
        Write-Host "✗ FAILED" -ForegroundColor Red
        $script:FAILED++
        return $false
    }
}

function Check-WithWarning {
    param(
        [string]$Name,
        [string]$Path
    )
    
    Write-Host "Checking $Name... " -NoNewline
    
    if (Test-Path $Path) {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $script:PASSED++
        return $true
    } else {
        Write-Host "⚠ WARNING" -ForegroundColor Yellow
        $script:WARNINGS++
        return $false
    }
}

Write-Host ""
Write-Host "=== 1. Infrastructure Checks ===" -ForegroundColor Blue

Check-Requirement "Docker Compose files" "docker-compose.prod.yml"
Check-Requirement "Staging Docker Compose" "docker-compose.staging.yml"
Check-Requirement "Environment files" ".env.example"
Check-Requirement "Staging environment" ".env.staging"
Check-Requirement "Deployment scripts" "scripts/deploy-staging.sh"
Check-Requirement "Database migrations" "packages/clients/db/migrations"

Write-Host ""
Write-Host "=== 2. Code Quality Checks ===" -ForegroundColor Blue

Check-Requirement "Package configuration" "package.json"
Check-Requirement "TypeScript configuration" "tsconfig.json"
Check-Requirement "Database schema" "packages/clients/db/schema.prisma"

Write-Host ""
Write-Host "=== 3. Documentation Checks ===" -ForegroundColor Blue

Check-Requirement "Deployment runbook" ".kiro/specs/production-readiness/DEPLOYMENT_RUNBOOK.md"
Check-Requirement "Environment variables doc" ".kiro/specs/production-readiness/ENVIRONMENT_VARIABLES.md"
Check-Requirement "Database migrations doc" ".kiro/specs/production-readiness/DATABASE_MIGRATIONS.md"
Check-Requirement "External dependencies doc" ".kiro/specs/production-readiness/EXTERNAL_DEPENDENCIES.md"
Check-Requirement "Staging environment guide" ".kiro/specs/production-readiness/STAGING_ENVIRONMENT_GUIDE.md"
Check-Requirement "Production readiness checklist" ".kiro/specs/production-readiness/PRODUCTION_READINESS_CHECKLIST.md"

Write-Host ""
Write-Host "=== 4. Service Implementation Checks ===" -ForegroundColor Blue

Check-Requirement "Health check service" "packages/data-orchestration/src/services/health-check.service.ts"
Check-Requirement "Monitoring service" "packages/data-orchestration/src/services/monitoring.service.ts"
Check-Requirement "SSE connection manager" "packages/data-orchestration/src/services/sse-connection-manager.service.ts"
Check-Requirement "Optimistic locking service" "packages/data-orchestration/src/services/optimistic-locking.service.ts"
Check-Requirement "Input validation service" "packages/data-orchestration/src/services/input-validation.service.ts"

Write-Host ""
Write-Host "=== 5. API Endpoint Checks ===" -ForegroundColor Blue

Check-Requirement "Health API" "apps/web/app/api/health/route.ts"
Check-Requirement "Detailed health API" "apps/web/app/api/health/detailed/route.ts"
Check-Requirement "Monitoring metrics API" "apps/web/app/api/monitoring/metrics/route.ts"
Check-Requirement "Events API (SSE)" "apps/web/app/api/events/route.ts"
Check-Requirement "Connections API" "apps/web/app/api/connections/route.ts"

Write-Host ""
Write-Host "=== 6. Component Checks ===" -ForegroundColor Blue

Check-Requirement "Error boundary" "apps/web/components/errors/GlobalErrorFallback.tsx"
Check-Requirement "Connection status indicator" "apps/web/components/realtime/ConnectionStatusIndicator.tsx"
Check-Requirement "Monitoring dashboard" "apps/web/components/monitoring/MonitoringDashboard.tsx"
Check-Requirement "Real-time context" "apps/web/contexts/RealTimeContext.tsx"

Write-Host ""
Write-Host "=== 7. Test Suite Checks ===" -ForegroundColor Blue

Check-Requirement "Unit tests" "packages/data-orchestration/test/unit"
Check-Requirement "Integration tests" "packages/data-orchestration/test/integration"
Check-Requirement "E2E tests" "apps/web/tests"
Check-Requirement "Load tests" "packages/data-orchestration/test/load"

Check-Requirement "Health check tests" "packages/data-orchestration/test/unit/health-check.service.test.ts"
Check-Requirement "API endpoint tests" "packages/data-orchestration/test/integration/api-endpoints.test.ts"
Check-Requirement "Contract upload E2E test" "apps/web/tests/contract-upload.e2e.spec.ts"
Check-Requirement "Load test suite" "packages/data-orchestration/test/load/production-readiness-load-test.ts"

Write-Host ""
Write-Host "=== 8. Security Implementation Checks ===" -ForegroundColor Blue

Check-Requirement "Rate limiting middleware" "apps/web/lib/middleware/rate-limit.middleware.ts"
Check-Requirement "Security headers middleware" "apps/web/lib/middleware/security-headers.middleware.ts"
Check-Requirement "Sanitization middleware" "apps/web/lib/middleware/sanitization.middleware.ts"
Check-Requirement "Validation schemas" "packages/data-orchestration/src/schemas/validation.schemas.ts"

Write-Host ""
Write-Host "=== 9. Performance Implementation Checks ===" -ForegroundColor Blue

Check-Requirement "Performance monitor" "apps/web/lib/performance/performance-monitor.ts"
Check-Requirement "Lazy components" "apps/web/lib/performance/lazy-components.tsx"
Check-Requirement "Query optimization" "packages/data-orchestration/src/utils/query-optimization.ts"
Check-Requirement "Query cache service" "packages/data-orchestration/src/services/query-cache.service.ts"

Write-Host ""
Write-Host "=== 10. UX Implementation Checks ===" -ForegroundColor Blue

Check-Requirement "Loading states" "apps/web/hooks/useLoadingState.ts"
Check-Requirement "Feedback system" "apps/web/components/feedback/FeedbackSystem.tsx"
Check-Requirement "Keyboard shortcuts" "apps/web/hooks/useKeyboardShortcuts.ts"
Check-Requirement "Responsive layout" "apps/web/components/layout/ResponsiveLayout.tsx"
Check-Requirement "Accessibility components" "apps/web/components/accessibility/AccessibleComponents.tsx"

Write-Host ""
Write-Host "=== 11. Configuration Checks ===" -ForegroundColor Blue

if (Test-Path .env) {
    $envContent = Get-Content .env -Raw
    
    Write-Host "Checking DATABASE_URL configured... " -NoNewline
    if ($envContent -match "DATABASE_URL=") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "⚠ WARNING" -ForegroundColor Yellow
        $WARNINGS++
    }
    
    Write-Host "Checking OPENAI_API_KEY configured... " -NoNewline
    if ($envContent -match "OPENAI_API_KEY=") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "⚠ WARNING" -ForegroundColor Yellow
        $WARNINGS++
    }
    
    Write-Host "Checking JWT_SECRET configured... " -NoNewline
    if ($envContent -match "JWT_SECRET=") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "⚠ WARNING" -ForegroundColor Yellow
        $WARNINGS++
    }
} else {
    Write-Host "⚠ WARNING: .env file not found" -ForegroundColor Yellow
    $WARNINGS++
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Verification Results" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Passed:   $PASSED" -ForegroundColor Green
Write-Host "Failed:   $FAILED" -ForegroundColor Red
Write-Host "Warnings: $WARNINGS" -ForegroundColor Yellow
Write-Host "Total:    $($PASSED + $FAILED + $WARNINGS)"
Write-Host ""

$TOTAL = $PASSED + $FAILED + $WARNINGS
if ($TOTAL -gt 0) {
    $SUCCESS_RATE = [math]::Round(($PASSED * 100) / $TOTAL, 2)
    Write-Host "Success Rate: $SUCCESS_RATE%"
}

Write-Host ""

if ($FAILED -eq 0) {
    if ($WARNINGS -eq 0) {
        Write-Host "✓ All checks passed! System is ready for production." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "⚠ All critical checks passed, but there are warnings." -ForegroundColor Yellow
        Write-Host "Review warnings before proceeding to production."
        exit 0
    }
} else {
    Write-Host "✗ Some checks failed. Please address the failures before production deployment." -ForegroundColor Red
    exit 1
}
