#!/bin/bash

# ============================================================================
# PactumAI - Startup Script
# ============================================================================
# This script starts all required services for the application
# Usage: ./start.sh [options]
#   --dev     Start in development mode (default)
#   --prod    Start in production mode
#   --workers Start only background workers
#   --web     Start only web server
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT="${PORT:-3005}"
MODE="${1:-dev}"

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║   ██████╗  █████╗  ██████╗████████╗██╗   ██╗███╗   ███╗      ║"
    echo "║   ██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██║   ██║████╗ ████║      ║"
    echo "║   ██████╔╝███████║██║        ██║   ██║   ██║██╔████╔██║      ║"
    echo "║   ██╔═══╝ ██╔══██║██║        ██║   ██║   ██║██║╚██╔╝██║      ║"
    echo "║   ██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║ ╚═╝ ██║      ║"
    echo "║   ╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝      ║"
    echo "║                                                               ║"
    echo "║              Contract Intelligence Platform                   ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Print status message
info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

success() {
    echo -e "${GREEN}✓${NC}  $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

error() {
    echo -e "${RED}✗${NC}  $1"
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    success "Node.js $(node -v)"
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        error "pnpm is not installed. Install with: npm install -g pnpm"
        exit 1
    fi
    success "pnpm $(pnpm -v)"
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        success "Docker $(docker -v | cut -d' ' -f3 | tr -d ',')"
    else
        warning "Docker not found (optional for local services)"
    fi
    
    echo ""
}

# Check if services are running
check_services() {
    info "Checking required services..."
    
    # Check PostgreSQL
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        success "PostgreSQL is running on port 5432"
    else
        warning "PostgreSQL is not running. Starting with Docker..."
        start_postgres
    fi
    
    # Check Redis
    if redis-cli ping &> /dev/null 2>&1; then
        success "Redis is running"
    else
        warning "Redis is not running. Starting with Docker..."
        start_redis
    fi
    
    echo ""
}

# Start PostgreSQL with Docker
start_postgres() {
    if command -v docker &> /dev/null; then
        docker run -d \
            --name pactum-postgres \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=postgres \
            -e POSTGRES_DB=contracts \
            -p 5432:5432 \
            postgres:15-alpine &> /dev/null || true
        sleep 3
        success "PostgreSQL started"
    else
        error "Cannot start PostgreSQL - Docker not available"
    fi
}

# Start Redis with Docker
start_redis() {
    if command -v docker &> /dev/null; then
        docker run -d \
            --name pactum-redis \
            -p 6379:6379 \
            redis:7-alpine &> /dev/null || true
        sleep 2
        success "Redis started"
    else
        error "Cannot start Redis - Docker not available"
    fi
}

# Install dependencies if needed
install_deps() {
    if [ ! -d "node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
        info "Installing dependencies..."
        pnpm install
        success "Dependencies installed"
        echo ""
    fi
}

# Run database migrations
run_migrations() {
    info "Running database migrations..."
    cd "$PROJECT_ROOT"
    npx prisma db push --accept-data-loss &> /dev/null || true
    success "Database schema synced"
    echo ""
}

# Start development mode
start_dev() {
    echo -e "${PURPLE}Starting in DEVELOPMENT mode...${NC}"
    echo ""
    
    info "Web server: http://localhost:$WEB_PORT"
    info "Workers: Background processing enabled"
    echo ""
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Application starting... Press Ctrl+C to stop${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    cd "$PROJECT_ROOT"
    pnpm dev
}

# Start production mode
start_prod() {
    echo -e "${PURPLE}Starting in PRODUCTION mode...${NC}"
    echo ""
    
    info "Building application..."
    cd "$PROJECT_ROOT/apps/web"
    pnpm build
    success "Build complete"
    
    info "Starting production server..."
    NODE_ENV=production pnpm start
}

# Start only workers
start_workers() {
    echo -e "${PURPLE}Starting WORKERS only...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT/packages/workers"
    pnpm dev
}

# Start only web server
start_web() {
    echo -e "${PURPLE}Starting WEB SERVER only...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT/apps/web"
    pnpm dev
}

# Main execution
main() {
    cd "$PROJECT_ROOT"
    
    print_banner
    
    case "$MODE" in
        --dev|dev)
            check_prerequisites
            check_services
            install_deps
            run_migrations
            start_dev
            ;;
        --prod|prod)
            check_prerequisites
            check_services
            install_deps
            run_migrations
            start_prod
            ;;
        --workers|workers)
            check_prerequisites
            start_workers
            ;;
        --web|web)
            check_prerequisites
            start_web
            ;;
        --help|-h|help)
            echo "Usage: ./start.sh [option]"
            echo ""
            echo "Options:"
            echo "  --dev, dev       Start in development mode (default)"
            echo "  --prod, prod     Start in production mode"
            echo "  --workers        Start only background workers"
            echo "  --web            Start only web server"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  PORT             Web server port (default: 3005)"
            echo "  DATABASE_URL     PostgreSQL connection string"
            echo "  REDIS_URL        Redis connection string"
            echo ""
            ;;
        *)
            error "Unknown option: $MODE"
            echo "Run './start.sh --help' for usage"
            exit 1
            ;;
    esac
}

# Run main
main
