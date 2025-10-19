# ============================================
# Contract Intelligence Platform - Run Script
# ============================================
# PowerShell script to start all services
# Usage: .\run.ps1 [command]
# Commands: start, stop, restart, status, logs, clean

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'clean', 'setup', 'dev')]
    [string]$Command = 'start'
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Banner
function Show-Banner {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   CONTRACT INTELLIGENCE PLATFORM                      ║" -ForegroundColor Cyan
    Write-Host "║   AI-Powered Contract Analysis & Management           ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "🔍 Checking prerequisites..."
    
    $missing = @()
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "✓ Node.js: $nodeVersion"
    } catch {
        $missing += "Node.js (https://nodejs.org/)"
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Success "✓ npm: v$npmVersion"
    } catch {
        $missing += "npm (comes with Node.js)"
    }
    
    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Success "✓ Docker: $dockerVersion"
    } catch {
        $missing += "Docker (https://www.docker.com/)"
    }
    
    # Check Docker Compose
    try {
        $composeVersion = docker compose version
        Write-Success "✓ Docker Compose: $composeVersion"
    } catch {
        $missing += "Docker Compose (comes with Docker Desktop)"
    }
    
    if ($missing.Count -gt 0) {
        Write-Error "❌ Missing prerequisites:"
        $missing | ForEach-Object { Write-Error "   - $_" }
        exit 1
    }
    
    Write-Success "✓ All prerequisites installed"
    Write-Host ""
}

# Check .env file
function Test-EnvFile {
    Write-Info "🔍 Checking environment configuration..."
    
    if (-not (Test-Path ".env")) {
        Write-Warning "⚠️  .env file not found"
        Write-Info "Creating .env from template..."
        Copy-Item ".env.example" ".env"
        Write-Success "✓ Created .env file"
        Write-Warning "⚠️  Please update .env with your configuration:"
        Write-Warning "   - DATABASE_URL"
        Write-Warning "   - OPENAI_API_KEY"
        Write-Warning "   - JWT_SECRET"
        Write-Warning "   - SESSION_SECRET"
        Write-Host ""
        Write-Info "Press any key to continue after updating .env..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } else {
        Write-Success "✓ .env file exists"
    }
    Write-Host ""
}

# Start services
function Start-Services {
    Write-Info "🚀 Starting services..."
    Write-Host ""
    
    # Start Docker services
    Write-Info "Starting Docker services (PostgreSQL, Redis)..."
    docker compose -f docker-compose.dev.yml up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Failed to start Docker services"
        exit 1
    }
    
    Write-Success "✓ Docker services started"
    Write-Host ""
    
    # Wait for services to be ready
    Write-Info "⏳ Waiting for services to be ready..."
    Start-Sleep -Seconds 5
    
    # Check PostgreSQL
    Write-Info "Checking PostgreSQL..."
    $retries = 0
    while ($retries -lt 30) {
        try {
            docker exec contract-intelligence-postgres-dev pg_isready -U postgres -d contracts | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✓ PostgreSQL is ready"
                break
            }
        } catch {}
        $retries++
        Start-Sleep -Seconds 1
    }
    
    # Check Redis
    Write-Info "Checking Redis..."
    $retries = 0
    while ($retries -lt 30) {
        try {
            docker exec contract-intelligence-redis-dev redis-cli ping | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✓ Redis is ready"
                break
            }
        } catch {}
        $retries++
        Start-Sleep -Seconds 1
    }
    
    Write-Host ""
    
    # Run database migrations
    Write-Info "Running database migrations..."
    Set-Location packages/clients/db
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "⚠️  Database migrations failed (this is OK if database is already set up)"
    } else {
        Write-Success "✓ Database migrations completed"
    }
    Set-Location ../../..
    Write-Host ""
    
    # Start the application
    Write-Info "Starting Next.js application..."
    Write-Host ""
    Write-Success "╔═══════════════════════════════════════════════════════╗"
    Write-Success "║   APPLICATION STARTING                                ║"
    Write-Success "╚═══════════════════════════════════════════════════════╝"
    Write-Host ""
    Write-Info "🌐 Application will be available at:"
    Write-Success "   http://localhost:3005"
    Write-Host ""
    Write-Info "📊 Services:"
    Write-Success "   PostgreSQL: localhost:5432"
    Write-Success "   Redis:      localhost:6379"
    Write-Host ""
    Write-Info "Press Ctrl+C to stop the application"
    Write-Host ""
    
    Set-Location apps/web
    npm run dev
}

# Stop services
function Stop-Services {
    Write-Info "🛑 Stopping services..."
    Write-Host ""
    
    # Stop Docker services
    Write-Info "Stopping Docker services..."
    docker compose -f docker-compose.dev.yml down
    
    Write-Success "✓ All services stopped"
    Write-Host ""
}

# Restart services
function Restart-Services {
    Stop-Services
    Start-Sleep -Seconds 2
    Start-Services
}

# Show status
function Show-Status {
    Write-Info "📊 Service Status"
    Write-Host ""
    
    # Docker services
    Write-Info "Docker Services:"
    docker compose -f docker-compose.dev.yml ps
    Write-Host ""
    
    # Check if app is running
    Write-Info "Application Status:"
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3005/api/health" -TimeoutSec 2 -UseBasicParsing
        Write-Success "✓ Application is running (http://localhost:3005)"
    } catch {
        Write-Warning "⚠️  Application is not responding"
    }
    Write-Host ""
}

# Show logs
function Show-Logs {
    Write-Info "📋 Service Logs"
    Write-Host ""
    docker compose -f docker-compose.dev.yml logs -f
}

# Clean everything
function Clean-All {
    Write-Warning "⚠️  This will remove all data and containers!"
    Write-Host ""
    $confirmation = Read-Host "Are you sure? (yes/no)"
    
    if ($confirmation -ne "yes") {
        Write-Info "Cancelled"
        return
    }
    
    Write-Info "🧹 Cleaning up..."
    Write-Host ""
    
    # Stop and remove containers
    docker compose -f docker-compose.dev.yml down -v
    
    # Remove node_modules (optional)
    $removeModules = Read-Host "Remove node_modules? (yes/no)"
    if ($removeModules -eq "yes") {
        Write-Info "Removing node_modules..."
        Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force apps/web/node_modules -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force packages/*/node_modules -ErrorAction SilentlyContinue
    }
    
    Write-Success "✓ Cleanup complete"
    Write-Host ""
}

# Setup project
function Setup-Project {
    Write-Info "🔧 Setting up project..."
    Write-Host ""
    
    # Install dependencies
    Write-Info "Installing dependencies..."
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Failed to install dependencies"
        exit 1
    }
    
    Write-Success "✓ Dependencies installed"
    Write-Host ""
    
    # Setup database
    Write-Info "Setting up database..."
    Set-Location packages/clients/db
    npx prisma generate
    Set-Location ../../..
    
    Write-Success "✓ Database setup complete"
    Write-Host ""
    
    Write-Success "╔═══════════════════════════════════════════════════════╗"
    Write-Success "║   SETUP COMPLETE                                      ║"
    Write-Success "╚═══════════════════════════════════════════════════════╝"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Info "1. Update .env with your configuration"
    Write-Info "2. Run: .\run.ps1 start"
    Write-Host ""
}

# Development mode (with auto-reload)
function Start-Dev {
    Write-Info "🔧 Starting in development mode..."
    Write-Host ""
    
    # Start Docker services
    Write-Info "Starting Docker services..."
    docker compose -f docker-compose.dev.yml up -d
    
    Write-Success "✓ Docker services started"
    Write-Host ""
    
    # Start application in dev mode
    Write-Info "Starting application with hot reload..."
    Write-Host ""
    
    Set-Location apps/web
    npm run dev
}

# Main execution
Show-Banner
Test-Prerequisites

switch ($Command) {
    'start' {
        Test-EnvFile
        Start-Services
    }
    'stop' {
        Stop-Services
    }
    'restart' {
        Restart-Services
    }
    'status' {
        Show-Status
    }
    'logs' {
        Show-Logs
    }
    'clean' {
        Clean-All
    }
    'setup' {
        Test-EnvFile
        Setup-Project
    }
    'dev' {
        Test-EnvFile
        Start-Dev
    }
}
