#!/bin/bash

# Contract Intelligence Platform - Production Deployment Script
# This script automates the deployment process for production environments

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV="${DEPLOY_ENV:-production}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-contract-intelligence}"
VERSION="${VERSION:-latest}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f ".env.production" ]; then
        log_error ".env.production file not found"
        log_info "Please create .env.production based on .env.example"
        exit 1
    fi
    
    # Check required environment variables
    source .env.production
    
    required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "OPENAI_API_KEY"
        "S3_ENDPOINT"
        "S3_BUCKET"
        "JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build API image
    log_info "Building API image..."
    docker build -t ${DOCKER_REGISTRY}/api:${VERSION} -f apps/api/Dockerfile .
    
    # Build Web image
    log_info "Building Web image..."
    docker build -t ${DOCKER_REGISTRY}/web:${VERSION} -f apps/web/Dockerfile .
    
    # Build Workers image
    log_info "Building Workers image..."
    docker build -t ${DOCKER_REGISTRY}/workers:${VERSION} -f apps/workers/Dockerfile .
    
    log_success "Docker images built successfully"
}

run_tests() {
    log_info "Running tests..."
    
    # Build test image
    docker build -t ${DOCKER_REGISTRY}/test:${VERSION} -f Dockerfile.test .
    
    # Run tests
    docker run --rm \
        -v $(pwd):/app \
        -w /app \
        ${DOCKER_REGISTRY}/test:${VERSION} \
        npm run test:all
    
    log_success "All tests passed"
}

backup_database() {
    log_info "Creating database backup..."
    
    # Create backup directory
    mkdir -p backups
    
    # Generate backup filename
    BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
    
    # Create backup
    docker-compose -f ${COMPOSE_FILE} exec postgres \
        pg_dump -U postgres -d contract_intelligence | gzip > ${BACKUP_FILE}
    
    log_success "Database backup created: ${BACKUP_FILE}"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure..."
    
    # Create necessary directories
    mkdir -p data/postgres data/redis data/minio logs
    
    # Set proper permissions
    chmod 755 data/postgres data/redis data/minio logs
    
    # Start infrastructure services
    docker-compose -f ${COMPOSE_FILE} up -d postgres redis minio
    
    # Wait for services to be ready
    log_info "Waiting for infrastructure services to be ready..."
    sleep 30
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose -f ${COMPOSE_FILE} run --rm api npm run db:migrate
    
    log_success "Infrastructure deployed successfully"
}

deploy_application() {
    log_info "Deploying application services..."
    
    # Deploy API and Workers
    docker-compose -f ${COMPOSE_FILE} up -d api workers
    
    # Wait for API to be ready
    log_info "Waiting for API to be ready..."
    sleep 20
    
    # Deploy Web frontend
    docker-compose -f ${COMPOSE_FILE} up -d web
    
    log_success "Application services deployed successfully"
}

health_check() {
    log_info "Performing health checks..."
    
    # Check API health
    API_URL="${API_URL:-http://localhost:8080}"
    
    for i in {1..10}; do
        if curl -sf "${API_URL}/healthz" > /dev/null; then
            log_success "API health check passed"
            break
        else
            log_warning "API health check failed, retrying in 10 seconds... (${i}/10)"
            sleep 10
        fi
        
        if [ $i -eq 10 ]; then
            log_error "API health check failed after 10 attempts"
            exit 1
        fi
    done
    
    # Check Web health
    WEB_URL="${WEB_URL:-http://localhost:3000}"
    
    for i in {1..5}; do
        if curl -sf "${WEB_URL}" > /dev/null; then
            log_success "Web health check passed"
            break
        else
            log_warning "Web health check failed, retrying in 10 seconds... (${i}/5)"
            sleep 10
        fi
        
        if [ $i -eq 5 ]; then
            log_error "Web health check failed after 5 attempts"
            exit 1
        fi
    done
    
    log_success "All health checks passed"
}

setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Start monitoring stack if configured
    if [ "${MONITORING_ENABLED}" = "true" ]; then
        docker-compose -f ${COMPOSE_FILE} -f docker-compose.monitoring.yml up -d prometheus grafana
        log_success "Monitoring stack deployed"
    else
        log_info "Monitoring is disabled, skipping..."
    fi
}

cleanup_old_images() {
    log_info "Cleaning up old Docker images..."
    
    # Remove old images (keep last 3 versions)
    docker images ${DOCKER_REGISTRY}/api --format "table {{.Tag}}\t{{.ID}}" | \
        tail -n +4 | awk '{print $2}' | xargs -r docker rmi
    
    docker images ${DOCKER_REGISTRY}/web --format "table {{.Tag}}\t{{.ID}}" | \
        tail -n +4 | awk '{print $2}' | xargs -r docker rmi
    
    docker images ${DOCKER_REGISTRY}/workers --format "table {{.Tag}}\t{{.ID}}" | \
        tail -n +4 | awk '{print $2}' | xargs -r docker rmi
    
    # Clean up dangling images
    docker image prune -f
    
    log_success "Old images cleaned up"
}

show_deployment_info() {
    log_success "Deployment completed successfully!"
    echo
    echo "=================================="
    echo "DEPLOYMENT INFORMATION"
    echo "=================================="
    echo "Environment: ${DEPLOY_ENV}"
    echo "Version: ${VERSION}"
    echo "API URL: ${API_URL:-http://localhost:8080}"
    echo "Web URL: ${WEB_URL:-http://localhost:3000}"
    echo
    echo "Services:"
    docker-compose -f ${COMPOSE_FILE} ps
    echo
    echo "To view logs:"
    echo "  docker-compose -f ${COMPOSE_FILE} logs -f [service_name]"
    echo
    echo "To stop services:"
    echo "  docker-compose -f ${COMPOSE_FILE} down"
    echo
}

rollback() {
    log_warning "Rolling back deployment..."
    
    # Stop current services
    docker-compose -f ${COMPOSE_FILE} down
    
    # Restore from backup if needed
    if [ -n "${BACKUP_FILE}" ] && [ -f "${BACKUP_FILE}" ]; then
        log_info "Restoring database from backup..."
        zcat ${BACKUP_FILE} | docker-compose -f ${COMPOSE_FILE} exec -T postgres \
            psql -U postgres -d contract_intelligence
    fi
    
    log_success "Rollback completed"
}

# Main deployment process
main() {
    log_info "Starting production deployment..."
    
    # Handle signals for graceful shutdown
    trap rollback ERR INT TERM
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --env)
                DEPLOY_ENV="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-tests     Skip running tests"
                echo "  --skip-backup    Skip database backup"
                echo "  --version VERSION Set deployment version (default: latest)"
                echo "  --env ENV        Set deployment environment (default: production)"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    
    if [ "${SKIP_TESTS}" != "true" ]; then
        run_tests
    else
        log_warning "Skipping tests as requested"
    fi
    
    build_images
    
    if [ "${SKIP_BACKUP}" != "true" ]; then
        backup_database
    else
        log_warning "Skipping database backup as requested"
    fi
    
    deploy_infrastructure
    deploy_application
    health_check
    setup_monitoring
    cleanup_old_images
    show_deployment_info
    
    log_success "Production deployment completed successfully!"
}

# Run main function
main "$@"
