#!/bin/bash
# ============================================================================
# start-test-services.sh — Start minimal services for testing
# ============================================================================
# Starts only postgres and redis (no minio/neo4j) for running tests.
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Starting test services (postgres + redis)..."

if ! command -v docker &>/dev/null; then
    echo "Docker not available — skipping service startup"
    exit 0
fi

# Start just postgres and redis from dev compose
docker compose -f docker-compose.dev.yml up -d postgres redis

for i in $(seq 1 20); do
    PG=$(docker exec contract-intelligence-postgres-dev pg_isready -U postgres 2>/dev/null && echo "ok" || echo "")
    RD=$(docker exec contract-intelligence-redis-dev redis-cli ping 2>/dev/null | grep -c PONG || echo "0")
    if [ -n "$PG" ] && [ "$RD" = "1" ]; then
        echo "Test services ready"
        exit 0
    fi
    sleep 1
done

echo "Warning: services may not be fully ready"
exit 0
