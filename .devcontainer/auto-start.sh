#!/bin/bash

# Auto-start script for Codespaces
# This runs after the container is created

echo "🔄 Auto-starting services..."

# Wait a bit for the system to be ready
sleep 5

# Start services in the background
nohup bash .devcontainer/start-services.sh > /tmp/services.log 2>&1 &

# Wait for services to be ready
sleep 10

# Start the application in the background
cd /workspaces/$(basename $PWD)
nohup pnpm dev > /tmp/app.log 2>&1 &

echo "✅ Services auto-started!"
echo "📋 Check logs:"
echo "  - Services: /tmp/services.log"
echo "  - App: /tmp/app.log"
