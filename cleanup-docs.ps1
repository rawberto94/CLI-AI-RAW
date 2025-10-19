# Documentation Cleanup Script
# Removes redundant documentation files, keeping only essential ones

Write-Host "🧹 Cleaning up redundant documentation files..." -ForegroundColor Cyan
Write-Host ""

# Files to DELETE (redundant/old documentation)
$filesToDelete = @(
    # Old debugging/audit reports
    "ARTIFACT_COMPARISON.md",
    "ARTIFACT_ENHANCEMENT_PLAN.md",
    "ARTIFACT_IMPROVEMENTS_SUMMARY.md",
    "CLEANUP_COMPLETE.md",
    "CLI-TEST-GUIDE.md",
    "CODE_AUDIT_REPORT.md",
    "CONTRACT_UPLOAD_AUDIT.md",
    "CURRENT_ARTIFACTS_AUDIT.md",
    "DEBUG_REPORT.md",
    "DEBUGGING_COMPLETE.md",
    "DEEP_DEBUGGING_REPORT.md",
    "DONE.md",
    "FINAL_DEEP_DEBUGGING_SUMMARY.md",
    "FINAL_IMPLEMENTATION_SUMMARY.md",
    "FIXES_SUMMARY.md",
    "FOCUSED_ARTIFACT_IMPROVEMENTS.md",
    "FOCUSED_IMPROVEMENTS.md",
    "IMPLEMENTATION_COMPLETE.md",
    "IMPLEMENTATION_GUIDE.md",
    "IMPLEMENTATION_STEPS.md",
    "INTEGRATION_COMPLETE.md",
    "PERFORMANCE_FIXES_IMPLEMENTED.md",
    "PRODUCTION_FIXES_COMPLETE.md",
    "QUICK_START_IMPROVEMENTS.md",
    "QUICK_START_PERFORMANCE_FIXES.md",
    "README_ARTIFACT_ENHANCEMENTS.md",
    "START_HERE_DEBUGGING_RESULTS.md",
    "START_HERE_PRODUCTION_FIXES.md",
    "WHATS_LEFT_TODO.md",
    
    # Redundant procurement intelligence docs (keep only README)
    "PROCUREMENT_INTELLIGENCE_ALL_TASKS_COMPLETE.md",
    "PROCUREMENT_INTELLIGENCE_COMPLETE_SUMMARY.md",
    "PROCUREMENT_INTELLIGENCE_COMPLETE.md",
    "PROCUREMENT_INTELLIGENCE_FINAL_STATUS.md",
    "PROCUREMENT_INTELLIGENCE_IMPLEMENTATION_STATUS.md",
    "PROCUREMENT_INTELLIGENCE_PHASE1_COMPLETE.md",
    "PROCUREMENT_INTELLIGENCE_PHASE2_COMPLETE.md",
    "PROCUREMENT_INTELLIGENCE_PHASE3_COMPLETE.md",
    "PROCUREMENT_INTELLIGENCE_PHASE3_PLAN.md",
    "PROCUREMENT_INTELLIGENCE_PHASE3_PROGRESS.md",
    "PROCUREMENT_INTELLIGENCE_QUICK_REFERENCE.md",
    "PROCUREMENT_INTELLIGENCE_SUMMARY.md",
    "START_HERE_PROCUREMENT_COMPLETE.md",
    "START_HERE_PROCUREMENT_INTELLIGENCE.md",
    
    # Redundant RAG docs (keep only GUIDE)
    "RAG_INTEGRATION_COMPLETE.md",
    "RAG_INTEGRATION_QUICK_START.md",
    "START_HERE_RAG_INTEGRATION.md",
    
    # Redundant run system docs (consolidate to fewer files)
    "COMPLETE_RUN_SYSTEM.md",
    "EASY_RUN_SUMMARY.md",
    "START_HERE_EASY_RUN.md",
    
    # Old setup/environment docs (replaced by new ones)
    "ENVIRONMENT_SETUP_GUIDE.md",
    "EXECUTIVE_SUMMARY.md",
    "START_HERE.md",
    
    # Old test files
    "CLI-Test-Suite.ps1",
    "CLI-Test-Suite.ts",
    "deep-code-analysis.js",
    "test-production-fixes.js",
    "seed-test-data.cjs",
    "seed-test-data.ts",
    
    # Old shell scripts (replaced by run.ps1)
    "check-services.sh",
    "fix-and-start.sh",
    "launch.sh",
    "start-persistent.sh",
    "start-simple.sh",
    "update-from-git.sh"
)

# Files to KEEP (essential documentation)
$filesToKeep = @(
    # Core documentation
    "README.md",
    "SETUP.md",
    
    # Run system (new, essential)
    "README_RUN_SYSTEM.md",
    "QUICK_START.md",
    "RUN_GUIDE.md",
    "VISUAL_QUICK_START.md",
    "run.ps1",
    "START.bat",
    
    # Environment files
    ".env",
    ".env.example",
    ".env.complete",
    ".env.production.example",
    
    # Feature documentation (keep one per feature)
    "PROCUREMENT_INTELLIGENCE_README.md",
    "RAG_INTEGRATION_GUIDE.md",
    "UNIFIED_ORCHESTRATION_COMPLETE.md",
    "SYSTEM_INTEGRATION_ANALYSIS.md",
    "SYSTEM_ARCHITECTURE.md",
    
    # Test guide
    "QUICK_TEST_GUIDE.md",
    
    # Docker compose files
    "docker-compose.dev.yml",
    "docker-compose.prod.yml",
    "docker-compose.rag.yml",
    
    # Config files
    "package.json",
    "tsconfig.json",
    "tsconfig.base.json",
    "eslint.config.js",
    "prettier.config.js",
    "turbo.json",
    "knip.config.json",
    "lighthouserc.json",
    "ecosystem.config.cjs",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    
    # Git files
    ".gitignore",
    ".eslintignore"
)

$deletedCount = 0
$notFoundCount = 0

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "✓ Deleted: $file" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "✗ Failed to delete: $file" -ForegroundColor Red
        }
    } else {
        $notFoundCount++
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Cleanup Summary:" -ForegroundColor Cyan
Write-Host "  Deleted: $deletedCount files" -ForegroundColor Green
Write-Host "  Not found: $notFoundCount files" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Essential documentation kept:" -ForegroundColor Cyan
Write-Host "  README.md - Project overview" -ForegroundColor White
Write-Host "  README_RUN_SYSTEM.md - Run system index" -ForegroundColor White
Write-Host "  QUICK_START.md - Quick start guide" -ForegroundColor White
Write-Host "  RUN_GUIDE.md - Complete run guide" -ForegroundColor White
Write-Host "  VISUAL_QUICK_START.md - Visual guide" -ForegroundColor White
Write-Host "  SETUP.md - Setup instructions" -ForegroundColor White
Write-Host "  Feature guides" -ForegroundColor White
Write-Host ""
