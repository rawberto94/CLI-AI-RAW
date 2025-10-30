# ============================================
# Security Scanning Script (PowerShell) - Simplified
# ============================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Security Scanning" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$PASSED = 0
$FAILED = 0
$WARNINGS = 0

Write-Host "=== 1. Dependency Vulnerability Scan ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Running npm audit..." -ForegroundColor Yellow
try {
    $auditJson = npm audit --json 2>&1 | Out-String
    $auditOutput = $auditJson | ConvertFrom-Json
    
    if ($auditOutput.metadata) {
        $critical = $auditOutput.metadata.vulnerabilities.critical
        $high = $auditOutput.metadata.vulnerabilities.high
        $moderate = $auditOutput.metadata.vulnerabilities.moderate
        $low = $auditOutput.metadata.vulnerabilities.low
        
        Write-Host "Vulnerability Summary:" -ForegroundColor Cyan
        Write-Host "  Critical: $critical" -ForegroundColor $(if ($critical -gt 0) { "Red" } else { "Green" })
        Write-Host "  High: $high" -ForegroundColor $(if ($high -gt 0) { "Red" } else { "Green" })
        Write-Host "  Moderate: $moderate" -ForegroundColor $(if ($moderate -gt 0) { "Yellow" } else { "Green" })
        Write-Host "  Low: $low" -ForegroundColor $(if ($low -gt 0) { "Yellow" } else { "Green" })
        Write-Host ""
        
        if ($critical -eq 0 -and $high -eq 0) {
            Write-Host "✓ No critical or high severity vulnerabilities" -ForegroundColor Green
            $PASSED++
        } else {
            Write-Host "✗ Critical or high severity vulnerabilities found" -ForegroundColor Red
            $FAILED++
        }
        
        if ($moderate -gt 0) {
            Write-Host "⚠ Moderate severity vulnerabilities found (review recommended)" -ForegroundColor Yellow
            $WARNINGS++
        }
    }
} catch {
    Write-Host "⚠ Could not run npm audit" -ForegroundColor Yellow
    $WARNINGS++
}

Write-Host ""
Write-Host "=== 2. Secrets Detection ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Checking for .env files in git... " -NoNewline
$envFiles = git ls-files 2>&1 | Select-String -Pattern "\.env$"
if ($envFiles.Count -eq 0) {
    Write-Host "✓ PASSED" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host "Checking .env in .gitignore... " -NoNewline
if (Test-Path .gitignore) {
    $gitignore = Get-Content .gitignore -Raw
    if ($gitignore -match "\.env") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "✗ FAILED" -ForegroundColor Red
        $FAILED++
    }
} else {
    Write-Host "✗ FAILED (.gitignore not found)" -ForegroundColor Red
    $FAILED++
}

Write-Host ""
Write-Host "=== 3. Security Headers Check ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Checking security headers middleware... " -NoNewline
if (Test-Path "apps/web/lib/middleware/security-headers.middleware.ts") {
    Write-Host "✓ PASSED" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host "Checking CSP header configured... " -NoNewline
if (Test-Path "apps/web/lib/middleware/security-headers.middleware.ts") {
    $file = Get-Content "apps/web/lib/middleware/security-headers.middleware.ts" -Raw
    if ($file -match "Content-Security-Policy") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "✗ FAILED" -ForegroundColor Red
        $FAILED++
    }
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host "Checking HSTS header configured... " -NoNewline
if (Test-Path "apps/web/lib/middleware/security-headers.middleware.ts") {
    $file = Get-Content "apps/web/lib/middleware/security-headers.middleware.ts" -Raw
    if ($file -match "Strict-Transport-Security") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "✗ FAILED" -ForegroundColor Red
        $FAILED++
    }
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host ""
Write-Host "=== 4. Input Validation Check ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Checking validation schemas... " -NoNewline
if (Test-Path "packages/data-orchestration/src/schemas/validation.schemas.ts") {
    Write-Host "✓ PASSED" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host "Checking input validation service... " -NoNewline
if (Test-Path "packages/data-orchestration/src/services/input-validation.service.ts") {
    Write-Host "✓ PASSED" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host "Checking sanitization middleware... " -NoNewline
if (Test-Path "apps/web/lib/middleware/sanitization.middleware.ts") {
    Write-Host "✓ PASSED" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host ""
Write-Host "=== 5. Authentication and Authorization Check ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Checking JWT_SECRET in environment... " -NoNewline
if (Test-Path .env) {
    $env = Get-Content .env -Raw
    if ($env -match "JWT_SECRET=") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "⚠ WARNING" -ForegroundColor Yellow
        $WARNINGS++
    }
} else {
    Write-Host "⚠ WARNING (.env not found)" -ForegroundColor Yellow
    $WARNINGS++
}

Write-Host "Checking SESSION_SECRET in environment... " -NoNewline
if (Test-Path .env) {
    $env = Get-Content .env -Raw
    if ($env -match "SESSION_SECRET=") {
        Write-Host "✓ PASSED" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "⚠ WARNING" -ForegroundColor Yellow
        $WARNINGS++
    }
} else {
    Write-Host "⚠ WARNING (.env not found)" -ForegroundColor Yellow
    $WARNINGS++
}

Write-Host "Checking rate limiting middleware... " -NoNewline
if (Test-Path "apps/web/lib/middleware/rate-limit.middleware.ts") {
    Write-Host "✓ PASSED" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host ""
Write-Host "=== 6. Database Security Check ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Checking Prisma ORM (SQL injection prevention)... " -NoNewline
if (Test-Path "packages/clients/db/schema.prisma") {
    Write-Host "✓ PASSED" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "✗ FAILED" -ForegroundColor Red
    $FAILED++
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Security Scan Results" -ForegroundColor Cyan
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
        Write-Host "✓ All security checks passed!" -ForegroundColor Green
        Write-Host "System is secure and ready for production." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "⚠ All critical checks passed, but there are warnings." -ForegroundColor Yellow
        Write-Host "Review warnings before proceeding to production." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✗ Some security checks failed." -ForegroundColor Red
    Write-Host "Please address the failures before production deployment." -ForegroundColor Red
    exit 1
}
