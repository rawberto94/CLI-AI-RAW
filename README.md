# Contract Intelligence Platform

Enterprise contract management and analysis platform with AI-powered search and processing.

## Quick Start

### Option 1: GitHub Codespaces (Recommended)

The easiest way to get started:

1. Click "Code" → "Codespaces" → "Create codespace"
2. Wait for setup to complete (~2-3 minutes)
3. Update `.env` with your OpenAI API key
4. Run: `./launch.sh`

See [CODESPACES_SETUP.md](./CODESPACES_SETUP.md) for detailed instructions.

### Option 2: Local Development

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- pnpm (recommended) or npm

#### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/contracts
OPENAI_API_KEY=sk-your-key-here
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Features

- **Contract Management**: Upload, process, and manage contracts
- **AI-Powered Search**: Full-text, vector, and hybrid search capabilities
- **Rate Card Management**: Import and analyze rate cards
- **Use Cases**: Pre-built workflows for common procurement tasks
- **Analytics**: Contract analytics and insights

## Project Structure

```
├── apps/
│   ├── api/          # API services
│   ├── core/         # Core business logic
│   ├── web/          # Next.js web application
│   └── workers/      # Background workers
├── packages/
│   ├── clients/      # Database clients
│   └── schemas/      # Shared schemas
└── README.md
```

## Development

```bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start
```

## API Documentation

API documentation is available at `/api-docs` when running the development server.

## License

Proprietary
