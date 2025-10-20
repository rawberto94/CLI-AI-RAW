# ============================================================================
# Complete Setup Script - Contract Intelligence System
# ============================================================================
# This script sets up everything you need to run the system with real AI
# Run this once and you're ready to go!
# ============================================================================

Write-Host "🚀 Starting Complete Setup..." -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
Write-Host "📋 Step 1: Checking Prerequisites..." -ForegroundColor Yellow

# Check Node.js
Write-Host "  Checking Node.js..." -NoNewline
try {
    $nodeVersion = node --version
    Write-Host " ✅ Found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Node.js not found!" -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check pnpm
Write-Host "  Checking pnpm..." -NoNewline
try {
    $pnpmVersion = pnpm --version
    Write-Host " ✅ Found: v$pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ pnpm not found!" -ForegroundColor Red
    Write-Host "  Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host " ✅ pnpm installed" -ForegroundColor Green
}

# Check PostgreSQL
Write-Host "  Checking PostgreSQL..." -NoNewline
try {
    $pgVersion = psql --version
    Write-Host " ✅ Found: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host " ⚠️  PostgreSQL not found" -ForegroundColor Yellow
    Write-Host "  You'll need to install PostgreSQL or configure DATABASE_URL" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# Step 2: Install Dependencies
# ============================================================================
Write-Host "📦 Step 2: Installing Dependencies..." -ForegroundColor Yellow

Write-Host "  Running pnpm install..." -NoNewline
pnpm install 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host " ❌ Failed to install dependencies" -ForegroundColor Red
    Write-Host "  Please run 'pnpm install' manually and check for errors" -ForegroundColor Red
    exit 1
}

# Verify pdf-parse
Write-Host "  Verifying pdf-parse..." -NoNewline
$pdfParse = pnpm list pdf-parse 2>&1 | Select-String "pdf-parse"
if ($pdfParse) {
    Write-Host " ✅ pdf-parse installed" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Installing pdf-parse..." -ForegroundColor Yellow
    pnpm add pdf-parse
    Write-Host " ✅ pdf-parse installed" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# Step 3: Setup Environment Variables
# ============================================================================
Write-Host "🔧 Step 3: Setting Up Environment..." -ForegroundColor Yellow

# Check if .env exists
if (Test-Path ".env") {
    Write-Host "  .env file exists" -ForegroundColor Green
    
    # Check for OpenAI key
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "OPENAI_API_KEY=sk-") {
        Write-Host "  ✅ OpenAI API key found" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  OpenAI API key not configured" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  To enable real AI analysis:" -ForegroundColor Cyan
        Write-Host "  1. Get API key from: https://platform.openai.com/api-keys" -ForegroundColor Cyan
        Write-Host "  2. Add to .env: OPENAI_API_KEY=sk-your-key-here" -ForegroundColor Cyan
        Write-Host ""
        $addKey = Read-Host "  Do you want to add your OpenAI API key now? (y/n)"
        if ($addKey -eq "y" -or $addKey -eq "Y") {
            $apiKey = Read-Host "  Enter your OpenAI API key (starts with sk-)"
            if ($apiKey -match "^sk-") {
                Add-Content ".env" "`nOPENAI_API_KEY=$apiKey"
                Write-Host "  ✅ OpenAI API key added to .env" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  Invalid API key format (should start with sk-)" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "  Creating .env from .env.example..." -NoNewline
    Copy-Item ".env.example" ".env"
    Write-Host " ✅ Created" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "  ⚠️  Please configure your .env file:" -ForegroundColor Yellow
    Write-Host "  1. Add DATABASE_URL (PostgreSQL connection string)" -ForegroundColor Cyan
    Write-Host "  2. Add OPENAI_API_KEY (from https://platform.openai.com/api-keys)" -ForegroundColor Cyan
    Write-Host ""
    
    $configure = Read-Host "  Do you want to configure now? (y/n)"
    if ($configure -eq "y" -or $configure -eq "Y") {
        Write-Host ""
        $dbUrl = Read-Host "  Enter DATABASE_URL (or press Enter to skip)"
        if ($dbUrl) {
            (Get-Content ".env") -replace 'DATABASE_URL=".*"', "DATABASE_URL=`"$dbUrl`"" | Set-Content ".env"
            Write-Host "  ✅ DATABASE_URL configured" -ForegroundColor Green
        }
        
        $apiKey = Read-Host "  Enter OPENAI_API_KEY (or press Enter to skip)"
        if ($apiKey -match "^sk-") {
            (Get-Content ".env") -replace 'OPENAI_API_KEY=".*"', "OPENAI_API_KEY=`"$apiKey`"" | Set-Content ".env"
            Write-Host "  ✅ OPENAI_API_KEY configured" -ForegroundColor Green
        }
    }
}

Write-Host ""

# ============================================================================
# Step 4: Setup Database Schema
# ============================================================================
Write-Host "🗄️  Step 4: Setting Up Database..." -ForegroundColor Yellow

Write-Host "  Checking if Cost Savings schema exists..." -NoNewline
$schemaContent = Get-Content "packages/clients/db/schema.prisma" -Raw
if ($schemaContent -match "model CostSavingsOpportunity") {
    Write-Host " ✅ Already exists" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Not found" -ForegroundColor Yellow
    Write-Host "  Adding Cost Savings schema..." -NoNewline
    
    # Read the schema to add
    $costSavingsSchema = Get-Content "packages/clients/db/schema-cost-savings.prisma" -Raw
    
    # Add to main schema
    Add-Content "packages/clients/db/schema.prisma" "`n`n// Cost Savings Opportunities`n$costSavingsSchema"
    
    Write-Host " ✅ Added" -ForegroundColor Green
}

# Generate Prisma Client
Write-Host "  Generating Prisma client..." -NoNewline
Push-Location "packages/clients/db"
pnpm prisma generate 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ Generated" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Failed (may need manual fix)" -ForegroundColor Yellow
}
Pop-Location

# Run migrations
Write-Host "  Running database migrations..." -NoNewline
$runMigrations = Read-Host "`n  Do you want to run database migrations now? (y/n)"
if ($runMigrations -eq "y" -or $runMigrations -eq "Y") {
    Push-Location "packages/clients/db"
    pnpm prisma migrate deploy 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Migrations completed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Migrations failed - you may need to run manually" -ForegroundColor Yellow
        Write-Host "  Run: cd packages/clients/db && pnpm prisma migrate deploy" -ForegroundColor Cyan
    }
    Pop-Location
} else {
    Write-Host "  ⚠️  Skipped - run manually with: cd packages/clients/db && pnpm prisma migrate deploy" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# Step 5: Create Upload Directories
# ============================================================================
Write-Host "📁 Step 5: Creating Upload Directories..." -ForegroundColor Yellow

$uploadDirs = @(
    "uploads",
    "uploads/contracts",
    "uploads/contracts/demo",
    "data",
    "data/contracts"
)

foreach ($dir in $uploadDirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✅ Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Exists: $dir" -ForegroundColor Gray
    }
}

Write-Host ""

# ============================================================================
# Step 6: Verify Setup
# ============================================================================
Write-Host "✅ Step 6: Verifying Setup..." -ForegroundColor Yellow

$allGood = $true

# Check .env
if (Test-Path ".env") {
    Write-Host "  ✅ .env file exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ .env file missing" -ForegroundColor Red
    $allGood = $false
}

# Check node_modules
if (Test-Path "node_modules") {
    Write-Host "  ✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Dependencies not installed" -ForegroundColor Red
    $allGood = $false
}

# Check Prisma client
if (Test-Path "node_modules/.prisma") {
    Write-Host "  ✅ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Prisma client may need regeneration" -ForegroundColor Yellow
}

# Check upload directories
if (Test-Path "uploads") {
    Write-Host "  ✅ Upload directories created" -ForegroundColor Green
} else {
    Write-Host "  ❌ Upload directories missing" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# ============================================================================
# Summary
# ============================================================================
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

if ($allGood) {
    Write-Host "✅ All checks passed! You're ready to go!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some checks failed. Please review the output above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 What's Next:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Start the development server:" -ForegroundColor White
Write-Host "     pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Open your browser:" -ForegroundColor White
Write-Host "     http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Upload a contract PDF and see the magic! ✨" -ForegroundColor White
Write-Host ""

# Check OpenAI key
$envContent = Get-Content ".env" -Raw
if ($envContent -match "OPENAI_API_KEY=sk-") {
    Write-Host "  🤖 Real AI Analysis: ENABLED" -ForegroundColor Green
    Write-Host "     Your contracts will be analyzed with GPT-4" -ForegroundColor Gray
} else {
    Write-Host "  💭 Mock Analysis: ACTIVE" -ForegroundColor Yellow
    Write-Host "     Add OPENAI_API_KEY to .env for real AI analysis" -ForegroundColor Gray
    Write-Host "     Get your key: https://platform.openai.com/api-keys" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   - Complete Guide: COMPLETE_SETUP_GUIDE.md" -ForegroundColor Gray
Write-Host "   - OpenAI Setup: SETUP_OPENAI_GUIDE.md" -ForegroundColor Gray
Write-Host "   - Troubleshooting: See guides above" -ForegroundColor Gray
Write-Host ""

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Offer to start the server
$startServer = Read-Host "Do you want to start the development server now? (y/n)"
if ($startServer -eq "y" -or $startServer -eq "Y") {
    Write-Host ""
    Write-Host "🚀 Starting development server..." -ForegroundColor Cyan
    Write-Host "   Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    pnpm dev
} else {
    Write-Host ""
    Write-Host "👋 Run 'pnpm dev' when you're ready to start!" -ForegroundColor Cyan
    Write-Host ""
}
