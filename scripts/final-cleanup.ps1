#!/usr/bin/env pwsh

# Final Cleanup - Remove all unused files based on actual system usage

Write-Host "FINAL CLEANUP - Removing unused files" -ForegroundColor Cyan

$toRemove = @(
    # Unused RAG pages (RAG system not fully integrated)
    "apps/web/app/rag",
    
    # Unused analytics pages (stubs/demos)
    "apps/web/app/analytics/ux-metrics",
    "apps/web/app/analytics/enhanced-rate-intelligence",
    "apps/web/app/analytics/rate-management",
    "apps/web/app/analytics/data-standardization",
    "apps/web/app/analytics/rate-intelligence",
    "apps/web/app/analytics/professional-dashboard",
    "apps/web/app/analytics/enhanced-dashboard",
    "apps/web/app/contracts/[id]/enhanced",
    "apps/web/app/contracts/[id]/state-of-the-art",
    
    # Unused use-case components (not integrated)
    "apps/web/components/use-cases",
    
    # Unused UI components
    "apps/web/components/celebrations",
    "apps/web/components/keyboard",
    "apps/web/components/command",
    "apps/web/components/onboarding",
    "apps/web/components/progress/MultiStageProgress.tsx",
    "apps/web/components/upload/BatchUploadQueue.tsx",
    "apps/web/components/background-jobs",
    "apps/web/components/error-boundaries/UXErrorBoundary.tsx",
    "apps/web/components/analytics/PerformanceAnalytics.tsx",
    
    # Unused RAG services (not integrated)
    "packages/data-orchestration/src/services/rag/federated-rag.service.ts",
    "packages/data-orchestration/src/services/rag/rag-security.service.ts",
    "packages/data-orchestration/src/services/rag/rag-observability.service.ts",
    "packages/data-orchestration/src/services/rag/rag-learning.service.ts",
    "packages/data-orchestration/src/services/rag/rag-analytics.service.ts",
    "packages/data-orchestration/src/services/rag/multi-modal-rag.service.ts",
    "packages/data-orchestration/src/services/rag/cross-contract-intelligence.service.ts",
    "packages/data-orchestration/src/services/rag/advanced-rag.service.ts",
    "packages/data-orchestration/src/services/rag/knowledge-graph.service.ts",
    "packages/data-orchestration/src/services/rag/unified-rag-orchestrator.service.ts",
    "packages/data-orchestration/src/services/rag/hybrid-rag.service.ts",
    "packages/data-orchestration/src/services/rag/rag-persistence-integration.ts",
    
    # Unused analytical engines (not integrated)
    "packages/data-orchestration/src/services/analytical-engines",
    "packages/data-orchestration/src/services/analytical-intelligence.service.ts",
    "packages/data-orchestration/src/services/analytical-database.service.ts",
    "packages/data-orchestration/src/services/analytical-sync.service.ts",
    "packages/data-orchestration/src/events/analytical-events.ts",
    "packages/data-orchestration/src/events/analytical-event-publisher.ts",
    
    # Unused rate card services
    "packages/data-orchestration/src/services/rate-validation.service.ts",
    "packages/data-orchestration/src/services/enhanced-rate-analytics.service.ts",
    "packages/data-orchestration/src/services/rate-calculation.engine.ts",
    "packages/data-orchestration/src/services/rate-card-management.service.ts",
    "packages/data-orchestration/src/services/data-standardization.service.ts",
    "packages/data-orchestration/src/services/rate-card-intelligence.service.ts",
    "packages/data-orchestration/src/services/taxonomy.service.ts",
    "packages/data-orchestration/src/services/database-optimization.service.ts",
    "packages/data-orchestration/src/services/contract-indexing.service.ts",
    
    # Unused API routes
    "apps/web/app/api/analytics/ux-metrics",
    "apps/web/app/api/analytics/rate-calculation",
    "apps/web/app/api/analytics/rate-validation",
    "apps/web/app/api/analytics/enhanced-rate-analytics",
    "apps/web/app/api/analytics/rate-management",
    "apps/web/app/api/analytics/data-standardization",
    "apps/web/app/api/analytics/rate-intelligence",
    "apps/web/app/api/analytics/dashboard",
    "apps/web/app/api/analytics/intelligence",
    "apps/web/app/api/dashboard",
    "apps/web/app/api/background-jobs",
    "apps/web/app/api/progress",
    "apps/web/app/api/user/preferences",
    "apps/web/app/api/rag",
    "apps/web/app/api/orchestration",
    "apps/web/app/api/test-connections",
    "apps/web/app/api/contracts/[id]/metadata",
    
    # Unused library files
    "apps/web/lib/monitoring",
    "apps/web/lib/analytics/ux-metrics-collector.ts",
    "apps/web/lib/keyboard-shortcuts.ts",
    "apps/web/lib/dashboard",
    "apps/web/lib/services/contract-processing-with-progress.ts",
    "apps/web/lib/services/progress-tracking.service.ts",
    "apps/web/lib/services/analytical-intelligence.service.ts",
    "apps/web/lib/websocket",
    "apps/web/lib/artifact-trigger.ts",
    
    # Unused test scripts
    "scripts/test-rag.ts",
    "scripts/test-rag-integration.ts",
    "scripts/test-procurement-intelligence.ts",
    "scripts/test-data-flow.ts",
    "scripts/test-artifact-system.ts",
    
    # Unused init scripts
    "packages/data-orchestration/src/scripts/init-analytical-db.ts",
    "packages/data-orchestration/src/scripts/init-orchestration.ts",
    "packages/data-orchestration/src/scripts/seed-rag-data.ts",
    "packages/data-orchestration/src/scripts/seed-enhanced-rate-data.ts",
    
    # Unused DAL adaptors
    "packages/data-orchestration/src/dal/rag-database.adaptor.ts",
    
    # Unused migrations
    "packages/data-orchestration/prisma/migrations/001_analytical_intelligence_schema.sql",
    "packages/data-orchestration/prisma/migrations/002_data_standardization_schema.sql",
    "packages/data-orchestration/prisma/migrations/003_enhanced_rate_card_schema.sql",
    "packages/data-orchestration/prisma/migrations/010_rag_persistence_schema.sql",
    "packages/data-orchestration/prisma/analytical-schema-extensions.prisma",
    
    # Unused types
    "packages/data-orchestration/src/types/enhanced-rate-card.types.ts",
    
    # Unused tests
    "packages/data-orchestration/src/__tests__/rag-integration.test.ts",
    "packages/data-orchestration/src/utils/__tests__/expression-parser.test.ts",
    
    # Old specs
    ".kiro/specs/analytical-intelligence-layer",
    ".kiro/specs/unified-rag-system",
    ".kiro/specs/enhanced-rate-card-schema",
    ".kiro/specs/data-mode-toggle",
    ".kiro/specs/data-flow-audit",
    ".kiro/specs/ui-enhancement",
    ".kiro/specs/websocket",
    
    # Unused UI files
    "apps/web/components/ui/empty-states.tsx",
    "apps/web/components/ui/skeletons.tsx",
    "apps/web/components/ui/interactive-elements.tsx",
    "apps/web/components/ui/data-visualization.tsx",
    "apps/web/components/ui/loading-states.tsx",
    "apps/web/components/ui/enhanced-card.tsx",
    "apps/web/components/ui/command.tsx",
    "apps/web/styles/animations.css",
    
    # Unused server file
    "apps/web/server.js",
    
    # Unused docs
    "docs/USER_GUIDE_RENEWAL_RADAR.md",
    "docs/USER_GUIDE_NEGOTIATION_PREP.md",
    "docs/USER_GUIDE_SUPPLIER_ANALYTICS.md",
    "docs/MIGRATION_GUIDE.md",
    "docs/API_DOCUMENTATION.md",
    
    # Unused env files
    ".env.complete",
    ".env.production.example",
    
    # Unused run script
    "run.ps1"
)

$existing = @()
foreach ($item in $toRemove) {
    if (Test-Path $item) {
        $existing += $item
    }
}

if ($existing.Count -eq 0) {
    Write-Host "No unused files found" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($existing.Count) unused items" -ForegroundColor Yellow
Write-Host ""

foreach ($item in $existing) {
    Write-Host "  - $item" -ForegroundColor Red
}

Write-Host ""
Write-Host "Remove these files? (y/N): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Removing files..." -ForegroundColor Red

$removed = 0
foreach ($item in $existing) {
    try {
        Remove-Item $item -Recurse -Force
        Write-Host "  Removed: $item" -ForegroundColor Green
        $removed++
    } catch {
        Write-Host "  Failed: $item" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Removed $removed items" -ForegroundColor Cyan
Write-Host "Cleanup complete!" -ForegroundColor Green
