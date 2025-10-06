#!/bin/bash

echo "🔄 Updating from GitHub..."
echo ""

# Stop any running processes
echo "⏸️  Stopping running processes..."
pm2 stop all 2>/dev/null || true

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Install any new dependencies
echo "📦 Installing dependencies..."
pnpm install

# Restart services
echo "🚀 Restarting services..."
./start-persistent.sh

echo ""
echo "✅ Update complete!"
