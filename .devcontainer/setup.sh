#!/bin/bash

# Setup script for GitHub Codespaces
echo "🚀 Setting up Contract Intelligence development environment..."

# Install pnpm globally
echo "📦 Installing pnpm..."
npm install -g pnpm@8.6.1

# Install dependencies
echo "📦 Installing project dependencies..."
pnpm install

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

until redis-cli -h redis ping > /dev/null 2>&1; do
  echo "Waiting for Redis..."
  sleep 2
done

echo "✅ Services are ready!"

# Setup database if needed
echo "🗄️ Setting up database..."
pnpm db:push 2>/dev/null || echo "Database setup completed or already exists"

# Create .env files if they don't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cat > .env << EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/contract_intelligence

# Redis
REDIS_URL=redis://redis:6379

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=contracts

# API
API_PORT=3001
WEB_PORT=3002

# Development
NODE_ENV=development
DEMO_API_KEY=demo-board-2025
EOF
fi

if [ ! -f apps/api/.env ]; then
  echo "📝 Creating API .env file..."
  cp .env apps/api/.env
fi

if [ ! -f apps/web/.env.local ]; then
  echo "📝 Creating Web .env.local file..."
  cat > apps/web/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=your-secret-key
EOF
fi

echo "🎉 Setup complete! You can now run:"
echo "  pnpm dev        - Start all services"
echo "  pnpm dev:local  - Start without Docker dependencies"
echo "  pnpm launch     - Interactive launcher"