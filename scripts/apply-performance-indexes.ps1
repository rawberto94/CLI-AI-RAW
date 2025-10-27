# Apply Performance Indexes Migration
# This script applies the rate card performance optimization indexes

Write-Host "🚀 Applying Rate Card Performance Indexes..." -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host "   Please set DATABASE_URL in your .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host "📊 Database Configuration:" -ForegroundColor Green
Write-Host "   URL: $($env:DATABASE_URL -replace 'postgresql://[^@]+@', 'postgresql://***@')" -ForegroundColor Gray
Write-Host ""

# Path to migration file
$migrationFile = "packages\clients\db\migrations\015_rate_card_performance_indexes.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERROR: Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Migration file: $migrationFile" -ForegroundColor Green
Write-Host ""

# Read migration content
$migrationContent = Get-Content $migrationFile -Raw

Write-Host "🔧 Applying migration..." -ForegroundColor Cyan
Write-Host ""

try {
    # Try using psql if available
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        Write-Host "   Using psql command..." -ForegroundColor Gray
        $migrationContent | psql $env:DATABASE_URL
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migration applied successfully!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  psql command not found" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Manual Migration Instructions:" -ForegroundColor Cyan
        Write-Host "   1. Install PostgreSQL client tools" -ForegroundColor Gray
        Write-Host "   2. Run the following command:" -ForegroundColor Gray
        Write-Host "      psql `$env:DATABASE_URL -f $migrationFile" -ForegroundColor White
        Write-Host ""
        Write-Host "   OR use a database GUI tool to execute the SQL in:" -ForegroundColor Gray
        Write-Host "      $migrationFile" -ForegroundColor White
        Write-Host ""
        
        # Show first few lines of migration
        Write-Host "📄 Migration Preview:" -ForegroundColor Cyan
        Write-Host "   ----------------------------------------" -ForegroundColor Gray
        $lines = $migrationContent -split "`n" | Select-Object -First 10
        foreach ($line in $lines) {
            Write-Host "   $line" -ForegroundColor Gray
        }
        Write-Host "   ..." -ForegroundColor Gray
        Write-Host "   ----------------------------------------" -ForegroundColor Gray
        Write-Host ""
        
        exit 0
    }
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: Failed to apply migration" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📊 Verifying indexes..." -ForegroundColor Cyan

# Verify indexes were created (if psql is available)
if (Get-Command psql -ErrorAction SilentlyContinue) {
    $verifyQuery = @"
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('rate_card_entries', 'rate_card_suppliers', 'benchmark_snapshots')
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
"@

    Write-Host ""
    Write-Host "   Indexes created:" -ForegroundColor Gray
    $verifyQuery | psql $env:DATABASE_URL -t
}

Write-Host ""
Write-Host "✅ Performance optimization complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Run integration tests: npm run test:rate-card-integration" -ForegroundColor Gray
Write-Host "   2. Run load tests: npm run test:rate-card-load" -ForegroundColor Gray
Write-Host "   3. Monitor performance: /rate-cards/performance" -ForegroundColor Gray
Write-Host ""
