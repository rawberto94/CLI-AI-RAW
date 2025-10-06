#!/bin/bash

echo "🚀 Starting Contract Intelligence services..."

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
sudo service postgresql start

# Start Redis and MinIO using docker-compose
if [ -f .devcontainer/docker-compose.codespaces.yml ]; then
  echo "📦 Starting Redis and MinIO..."
  docker-compose -f .devcontainer/docker-compose.codespaces.yml up -d
fi

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 3

# Check PostgreSQL
if pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
  echo "✅ PostgreSQL is ready"
else
  echo "⚠️  PostgreSQL is not ready"
fi

# Check Redis
if docker exec codespaces-redis redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis is ready"
else
  echo "⚠️  Redis is not ready"
fi

# Check MinIO
if curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
  echo "✅ MinIO is ready"
else
  echo "⚠️  MinIO is not ready"
fi

echo ""
echo "🎉 Services started! You can now run: pnpm dev"
