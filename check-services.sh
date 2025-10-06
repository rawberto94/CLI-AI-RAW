#!/bin/bash

echo "🔍 Checking Service Status..."
echo ""

echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "❌ Docker not available or no containers running"
echo ""

echo "=== Port Status ==="
echo "Checking if services are listening on expected ports..."
echo ""

check_port() {
  local port=$1
  local service=$2
  if lsof -i :$port > /dev/null 2>&1; then
    echo "✅ $service (port $port) - RUNNING"
  else
    echo "❌ $service (port $port) - NOT RUNNING"
  fi
}

check_port 3002 "Web App"
check_port 3001 "API Server"
check_port 6379 "Redis"
check_port 9000 "MinIO API"
check_port 9001 "MinIO Console"

echo ""
echo "=== Environment Check ==="
if [ -f .env ]; then
  echo "✅ .env file exists"
  echo ""
  echo "Key variables:"
  grep -E "^(S3_ENDPOINT|S3_BUCKET|REDIS_URL|DATABASE_URL|OPENAI_API_KEY)" .env | sed 's/=.*/=***/' || echo "No key variables found"
else
  echo "❌ .env file not found"
fi

echo ""
echo "=== MinIO Health Check ==="
if curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
  echo "✅ MinIO is healthy"
else
  echo "❌ MinIO is not responding"
fi

echo ""
echo "=== Redis Health Check ==="
if docker exec codespaces-redis redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis is healthy"
elif redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis is healthy (local)"
else
  echo "❌ Redis is not responding"
fi

echo ""
echo "=== PM2 Status (if running) ==="
pm2 status 2>/dev/null || echo "PM2 not running or not installed"

echo ""
echo "=== Recommendations ==="
if ! docker ps | grep -q codespaces-redis; then
  echo "⚠️  Start services with: bash .devcontainer/start-services.sh"
fi

if ! lsof -i :3002 > /dev/null 2>&1; then
  echo "⚠️  Start app with: ./launch.sh or ./start-persistent.sh"
fi
