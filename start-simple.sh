#!/bin/bash

echo "🚀 Starting Contract Intelligence Platform (Simple Mode)"
echo ""
echo "ℹ️  Running without Docker services (Redis/MinIO)"
echo "   Files will be stored in memory/local filesystem"
echo ""

# Stop any existing PM2 processes
echo "⏸️  Stopping any existing processes..."
pm2 delete all 2>/dev/null || true

# Install PM2 if not available
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  npm install -g pm2
fi

echo ""
echo "📦 Installing dependencies..."
pnpm install --silent

echo ""
echo "🚀 Starting application..."
pm2 start ecosystem.config.js

echo ""
echo "⏳ Waiting for app to start..."
sleep 5

echo ""
echo "📊 Status:"
pm2 status

echo ""
echo "✅ App started!"
echo ""
echo "🌐 Access your app:"
echo "   1. Go to the PORTS tab in VS Code"
echo "   2. Click the globe icon on port 3002"
echo ""
echo "⚠️  Note: Running in simple mode without Redis/MinIO"
echo "   - Files stored locally in ./uploads/"
echo "   - Background processing may be limited"
echo ""
echo "📋 Commands:"
echo "   pm2 logs          - View logs"
echo "   pm2 restart all   - Restart"
echo "   pm2 stop all      - Stop"
echo ""
