#!/bin/bash

echo "🔧 Auto-fixing and starting Contract Intelligence Platform..."
echo ""

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main
echo ""

# Check if services are running
echo "🔍 Checking current status..."
echo ""

# Stop any existing PM2 processes
echo "⏸️  Stopping any existing app processes..."
pm2 delete all 2>/dev/null || true
echo ""

# Stop and restart Docker services
echo "🔄 Restarting backend services..."
docker compose -f .devcontainer/docker-compose.codespaces.yml down 2>/dev/null || true
sleep 2

echo "📦 Starting Redis and MinIO..."
docker compose -f .devcontainer/docker-compose.codespaces.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are up
echo ""
echo "✅ Checking service health..."
if docker ps | grep -q codespaces-redis; then
  echo "  ✅ Redis is running"
else
  echo "  ❌ Redis failed to start"
fi

if docker ps | grep -q codespaces-minio; then
  echo "  ✅ MinIO is running"
else
  echo "  ❌ MinIO failed to start"
fi

echo ""
echo "📦 Installing/updating dependencies..."
pnpm install --silent

echo ""
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js

echo ""
echo "⏳ Waiting for app to start..."
sleep 5

echo ""
echo "📊 Status:"
pm2 status

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Your app should be running on port 3002"
echo "   Click the PORTS tab and open port 3002 in your browser"
echo ""
echo "📋 Useful commands:"
echo "   pm2 logs          - View app logs"
echo "   pm2 restart all   - Restart app"
echo "   ./check-services.sh - Check service status"
echo ""
