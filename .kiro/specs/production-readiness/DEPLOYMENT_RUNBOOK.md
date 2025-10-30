# Production Deployment Runbook

## Overview

This runbook provides step-by-step instructions for deploying the Contract Intelligence Platform to production. Follow these procedures carefully to ensure a smooth deployment with minimal downtime.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Application Deployment](#application-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before starting deployment, verify the following:

### Code Readiness
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review completed and approved
- [ ] Version tagged in Git (e.g., `v2.0.0`)
- [ ] Release notes prepared
- [ ] Security scan completed with no critical issues

### Infrastructure Readiness
- [ ] Production environment provisioned
- [ ] Database backup completed
- [ ] SSL certificates valid and up-to-date
- [ ] DNS records configured
- [ ] Monitoring and alerting configured
- [ ] Log aggregation configured

### Team Readiness
- [ ] Deployment window scheduled and communicated
- [ ] On-call engineer identified
- [ ] Rollback plan reviewed
- [ ] Stakeholders notified

---

## Environment Setup

### 1. Server Requirements

**Minimum Production Specifications:**
- **API Server**: 4 CPU cores, 8GB RAM, 50GB SSD
- **Database**: 4 CPU cores, 16GB RAM, 200GB SSD
- **Redis**: 2 CPU cores, 4GB RAM, 20GB SSD
- **Workers**: 2 CPU cores, 4GB RAM per worker (3 workers recommended)

### 2. Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm@latest

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose-plugin

# Install PM2 for process management
npm install -g pm2
```

### 3. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/contract-intelligence.git
cd contract-intelligence

# Checkout the release tag
git checkout v2.0.0

# Install dependencies
pnpm install
```

### 4. Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit environment file with production values
nano .env
```

**Critical Environment Variables to Configure:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `JWT_SECRET` - Strong random secret (generate with `openssl rand -base64 32`)
- `SESSION_SECRET` - Strong random secret
- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `SENTRY_DSN` - Error tracking (optional but recommended)

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete documentation.

---

## Database Migration

### 1. Backup Current Database

```bash
# Create backup directory
mkdir -p backups

# Backup database
pg_dump -h localhost -U postgres -d contract_intelligence \
  -F c -b -v -f "backups/backup_$(date +%Y%m%d_%H%M%S).dump"

# Verify backup
ls -lh backups/
```

### 2. Test Migration on Staging

```bash
# Run migrations on staging first
cd packages/clients/db
npx prisma migrate deploy --preview-feature

# Verify migration success
npx prisma migrate status
```

### 3. Run Production Migration

```bash
# Set production database URL
export DATABASE_URL="postgresql://user:password@prod-host:5432/contract_intelligence"

# Run migrations
cd packages/clients/db
npx prisma migrate deploy

# Verify migration
npx prisma migrate status

# Generate Prisma client
npx prisma generate
```

### 4. Verify Database State

```bash
# Connect to database
psql $DATABASE_URL

# Check tables exist
\dt

# Verify critical tables
SELECT COUNT(*) FROM "Contract";
SELECT COUNT(*) FROM "RateCard";
SELECT COUNT(*) FROM "Artifact";

# Exit
\q
```

---

## Application Deployment

### Option A: Docker Compose Deployment (Recommended)

#### 1. Build Docker Images

```bash
# Build all images
docker compose -f docker-compose.prod.yml build

# Tag images with version
docker tag contract-intelligence/api:latest contract-intelligence/api:v2.0.0
docker tag contract-intelligence/web:latest contract-intelligence/web:v2.0.0
docker tag contract-intelligence/workers:latest contract-intelligence/workers:v2.0.0
```

#### 2. Start Services

```bash
# Start infrastructure services first
docker compose -f docker-compose.prod.yml up -d postgres redis minio

# Wait for services to be healthy (30 seconds)
sleep 30

# Start application services
docker compose -f docker-compose.prod.yml up -d api workers web

# Optional: Start nginx reverse proxy
docker compose -f docker-compose.prod.yml --profile nginx up -d nginx
```

#### 3. Verify Services

```bash
# Check service status
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f workers
docker compose -f docker-compose.prod.yml logs -f web

# Verify health checks
curl http://localhost:8080/healthz
curl http://localhost:3000/api/health
```

### Option B: PM2 Deployment

#### 1. Build Application

```bash
# Build Next.js application
cd apps/web
pnpm run build

# Return to root
cd ../..
```

#### 2. Start with PM2

```bash
# Start application using PM2
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command
```

#### 3. Verify PM2 Status

```bash
# Check process status
pm2 status

# View logs
pm2 logs contract-intelligence-web

# Monitor resources
pm2 monit
```

---

## Post-Deployment Verification

### 1. Health Check Verification

```bash
# Check overall health
curl http://localhost:3000/api/health

# Check detailed health
curl http://localhost:3000/api/health/detailed

# Check database health
curl http://localhost:3000/api/health/database
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-30T12:00:00.000Z",
  "uptime": 120,
  "version": "2.0.0"
}
```

### 2. Functional Testing

```bash
# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test contract upload (with auth token)
curl -X POST http://localhost:3000/api/contracts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-contract.pdf"

# Test rate card retrieval
curl http://localhost:3000/api/rate-cards \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Performance Verification

```bash
# Run load test (from scripts directory)
cd scripts
./run-load-tests.sh

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health
```

Create `curl-format.txt`:
```
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
----------\n
time_total:  %{time_total}\n
```

### 4. Monitoring Verification

```bash
# Check monitoring dashboard
curl http://localhost:3000/api/monitoring/metrics

# Verify SSE connections
curl http://localhost:3000/api/connections

# Check resource usage
curl http://localhost:3000/api/monitoring/resources
```

### 5. Log Verification

```bash
# Check application logs
tail -f apps/web/logs/application.log

# Check error logs
tail -f apps/web/logs/error.log

# For Docker deployment
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

---

## Rollback Procedures

### When to Rollback

Initiate rollback if:
- Critical functionality is broken
- Error rate exceeds 5%
- Performance degradation > 50%
- Database corruption detected
- Security vulnerability discovered

### Rollback Steps

#### 1. Stop Current Deployment

**Docker Compose:**
```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Remove containers (keeps volumes)
docker compose -f docker-compose.prod.yml rm -f
```

**PM2:**
```bash
# Stop application
pm2 stop all

# Delete processes
pm2 delete all
```

#### 2. Restore Database

```bash
# Stop application to prevent writes
docker compose -f docker-compose.prod.yml stop api workers

# Restore from backup
pg_restore -h localhost -U postgres -d contract_intelligence \
  -c -v backups/backup_YYYYMMDD_HHMMSS.dump

# Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Contract\";"
```

#### 3. Deploy Previous Version

**Docker Compose:**
```bash
# Checkout previous version
git checkout v1.9.0

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d
```

**PM2:**
```bash
# Checkout previous version
git checkout v1.9.0

# Rebuild application
cd apps/web
pnpm install
pnpm run build

# Start with PM2
pm2 start ecosystem.config.cjs
```

#### 4. Verify Rollback

```bash
# Check health
curl http://localhost:3000/api/health

# Verify version
curl http://localhost:3000/api/version

# Check logs for errors
docker compose -f docker-compose.prod.yml logs -f --tail=50
```

#### 5. Notify Stakeholders

```bash
# Send notification (example using curl to Slack webhook)
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🔴 Production Rollback Completed",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Rollback Details*\n• From: v2.0.0\n• To: v1.9.0\n• Reason: [REASON]\n• Time: [TIME]"
        }
      }
    ]
  }'
```

---

## Troubleshooting

### Common Issues

#### Issue: Database Connection Failures

**Symptoms:**
- "Connection refused" errors
- "Too many connections" errors

**Solutions:**
```bash
# Check database is running
docker compose -f docker-compose.prod.yml ps postgres

# Check connection limit
psql $DATABASE_URL -c "SHOW max_connections;"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Restart database if needed
docker compose -f docker-compose.prod.yml restart postgres
```

#### Issue: High Memory Usage

**Symptoms:**
- Application crashes
- Slow response times
- OOM errors in logs

**Solutions:**
```bash
# Check memory usage
docker stats

# Restart workers to free memory
docker compose -f docker-compose.prod.yml restart workers

# Increase memory limits in docker-compose.prod.yml
# Add under service definition:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

#### Issue: SSE Connection Failures

**Symptoms:**
- Real-time updates not working
- "Connection lost" messages

**Solutions:**
```bash
# Check SSE endpoint
curl http://localhost:3000/api/events

# Check connection count
curl http://localhost:3000/api/connections

# Restart API server
docker compose -f docker-compose.prod.yml restart api
```

#### Issue: Slow Performance

**Symptoms:**
- Page load times > 5 seconds
- API response times > 1 second

**Solutions:**
```bash
# Check database query performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"

# Clear cache
redis-cli FLUSHALL

# Restart services
docker compose -f docker-compose.prod.yml restart
```

### Emergency Contacts

- **On-Call Engineer**: [Phone/Email]
- **Database Admin**: [Phone/Email]
- **DevOps Lead**: [Phone/Email]
- **Product Owner**: [Phone/Email]

### Support Resources

- **Documentation**: https://docs.your-domain.com
- **Status Page**: https://status.your-domain.com
- **Incident Management**: https://incidents.your-domain.com
- **Slack Channel**: #production-support

---

## Deployment Checklist

Use this checklist during deployment:

### Pre-Deployment
- [ ] Backup database completed
- [ ] Environment variables configured
- [ ] SSL certificates verified
- [ ] Monitoring configured
- [ ] Team notified

### Deployment
- [ ] Code deployed
- [ ] Database migrations run
- [ ] Services started
- [ ] Health checks passing

### Post-Deployment
- [ ] Functional tests passed
- [ ] Performance verified
- [ ] Monitoring operational
- [ ] Logs reviewed
- [ ] Stakeholders notified

### Rollback (If Needed)
- [ ] Issue identified and documented
- [ ] Rollback decision made
- [ ] Database restored
- [ ] Previous version deployed
- [ ] Rollback verified
- [ ] Post-mortem scheduled

---

## Maintenance Windows

**Recommended Deployment Times:**
- **Preferred**: Tuesday-Thursday, 2:00 AM - 4:00 AM UTC
- **Avoid**: Fridays, weekends, holidays, month-end

**Estimated Downtime:**
- **Standard Deployment**: 5-10 minutes
- **With Database Migration**: 15-30 minutes
- **Major Version Upgrade**: 30-60 minutes

---

## Version History

| Version | Date | Changes | Deployed By |
|---------|------|---------|-------------|
| v2.0.0 | 2025-10-30 | Production readiness release | [Name] |
| v1.9.0 | 2025-10-15 | Rate card enhancements | [Name] |
| v1.8.0 | 2025-10-01 | Real-time updates | [Name] |

---

## Additional Resources

- [Environment Variables Documentation](./ENVIRONMENT_VARIABLES.md)
- [Database Migration Guide](./DATABASE_MIGRATIONS.md)
- [External Dependencies Guide](./EXTERNAL_DEPENDENCIES.md)
- [Architecture Overview](../../SYSTEM_ARCHITECTURE.md)
- [Quick Start Guide](../../QUICK_START.md)
