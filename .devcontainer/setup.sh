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

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env with your OPENAI_API_KEY (if needed)"
echo "  2. Run: ./launch.sh"
echo ""