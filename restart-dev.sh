#!/bin/bash
# Quick restart script for dev server with cache clear

echo "🧹 Stopping dev server and workers..."
pkill -f "next dev" 2>/dev/null
pkill -f "tsx.*workers.*index" 2>/dev/null
sleep 2

echo "🗑️  Clearing Next.js cache..."
cd /workspaces/CLI-AI-RAW/apps/web
rm -rf .next/cache

echo "🔧 Starting BullMQ workers..."
cd /workspaces/CLI-AI-RAW/packages/workers
NODE_OPTIONS="--max-old-space-size=8192" npx tsx src/index.ts &
WORKER_PID=$!
echo "   Workers started (PID: $WORKER_PID)"

trap "kill $WORKER_PID 2>/dev/null" EXIT

echo "🚀 Starting dev server with Turbopack..."
cd /workspaces/CLI-AI-RAW/apps/web
pnpm dev
