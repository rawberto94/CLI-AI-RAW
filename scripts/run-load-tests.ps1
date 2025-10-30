# Production Readiness Load Testing Script (PowerShell)
# 
# This script runs comprehensive load tests to verify production readiness
# 
# Usage:
#   .\scripts\run-load-tests.ps1 [-Url <url>] [-Quick] [-Full]
#
# Parameters:
#   -Url <url>       Base URL for testing (default: http://localhost:3005)
#   -Quick           Run quick tests (reduced load)
#   -Full            Run full test suite (default)
#   -Help            Show this help message

param(
    [string]$Url = "http://localhost:3005",
    [switch]$Quick,
    [switch]$Full,
    [switch]$Help
)

# Show help if requested
if ($Help) {
    Write-Host "Production Readiness Load Testing Script"
    Write-Host ""
    Write-Host "Usage: .\scripts\run-load-tests.ps1 [parameters]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -Url <url>       Base URL for testing (default: http://localhost:3005)"
    Write-Host "  -Quick           Run quick tests (reduced load)"
    Write-Host "  -Full            Run full test suite (default)"
    Write-Host "  -Help            Show this help message"
    exit 0
}

# Set test mode
$TestMode = if ($Quick) { "quick" } else { "full" }

# Use environment variable if set, otherwise use parameter
$BaseUrl = if ($env:TEST_BASE_URL) { $env:TEST_BASE_URL } else { $Url }

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║     Production Readiness Load Testing Suite                   ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Check if server is running
Write-Host "Checking if server is running at $BaseUrl..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Server is running" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Server is not running at $BaseUrl" -ForegroundColor Red
    Write-Host "Please start the server first:" -ForegroundColor Yellow
    Write-Host "  npm run dev"
    exit 1
}
Write-Host ""

# Display test configuration
Write-Host "Test Configuration:" -ForegroundColor Blue
Write-Host "  Base URL: $BaseUrl"
Write-Host "  Test Mode: $TestMode"
Write-Host ""

# Set environment variable
$env:TEST_BASE_URL = $BaseUrl

# Run production readiness load tests
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "Running Production Readiness Load Tests" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""

$ProdTestsPassed = $false
try {
    npx tsx packages/data-orchestration/test/load/production-readiness-load-test.ts
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Production readiness load tests passed" -ForegroundColor Green
        $ProdTestsPassed = $true
    } else {
        Write-Host ""
        Write-Host "✗ Production readiness load tests failed" -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "✗ Production readiness load tests failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║     Load Testing Summary                                       ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

if ($ProdTestsPassed) {
    Write-Host "✅ All load tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "System is ready for production deployment." -ForegroundColor Green
    Write-Host ""
    Write-Host "Performance targets met:"
    Write-Host "  ✓ Concurrent Users: 100+"
    Write-Host "  ✓ SSE Connections: 100+"
    Write-Host "  ✓ API Response Time: <200ms (P95)"
    Write-Host "  ✓ Success Rate: >95%"
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ Some load tests failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Review the test output above for details." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common issues:"
    Write-Host "  • Database query optimization needed"
    Write-Host "  • Connection pool configuration"
    Write-Host "  • Cache configuration"
    Write-Host "  • Resource limits (CPU, memory)"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Review failed test details"
    Write-Host "  2. Check application logs"
    Write-Host "  3. Monitor system resources"
    Write-Host "  4. Optimize as needed"
    Write-Host "  5. Re-run tests"
    Write-Host ""
    exit 1
}
