#!/bin/bash

echo "🚀 Starting Contract Intelligence Platform (Persistent Mode)..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  echo "Please create .env file with your configuration."
  exit 1
fi

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2 process manager..."
  npm install -g pm2
fi

# Start backend services (Redis and MinIO)
echo "📦 Starting backend services..."
bash .devcontainer/start-services.sh

echo ""
echo "🌐 Starting application with PM2..."
echo ""

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true

# Start the application with PM2
pm2 start ecosystem.config.js

# Show status
pm2 status

echo ""
echo "✅ Application is running!"
echo ""
echo "📊 Useful commands:"
echo "  pm2 status          - Check app status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart app"
echo "  pm2 stop all        - Stop app"
echo "  pm2 delete all      - Remove from PM2"
echo ""
echo "🌐 Access your app on port 3002"
