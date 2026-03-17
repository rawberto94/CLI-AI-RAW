#!/bin/bash
# ============================================================================
# health-check.sh — Verify all services are healthy
# ============================================================================
# Checks Docker services, workers, web server, DB connectivity, and Redis.
# Usage:
#   bash scripts/health-check.sh          # full check
#   bash scripts/health-check.sh --quiet  # exit code only (0=healthy, 1=issues)
# ============================================================================

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.logs"
QUIET="${1:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

ISSUES=0

check() {
    local name="$1" ok_flag="$2" detail="${3:-}"
    if $ok_flag; then
        [ "$QUIET" != "--quiet" ] && echo -e "  ${GREEN}✓${NC}  ${name}${detail:+ — $detail}"
    else
        [ "$QUIET" != "--quiet" ] && echo -e "  ${RED}✗${NC}  ${name}${detail:+ — $detail}"
        ISSUES=$((ISSUES + 1))
    fi
}

[ "$QUIET" != "--quiet" ] && echo -e "${BLUE}Health Check${NC}"
[ "$QUIET" != "--quiet" ] && echo ""

# ── Docker containers ────────────────────────────────────────────────────────
[ "$QUIET" != "--quiet" ] && echo -e "${BLUE}Docker Services${NC}"

pg_healthy=false
if docker exec contract-intelligence-postgres-dev pg_isready -U postgres &>/dev/null 2>&1; then
    pg_healthy=true
fi
check "PostgreSQL" $pg_healthy "port 5432"

redis_healthy=false
if docker exec contract-intelligence-redis-dev redis-cli ping 2>/dev/null | grep -q PONG; then
    redis_healthy=true
fi
check "Redis" $redis_healthy "port 6379"

minio_healthy=false
if docker ps --format '{{.Names}}' | grep -q "contract-intelligence-minio-dev"; then
    minio_healthy=true
fi
check "MinIO" $minio_healthy "ports 9000/9001"

neo4j_healthy=false
if docker ps --format '{{.Names}}' | grep -q "contract-intelligence-neo4j-dev"; then
    neo4j_healthy=true
fi
check "Neo4j" $neo4j_healthy "ports 7474/7687"

# ── Application processes ────────────────────────────────────────────────────
[ "$QUIET" != "--quiet" ] && echo ""
[ "$QUIET" != "--quiet" ] && echo -e "${BLUE}Application Processes${NC}"

worker_healthy=false
worker_detail="not running"
if [ -f "$LOG_DIR/worker.pid" ]; then
    WPID=$(cat "$LOG_DIR/worker.pid")
    if kill -0 "$WPID" 2>/dev/null; then
        worker_healthy=true
        worker_detail="PID $WPID"
    else
        worker_detail="PID $WPID (dead)"
    fi
elif pgrep -f "tsx.*workers.*index" &>/dev/null; then
    worker_healthy=true
    worker_detail="PID $(pgrep -f 'tsx.*workers.*index' | head -1)"
elif pgrep -f "tsx.*src/index.ts" &>/dev/null; then
    worker_healthy=true
    worker_detail="PID $(pgrep -f 'tsx.*src/index.ts' | head -1)"
fi
check "BullMQ Workers" $worker_healthy "$worker_detail"

web_healthy=false
web_detail="not running"
if pgrep -f "next dev" &>/dev/null; then
    web_healthy=true
    web_detail="PID $(pgrep -f 'next dev' | head -1)"
fi
check "Next.js Dev Server" $web_healthy "$web_detail"

# ── Connectivity ─────────────────────────────────────────────────────────────
[ "$QUIET" != "--quiet" ] && echo ""
[ "$QUIET" != "--quiet" ] && echo -e "${BLUE}Connectivity${NC}"

web_responds=false
WEB_PORT="${PORT:-3005}"
if curl -sf "http://localhost:$WEB_PORT/api/health" &>/dev/null 2>&1 || \
   curl -sf "http://localhost:$WEB_PORT" &>/dev/null 2>&1; then
    web_responds=true
fi
check "Web HTTP (port $WEB_PORT)" $web_responds

db_query=false
if docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts -tc "SELECT 1;" &>/dev/null 2>&1; then
    db_query=true
fi
check "DB query (SELECT 1)" $db_query

redis_write=false
if docker exec contract-intelligence-redis-dev redis-cli SET healthcheck ok EX 5 2>/dev/null | grep -q OK; then
    redis_write=true
fi
check "Redis write" $redis_write

# ── Queue status ─────────────────────────────────────────────────────────────
[ "$QUIET" != "--quiet" ] && echo ""
[ "$QUIET" != "--quiet" ] && echo -e "${BLUE}Queue Status${NC}"

for queue in contract-processing artifact-generation rag-indexing webhook-delivery; do
    waiting=$(docker exec contract-intelligence-redis-dev redis-cli LLEN "bull:${queue}:wait" 2>/dev/null || echo "?")
    active=$(docker exec contract-intelligence-redis-dev redis-cli LLEN "bull:${queue}:active" 2>/dev/null || echo "?")
    [ "$QUIET" != "--quiet" ] && echo -e "  ${BLUE}·${NC}  ${queue}: waiting=${waiting} active=${active}"
done

# ── Environment ──────────────────────────────────────────────────────────────
[ "$QUIET" != "--quiet" ] && echo ""
[ "$QUIET" != "--quiet" ] && echo -e "${BLUE}Environment${NC}"

env_ok=true
env_missing=""
if [ -f "$PROJECT_ROOT/.env" ]; then
    for var in DATABASE_URL REDIS_URL NEXTAUTH_SECRET OPENAI_API_KEY MISTRAL_API_KEY \
               AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT AZURE_DOCUMENT_INTELLIGENCE_KEY; do
        val=$(grep "^${var}=" "$PROJECT_ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
        if [ -z "$val" ] || [[ "$val" == *"your-"* ]] || [[ "$val" == "sk-..." ]]; then
            env_ok=false
            env_missing="${env_missing} ${var}"
        fi
    done
fi
if $env_ok; then
    check ".env vars" true "all critical keys present"
else
    check ".env vars" false "missing/placeholder:${env_missing}"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
[ "$QUIET" != "--quiet" ] && echo ""
if [ "$ISSUES" -eq 0 ]; then
    [ "$QUIET" != "--quiet" ] && echo -e "${GREEN}All checks passed ✓${NC}"
else
    [ "$QUIET" != "--quiet" ] && echo -e "${RED}$ISSUES issue(s) found${NC}"
fi
[ "$QUIET" != "--quiet" ] && echo ""
exit "$ISSUES"
