# Contract Intelligence Platform

Enterprise contract management and analysis platform with AI-powered search and processing.

## 🚀 Quick Start (Launch Package Ready!)

### Production Launch (Recommended)

```bash
./launch-production.sh
```

**What it does:**

- ✅ Verifies all prerequisites (Node, PNPM)
- ✅ Installs dependencies
- ✅ Builds production bundle (66 pages)
- ✅ Runs comprehensive health checks
- ✅ Starts server on port 3005
- ✅ Opens browser automatically
- ✅ Tails live logs

### Development Mode

```bash
./launch-development.sh
```

**Features:**

- 🔥 Hot reload enabled
- 🎯 Real-time logs
- 🔧 Development environment
- ⚡ Fast iteration

### Test Everything

```bash
./test-all-features.sh
```

**Tests 30+ features:**

- Health endpoints
- Contract APIs
- Page loads
- Use cases
- Analytics

### Stop Server

```bash
./stop-server.sh
```

## 📚 Documentation

- **[LAUNCH_PACKAGE_READY.md](./LAUNCH_PACKAGE_READY.md)** - Complete overview (START HERE!)
- **[LAUNCH_PACKAGE.md](./LAUNCH_PACKAGE.md)** - Detailed documentation
- **[CODESPACES_SETUP.md](./CODESPACES_SETUP.md)** - Codespaces instructions

## ✨ System Status

- **Build**: ✅ 66 pages, 0 errors
- **Health**: ✅ 36/36 tests passing
- **Features**: ✅ All operational
- **Stack**: Next.js 15.1.4, React 19, TypeScript 5.7.2

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
