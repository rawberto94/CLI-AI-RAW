# 🚀 Unified Contract Intelligence Launcher

The Contract Intelligence project includes a comprehensive, unified launcher that automatically detects your development environment and provides intelligent orchestration for all services.

## Quick Start

```bash
# One-time setup (any environment)
pnpm launch:setup

# Start full development environment
pnpm launch

# Or use the direct command
pnpm launch
```

## Environment Detection

The launcher automatically detects and adapts to your environment:

- **🏠 Local Development**: Uses Docker Compose for PostgreSQL, Redis, and MinIO
- **☁️ GitHub Codespaces**: Uses pre-configured container services 
- **🐳 Dev Container**: Uses Docker Compose services in containerized environment

## Commands

### Development

| Command | Description |
|---------|-------------|
| `pnpm launch` | Start full development environment (API + Web + Workers) |
| `pnpm launch:api` | Start API server only |
| `pnpm launch:web` | Start Web server only |
| `pnpm launch:workers` | Start Workers only |
| `pnpm launch:both` | Start API + Web (skip infra if running) |

### Production

| Command | Description |
|---------|-------------|
| `pnpm launch:start` | Build and start all services in production mode |
| `pnpm launch:start:api` | Build and start API only (production) |
| `pnpm launch:start:web` | Build and start Web only (production) |

### Utilities

| Command | Description |
|---------|-------------|
| `pnpm launch:setup` | One-time environment setup and dependencies |
| `pnpm launch:env` | Show environment info and configuration |
| `pnpm launch:health` | Run health checks for all services |
| `pnpm launch:stop` | Stop all services and free ports |

## Options

Add these flags to any launch command:

- `--no-infra` - Skip infrastructure startup
- `--no-db` - Skip database setup
- `--open` - Open browser after startup
- `--worker-only` - Force worker-only processing (API)
- `--direct` - Force direct extraction (API)
- `--codespaces` - Force Codespaces environment mode
- `--local` - Force local Docker environment mode

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:3001 | REST API and OpenAPI docs |
| Web | http://localhost:3002 | Next.js web interface |
| Workers | Background | Async processing workers |

### API Endpoints

- **Health**: http://localhost:3001/healthz
- **Docs**: http://localhost:3001/docs
- **OpenAPI**: http://localhost:3001/openapi.json

## Environment-Specific Configurations

### Local Development

When running locally, the launcher:
1. Starts Docker Compose infrastructure (PostgreSQL, Redis, MinIO)
2. Waits for services to be ready
3. Configures MinIO bucket
4. Sets up database schema
5. Starts development servers

**Required**: Docker Desktop or Docker Engine

### GitHub Codespaces

When running in Codespaces, the launcher:
1. Uses pre-configured container services
2. Skips Docker infrastructure startup
3. Connects to container databases
4. Sets up environment files
5. Starts development servers

**Benefits**: Zero setup, consistent environment, collaborative development

### Manual Environment Override

Force a specific environment mode:

```bash
# Force Codespaces mode (even locally)
pnpm launch --codespaces

# Force local mode (even in containers)  
pnpm launch --local
```

## Development Workflow

### First Time Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd contract-intelligence

# 2. One-time setup
pnpm launch:setup

# 3. Start development
pnpm launch
```

### Daily Development

```bash
# Start everything
pnpm launch

# Or start specific services
pnpm launch:api      # API only
pnpm launch:web      # Web only
pnpm launch:workers  # Workers only

# Check health
pnpm launch:health

# Stop services
pnpm launch:stop
```

### Production Testing

```bash
# Build and test production build
pnpm launch:start

# Or test specific services
pnpm launch:start:api
pnpm launch:start:web
```

## Troubleshooting

### Check Environment

```bash
pnpm launch:env
```

This shows:
- Detected environment type
- Docker availability
- Service URLs
- Configuration values

### Common Issues

**Docker not available**:
```bash
# Install Docker Desktop or use Codespaces
pnpm launch --codespaces  # Force Codespaces mode
```

**Port conflicts**:
```bash
pnpm launch:stop  # Free ports 3001, 3002, 3003
```

**Database connection issues**:
```bash
pnpm launch:setup  # Recreate environment files
```

**Services not responding**:
```bash
pnpm launch:health  # Check service health
```

## Advanced Usage

### Custom Environment Variables

The launcher respects existing environment variables:

```bash
# Custom database
export DATABASE_URL="postgresql://user:pass@host:5432/db"

# Custom API URL
export NEXT_PUBLIC_API_URL="https://api.example.com"

# Custom OpenAI model
export OPENAI_MODEL="gpt-4"

pnpm launch
```

### Worker Processing Modes

```bash
# Force worker-only processing (no direct extraction)
pnpm launch --worker-only

# Force direct extraction in API (no workers)
pnpm launch --direct
```

### Development with Browser

```bash
# Auto-open browser after startup
pnpm launch --open
pnpm launch:web --open
pnpm launch:health --open
```

## Script Details

The launcher is implemented in `scripts/launch.mjs` and provides:

- **Environment Detection**: Automatic detection of local, Codespaces, and dev container environments
- **Intelligent Infrastructure**: Only starts Docker when needed
- **Health Monitoring**: Built-in health checks and service monitoring
- **Error Handling**: Graceful error handling and helpful error messages
- **Interactive Mode**: TTY detection for interactive browser opening
- **Production Support**: Full production build and deployment support

## Migration from Old Scripts

The unified launcher replaces multiple individual scripts:

| Old Command | New Command |
|-------------|-------------|
| `pnpm dev:local` | `pnpm launch` |
| `pnpm dev:codespaces` | `pnpm launch` (auto-detected) |
| `pnpm setup:infra` | `pnpm launch:setup` |
| `pnpm kill-ports` | `pnpm launch:stop` |

All existing commands continue to work for backward compatibility.