#!/usr/bin/env pwsh

# Comprehensive Cleanup - Remove ALL unused directories and files

Write-Host "COMPREHENSIVE CLEANUP - Scanning entire repository" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

$toRemove = @(
    # Unused apps
    "apps/workers",
    "apps/api",
    "apps/core",
    
    # Unused packages
    "packages/ai-providers",
    
    # Unused components
    "apps/web/components/rag",
    "apps/web/components/dashboard/WhatsNewWidget.tsx",
    "apps/web/components/dashboard/DashboardViewManager.tsx",
    "apps/web/components/dashboard/QuickActionsBar.tsx",
    
    # Unused hooks
    "apps/web/hooks/useRateBenchmarkingData.ts",
    
    # Unused pages
    "apps/web/app/analytics/intelligence",
    "apps/web/app/contracts/[id]/state-of-the-art",
    "apps/web/app/contracts/[id]/enhanced",
    
    # Unused lib files
    "apps/web/lib/mock-data",
    
    # Unused providers
    "packages/data-orchestration/src/providers",
    
    # Unused services
    "packages/data-orchestration/src/services/rag-integration.service.ts",
    "packages/data-orchestration/src/services/unified-orchestration.service.ts",
    
    # Unused utils
    "packages/data-orchestration/src/utils/expression-parser.ts",
    
    # Unused DAL
    "packages/data-orchestration/src/dal/artifact-database.adaptor.ts",
    
    # Old specs
    ".kiro/specs/production-data-pipeline",
    ".kiro/specs/production-data-architecture-audit",
    ".kiro/specs/ux-quick-wins",
    ".kiro/specs/end-to-end-data-flow-integration",
    ".kiro/specs/procurement-intelligence-consolidation",
    ".kiro/specs/editable-artifact-repository",
    
    # Unused scripts
    "scripts/smoke-test.mjs",
    "scripts/launch.mjs",
    "scripts/batch-upload.mjs",
    "scripts/analyze-usage.ps1",
    "scripts/deep-cleanup.ps1",
    "scripts/final-cleanup.ps1",
    "scripts/cleanup-unused-files.ps1",
    "scripts/cleanup-stub-apis.ps1",
    
    # Unused docs
    "docs",
    "CLEANUP_SUMMARY.md",
    
    # Unused config files
    "knip.config.json",
    "eslint.config.js",
    "lighthouserc.json",
    "vitest.config.ts",
    
    # Unused infra
    "infra",
    ".devcontainer",
    "docker-compose.yml",
    "Dockerfile",
    
    # Unused test directories
    "apps/web/__tests__",
    "packages/data-orchestration/src/__tests__"
)

Write-Host "`nScanning for unused items..." -ForegroundColor Yellow

$existing = @()
foreach ($item in $toRemove) {
    if (Test-Path $item) {
        $existing += $item
    }
}

if ($existing.Count -eq 0) {
    Write-Host "No unused items found" -ForegroundColor Green
    exit 0
}

Write-Host "`nFound $($existing.Count) unused items:" -ForegroundColor Yellow
foreach ($item in $existing) {
    if (Test-Path $item -PathType Container) {
        $size = (Get-ChildItem $item -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "  [DIR] $item (~$([math]::Round($size, 2))MB)" -ForegroundColor Red
    } else {
        Write-Host "  [FILE] $item" -ForegroundColor Red
    }
}

Write-Host "`nRemove these items? (y/N): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host "`nRemoving items..." -ForegroundColor Red

$removed = 0
$totalSize = 0

foreach ($item in $existing) {
    try {
        if (Test-Path $item -PathType Container) {
            $size = (Get-ChildItem $item -Recurse -File | Measure-Object -Property Length -Sum).Sum
            $totalSize += $size
        }
        Remove-Item $item -Recurse -Force
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
Write-Host "Space saved: ~$([math]::Round($totalSize / 1MB, 2))MB" -ForegroundColor Cyan
