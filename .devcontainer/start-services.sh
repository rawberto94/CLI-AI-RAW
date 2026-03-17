#!/bin/bash
# ============================================================================
# .devcontainer/start-services.sh — Start Docker services for dev container
# ============================================================================
# Called by `pnpm services`. Ensures Docker compose services are up and healthy.
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Starting Docker dev services..."

if ! command -v docker &>/dev/null || ! docker info &>/dev/null 2>&1; then
    echo "ERROR: Docker not available"
    exit 1
fi

docker compose -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo -n "Waiting for services"
for i in $(seq 1 30); do
    PG=$(docker exec contract-intelligence-postgres-dev pg_isready -U postgres 2>/dev/null && echo "ok" || echo "")
    RD=$(docker exec contract-intelligence-redis-dev redis-cli ping 2>/dev/null | grep -c PONG || echo "0")
    if [ -n "$PG" ] && [ "$RD" = "1" ]; then
        echo " ready!"
        echo "  PostgreSQL: localhost:5432"
        echo "  Redis:      localhost:6379"
        echo "  MinIO:      localhost:9000 (API) / localhost:9001 (Console)"
        echo "  Neo4j:      localhost:7474"
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo " timeout — some services may not be ready"
exit 1
