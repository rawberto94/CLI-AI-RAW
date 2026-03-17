#!/bin/bash
# ============================================================================
# preflight.sh — Validate environment before first run
# ============================================================================
# Checks everything needed for the platform to work end-to-end:
#   - Runtime dependencies (node, pnpm, docker)
#   - .env file with required variables
#   - Docker compose file
#   - Node modules
#   - Prisma schema
#   - Port availability
#
# Usage:
#   bash scripts/preflight.sh
#
# Exit codes: 0 = ready, 1 = errors (fix before running)
# ============================================================================

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

ERRORS=0
WARNINGS=0

pass()  { echo -e "  ${GREEN}✓${NC}  $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $1"; WARNINGS=$((WARNINGS + 1)); }
fail()  { echo -e "  ${RED}✗${NC}  $1"; ERRORS=$((ERRORS + 1)); }

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Preflight Environment Check                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Runtime tools ─────────────────────────────────────────────────────────
echo -e "${BLUE}Runtime Dependencies${NC}"

if command -v node &>/dev/null; then
    NODE_V=$(node -v)
    NODE_MAJOR=$(echo "$NODE_V" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        pass "Node.js $NODE_V"
    else
        fail "Node.js $NODE_V — need v18+ (v20 recommended)"
    fi
else
    fail "Node.js not installed"
fi

if command -v pnpm &>/dev/null; then
    pass "pnpm $(pnpm -v)"
else
    fail "pnpm not installed — run: npm install -g pnpm"
fi

if command -v docker &>/dev/null; then
    if docker info &>/dev/null 2>&1; then
        pass "Docker daemon running"
    else
        fail "Docker installed but daemon not running"
    fi
else
    fail "Docker not installed"
fi

if command -v git &>/dev/null; then
    pass "Git $(git --version | cut -d' ' -f3)"
else
    warn "Git not found (not critical but recommended)"
fi

# ── 2. Project files ────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}Project Files${NC}"

if [ -f "$PROJECT_ROOT/docker-compose.dev.yml" ]; then
    pass "docker-compose.dev.yml"
else
    fail "docker-compose.dev.yml missing"
fi

if [ -f "$PROJECT_ROOT/packages/clients/db/schema.prisma" ]; then
    pass "Prisma schema"
else
    fail "Prisma schema not found at packages/clients/db/schema.prisma"
fi

if [ -f "$PROJECT_ROOT/packages/workers/src/index.ts" ]; then
    pass "Workers entry point"
else
    fail "packages/workers/src/index.ts missing"
fi

if [ -f "$PROJECT_ROOT/apps/web/package.json" ]; then
    pass "Web app package.json"
else
    fail "apps/web/package.json missing"
fi

# ── 3. Environment variables ────────────────────────────────────────────────
echo ""
echo -e "${BLUE}Environment Configuration${NC}"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    fail ".env file does not exist"
    echo -e "     Run: ${CYAN}cp .env.example .env${NC} and edit with your values"
else
    pass ".env file exists"

    # Required vars (app won't start without these)
    REQUIRED_VARS=(
        "DATABASE_URL"
        "REDIS_URL"
        "NEXTAUTH_SECRET"
        "NEXTAUTH_URL"
    )

    # Important vars (features will be degraded without these)
    IMPORTANT_VARS=(
        "OPENAI_API_KEY"
        "MISTRAL_API_KEY"
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"
        "AZURE_DOCUMENT_INTELLIGENCE_KEY"
        "CREDENTIAL_ENCRYPTION_KEY"
    )

    # Optional vars
    OPTIONAL_VARS=(
        "MINIO_ENDPOINT"
        "MINIO_ACCESS_KEY"
        "MINIO_SECRET_KEY"
        "NODE_ENV"
    )

    PLACEHOLDER_PATTERNS="your-|sk-\.\.\.|change-me|example|placeholder|xxx"

    check_var() {
        local var="$1" level="$2"
        local val
        val=$(grep "^${var}=" "$PROJECT_ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
        if [ -z "$val" ]; then
            if [ "$level" = "required" ]; then
                fail "$var — not set (REQUIRED)"
            elif [ "$level" = "important" ]; then
                warn "$var — not set (AI features will be limited)"
            fi
            return 1
        elif echo "$val" | grep -qEi "$PLACEHOLDER_PATTERNS"; then
            if [ "$level" = "required" ]; then
                fail "$var — still has placeholder value"
            elif [ "$level" = "important" ]; then
                warn "$var — still has placeholder value"
            fi
            return 1
        else
            pass "$var"
            return 0
        fi
    }

    for var in "${REQUIRED_VARS[@]}"; do
        check_var "$var" "required"
    done

    for var in "${IMPORTANT_VARS[@]}"; do
        check_var "$var" "important"
    done

    for var in "${OPTIONAL_VARS[@]}"; do
        check_var "$var" "optional" 2>/dev/null || true
    done
fi

# ── 4. Dependencies ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}Dependencies${NC}"

if [ -d "$PROJECT_ROOT/node_modules" ]; then
    pass "Root node_modules"
else
    warn "node_modules missing — run: pnpm install"
fi

if [ -d "$PROJECT_ROOT/apps/web/node_modules" ] || [ -d "$PROJECT_ROOT/node_modules/.pnpm" ]; then
    pass "Web app dependencies"
else
    warn "Web app node_modules not found"
fi

if [ -d "$PROJECT_ROOT/node_modules/.prisma/client" ] || [ -n "$(find "$PROJECT_ROOT/node_modules/.pnpm" -path "*/.prisma/client/index.js" -print -quit 2>/dev/null)" ]; then
    pass "Prisma client generated"
else
    warn "Prisma client not generated — run: pnpm db:push"
fi

# ── 5. Port availability ────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}Port Availability${NC}"

check_port() {
    local port="$1" name="$2" expected="${3:-no}"
    if command -v lsof &>/dev/null; then
        if lsof -i ":$port" &>/dev/null; then
            local proc pname
            proc=$(lsof -i ":$port" -t 2>/dev/null | head -1)
            pname=$(ps -p "$proc" -o comm= 2>/dev/null || echo "unknown")
            if [ "$expected" = "docker" ]; then
                pass "Port $port ($name) — running ($pname)"
            else
                warn "Port $port ($name) — in use by $pname (PID $proc)"
            fi
        else
            if [ "$expected" = "docker" ]; then
                warn "Port $port ($name) — NOT running (start Docker services first)"
            else
                pass "Port $port ($name) — available"
            fi
        fi
    elif command -v netstat &>/dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            if [ "$expected" = "docker" ]; then
                pass "Port $port ($name) — running"
            else
                warn "Port $port ($name) — in use"
            fi
        else
            if [ "$expected" = "docker" ]; then
                warn "Port $port ($name) — NOT running"
            else
                pass "Port $port ($name) — available"
            fi
        fi
    else
        pass "Port $port ($name) — cannot check (no lsof/netstat)"
    fi
}

check_port 3005 "Next.js dev"
check_port 5432 "PostgreSQL" "docker"
check_port 6379 "Redis" "docker"
check_port 9000 "MinIO API" "docker"
check_port 9001 "MinIO Console" "docker"
check_port 7474 "Neo4j Browser" "docker"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo -e "${GREEN}  All checks passed — ready to start!${NC}"
    echo -e "  Run: ${CYAN}bash scripts/start-all.sh${NC}"
elif [ "$ERRORS" -eq 0 ]; then
    echo -e "${YELLOW}  $WARNINGS warning(s) — can start but some features may not work${NC}"
    echo -e "  Run: ${CYAN}bash scripts/start-all.sh${NC}"
else
    echo -e "${RED}  $ERRORS error(s), $WARNINGS warning(s) — fix errors before starting${NC}"
fi
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit "$ERRORS"
