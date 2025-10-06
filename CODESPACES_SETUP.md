# GitHub Codespaces Setup Guide

This project is configured to run in GitHub Codespaces with all necessary services.

## Quick Start

1. **Open in Codespaces**
   - Click the "Code" button on GitHub
   - Select "Codespaces" tab
   - Click "Create codespace on main"

2. **Wait for Setup**
   - The devcontainer will automatically install dependencies
   - PostgreSQL will be initialized
   - This takes about 2-3 minutes

3. **Configure Environment**
   ```bash
   # Edit .env file with your OpenAI API key
   nano .env
   ```
   Update `OPENAI_API_KEY=your_openai_api_key_here`

4. **Start Services**
   ```bash
   # Start Redis and MinIO
   bash .devcontainer/start-services.sh
   ```

5. **Run the Application**
   ```bash
   # Start the development server
   pnpm dev
   ```

## Services

The following services are available in Codespaces:

- **PostgreSQL** (Port 5432): Database with pgvector extension
- **Redis** (Port 6379): Queue and caching
- **MinIO** (Ports 9000, 9001): Object storage
- **Web App** (Port 3002): Next.js frontend
- **API** (Port 3001): Backend API

## Useful Commands

```bash
# Install dependencies
pnpm install

# Start all services
bash .devcontainer/start-services.sh

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Check service status
sudo service postgresql status
docker ps
```

## Troubleshooting

### PostgreSQL not starting
```bash
sudo service postgresql start
sudo service postgresql status
```

### Redis/MinIO not running
```bash
docker-compose -f .devcontainer/docker-compose.codespaces.yml up -d
docker ps
```

### Port already in use
Check what's running on the port:
```bash
lsof -i :3002  # or whatever port
```

### Reset everything
```bash
# Stop all services
docker-compose -f .devcontainer/docker-compose.codespaces.yml down
sudo service postgresql stop

# Restart
bash .devcontainer/start-services.sh
```

## Environment Variables

Key environment variables in `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_intelligence
OPENAI_API_KEY=your_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3002
API_PORT=3001
WEB_PORT=3002
NODE_ENV=development
```

## Accessing Services

- **Web App**: Click the "Ports" tab and open port 3002
- **API**: Port 3001
- **MinIO Console**: Port 9001 (user: minioadmin, pass: minioadmin)

## Performance Tips

- Codespaces uses 2-4 cores by default
- For better performance, upgrade to 4-core or 8-core machine
- Services are configured with memory limits for efficiency

## Next Steps

1. Update your `.env` with real API keys
2. Run database migrations if needed
3. Start developing!

For more information, see the main [README.md](./README.md)
