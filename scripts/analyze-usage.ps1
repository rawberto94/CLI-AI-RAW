#!/usr/bin/env pwsh

# Comprehensive Usage Analysis
# Scans the entire codebase to identify what's actually used

Write-Host "🔍 ANALYZING CODEBASE USAGE..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

$results = @{
    UnusedPages = @()
    UnusedComponents = @()
    UnusedServices = @()
    UnusedAPIs = @()
    UnusedSpecs = @()
    UnusedScripts = @()
}

# 1. ANALYZE PAGES - Check if they're linked in navigation or used
Write-Host "`n📄 Analyzing pages..." -ForegroundColor Yellow

$allPages = Get-ChildItem "apps/web/app" -Recurse -Filter "page.tsx" | Where-Object { $_.FullName -notmatch "node_modules" }

foreach ($page in $allPages) {
    $relativePath = $page.FullName.Replace((Get-Location).Path + "\", "")
    $pageName = $page.Directory.Name
    
    # Skip essential pages
    if ($pageName -match "^(page|layout|loading|error|not-found)$") { continue }
    
    # Check if page is referenced anywhere
    $searchPattern = $pageName
    $usages = Get-ChildItem "apps/web" -Recurse -Include "*.tsx","*.ts" | Select-String $searchPattern -Quiet
    
    if (-not $usages) {
        $results.UnusedPages += $relativePath
    }
}

# 2. ANALYZE COMPONENTS - Check if imported anywhere
Write-Host "🧩 Analyzing components..." -ForegroundColor Yellow

$componentDirs = @(
    "apps/web/components/use-cases",
    "apps/web/components/rag",
    "apps/web/components/error-boundaries",
    "apps/web/components/celebrations",
    "apps/web/components/keyboard",
    "apps/web/components/upload",
    "apps/web/components/background-jobs",
    "apps/web/components/dashboard",
    "apps/web/components/onboarding",
    "apps/web/components/command",
    "apps/web/components/progress",
    "apps/web/components/analytics"
)

foreach ($dir in $componentDirs) {
    if (Test-Path $dir) {
        $components = Get-ChildItem $dir -Recurse -Filter "*.tsx"
        foreach ($comp in $components) {
            $compName = [System.IO.Path]::GetFileNameWithoutExtension($comp.Name)
            
            # Search for imports of this component
            $pattern = "from.*$compName|import.*$compName"
            $usages = Get-ChildItem "apps/web/app" -Recurse -Include "*.tsx","*.ts" | Select-String $pattern -Quiet
            
            if (-not $usages) {
                $results.UnusedComponents += $comp.FullName.Replace((Get-Location).Path + "\", "")
            }
        }
    }
}

# 3. ANALYZE SERVICES - Check if imported
Write-Host "⚙️ Analyzing services..." -ForegroundColor Yellow

$serviceDirs = @(
    "packages/data-orchestration/src/services/rag",
    "packages/data-orchestration/src/services/analytical-engines"
)

foreach ($dir in $serviceDirs) {
    if (Test-Path $dir) {
        $services = Get-ChildItem $dir -Recurse -Filter "*.ts" | Where-Object { $_.Name -notmatch "test" }
        foreach ($service in $services) {
            $serviceName = [System.IO.Path]::GetFileNameWithoutExtension($service.Name)
            
            # Search for imports
            $pattern = "from.*$serviceName|import.*$serviceName"
            $usages = Get-ChildItem "apps/web","packages/data-orchestration/src" -Recurse -Include "*.tsx","*.ts" | Select-String $pattern -Quiet
            
            if (-not $usages) {
                $results.UnusedServices += $service.FullName.Replace((Get-Location).Path + "\", "")
            }
        }
    }
}

# 4. ANALYZE API ROUTES - Check if called from frontend
Write-Host "🔌 Analyzing API routes..." -ForegroundColor Yellow

$apiRoutes = Get-ChildItem "apps/web/app/api" -Recurse -Filter "route.ts"

foreach ($route in $apiRoutes) {
    $apiPath = $route.Directory.FullName.Replace((Get-Location).Path + "\apps\web\app\api\", "").Replace("\", "/")
    
    # Check if this API path is called anywhere
    $pattern = "/api/$apiPath"
    $usages = Get-ChildItem "apps/web" -Recurse -Include "*.tsx","*.ts" | Select-String $pattern -Quiet
    
    if (-not $usages) {
        $results.UnusedAPIs += $route.FullName.Replace((Get-Location).Path + "\", "")
    }
}

# 5. ANALYZE SPECS - Check modification date
Write-Host "📋 Analyzing specs..." -ForegroundColor Yellow

if (Test-Path ".kiro/specs") {
    $specs = Get-ChildItem ".kiro/specs" -Directory
    foreach ($spec in $specs) {
        $files = Get-ChildItem $spec.FullName -File -Recurse
        if ($files) {
            $lastModified = ($files | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
            $daysSince = ((Get-Date) - $lastModified).Days
            
            # If not modified in 30 days, likely unused
            if ($daysSince -gt 30) {
                $results.UnusedSpecs += $spec.FullName.Replace((Get-Location).Path + "\", "")
            }
        }
    }
}

# 6. ANALYZE SCRIPTS - Check if referenced
Write-Host "🔧 Analyzing scripts..." -ForegroundColor Yellow

$scripts = Get-ChildItem "scripts" -Filter "*.ps1","*.sh","*.mjs","*.ts" | Where-Object { $_.Name -notmatch "setup|cleanup" }

foreach ($script in $scripts) {
    $scriptName = $script.Name
    
    # Check if mentioned in package.json or docs
    $usages = Get-ChildItem "." -Include "package.json","*.md" -Recurse | Select-String $scriptName -Quiet
    
    if (-not $usages) {
        $results.UnusedScripts += $script.FullName.Replace((Get-Location).Path + "\", "")
    }
}

# SUMMARY
Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "📊 USAGE ANALYSIS RESULTS" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

$totalUnused = 0

if ($results.UnusedPages.Count -gt 0) {
    Write-Host "`n📄 Unused Pages ($($results.UnusedPages.Count)):" -ForegroundColor Yellow
    $results.UnusedPages | ForEach-Object { Write-Host "   ❌ $_" -ForegroundColor Red }
    $totalUnused += $results.UnusedPages.Count
}

if ($results.UnusedComponents.Count -gt 0) {
    Write-Host "`n🧩 Unused Components ($($results.UnusedComponents.Count)):" -ForegroundColor Yellow
    $results.UnusedComponents | ForEach-Object { Write-Host "   ❌ $_" -ForegroundColor Red }
    $totalUnused += $results.UnusedComponents.Count
}

if ($results.UnusedServices.Count -gt 0) {
    Write-Host "`n⚙️ Unused Services ($($results.UnusedServices.Count)):" -ForegroundColor Yellow
    $results.UnusedServices | ForEach-Object { Write-Host "   ❌ $_" -ForegroundColor Red }
    $totalUnused += $results.UnusedServices.Count
}

if ($results.UnusedAPIs.Count -gt 0) {
    Write-Host "`n🔌 Unused API Routes ($($results.UnusedAPIs.Count)):" -ForegroundColor Yellow
    $results.UnusedAPIs | ForEach-Object { Write-Host "   ❌ $_" -ForegroundColor Red }
    $totalUnused += $results.UnusedAPIs.Count
}

if ($results.UnusedSpecs.Count -gt 0) {
    Write-Host "`n📋 Old Specs ($($results.UnusedSpecs.Count)):" -ForegroundColor Yellow
    $results.UnusedSpecs | ForEach-Object { Write-Host "   ❌ $_" -ForegroundColor Red }
    $totalUnused += $results.UnusedSpecs.Count
}

if ($results.UnusedScripts.Count -gt 0) {
    Write-Host "`n🔧 Unused Scripts ($($results.UnusedScripts.Count)):" -ForegroundColor Yellow
    $results.UnusedScripts | ForEach-Object { Write-Host "   ❌ $_" -ForegroundColor Red }
    $totalUnused += $results.UnusedScripts.Count
}

if ($totalUnused -eq 0) {
    Write-Host "`n✅ No unused files detected!" -ForegroundColor Green
    exit 0
}

Write-Host "`n📈 Total unused items: $totalUnused" -ForegroundColor Cyan

# Export results to JSON for further processing
$results | ConvertTo-Json -Depth 10 | Out-File "scripts/unused-files.json"
Write-Host "`n💾 Results saved to scripts/unused-files.json" -ForegroundColor Blue
