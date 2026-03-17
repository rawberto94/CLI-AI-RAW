#!/bin/bash
# ============================================================================
# start-all.sh — Start all services for development
# ============================================================================
# Starts Docker services, BullMQ workers, and the Next.js dev server.
# Usage:
#   bash scripts/start-all.sh          # interactive (foreground)
#   bash scripts/start-all.sh --bg     # start everything in background
#   bash scripts/start-all.sh --check  # preflight check only (no start)
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}ℹ${NC}  $1"; }
ok()      { echo -e "${GREEN}✓${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
fail()    { echo -e "${RED}✗${NC}  $1"; }

# ── PID / log bookkeeping ───────────────────────────────────────────────────
WORKER_PID=""
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

cleanup() {
    echo ""
    info "Shutting down..."
    [ -n "$WORKER_PID" ] && kill "$WORKER_PID" 2>/dev/null && info "Workers stopped"
    rm -f "$LOG_DIR/worker.pid"
    exit 0
}
trap cleanup EXIT INT TERM

# ── 1. Preflight checks ─────────────────────────────────────────────────────
preflight() {
    local errors=0
    info "Running preflight checks..."

    # Node
    if command -v node &>/dev/null; then
        ok "Node $(node -v)"
    else
        fail "Node.js not found"; errors=$((errors + 1))
    fi

    # pnpm
    if command -v pnpm &>/dev/null; then
        ok "pnpm $(pnpm -v)"
    else
        fail "pnpm not found (npm i -g pnpm)"; errors=$((errors + 1))
    fi

    # Docker
    if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
        ok "Docker available"
    else
        fail "Docker daemon not reachable"; errors=$((errors + 1))
    fi

    # .env
    if [ -f "$PROJECT_ROOT/.env" ]; then
        ok ".env file exists"
    else
        fail ".env file missing — copy from .env.example"; errors=$((errors + 1))
    fi

    # Critical env vars
    if [ -f "$PROJECT_ROOT/.env" ]; then
        local missing_vars=()
        for var in DATABASE_URL REDIS_URL NEXTAUTH_SECRET OPENAI_API_KEY; do
            if ! grep -qE "^${var}=" "$PROJECT_ROOT/.env"; then
                missing_vars+=("$var")
            fi
        done
        if [ ${#missing_vars[@]} -gt 0 ]; then
            fail "Missing env vars: ${missing_vars[*]}"
            errors=$((errors + 1))
        else
            ok "Critical env vars present (DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, OPENAI_API_KEY)"
        fi
    fi

    # node_modules
    if [ -d "$PROJECT_ROOT/node_modules" ]; then
        ok "node_modules installed"
    else
        warn "node_modules missing — will run pnpm install"
    fi

    # Prisma client
    if [ -d "$PROJECT_ROOT/node_modules/.prisma/client" ]; then
        ok "Prisma client generated"
    else
        warn "Prisma client not generated — will run db:push"
    fi

    echo ""
    if [ "$errors" -gt 0 ]; then
        fail "$errors preflight error(s). Fix before starting."
        return 1
    fi
    ok "All preflight checks passed"
    return 0
}

# ── 2. Docker services ──────────────────────────────────────────────────────
start_docker() {
    info "Ensuring Docker services (postgres, redis, minio, neo4j)..."

    if docker ps --format '{{.Names}}' | grep -q "contract-intelligence-postgres-dev"; then
        ok "Docker services already running"
    else
        docker compose -f docker-compose.dev.yml up -d
        ok "Docker services started"
    fi

    # Wait for postgres + redis to be healthy
    local retries=0
    while [ $retries -lt 30 ]; do
        local pg_ok=false redis_ok=false

        if docker exec contract-intelligence-postgres-dev pg_isready -U postgres &>/dev/null 2>&1; then
            pg_ok=true
        fi
        if docker exec contract-intelligence-redis-dev redis-cli ping 2>/dev/null | grep -q PONG; then
            redis_ok=true
        fi

        if $pg_ok && $redis_ok; then
            ok "PostgreSQL ready"
            ok "Redis ready"
            return 0
        fi

        retries=$((retries + 1))
        sleep 1
    done
    fail "Docker services did not become healthy within 30s"
    return 1
}

# ── 3. Dependencies & schema ────────────────────────────────────────────────
ensure_deps() {
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        info "Installing dependencies..."
        pnpm install --frozen-lockfile
        ok "Dependencies installed"
    fi

    if [ ! -d "$PROJECT_ROOT/node_modules/.prisma/client" ]; then
        info "Pushing Prisma schema..."
        pnpm exec prisma db push --schema packages/clients/db/schema.prisma --accept-data-loss 2>/dev/null
        ok "Prisma schema synced"
    fi
}

# ── 4. Workers ───────────────────────────────────────────────────────────────
start_workers() {
    # Kill stale workers
    pkill -f "tsx.*workers.*index" 2>/dev/null || true
    sleep 1

    info "Starting BullMQ workers..."
    cd "$PROJECT_ROOT/packages/workers"
    NODE_OPTIONS="--max-old-space-size=8192" npx tsx src/index.ts \
        > "$LOG_DIR/workers.log" 2>&1 &
    WORKER_PID=$!
    echo "$WORKER_PID" > "$LOG_DIR/worker.pid"

    # Verify it didn't crash immediately
    sleep 3
    if kill -0 "$WORKER_PID" 2>/dev/null; then
        ok "Workers started (PID $WORKER_PID) — logs: .logs/workers.log"
    else
        fail "Workers crashed on startup. Check .logs/workers.log"
        return 1
    fi
    cd "$PROJECT_ROOT"
}

# ── 5. Web server ───────────────────────────────────────────────────────────
start_web() {
    info "Clearing Next.js cache..."
    rm -rf "$PROJECT_ROOT/apps/web/.next/cache"

    info "Starting Next.js dev server on port ${PORT:-3005}..."
    cd "$PROJECT_ROOT/apps/web"
    NEXT_TELEMETRY_DISABLED=1 pnpm dev
}

start_web_bg() {
    info "Clearing Next.js cache..."
    rm -rf "$PROJECT_ROOT/apps/web/.next/cache"

    info "Starting Next.js dev server (background)..."
    cd "$PROJECT_ROOT/apps/web"
    NEXT_TELEMETRY_DISABLED=1 pnpm dev > "$LOG_DIR/web.log" 2>&1 &
    local web_pid=$!
    echo "$web_pid" > "$LOG_DIR/web.pid"
    sleep 5
    if kill -0 "$web_pid" 2>/dev/null; then
        ok "Web server started (PID $web_pid) — logs: .logs/web.log"
    else
        fail "Web server failed to start. Check .logs/web.log"
        return 1
    fi
    cd "$PROJECT_ROOT"
}

# ── 6. Summary ──────────────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  All services running${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${GREEN}Web:${NC}        http://localhost:${PORT:-3005}"
    echo -e "  ${GREEN}Postgres:${NC}   localhost:5432"
    echo -e "  ${GREEN}Redis:${NC}      localhost:6379"
    echo -e "  ${GREEN}MinIO:${NC}      http://localhost:9001 (console)"
    echo -e "  ${GREEN}Neo4j:${NC}      http://localhost:7474"
    echo -e "  ${GREEN}Workers:${NC}    PID $WORKER_PID — .logs/workers.log"
    echo ""
    echo -e "  ${YELLOW}Stop:${NC}       bash scripts/stop-all.sh"
    echo -e "  ${YELLOW}Health:${NC}     bash scripts/health-check.sh"
    echo -e "  ${YELLOW}Logs:${NC}       tail -f .logs/workers.log"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    local mode="${1:-}"

    echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   Contract Intelligence — Start All          ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""

    # Preflight only
    if [ "$mode" = "--check" ]; then
        preflight
        exit $?
    fi

    preflight || exit 1
    start_docker || exit 1
    ensure_deps
    start_workers || exit 1

    if [ "$mode" = "--bg" ]; then
        start_web_bg || exit 1
        print_summary
        echo -e "${GREEN}All services running in background. Use 'bash scripts/stop-all.sh' to stop.${NC}"
        # Detach from trap so background processes persist
        trap - EXIT
    else
        print_summary
        echo -e "${GREEN}Press Ctrl+C to stop everything.${NC}"
        start_web  # foreground — blocks here
    fi
}

main "$@"
