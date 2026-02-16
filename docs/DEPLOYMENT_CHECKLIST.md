# 🚀 Production Deployment Checklist

> **Version:** 1.0.0  
> **Last Updated:** December 21, 2025  
> **Purpose:** Comprehensive checklist for deploying Contract Intelligence Platform to production

---

## Pre-Deployment (1 Week Before)

### Environment Preparation

- [ ] **Secrets configured** - All secrets in environment/vault
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `NEXTAUTH_SECRET` - 32+ character random string
  - [ ] `NEXTAUTH_URL` - Production URL
  - [ ] `OPENAI_API_KEY` - Valid API key
  - [ ] `REDIS_URL` or Upstash credentials
  - [ ] `S3_ACCESS_KEY` / `S3_SECRET_KEY`
  - [ ] `SENTRY_DSN` - Error tracking
  - [ ] `JWT_SECRET` - For API tokens
  - [ ] `ENCRYPTION_KEY` - For data encryption

### Infrastructure Verification

- [ ] **Database ready**
  - [ ] PostgreSQL 16+ with pgvector extension
  - [ ] Connection pooling configured (PgBouncer)
  - [ ] Backup automation enabled
  - [ ] Read replica (if needed)
  
- [ ] **Redis ready**
  - [ ] Redis 7+ or Upstash configured
  - [ ] Eviction policy set (`allkeys-lru`)
  - [ ] Persistence enabled
  
- [ ] **Object Storage ready**
  - [ ] S3 bucket or MinIO configured
  - [ ] CORS policy set
  - [ ] Lifecycle policies for old files
  
- [ ] **DNS & SSL**
  - [ ] Domain configured
  - [ ] SSL certificate issued
  - [ ] CDN configured (optional)

### Code Preparation

- [ ] **All tests passing**

  ```bash
  pnpm test:unit
  pnpm test:e2e
  ```

- [ ] **No TypeScript errors**

  ```bash
  pnpm type-check
  ```

- [ ] **Linting clean**

  ```bash
  pnpm lint
  ```

- [ ] **Dependencies up to date**

  ```bash
  pnpm audit
  ```

- [ ] **Build succeeds**

  ```bash
  pnpm build
  ```

---

## Deployment Day

### 1. Pre-Deployment Checks (30 min before)

```bash
# Verify current production status
curl https://your-app.com/api/health

# Create database backup
./scripts/backup.sh

# Verify backup created
ls -la backups/

# Check git status
git status
git log --oneline -5
```

### 2. Database Migration

```bash
# Check migration status
pnpm prisma migrate status

# Apply migrations (if any)
pnpm prisma migrate deploy

# Verify database connection
pnpm prisma db pull --print
```

### 3. Deploy Application

#### Docker Deployment

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Deploy with rolling update
docker compose -f docker-compose.prod.yml up -d --no-deps --scale app=2

# Wait for health checks
sleep 30

# Verify deployment
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 app
```

#### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f kubernetes/deployment.yaml

# Watch rollout
kubectl rollout status deployment/app -n contract-intel --timeout=300s

# Verify pods
kubectl get pods -n contract-intel

# Check logs
kubectl logs -l app=contract-intel -n contract-intel --tail=50
```

### 4. Post-Deployment Verification

#### Health Checks

```bash
# Basic health
curl https://your-app.com/api/health

# Detailed health
curl https://your-app.com/api/monitoring/health

# Prometheus metrics
curl https://your-app.com/api/monitoring/prometheus
```

#### Functional Tests

- [ ] **Authentication works**
  - [ ] Login with existing user
  - [ ] Signup new user
  - [ ] Password reset
  
- [ ] **Core Features**
  - [ ] Upload contract
  - [ ] View contract list
  - [ ] AI chat responds
  - [ ] Rate cards load
  
- [ ] **API Endpoints**
  - [ ] `/api/contracts` - Returns data
  - [ ] `/api/rate-cards` - Returns data
  - [ ] `/api/dashboard/metrics` - Returns metrics

### 5. Monitoring Verification

- [ ] **Sentry connected**
  - Check Sentry dashboard for any new errors
  
- [ ] **Metrics flowing**
  - Prometheus scraping `/api/monitoring/prometheus`
  - Grafana dashboard showing data
  
- [ ] **Alerts configured**
  - Test alert (optional)
  - Verify alert channels

---

## Rollback Procedure

### If Issues Detected

#### 1. Quick Rollback (Docker)

```bash
# Rollback to previous image
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --no-build
```

#### 2. Quick Rollback (Kubernetes)

```bash
# Rollback deployment
kubectl rollout undo deployment/app -n contract-intel

# Verify rollback
kubectl rollout status deployment/app -n contract-intel
```

#### 3. Database Rollback (if needed)

```bash
# List available backups
ls -la backups/

# Restore from backup
./scripts/restore.sh backups/pre-deploy-YYYYMMDD-HHMMSS.sql

# Or mark migration as rolled back
./scripts/db-rollback.sh --steps 1
```

---

## Post-Deployment

### Immediate (Day 1)

- [ ] **Monitor error rates** - Check Sentry every hour
- [ ] **Check performance** - Response times normal
- [ ] **Verify workers** - Background jobs processing
- [ ] **User feedback** - Any issues reported

### Short Term (Week 1)

- [ ] **Review metrics** - CPU, memory, response times
- [ ] **Check logs** - Any recurring warnings
- [ ] **Load testing** - Run load test if new features

  ```bash
  k6 run scripts/load-test.js
  ```

- [ ] **Update documentation** - Any changes needed

### Long Term

- [ ] **Schedule reviews** - Monthly architecture review
- [ ] **Plan next release** - Roadmap update
- [ ] **Security scan** - Quarterly vulnerability scan

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | TBD | TBD |
| Secondary On-Call | TBD | TBD |
| Database Admin | TBD | TBD |
| DevOps Lead | TBD | TBD |

---

## Quick Reference Commands

```bash
# === Health ===
curl https://app.com/api/health
curl https://app.com/api/monitoring/health

# === Logs ===
docker compose -f docker-compose.prod.yml logs -f app
kubectl logs -f -l app=contract-intel -n contract-intel

# === Restart ===
docker compose -f docker-compose.prod.yml restart app
kubectl rollout restart deployment/app -n contract-intel

# === Scale ===
docker compose -f docker-compose.prod.yml up -d --scale app=3
kubectl scale deployment/app --replicas=3 -n contract-intel

# === Database ===
./scripts/backup.sh
./scripts/restore.sh <backup-file>
pnpm prisma migrate status

# === Redis ===
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
docker compose -f docker-compose.prod.yml exec redis redis-cli INFO
```

---

## Deployment Sign-Off

| Step | Completed | By | Time |
|------|-----------|-----|------|
| Pre-deployment checks | ☐ | | |
| Database backup | ☐ | | |
| Database migration | ☐ | | |
| Application deployed | ☐ | | |
| Health checks pass | ☐ | | |
| Functional tests pass | ☐ | | |
| Monitoring verified | ☐ | | |
| **DEPLOYMENT APPROVED** | ☐ | | |

---

**Notes:**

- Always deploy during low-traffic periods
- Keep communication channel open during deployment
- Document any deviations from this checklist
- Update this checklist after each deployment with lessons learned
