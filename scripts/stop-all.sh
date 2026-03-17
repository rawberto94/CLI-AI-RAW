#!/bin/bash
# ============================================================================
# stop-all.sh — Stop all development services
# ============================================================================
# Stops workers, web server, and optionally Docker containers.
# Usage:
#   bash scripts/stop-all.sh              # stop app processes (keep Docker)
#   bash scripts/stop-all.sh --docker     # also stop Docker containers
#   bash scripts/stop-all.sh --clean      # stop + remove .next cache + logs
# ============================================================================

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.logs"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}ℹ${NC}  $1"; }
ok()    { echo -e "${GREEN}✓${NC}  $1"; }

echo -e "${YELLOW}Stopping all services...${NC}"
echo ""

# ── 1. Workers ───────────────────────────────────────────────────────────────
if [ -f "$LOG_DIR/worker.pid" ]; then
    WORKER_PID=$(cat "$LOG_DIR/worker.pid")
    if kill -0 "$WORKER_PID" 2>/dev/null; then
        kill "$WORKER_PID" 2>/dev/null
        ok "Workers stopped (PID $WORKER_PID)"
    fi
    rm -f "$LOG_DIR/worker.pid"
fi
# Also kill any stray worker processes
pkill -f "tsx.*workers.*index" 2>/dev/null && ok "Stray worker processes killed" || true
pkill -f "tsx.*src/index.ts" 2>/dev/null || true

# ── 2. Web server ───────────────────────────────────────────────────────────
if [ -f "$LOG_DIR/web.pid" ]; then
    WEB_PID=$(cat "$LOG_DIR/web.pid")
    if kill -0 "$WEB_PID" 2>/dev/null; then
        kill "$WEB_PID" 2>/dev/null
        ok "Web server stopped (PID $WEB_PID)"
    fi
    rm -f "$LOG_DIR/web.pid"
fi
pkill -f "next dev" 2>/dev/null && ok "Next.js dev process killed" || true

# Give processes a moment to terminate
sleep 2

# ── 3. Docker (optional) ────────────────────────────────────────────────────
if [[ "${1:-}" == "--docker" || "${1:-}" == "--clean" ]]; then
    info "Stopping Docker containers..."
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.dev.yml down 2>/dev/null && ok "Docker containers stopped" || true
fi

# ── 4. Cleanup (optional) ───────────────────────────────────────────────────
if [[ "${1:-}" == "--clean" ]]; then
    info "Cleaning caches and logs..."
    rm -rf "$PROJECT_ROOT/apps/web/.next/cache"
    rm -rf "$LOG_DIR"/*.log
    ok "Caches and logs cleaned"
fi

# ── Status ───────────────────────────────────────────────────────────────────
echo ""
REMAINING=$(ps aux | grep -E 'next dev|tsx.*index' | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "${YELLOW}⚠  $REMAINING process(es) still running — may need manual kill${NC}"
    ps aux | grep -E 'next dev|tsx.*index' | grep -v grep
else
    ok "All application processes stopped"
fi

if command -v docker &>/dev/null; then
    CONTAINERS=$(docker ps --format '{{.Names}}' | grep 'contract-intelligence' | wc -l)
    if [ "$CONTAINERS" -gt 0 ]; then
        info "Docker containers still running ($CONTAINERS). Use --docker to stop them."
    fi
fi
echo ""
