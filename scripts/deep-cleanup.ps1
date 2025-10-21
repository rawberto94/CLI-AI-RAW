#!/usr/bin/env pwsh

# Deep Repository Cleanup - Phase 2

Write-Host "🧹 DEEP CLEANUP - Phase 2" -ForegroundColor Cyan

$filesToRemove = @(
    # Old spec documentation
    ".kiro/specs/editable-artifact-repository/INTEGRATION_COMPLETE.md",
    ".kiro/specs/editable-artifact-repository/INTEGRATION_GUIDE.md",
    ".kiro/specs/editable-artifact-repository/STATUS_UPDATE.md",
    ".kiro/specs/editable-artifact-repository/FINAL_SUMMARY.md",
    ".kiro/specs/editable-artifact-repository/DEPLOYMENT_CHECKLIST.md",
    ".kiro/specs/editable-artifact-repository/USER_GUIDE.md",
    ".kiro/specs/editable-artifact-repository/API_DOCUMENTATION.md",
    ".kiro/specs/editable-artifact-repository/TEST_RESULTS.md",
    ".kiro/specs/editable-artifact-repository/REMAINING_WORK.md",
    ".kiro/specs/editable-artifact-repository/IMPLEMENTATION_COMPLETE.md",
    ".kiro/specs/editable-artifact-repository/PHASE_1-5_COMPLETE.md",
    ".kiro/specs/editable-artifact-repository/IMPLEMENTATION_STATUS.md",
    ".kiro/specs/editable-artifact-repository/FINAL_CHECKLIST.md",
    ".kiro/specs/editable-artifact-repository/DATABASE_CHANGES.md",
    ".kiro/specs/websocket/WEBSOCKET_STATUS.md",
    ".kiro/specs/websocket/WEBSOCKET_INTEGRATION_FIX.md",
    ".kiro/specs/ui-enhancement/CONTRACT_DETAIL_UI_AUDIT.md",
    ".kiro/specs/data-flow-audit/ORCHESTRATION_GAPS_ANALYSIS.md",
    ".kiro/specs/data-flow-audit/INTEGRATION_COMPLETE.md",
    ".kiro/specs/data-flow-audit/COMPLETE_DATA_FLOW_ANALYSIS.md",
    ".kiro/specs/data-mode-toggle/IMPLEMENTATION_GUIDE.md",
    ".kiro/specs/procurement-intelligence-consolidation/REPOSITORY_AUDIT.md",
    
    # Old root documentation
    "COMPLETE_SETUP_GUIDE.md",
    "SETUP_OPENAI_GUIDE.md",
    "IMPLEMENTATION_CHECKLIST.md",
    "HOW_TO_SEE_NEW_COMPONENTS.md",
    "EDITABLE_ARTIFACTS_PUSH_SUMMARY.md",
    "PUSH_COMPLETE.md",
    "EVERYTHING_YOU_NEED.md",
    "START_HERE.md",
    "SETUP.md",
    
    # Duplicate/unused pages
    "apps/web/app/test-editable-artifacts",
    "apps/web/app/contracts/[id]/enhanced",
    "apps/web/app/contracts/enhanced-v2",
    "apps/web/app/contracts/[id]/state-of-the-art",
    "apps/web/app/use-cases",
    "apps/web/app/taxonomy",
    "apps/web/app/analytics/procurement-intelligence-demo",
    
    # Unused API routes
    "apps/web/app/api/contracts/enhanced",
    "apps/web/app/api/contracts/search/enhanced",
    "apps/web/app/api/intelligence",
    "apps/web/app/api/taxonomy",
    "apps/web/app/api/database",
    "apps/web/app/api/savings-calculator",
    "apps/web/app/api/market-intelligence",
    "apps/web/app/api/supplier-benchmarks",
    
    # Unused components
    "apps/web/components/automation/WorkflowAutomation.tsx",
    "apps/web/components/search/IntelligentSearch.tsx",
    "apps/web/components/notifications/IntelligenceNotifications.tsx",
    "apps/web/components/dashboard/IntelligenceDashboard.tsx",
    "apps/web/components/contracts/ContractMetadataPanel.tsx",
    "apps/web/components/contracts/ContractMetadataEditor.tsx",
    
    # Unused services
    "packages/data-orchestration/src/services/workflow.service.ts",
    "packages/data-orchestration/src/services/analytics.service.ts",
    "packages/data-orchestration/src/services/intelligence.service.ts",
    
    # Unused library files
    "apps/web/lib/artifact-generator-enhanced.ts",
    "apps/web/lib/contract-integration.ts",
    
    # Old setup scripts
    "setup-complete.sh",
    "setup-complete.ps1",
    "scripts/fix-websocket.ps1",
    "scripts/create-artifact-services.ps1",
    "scripts/run-integration-tests.ps1",
    
    # Unused test files
    "apps/web/__tests__/e2e/artifact-editing-workflow.test.ts",
    "apps/web/__tests__/api/artifact-editing.test.ts",
    "apps/web/__tests__/procurement-use-cases.test.ts",
    "packages/data-orchestration/src/__tests__/artifact-change-propagation.service.test.ts",
    "packages/data-orchestration/src/__tests__/editable-artifact.service.test.ts",
    
    # Unused schema extensions
    "packages/data-orchestration/prisma/schema-extensions.prisma",
    "packages/clients/db/schema-cost-savings.prisma",
    
    # Old migration files
    "packages/clients/db/migrations/013_editable_artifacts_rollback.sql",
    "packages/clients/db/migrations/007_UX_MIGRATION_README.md",
    
    # Unused event/lineage files
    "packages/data-orchestration/src/events/intelligence-events.ts",
    "packages/data-orchestration/src/lineage/data-lineage.ts"
)

$existing = @()
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        $existing += $file
    }
}

if ($existing.Count -eq 0) {
    Write-Host "✅ No additional unused files found!" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($existing.Count) files/directories to remove:" -ForegroundColor Yellow
foreach ($file in $existing) {
    Write-Host "   ❌ $file" -ForegroundColor Red
}

Write-Host "`n🤔 Remove these files? (y/N): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "⏭️  Cleanup cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nRemoving files..." -ForegroundColor Red

$removed = 0
foreach ($file in $existing) {
    try {
        if (Test-Path $file) {
            Remove-Item $file -Recurse -Force
            Write-Host "   ✅ Removed: $file" -ForegroundColor Green
            $removed++
        }
    } catch {
        Write-Host "   ❌ Failed: $file" -ForegroundColor Red
    }
}

Write-Host "`n📊 Removed $removed files/directories" -ForegroundColor Cyan
Write-Host "🎉 Deep cleanup complete!" -ForegroundColor Green
