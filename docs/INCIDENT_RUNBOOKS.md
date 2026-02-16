# Incident Response Runbooks

> Last Updated: December 21, 2025  
> Version: 1.0.0

## 📋 Table of Contents

1. [Incident Classification](#incident-classification)
2. [On-Call Procedures](#on-call-procedures)
3. [Common Incidents](#common-incidents)
4. [Escalation Matrix](#escalation-matrix)
5. [Post-Incident Process](#post-incident-process)

---

## Incident Classification

### Severity Levels

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **SEV1 - Critical** | Complete service outage | 15 minutes | App down, data loss, security breach |
| **SEV2 - Major** | Major feature unavailable | 30 minutes | Auth broken, uploads failing, API errors |
| **SEV3 - Minor** | Degraded performance | 2 hours | Slow responses, minor UI bugs |
| **SEV4 - Low** | Cosmetic/minor issues | 24 hours | Typos, non-critical warnings |

---

## On-Call Procedures

### Initial Response Checklist

```
□ Acknowledge the alert
□ Check monitoring dashboard
□ Verify the issue is real (not false positive)
□ Classify severity
□ Begin investigation
□ Communicate status to stakeholders
□ Document timeline in incident channel
```

### Status Page Updates

Update status page at: `https://status.yourapp.com` (or internal status channel)

Templates:

- **Investigating**: "We are investigating reports of [ISSUE]. More updates to follow."
- **Identified**: "We have identified the cause of [ISSUE] and are working on a fix."
- **Resolved**: "The issue with [FEATURE] has been resolved. Service is back to normal."

---

## Common Incidents

### 🔴 INC-001: Application Not Responding

**Symptoms:**

- Health check returns 503
- No response from web server
- Container restarts

**Diagnostic Steps:**

```bash
# 1. Check container status
docker compose -f docker-compose.prod.yml ps

# 2. Check application logs
docker compose -f docker-compose.prod.yml logs --tail=100 app

# 3. Check memory/CPU usage
docker stats

# 4. Check if port is listening
curl -v http://localhost:3005/api/monitoring/health
```

**Resolution:**

```bash
# Option 1: Restart the application container
docker compose -f docker-compose.prod.yml restart app

# Option 2: Full stack restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Option 3: Force recreate with latest image
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

---

### 🔴 INC-002: Database Connection Issues

**Symptoms:**

- "Connection refused" errors
- "Too many connections" errors
- Slow queries

**Diagnostic Steps:**

```bash
# 1. Check PostgreSQL status
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres

# 2. Check connection count
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Check for long-running queries
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
  FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '30 seconds';"

# 4. Check disk space
docker compose -f docker-compose.prod.yml exec postgres df -h
```

**Resolution:**

```bash
# Kill long-running queries
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes';"

# Restart PostgreSQL (will cause brief downtime)
docker compose -f docker-compose.prod.yml restart postgres

# If disk full, clean up
docker system prune -f
```

---

### 🔴 INC-003: Redis Connection/Memory Issues

**Symptoms:**

- Cache misses increasing
- Session errors
- "OOM" errors in Redis logs

**Diagnostic Steps:**

```bash
# 1. Check Redis status
docker compose -f docker-compose.prod.yml exec redis redis-cli ping

# 2. Check memory usage
docker compose -f docker-compose.prod.yml exec redis redis-cli INFO memory

# 3. Check key count
docker compose -f docker-compose.prod.yml exec redis redis-cli DBSIZE

# 4. Check eviction stats
docker compose -f docker-compose.prod.yml exec redis redis-cli INFO stats | grep evicted
```

**Resolution:**

```bash
# Clear expired keys
docker compose -f docker-compose.prod.yml exec redis redis-cli --scan --pattern '*' | head -100

# Flush non-essential cache (careful!)
docker compose -f docker-compose.prod.yml exec redis redis-cli FLUSHDB

# Restart Redis
docker compose -f docker-compose.prod.yml restart redis
```

---

### 🟡 INC-004: High Memory Usage

**Symptoms:**

- Slow responses
- Container OOM kills
- Memory alerts

**Diagnostic Steps:**

```bash
# 1. Check memory per container
docker stats --no-stream

# 2. Check Node.js heap
curl http://localhost:3005/api/monitoring/prometheus | grep memory

# 3. Check for memory leaks (if heap keeps growing)
# Enable heapdump in production for analysis
```

**Resolution:**

```bash
# Restart application to clear memory
docker compose -f docker-compose.prod.yml restart app

# Scale horizontally if available
kubectl scale deployment/app --replicas=3

# Increase container memory limits
# Edit docker-compose.prod.yml:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

---

### 🟡 INC-005: Worker Queue Backup

**Symptoms:**

- Contract processing delayed
- Artifacts not generating
- Queue length increasing

**Diagnostic Steps:**

```bash
# 1. Check worker logs
docker compose -f docker-compose.prod.yml logs --tail=200 workers

# 2. Check Redis queue length
docker compose -f docker-compose.prod.yml exec redis redis-cli LLEN bull:contract-processing:wait

# 3. Check for failed jobs
docker compose -f docker-compose.prod.yml exec redis redis-cli LLEN bull:contract-processing:failed
```

**Resolution:**

```bash
# Restart workers
docker compose -f docker-compose.prod.yml restart workers

# Clear failed jobs (be careful - loses data)
docker compose -f docker-compose.prod.yml exec redis redis-cli DEL bull:contract-processing:failed

# Scale workers (if Kubernetes)
kubectl scale deployment/workers --replicas=3
```

---

### 🟡 INC-006: File Upload Failures

**Symptoms:**

- Upload timeout errors
- "Storage unavailable" errors
- S3/MinIO errors

**Diagnostic Steps:**

```bash
# 1. Check MinIO status
curl http://localhost:9000/minio/health/live

# 2. Check MinIO logs
docker compose -f docker-compose.prod.yml logs --tail=100 minio

# 3. Test bucket access
docker compose -f docker-compose.prod.yml exec minio \
  mc ls local/contracts
```

**Resolution:**

```bash
# Restart MinIO
docker compose -f docker-compose.prod.yml restart minio

# Recreate bucket if missing
docker compose -f docker-compose.prod.yml exec minio \
  mc mb local/contracts --ignore-existing

# Check disk space
df -h
```

---

### 🔴 INC-007: Authentication Failures

**Symptoms:**

- Users cannot log in
- Session expired errors
- 401 Unauthorized on all requests

**Diagnostic Steps:**

```bash
# 1. Check auth logs
docker compose -f docker-compose.prod.yml logs app 2>&1 | grep -i "auth\|session\|jwt"

# 2. Verify NEXTAUTH_SECRET is set
docker compose -f docker-compose.prod.yml exec app printenv | grep NEXTAUTH

# 3. Check session cookie settings
# Ensure NEXTAUTH_URL matches actual domain
```

**Resolution:**

```bash
# Verify environment variables
echo $NEXTAUTH_SECRET | wc -c  # Should be 32+

# Clear all sessions (forces re-login)
docker compose -f docker-compose.prod.yml exec redis redis-cli KEYS "session:*" | xargs docker compose -f docker-compose.prod.yml exec redis redis-cli DEL

# Restart app after env changes
docker compose -f docker-compose.prod.yml restart app
```

---

### 🟡 INC-008: API Rate Limiting Triggered

**Symptoms:**

- 429 Too Many Requests errors
- Legitimate users blocked
- Rate limit headers in response

**Diagnostic Steps:**

```bash
# 1. Check rate limit logs
docker compose -f docker-compose.prod.yml logs app 2>&1 | grep "rate limit"

# 2. Check Redis rate limit keys
docker compose -f docker-compose.prod.yml exec redis redis-cli KEYS "ratelimit:*"
```

**Resolution:**

```bash
# Clear rate limit for specific IP
docker compose -f docker-compose.prod.yml exec redis redis-cli DEL "ratelimit:1.2.3.4"

# Clear all rate limits (temporary relief)
docker compose -f docker-compose.prod.yml exec redis redis-cli KEYS "ratelimit:*" | xargs docker compose -f docker-compose.prod.yml exec redis redis-cli DEL

# Adjust rate limits in middleware.ts if needed
```

---

## Escalation Matrix

| Severity | First Responder | Escalate To | Time to Escalate |
|----------|-----------------|-------------|------------------|
| SEV1 | On-call Engineer | Team Lead + CTO | 15 minutes |
| SEV2 | On-call Engineer | Team Lead | 30 minutes |
| SEV3 | On-call Engineer | Senior Engineer | 2 hours |
| SEV4 | On-call Engineer | - | Next business day |

### Contact List

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | TBD | TBD |
| Secondary On-Call | TBD | TBD |
| Team Lead | TBD | TBD |
| Database Admin | TBD | TBD |

---

## Post-Incident Process

### Incident Review Template

```markdown
# Incident Review: [INCIDENT-ID]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: SEV1/2/3/4
- **Impact**: [Number of users affected, business impact]

## Timeline
- HH:MM - Alert triggered
- HH:MM - On-call acknowledged
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored

## Root Cause
[Technical explanation of what caused the incident]

## Resolution
[What was done to fix the immediate issue]

## Action Items
- [ ] [Preventive measure 1] - Owner: @name, Due: date
- [ ] [Preventive measure 2] - Owner: @name, Due: date

## Lessons Learned
- What went well?
- What could be improved?
```

### Blameless Postmortem Guidelines

1. Focus on systems, not individuals
2. Ask "what" not "who"
3. Identify contributing factors
4. Create actionable improvements
5. Share learnings with the team

---

## Quick Reference Commands

```bash
# === Health Checks ===
curl http://localhost:3005/api/monitoring/health
curl http://localhost:3005/api/monitoring/prometheus

# === Container Management ===
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart [service]

# === Database ===
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres

# === Redis ===
docker compose -f docker-compose.prod.yml exec redis redis-cli

# === Full Stack Health Check ===
./scripts/health-check.sh

# === Backup (before major changes) ===
./scripts/backup.sh

# === Restore (if needed) ===
./scripts/restore.sh [backup-file]
```

---

## Appendix: Monitoring Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/monitoring/health` | Full health check | JSON with component status |
| `/api/monitoring/health?probe=liveness` | K8s liveness | `{"status":"alive"}` |
| `/api/monitoring/health?probe=readiness` | K8s readiness | Full health JSON |
| `/api/monitoring/prometheus` | Prometheus metrics | Text format metrics |
| `/api/health` | Simple health | `{"status":"ok"}` |
