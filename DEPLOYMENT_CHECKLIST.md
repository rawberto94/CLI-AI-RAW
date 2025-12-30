# Production Deployment Checklist

## Pre-Deployment

- [ ] **Environment Variables Configured**
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `OPENAI_API_KEY` - OpenAI API key
  - [ ] `JWT_SECRET` - Strong random string (32+ chars)
  - [ ] `SESSION_SECRET` - Strong random string (32+ chars)
  - [ ] `REDIS_URL` - Redis connection string
  - [ ] `NODE_ENV=production`
  - [ ] Optional: `SENDGRID_API_KEY` for emails

- [ ] **Database Setup**
  - [ ] PostgreSQL 16+ with pgvector extension
  - [ ] Database created
  - [ ] User credentials configured
  - [ ] Connection pooling enabled (connection_limit=20)

- [ ] **Redis Setup**
  - [ ] Redis 7+ running
  - [ ] Memory limit configured (2GB+)
  - [ ] Eviction policy set (allkeys-lru)

- [ ] **Build Environment**
  - [ ] Machine with ≥16GB RAM OR
  - [ ] CI/CD pipeline configured (GitHub Actions ready)

---

## Deployment Steps

### 1. Clone & Setup
```bash
git clone https://github.com/your-org/CLI-AI-RAW.git
cd CLI-AI-RAW
cp .env.example .env.production
# Edit .env.production with your values
```

### 2. Run Database Migrations
```bash
cd /workspaces/CLI-AI-RAW
DATABASE_URL="your-connection-string" npx prisma migrate deploy
```

Expected output:
```
✔ Migration applied: 20251230113855_add_agentic_ai_models
✔ Generated Prisma Client
```

### 3. Verify Agent Tables Created
```bash
npx prisma db execute --sql "
  SELECT tablename FROM pg_tables 
  WHERE schemaname='public' 
  AND (tablename LIKE 'agent%' 
    OR tablename = 'learning_records' 
    OR tablename = 'opportunity_discoveries')
"
```

Expected: 4 tables returned
- `agent_events`
- `agent_recommendations`
- `learning_records`
- `opportunity_discoveries`

### 4. Choose Deployment Method

#### Option A: Docker Compose (Recommended for Self-Hosted)
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f web workers

# Scale workers
docker-compose -f docker-compose.prod.yml up -d --scale workers=3
```

#### Option B: Kubernetes
```bash
# Create secrets
kubectl create secret generic app-secrets \
  --from-env-file=.env.production \
  -n contract-intelligence

# Deploy
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -n contract-intelligence
kubectl logs -f deployment/web -n contract-intelligence
```

#### Option C: AWS ECS (via GitHub Actions)
```bash
# Push to trigger deployment
git push origin main

# Monitor deployment
# Check GitHub Actions: https://github.com/your-org/repo/actions

# Verify ECS services
aws ecs describe-services \
  --cluster contract-intelligence-prod \
  --services web workers
```

#### Option D: Manual Build & Deploy
```bash
# Build on powerful machine
cd apps/web
NODE_OPTIONS="--max-old-space-size=16384" pnpm build

# Copy to production
rsync -avz .next/ production:/app/.next/
rsync -avz public/ production:/app/public/

# Run on production
ssh production
cd /app
NODE_ENV=production node server.js
```

---

## Post-Deployment Verification

### 1. Health Check ✅
```bash
curl https://your-domain.com/api/health
# Expected: {"status":"ok","timestamp":"2025-12-30..."}
```

### 2. Agent Routes ✅
```bash
# Check all 5 agent API endpoints
curl https://your-domain.com/api/agents/status
curl https://your-domain.com/api/agents/health
curl https://your-domain.com/api/agents/execute
curl https://your-domain.com/api/agents/opportunities
curl https://your-domain.com/api/agents/dashboard-stats

# All should return 200 OK (may need authentication)
```

### 3. Test Agent Execution ✅
```bash
# Upload a test contract
curl -X POST https://your-domain.com/api/contracts/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-contract.pdf" \
  -F "tenantId=your-tenant-id"

# Agents will automatically process the contract
# Check agent events in database:
```

```sql
SELECT 
  agent_name,
  event_type,
  outcome,
  created_at
FROM agent_events
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Database Verification ✅
```sql
-- Check agent activity
SELECT COUNT(*) as total_events FROM agent_events;
SELECT COUNT(*) as recommendations FROM agent_recommendations;
SELECT COUNT(*) as learning_records FROM learning_records;
SELECT COUNT(*) as opportunities FROM opportunity_discoveries;

-- View recent agent activity
SELECT 
  agent_name,
  event_type,
  outcome,
  confidence,
  duration_ms,
  created_at
FROM agent_events
ORDER BY created_at DESC
LIMIT 20;
```

### 5. Worker Health ✅
```bash
# Check worker logs for agent registration
docker logs <worker-container-id> 2>&1 | grep "agent"

# Expected output includes:
# "Contract Health Monitor agent registered"
# "Intelligent Search agent registered"
# "Smart Gap-Filling agent registered"
# ... (9 total agents)
```

---

## Monitoring Setup

### 1. Set Up Alerts
```bash
# AWS CloudWatch
aws cloudwatch put-metric-alarm \
  --alarm-name high-memory-usage \
  --metric-name MemoryUtilization \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold

# Or configure in your monitoring tool
```

### 2. Enable Logging
- [ ] Application logs forwarded to CloudWatch/Stackdriver/Azure Monitor
- [ ] Error tracking enabled (Sentry/Rollbar)
- [ ] Performance monitoring enabled
- [ ] Database slow query logging enabled

### 3. Set Up Backups
```bash
# PostgreSQL automated backups
# AWS RDS: Enable automated backups (7-35 days retention)
# Azure: Enable point-in-time restore
# GCP: Enable automated backups

# Manual backup script
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
```

---

## Troubleshooting

### Issue: Build fails with memory error
**Solution**: Use cloud CI/CD or machine with ≥16GB RAM
- See [BUILD_MEMORY_WORKAROUND.md](BUILD_MEMORY_WORKAROUND.md)

### Issue: Agents not executing
**Check**:
```bash
# 1. Redis connection
redis-cli -u $REDIS_URL ping
# Expected: PONG

# 2. Worker logs
docker logs <worker-container> 2>&1 | grep -i error

# 3. Database connection
psql $DATABASE_URL -c "SELECT 1"
# Expected: 1

# 4. OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
# Expected: JSON response with models
```

### Issue: 404 on /api/agents/*
**Check**:
```bash
# Verify routes compiled
ls -la apps/web/.next/server/app/api/agents/
# Expected: execute/, health/, opportunities/, status/, dashboard-stats/

# Check deployment copied .next directory
# Rebuild if necessary with more memory
```

### Issue: Database migration failed
```bash
# Reset and reapply
cd packages/clients/db
npx prisma migrate reset --force
npx prisma migrate deploy

# Verify tables
npx prisma db execute --sql "SELECT tablename FROM pg_tables WHERE schemaname='public'"
```

---

## Scaling

### Horizontal Scaling
```bash
# Docker Compose
docker-compose -f docker-compose.prod.yml up -d --scale workers=5

# Kubernetes
kubectl scale deployment/workers --replicas=5 -n contract-intelligence

# AWS ECS
aws ecs update-service \
  --cluster contract-intelligence-prod \
  --service workers \
  --desired-count 5
```

### Auto-Scaling Configuration
```yaml
# Already configured in k8s/deployment.yaml
# HPA scales based on CPU (70%) and Memory (80%)
# Min: 2 replicas, Max: 10 replicas
```

---

## Security Checklist

- [ ] **Secrets Management**
  - [ ] No secrets in code or .env files in repo
  - [ ] Use AWS Secrets Manager / Azure Key Vault / GCP Secret Manager
  - [ ] Rotate secrets regularly (90 days)

- [ ] **Network Security**
  - [ ] Database in private subnet/network
  - [ ] Redis in private subnet/network
  - [ ] Load balancer with WAF enabled
  - [ ] TLS 1.3 for all connections

- [ ] **Access Control**
  - [ ] IAM roles with least privilege
  - [ ] Service accounts for workers
  - [ ] API authentication enabled
  - [ ] CORS properly configured

- [ ] **Monitoring & Logging**
  - [ ] CloudWatch/Application Insights enabled
  - [ ] Log aggregation configured
  - [ ] Alerts for critical errors
  - [ ] Audit logs enabled

---

## Success Criteria ✅

Your deployment is successful when:

1. ✅ Health endpoint returns 200
2. ✅ All 5 agent API routes accessible
3. ✅ Database has 4 agent tables
4. ✅ Workers registered (check logs)
5. ✅ Test contract processes successfully
6. ✅ Agent events recorded in database
7. ✅ No errors in logs
8. ✅ Monitoring alerts configured

---

## Support

For issues:
1. Check [BUILD_MEMORY_WORKAROUND.md](BUILD_MEMORY_WORKAROUND.md)
2. Check [CLOUD_DEPLOYMENT_GUIDE.md](CLOUD_DEPLOYMENT_GUIDE.md)
3. Review logs: `docker logs <container>` or `kubectl logs <pod>`
4. Check database connectivity
5. Verify environment variables

---

## Next Steps After Deployment

1. **Configure Monitoring**
   - Set up dashboards for agent activity
   - Create alerts for high memory/CPU
   - Monitor queue depths

2. **Performance Tuning**
   - Adjust worker concurrency based on load
   - Enable Redis persistence if needed
   - Optimize database queries

3. **Security Hardening**
   - Enable WAF rules
   - Set up rate limiting
   - Configure IP whitelisting

4. **Backup & DR**
   - Test backup restoration
   - Document recovery procedures
   - Set up cross-region replication

5. **User Training**
   - Share AI Insights dashboard URL
   - Document agent capabilities
   - Provide API documentation

🚀 **Your Agentic AI Platform is Live!**
