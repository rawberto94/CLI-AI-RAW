#!/bin/bash

echo "🚀 Launching Contract Intelligence Platform..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  echo "Please create .env file with your configuration."
  echo "Run: cp .env.example .env"
  exit 1
fi

# Check if OPENAI_API_KEY is set
if grep -q "your_openai_api_key_here" .env; then
  echo "⚠️  Warning: OPENAI_API_KEY not configured in .env"
  echo "Please update your .env file with a valid OpenAI API key"
  echo ""
fi

# Start services
echo "📦 Starting services..."
bash .devcontainer/start-services.sh

echo ""
echo "🌐 Starting application..."
echo ""

# Start the dev server
pnpm dev
