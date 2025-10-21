#!/usr/bin/env pwsh

# Systematic Cleanup - Remove all unused demo/showcase pages and files

Write-Host "SYSTEMATIC CLEANUP - Removing demo and unused pages" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

$toRemove = @(
    # Demo/Showcase pages (not production features)
    "apps/web/app/ai-intelligence",
    "apps/web/app/automation",
    "apps/web/app/bpo-demo",
    "apps/web/app/pilot-demo",
    "apps/web/app/integration-demo",
    "apps/web/app/futuristic-contracts",
    "apps/web/app/ui-showcase",
    "apps/web/app/mvp",
    "apps/web/app/api-docs",
    "apps/web/app/cross-contract-analysis",
    "apps/web/app/drafts",
    "apps/web/app/system",
    
    # Unused analytics pages
    "apps/web/app/analytics/portfolio",
    "apps/web/app/analytics/risk",
    "apps/web/app/analytics/compliance",
    
    # Unused contract pages
    "apps/web/app/contracts/enhanced",
    "apps/web/app/contracts/page-backup.tsx",
    "apps/web/app/contracts/[id]/enhanced",
    "apps/web/app/contracts/[id]/state-of-the-art",
    
    # Unused components referenced in layout but deleted
    "apps/web/components/FloatingDemoButton.tsx",
    "apps/web/components/OnboardingWrapper.tsx",
    
    # Unused styles
    "apps/web/styles/rate-benchmarking-animations.css",
    
    # Unused lib directories
    "apps/web/app/lib",
    "apps/web/app/components",
    
    # Unused API routes
    "apps/web/app/api/assistant",
    "apps/web/app/api/business-insights",
    "apps/web/app/api/chat",
    "apps/web/app/api/benchmarks",
    "apps/web/app/api/portfolio-metrics",
    "apps/web/app/api/v2",
    "apps/web/app/api/middleware",
    "apps/web/app/api/_health",
    "apps/web/app/api/web-health",
    
    # Unused services in data-orchestration
    "packages/data-orchestration/src/services/hybrid-artifact-storage.service.ts",
    "packages/data-orchestration/src/services/smart-cache.service.ts",
    "packages/data-orchestration/src/services/enhanced-savings-opportunities.service.ts",
    
    # Unused DAL
    "packages/data-orchestration/src/dal/enhanced-database.adaptor.ts",
    
    # Unused events
    "packages/data-orchestration/src/events",
    
    # Unused utils
    "packages/data-orchestration/src/utils",
    
    # Unused scripts
    "packages/data-orchestration/src/scripts",
    "packages/clients/db/scripts/verify-ux-schema.ts",
    "packages/clients/db/scripts/run-performance-migrations.ts",
    
    # Unused migrations (old/unused schemas)
    "packages/data-orchestration/prisma",
    "packages/clients/db/migrations/007_ux_quick_wins_schema.sql",
    
    # Unused error boundaries
    "apps/web/components/error-boundaries",
    
    # Unused dashboard components
    "apps/web/components/dashboard/CostSavingsDashboardWidget.tsx",
    
    # Unused hooks
    "apps/web/hooks/useProcurementIntelligence.ts",
    
    # Unused middleware
    "apps/web/lib/middleware/tenant-validation.ts"
)

Write-Host "`nScanning for items to remove..." -ForegroundColor Yellow

$existing = @()
$totalSize = 0

foreach ($item in $toRemove) {
    if (Test-Path $item) {
        if (Test-Path $item -PathType Container) {
            $size = (Get-ChildItem $item -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            $totalSize += $size
            $sizeMB = [math]::Round($size / 1MB, 2)
            Write-Host "  [DIR] $item ($sizeMB MB)" -ForegroundColor Red
        } else {
            $size = (Get-Item $item).Length
            $totalSize += $size
            Write-Host "  [FILE] $item" -ForegroundColor Red
        }
        $existing += $item
    }
}

if ($existing.Count -eq 0) {
    Write-Host "`nNo items found to remove" -ForegroundColor Green
    exit 0
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "Found $($existing.Count) items" -ForegroundColor Yellow
Write-Host "Total size: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Cyan

Write-Host "`nRemove these items? (y/N): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host "`nRemoving items..." -ForegroundColor Red

$removed = 0
foreach ($item in $existing) {
    try {
        Remove-Item $item -Recurse -Force -ErrorAction Stop
        Write-Host "  Removed: $item" -ForegroundColor Green
        $removed++
    } catch {
        Write-Host "  Failed: $item - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Removed: $removed items" -ForegroundColor Cyan
Write-Host "Space saved: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Cyan
