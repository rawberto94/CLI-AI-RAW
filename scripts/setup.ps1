# Complete System Setup Script (PowerShell)
# Sets up the entire contract intelligence platform locally

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Complete Contract Intelligence Platform..." -ForegroundColor Green
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker found" -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "✅ Node.js found ($nodeVersion)" -ForegroundColor Green

# Step 1: Install dependencies
Write-Host ""
Write-Host "📦 Step 1/7: Installing dependencies..." -ForegroundColor Cyan
npm install

# Step 2: Start Docker services
Write-Host ""
Write-Host "🐳 Step 2/7: Starting Docker services..." -ForegroundColor Cyan

# Start Chroma DB
$chromaRunning = docker ps --filter "name=chroma" --format "{{.Names}}"
if ($chromaRunning -eq "chroma") {
    Write-Host "Chroma DB already running" -ForegroundColor Yellow
} else {
    docker run -d -p 8000:8000 --name chroma chromadb/chroma
    Write-Host "✅ Chroma DB started (port 8000)" -ForegroundColor Green
}

# Start MySQL
$mysqlRunning = docker ps --filter "name=mysql-rag" --format "{{.Names}}"
if ($mysqlRunning -eq "mysql-rag") {
    Write-Host "MySQL already running" -ForegroundColor Yellow
} else {
    docker run -d `
        --name mysql-rag `
        -e MYSQL_ROOT_PASSWORD=ragpassword `
        -e MYSQL_DATABASE=rag_system `
        -p 3306:3306 `
        mysql:8.0
    Write-Host "✅ MySQL started (port 3306)" -ForegroundColor Green
    Write-Host "Waiting for MySQL to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
}

# Step 3: Create .env file
Write-Host ""
Write-Host "📝 Step 3/7: Creating .env file..." -ForegroundColor Cyan
$envContent = @"
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Database Configuration
DATABASE_URL=mysql://root:ragpassword@localhost:3306/rag_system

# Chroma DB Configuration
CHROMA_URL=http://localhost:8000

# Application Configuration
NODE_ENV=development
PORT=3000

# RAG Configuration
RAG_CACHE_TTL=300000
RAG_MAX_RESULTS=20
RAG_RATE_LIMIT_PER_MINUTE=10
RAG_RATE_LIMIT_PER_HOUR=100
RAG_RATE_LIMIT_PER_DAY=1000
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ .env file created" -ForegroundColor Green
Write-Host "⚠️  Please update OPENAI_API_KEY in .env file" -ForegroundColor Yellow

# Step 4: Apply database migrations
Write-Host ""
Write-Host "🗃️  Step 4/7: Applying database migrations..." -ForegroundColor Cyan
Set-Location packages/data-orchestration

try {
    npx prisma migrate deploy 2>&1 | Out-Null
} catch {
    Write-Host "⚠️  Prisma migrate failed, trying manual SQL..." -ForegroundColor Yellow
}

# Apply all migrations manually
$migrations = @(
    "prisma/migrations/002_data_standardization_schema.sql",
    "prisma/migrations/003_enhanced_rate_card_schema.sql",
    "prisma/migrations/004_processing_jobs_schema.sql",
    "prisma/migrations/005_audit_trail_schema.sql",
    "prisma/migrations/006_artifact_versioning_schema.sql",
    "prisma/migrations/007_ux_quick_wins_schema.sql",
    "prisma/migrations/008_add_performance_indexes.sql",
    "prisma/migrations/010_rag_persistence_schema.sql"
)

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "Applying $migration..." -ForegroundColor Gray
        Get-Content $migration | docker exec -i mysql-rag mysql -u root -pragpassword rag_system 2>&1 | Out-Null
    }
}

Write-Host "✅ Database migrations applied" -ForegroundColor Green
Set-Location ../..

# Step 5: Seed example data
Write-Host ""
Write-Host "🌱 Step 5/7: Seeding example data..." -ForegroundColor Cyan
Set-Location packages/data-orchestration
try {
    npx ts-node src/scripts/seed-rag-data.ts 2>&1 | Out-Null
    Write-Host "✅ Example data seeded" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Seeding skipped (optional)" -ForegroundColor Yellow
}
Set-Location ../..

# Step 6: Run health checks
Write-Host ""
Write-Host "🧪 Step 6/7: Running health checks..." -ForegroundColor Cyan

try {
    $chromaHealth = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/heartbeat" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Chroma DB is healthy" -ForegroundColor Green
} catch {
    Write-Host "❌ Chroma DB is not responding" -ForegroundColor Red
}

try {
    docker exec mysql-rag mysql -u root -pragpassword -e "SELECT 1;" 2>&1 | Out-Null
    Write-Host "✅ MySQL is healthy" -ForegroundColor Green
} catch {
    Write-Host "❌ MySQL is not responding" -ForegroundColor Red
}

# Step 7: Instructions
Write-Host ""
Write-Host "✨ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Update OPENAI_API_KEY in .env file"
Write-Host "2. Run: npm run dev"
Write-Host "3. Visit: http://localhost:3000"
Write-Host ""
Write-Host "📊 Available Features:" -ForegroundColor Cyan
Write-Host "  • Contracts: http://localhost:3000/contracts"
Write-Host "  • RAG Chat: http://localhost:3000/rag/chat"
Write-Host "  • Intelligence: http://localhost:3000/rag/intelligence"
Write-Host "  • Analytics: http://localhost:3000/analytics"
Write-Host ""
Write-Host "🛑 To stop services:" -ForegroundColor Yellow
Write-Host "  docker stop chroma mysql-rag"
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "  See SETUP.md for complete guide"
Write-Host ""
