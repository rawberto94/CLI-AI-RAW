#!/bin/bash
# ============================================================================
# .devcontainer/setup.sh — Safe dev container setup (Codespaces compatible)
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Dev Container Setup ==="
echo ""

# 1. Enable corepack for pnpm
echo "1/5 Enabling corepack..."
corepack enable 2>/dev/null || true

# 2. Install dependencies (safe fallback)
echo "2/5 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install || {
    echo "   ⚠ pnpm install failed — continuing (you can retry manually)"
}

# 3. Set up .env if missing
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "3/5 Creating .env from .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env" || true

    # Set dev defaults safely
    sed -i 's|postgresql://user:password@localhost:5432/contract_intelligence.*|postgresql://postgres:postgres@localhost:5432/contracts|' "$PROJECT_ROOT/.env" || true

    echo 'REDIS_URL="redis://localhost:6379"' >> "$PROJECT_ROOT/.env" || true
    echo 'DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contracts"' >> "$PROJECT_ROOT/.env" || true

    echo "   ⚠ Edit .env to add API keys (OPENAI_API_KEY, MISTRAL_API_KEY, etc.)"
else
    echo "3/5 .env already exists — skipping"
fi

# 4. Skip Docker startup (CRITICAL FIX)
echo "4/5 Skipping Docker startup (run manually after container starts)"

# 5. Skip Prisma (depends on DB)
echo "5/5 Skipping Prisma (run after DB is ready)"

echo ""
echo "=== Setup Complete (Safe Mode) ==="
echo ""
echo "Next steps:"
echo "  1. Start services: docker compose up -d"
echo "  2. Run Prisma: pnpm exec prisma db push"
echo "  3. Start app: pnpm dev"
echo "  4. Open: http://localhost:3005"
echo ""
