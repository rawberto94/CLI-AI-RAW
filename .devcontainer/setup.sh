#!/bin/bash
set -e

# Setup script for GitHub Codespaces
echo "🚀 Setting up Contract Intelligence development environment..."

# Install pnpm if not already installed
if ! command -v pnpm &> /dev/null; then
  echo "📦 Installing pnpm..."
  npm install -g pnpm@8.6.1
fi

# Install dependencies
echo "📦 Installing project dependencies..."
pnpm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cat > .env << 'EOF'
# Database (using Codespaces PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_intelligence

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3002
API_PORT=3001
WEB_PORT=3002

# Development
NODE_ENV=development
DEMO_API_KEY=demo-board-2025
EOF
  echo "⚠️  Please update .env with your OPENAI_API_KEY"
fi

# Initialize PostgreSQL if needed
echo "🗄️ Initializing PostgreSQL..."
if command -v psql &> /dev/null; then
  # Start PostgreSQL service
  sudo service postgresql start || true
  
  # Wait for PostgreSQL to be ready
  sleep 3
  
  # Create database and user if they don't exist
  sudo -u postgres psql -c "CREATE DATABASE contract_intelligence;" 2>/dev/null || echo "Database already exists"
  sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || echo "User already exists"
  sudo -u postgres psql -c "ALTER DATABASE contract_intelligence OWNER TO postgres;" 2>/dev/null || true
  sudo -u postgres psql -d contract_intelligence -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
  
  echo "✅ PostgreSQL is ready!"
else
  echo "⚠️  PostgreSQL not found. You may need to set up an external database."
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env with your OPENAI_API_KEY"
echo "  2. Run: pnpm dev"
echo ""