#!/bin/bash

echo "🚀 Starting Contract Intelligence services..."

# Start Redis and MinIO using docker-compose
if [ -f .devcontainer/docker-compose.codespaces.yml ]; then
  echo "📦 Starting Redis and MinIO..."
  docker compose -f .devcontainer/docker-compose.codespaces.yml up -d
fi

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check Redis
if docker exec codespaces-redis redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis is ready"
else
  echo "⚠️  Redis is not ready - checking status..."
  docker ps | grep redis || echo "Redis container not running"
fi

# Check MinIO
if curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
  echo "✅ MinIO is ready"
else
  echo "⚠️  MinIO is not ready - checking status..."
  docker ps | grep minio || echo "MinIO container not running"
fi

echo ""
echo "🎉 Services started! You can now run: pnpm dev"
