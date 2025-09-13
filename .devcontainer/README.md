# GitHub Codespaces Setup

This repository is configured to work seamlessly with GitHub Codespaces, providing a complete cloud development environment.

## 🚀 Quick Start

1. **Open in Codespaces:**
   - Click the green "Code" button on GitHub
   - Select "Codespaces" tab
   - Click "Create codespace on main"

2. **Wait for Setup:**
   - The environment will automatically install dependencies
   - PostgreSQL, Redis, and MinIO will be configured
   - All ports will be forwarded

3. **Start Development:**
   ```bash
   pnpm dev        # Start all services
   pnpm dev:local  # Start without external dependencies
   pnpm launch     # Interactive launcher
   ```

## 🛠️ What's Included

### Services
- **PostgreSQL 16** with pgvector extension (port 5432)
- **Redis 7** for caching and queues (port 6379)
- **MinIO** for object storage (ports 9000, 9001)

### Development Tools
- **Node.js 20** with TypeScript support
- **pnpm** package manager
- **GitHub CLI** for repository management
- **Docker** for running services

### VS Code Extensions
- TypeScript and JavaScript support
- Tailwind CSS IntelliSense
- Prettier code formatting
- ESLint linting
- Playwright testing
- GitHub Pull Requests

### Port Forwarding
- `3001` - API Server (auto-notify)
- `3002` - Web App (auto-open browser)
- `5432` - PostgreSQL (silent)
- `6379` - Redis (silent)
- `9000` - MinIO API (silent)
- `9001` - MinIO Console (silent)

## 📁 Environment Files

The setup automatically creates:
- `.env` - Main environment variables
- `apps/api/.env` - API-specific variables
- `apps/web/.env.local` - Web app variables

## 🎯 Available Commands

```bash
# Development
pnpm dev          # Start all services with hot reload
pnpm dev:local    # Start without Docker (uses Codespaces services)
pnpm build        # Build all packages
pnpm test         # Run tests

# Database
pnpm db:push      # Push database schema
pnpm db:seed      # Seed database with sample data

# Utilities
pnpm launch       # Interactive development launcher
pnpm smoke        # Run smoke tests
pnpm lint         # Run linting
```

## 🔧 Customization

### Adding VS Code Extensions
Edit `.devcontainer/devcontainer.json`:
```json
{
  "customizations": {
    "vscode": {
      "extensions": [
        "your.extension.id"
      ]
    }
  }
}
```

### Modifying Services
Edit `.devcontainer/docker-compose.yml` to:
- Change service versions
- Add new services
- Modify configurations

### Environment Variables
Edit `.devcontainer/setup.sh` to customize default environment variables.

## 🐛 Troubleshooting

### Services Not Ready
If services aren't responding:
```bash
# Check service status
docker ps

# Restart services
docker-compose -f .devcontainer/docker-compose.yml restart
```

### Permission Issues
```bash
# Fix ownership if needed
sudo chown -R node:node /workspaces/contract-intelligence
```

### Port Conflicts
If ports are already in use, Codespaces will automatically assign alternative ports. Check the "Ports" tab in VS Code.

## 🌟 Benefits over Local Docker

1. **No Local Setup** - Zero configuration on your machine
2. **Consistent Environment** - Same setup for all developers
3. **Powerful Hardware** - Cloud resources for development
4. **Pre-configured** - All tools and extensions ready
5. **Isolated** - Clean environment for each branch
6. **Collaborative** - Easy sharing and pair programming

## 📚 Next Steps

- Check out the main [README.md](../README.md) for project overview
- Review [docs/](../docs/) for detailed documentation
- Start developing with `pnpm dev`!