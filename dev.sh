#!/bin/bash
# Stable dev server with automatic cache clearing

echo "🧹 Clearing Turbopack cache..."
cd /workspaces/CLI-AI-RAW/apps/web
rm -rf .next/cache

echo "� Starting BullMQ workers..."
cd /workspaces/CLI-AI-RAW/packages/workers
NODE_OPTIONS="--max-old-space-size=8192" npx tsx src/index.ts &
WORKER_PID=$!
echo "   Workers started (PID: $WORKER_PID)"

# Ensure workers are stopped when the script exits
trap "kill $WORKER_PID 2>/dev/null" EXIT

echo "🚀 Starting dev server..."
cd /workspaces/CLI-AI-RAW/apps/web
NEXT_TELEMETRY_DISABLED=1 pnpm dev
