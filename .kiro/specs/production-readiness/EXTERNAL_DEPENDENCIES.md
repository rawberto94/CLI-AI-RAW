# External Dependencies Guide

## Overview

This document provides comprehensive information about all external services and dependencies required by the Contract Intelligence Platform. It includes configuration requirements, setup instructions, and troubleshooting guides for each dependency.

---

## Table of Contents

1. [Critical Dependencies](#critical-dependencies)
2. [AI Services](#ai-services)
3. [Database Services](#database-services)
4. [Storage Services](#storage-services)
5. [Monitoring & Observability](#monitoring--observability)
6. [Optional Dependencies](#optional-dependencies)
7. [Dependency Health Checks](#dependency-health-checks)
8. [Troubleshooting](#troubleshooting)

---

## Critical Dependencies

These services are required for the application to function.

### PostgreSQL Database

**Purpose**: Primary data storage for contracts, rate cards, and application data

**Version**: PostgreSQL 16+ with pgvector extension

**Configuration**:
```bash
# Environment Variables
DATABASE_URL="postgresql://user:password@host:5432/contract_intelligence?connection_limit=10&pool_timeout=20"

# Docker Compose
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: contract_intelligence
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
```

**Required Extensions**:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

**Setup Instructions**:

1. **Install PostgreSQL**:
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql-16 postgresql-contrib-16
   
   # macOS
   brew install postgresql@16
   
   # Or use Docker
   docker run -d --name postgres \
     -e POSTGRES_DB=contract_intelligence \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     pgvector/pgvector:pg16
   ```

2. **Install pgvector Extension**:
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql-16-pgvector
   
   # Or build from source
   git clone https://github.com/pgvector/pgvector.git
   cd pgvector
   make
   sudo make install
   ```

3. **Create Database**:
   ```bash
   createdb contract_intelligence
   psql contract_intelligence -f init/01-enable-extensions.sql
   ```

4. **Run Migrations**:
   ```bash
   cd packages/clients/db
   npx prisma migrate deploy
   ```

**Health Check**:
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Check extensions
psql $DATABASE_URL -c "SELECT * FROM pg_extension;"

# Check tables
psql $DATABASE_URL -c "\dt"
```

**Troubleshooting**:
- **Connection refused**: Check PostgreSQL is running (`sudo systemctl status postgresql`)
- **Too many connections**: Increase `max_connections` in postgresql.conf
- **Slow queries**: Run `VACUUM ANALYZE` and check indexes
- **Extension not found**: Install pgvector package for your PostgreSQL version

**Resources**:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/16/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Connection Pooling Guide](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

---

### Redis Cache

**Purpose**: Caching, session storage, and real-time event distribution

**Version**: Redis 7+

**Configuration**:
```bash
# Environment Variables
REDIS_URL="redis://localhost:6379"

# Docker Compose
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
```

**Setup Instructions**:

1. **Install Redis**:
   ```bash
   # Ubuntu/Debian
   sudo apt install redis-server
   
   # macOS
   brew install redis
   
   # Or use Docker
   docker run -d --name redis \
     -p 6379:6379 \
     redis:7-alpine redis-server --appendonly yes
   ```

2. **Configure Redis**:
   ```bash
   # Edit redis.conf
   maxmemory 1gb
   maxmemory-policy allkeys-lru
   appendonly yes
   ```

3. **Start Redis**:
   ```bash
   # System service
   sudo systemctl start redis
   
   # Or Docker
   docker start redis
   ```

**Health Check**:
```bash
# Check connection
redis-cli ping
# Expected: PONG

# Check memory usage
redis-cli INFO memory

# Check connected clients
redis-cli CLIENT LIST
```

**Troubleshooting**:
- **Connection refused**: Check Redis is running (`sudo systemctl status redis`)
- **Out of memory**: Increase `maxmemory` or change eviction policy
- **Slow performance**: Check `SLOWLOG` and optimize queries
- **Persistence issues**: Check disk space and `appendonly.aof` file

**Resources**:
- [Redis Documentation](https://redis.io/docs/)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)
- [Redis Persistence](https://redis.io/docs/management/persistence/)

---

## AI Services

### OpenAI API

**Purpose**: AI-powered contract analysis, artifact generation, and insights

**Version**: GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o-mini

**Configuration**:
```bash
# Environment Variables
OPENAI_API_KEY="sk-proj-..."
OPENAI_MODEL="gpt-4o-mini"
ANALYSIS_USE_LLM=true
```

**Setup Instructions**:

1. **Create OpenAI Account**:
   - Visit https://platform.openai.com/signup
   - Verify email and phone number
   - Add payment method

2. **Generate API Key**:
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy and save the key securely
   - Set usage limits to prevent unexpected costs

3. **Configure Application**:
   ```bash
   # Add to .env
   OPENAI_API_KEY=sk-proj-your-key-here
   OPENAI_MODEL=gpt-4o-mini
   ```

4. **Test Connection**:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

**Cost Management**:

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Use Case |
|-------|----------------------|------------------------|----------|
| gpt-4o-mini | $0.15 | $0.60 | Most tasks, cost-effective |
| gpt-4o | $2.50 | $10.00 | Complex analysis |
| gpt-4-turbo | $10.00 | $30.00 | Highest quality |

**Estimated Monthly Costs** (based on 1000 contracts/month):
- **Light usage** (gpt-4o-mini): $50-100/month
- **Medium usage** (gpt-4o): $200-500/month
- **Heavy usage** (gpt-4-turbo): $500-1000/month

**Rate Limits**:
- **Free tier**: 3 requests/minute, 200 requests/day
- **Tier 1** ($5+ spent): 500 requests/minute
- **Tier 2** ($50+ spent): 5000 requests/minute

**Health Check**:
```bash
# Test API connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | jq '.data[0].id'

# Check usage
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Troubleshooting**:
- **401 Unauthorized**: Check API key is correct and active
- **429 Rate limit**: Implement exponential backoff, upgrade tier
- **500 Server error**: OpenAI service issue, retry with backoff
- **High costs**: Review usage, optimize prompts, use cheaper models

**Resources**:
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Rate Limits Guide](https://platform.openai.com/docs/guides/rate-limits)
- [Best Practices](https://platform.openai.com/docs/guides/production-best-practices)

---

### Chroma Vector Database (Optional)

**Purpose**: Vector storage for RAG (Retrieval-Augmented Generation)

**Version**: Chroma 0.4+

**Configuration**:
```bash
# Environment Variables
CHROMA_URL="http://localhost:8000"
RAG_INTEGRATION_ENABLED=true
RAG_AUTO_INDEX=true
```

**Setup Instructions**:

1. **Install Chroma**:
   ```bash
   # Using pip
   pip install chromadb
   
   # Or use Docker
   docker run -d --name chroma \
     -p 8000:8000 \
     chromadb/chroma:latest
   ```

2. **Start Chroma Server**:
   ```bash
   # Local installation
   chroma run --host 0.0.0.0 --port 8000
   
   # Or Docker
   docker start chroma
   ```

3. **Configure Application**:
   ```bash
   # Add to .env
   CHROMA_URL=http://localhost:8000
   RAG_INTEGRATION_ENABLED=true
   ```

**Health Check**:
```bash
# Check Chroma is running
curl http://localhost:8000/api/v1/heartbeat

# List collections
curl http://localhost:8000/api/v1/collections
```

**Troubleshooting**:
- **Connection refused**: Check Chroma is running
- **Slow indexing**: Increase batch size, use faster embeddings
- **Out of memory**: Reduce collection size or increase RAM

**Resources**:
- [Chroma Documentation](https://docs.trychroma.com/)
- [Chroma GitHub](https://github.com/chroma-core/chroma)

---

## Database Services

### Prisma ORM

**Purpose**: Database ORM and migration management

**Version**: Prisma 5.22+

**Configuration**:
```bash
# Environment Variables
DATABASE_URL="postgresql://..."

# Schema Location
packages/clients/db/schema.prisma
```

**Setup Instructions**:

1. **Install Prisma**:
   ```bash
   cd packages/clients/db
   pnpm install
   ```

2. **Generate Client**:
   ```bash
   npx prisma generate
   ```

3. **Run Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

**Health Check**:
```bash
# Check Prisma can connect
npx prisma db pull

# Check migration status
npx prisma migrate status
```

**Troubleshooting**:
- **Cannot connect**: Check DATABASE_URL is correct
- **Migration failed**: See [DATABASE_MIGRATIONS.md](./DATABASE_MIGRATIONS.md)
- **Type errors**: Run `npx prisma generate` to update types

**Resources**:
- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

## Storage Services

### MinIO / S3 (Optional)

**Purpose**: Object storage for uploaded contracts and generated files

**Version**: MinIO latest or AWS S3

**Configuration**:
```bash
# Environment Variables
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="contracts"
AWS_ACCESS_KEY_ID="minioadmin"
AWS_SECRET_ACCESS_KEY="minioadmin"
```

**Setup Instructions**:

**Option A: MinIO (Self-hosted)**

1. **Install MinIO**:
   ```bash
   # Using Docker
   docker run -d --name minio \
     -p 9000:9000 -p 9001:9001 \
     -e MINIO_ROOT_USER=minioadmin \
     -e MINIO_ROOT_PASSWORD=minioadmin \
     minio/minio server /data --console-address ":9001"
   ```

2. **Create Bucket**:
   ```bash
   # Install mc (MinIO Client)
   brew install minio/stable/mc
   
   # Configure
   mc alias set local http://localhost:9000 minioadmin minioadmin
   
   # Create bucket
   mc mb local/contracts
   ```

**Option B: AWS S3**

1. **Create S3 Bucket**:
   - Go to AWS Console → S3
   - Create bucket with appropriate name
   - Configure CORS if needed

2. **Create IAM User**:
   - Go to IAM → Users → Create user
   - Attach policy: `AmazonS3FullAccess` (or custom policy)
   - Generate access keys

3. **Configure Application**:
   ```bash
   S3_ENDPOINT=https://s3.amazonaws.com
   S3_BUCKET=your-bucket-name
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

**Health Check**:
```bash
# MinIO
curl http://localhost:9000/minio/health/live

# AWS S3
aws s3 ls s3://your-bucket-name
```

**Troubleshooting**:
- **Access denied**: Check credentials and bucket permissions
- **Bucket not found**: Create bucket first
- **Slow uploads**: Check network bandwidth, use multipart uploads

**Resources**:
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)

---

## Monitoring & Observability

### Sentry (Optional but Recommended)

**Purpose**: Error tracking and performance monitoring

**Version**: Sentry 8+

**Configuration**:
```bash
# Environment Variables
SENTRY_DSN="https://abc123@o123456.ingest.sentry.io/7654321"
NODE_ENV=production
```

**Setup Instructions**:

1. **Create Sentry Account**:
   - Visit https://sentry.io/signup
   - Create organization and project

2. **Get DSN**:
   - Go to Project Settings → Client Keys (DSN)
   - Copy DSN

3. **Configure Application**:
   ```bash
   # Add to .env
   SENTRY_DSN=https://...@sentry.io/...
   ```

4. **Test Integration**:
   ```javascript
   // Trigger test error
   throw new Error("Sentry test error");
   ```

**Features**:
- Automatic error capture
- Performance monitoring
- Release tracking
- User feedback
- Custom alerts

**Health Check**:
```bash
# Check Sentry is receiving events
# Visit Sentry dashboard → Issues
```

**Troubleshooting**:
- **No events**: Check DSN is correct, check network connectivity
- **Too many events**: Adjust sample rate, filter errors
- **High costs**: Review event volume, adjust quotas

**Resources**:
- [Sentry Documentation](https://docs.sentry.io/)
- [Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

### Application Insights (Optional)

**Purpose**: Azure-based monitoring and analytics

**Configuration**:
```bash
# Environment Variables
APPINSIGHTS_CONNECTION_STRING="InstrumentationKey=..."
```

**Setup Instructions**:

1. **Create Application Insights Resource**:
   - Go to Azure Portal
   - Create Application Insights resource
   - Copy connection string

2. **Configure Application**:
   ```bash
   APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
   ```

**Resources**:
- [Application Insights Documentation](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)

---

## Optional Dependencies

### Socket.IO (Real-time Updates)

**Purpose**: Real-time bidirectional communication

**Version**: Socket.IO 4+

**Configuration**:
- Automatically configured in Next.js API routes
- No external service required

**Setup**:
```bash
# Already included in dependencies
# No additional setup needed
```

---

## Dependency Health Checks

### Automated Health Check Script

Create `scripts/check-dependencies.sh`:

```bash
#!/bin/bash

echo "Checking external dependencies..."

# PostgreSQL
echo -n "PostgreSQL: "
if psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✓ Connected"
else
  echo "✗ Failed"
fi

# Redis
echo -n "Redis: "
if redis-cli ping > /dev/null 2>&1; then
  echo "✓ Connected"
else
  echo "✗ Failed"
fi

# OpenAI
echo -n "OpenAI: "
if curl -s -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models > /dev/null 2>&1; then
  echo "✓ Connected"
else
  echo "✗ Failed"
fi

# Chroma (if enabled)
if [ "$RAG_INTEGRATION_ENABLED" = "true" ]; then
  echo -n "Chroma: "
  if curl -s $CHROMA_URL/api/v1/heartbeat > /dev/null 2>&1; then
    echo "✓ Connected"
  else
    echo "✗ Failed"
  fi
fi

# MinIO/S3 (if configured)
if [ -n "$S3_ENDPOINT" ]; then
  echo -n "S3/MinIO: "
  if curl -s $S3_ENDPOINT/minio/health/live > /dev/null 2>&1; then
    echo "✓ Connected"
  else
    echo "✗ Failed"
  fi
fi

echo "Health check complete"
```

### Application Health Endpoints

The application provides health check endpoints:

```bash
# Overall health
curl http://localhost:3000/api/health

# Detailed health (includes dependencies)
curl http://localhost:3000/api/health/detailed

# Database health
curl http://localhost:3000/api/health/database
```

---

## Troubleshooting

### General Troubleshooting Steps

1. **Check Service Status**:
   ```bash
   # PostgreSQL
   sudo systemctl status postgresql
   
   # Redis
   sudo systemctl status redis
   
   # Docker services
   docker compose ps
   ```

2. **Check Logs**:
   ```bash
   # Application logs
   tail -f apps/web/logs/application.log
   
   # PostgreSQL logs
   tail -f /var/log/postgresql/postgresql-16-main.log
   
   # Redis logs
   tail -f /var/log/redis/redis-server.log
   
   # Docker logs
   docker compose logs -f
   ```

3. **Check Network Connectivity**:
   ```bash
   # Test port connectivity
   nc -zv localhost 5432  # PostgreSQL
   nc -zv localhost 6379  # Redis
   nc -zv localhost 8000  # Chroma
   ```

4. **Check Environment Variables**:
   ```bash
   # Verify all required variables are set
   env | grep -E "DATABASE_URL|OPENAI_API_KEY|REDIS_URL"
   ```

### Common Issues

#### "Cannot connect to database"
- Check DATABASE_URL is correct
- Verify PostgreSQL is running
- Check firewall rules
- Verify credentials

#### "OpenAI API rate limit exceeded"
- Implement exponential backoff
- Upgrade OpenAI tier
- Reduce request frequency
- Use caching

#### "Redis connection timeout"
- Check Redis is running
- Verify REDIS_URL is correct
- Check network connectivity
- Increase timeout settings

#### "Out of memory"
- Check Redis memory usage
- Increase maxmemory setting
- Review cache eviction policy
- Scale infrastructure

---

## Dependency Matrix

| Dependency | Required | Version | Purpose | Fallback |
|------------|----------|---------|---------|----------|
| PostgreSQL | Yes | 16+ | Data storage | None |
| Redis | Yes | 7+ | Caching | None |
| OpenAI | Yes* | Latest | AI features | Can disable |
| Chroma | No | 0.4+ | RAG | Can disable |
| MinIO/S3 | No | Latest | File storage | Local filesystem |
| Sentry | No | 8+ | Error tracking | Console logs |

*Required if AI features are enabled

---

## Production Checklist

Before deploying to production, verify:

- [ ] PostgreSQL configured with connection pooling
- [ ] Redis configured with persistence
- [ ] OpenAI API key set with usage limits
- [ ] Database backups configured
- [ ] Monitoring configured (Sentry or equivalent)
- [ ] Health checks passing for all dependencies
- [ ] SSL/TLS enabled for all external connections
- [ ] Credentials stored securely (not in code)
- [ ] Rate limiting configured
- [ ] Error handling implemented for all dependencies

---

## Additional Resources

- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Database Migrations](./DATABASE_MIGRATIONS.md)
- [System Architecture](../../SYSTEM_ARCHITECTURE.md)
- [Quick Start Guide](../../QUICK_START.md)
