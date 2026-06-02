#!/bin/bash
# ============================================================================
# demo-startup.sh — One-command demo / production preview
# ============================================================================
# Builds the Next.js app with standalone output and starts the production
# server. This is ~5-10x faster than webpack dev mode through a tunnel.
#
# Usage:
#   bash scripts/demo-startup.sh          # build + start
#   bash scripts/demo-startup.sh --skip-build  # start only (if already built)
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

SKIP_BUILD=false
if [ "${1:-}" = "--skip-build" ]; then
    SKIP_BUILD=true
fi

# ── Preflight checks ────────────────────────────────────────────────────────
info "Running demo preflight checks..."

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    fail ".env file missing — copy from .env.example and fill in your values"
    exit 1
fi
ok ".env file exists"

for var in DATABASE_URL REDIS_URL NEXTAUTH_SECRET OPENAI_API_KEY; do
    if ! grep -qE "^${var}=" "$PROJECT_ROOT/.env" || grep -qE "^${var}=\".*(your-|password|key-here).*\"" "$PROJECT_ROOT/.env"; then
        warn "$var may be unset or still has placeholder value"
    fi
done

# ── Build ───────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
    info "Building Next.js app (standalone output)..."
    pnpm build:web
    ok "Build complete"
else
    info "Skipping build (--skip-build)"
fi

# ── Start ───────────────────────────────────────────────────────────────────
info "Starting production server..."
warn "This runs in production mode — much faster than dev through a tunnel"
warn "Press Ctrl+C to stop"
echo ""

# Use the web app's start script
pnpm start
