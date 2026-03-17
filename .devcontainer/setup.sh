#!/bin/bash
# ============================================================================
# .devcontainer/setup.sh — First-time dev container setup
# ============================================================================
# Called by `pnpm setup`. Sets up the workspace after a fresh clone/create.
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Dev Container Setup ==="
echo ""

# 1. Enable corepack for pnpm
echo "1/5 Enabling corepack..."
corepack enable 2>/dev/null || true

# 2. Install dependencies
echo "2/5 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 3. Set up .env if missing
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "3/5 Creating .env from .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    # Set dev defaults
    sed -i 's|postgresql://user:password@localhost:5432/contract_intelligence.*|postgresql://postgres:postgres@localhost:5432/contracts|' "$PROJECT_ROOT/.env"
    echo 'REDIS_URL="redis://localhost:6379"' >> "$PROJECT_ROOT/.env"
    echo 'DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contracts"' >> "$PROJECT_ROOT/.env"
    echo "   ⚠  Edit .env to add your API keys (OPENAI_API_KEY, MISTRAL_API_KEY, etc.)"
else
    echo "3/5 .env already exists — skipping"
fi

# 4. Start Docker services
echo "4/5 Starting Docker services..."
bash "$PROJECT_ROOT/.devcontainer/start-services.sh"

# 5. Push Prisma schema
echo "5/5 Syncing database schema..."
pnpm exec prisma db push --schema packages/clients/db/schema.prisma --accept-data-loss 2>/dev/null || {
    echo "   Prisma push failed — will retry on first start"
}

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run: bash scripts/start-all.sh"
echo "  3. Open: http://localhost:3005"
echo ""
