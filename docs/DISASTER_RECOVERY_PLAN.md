# Disaster Recovery Plan

## Overview

This document outlines the disaster recovery (DR) procedures for the Contigo platform to ensure business continuity in the event of system failures, data loss, or regional outages.

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | 4 hours | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |
| **MTTR** (Mean Time to Recovery) | 2 hours | Average recovery time |

## Disaster Categories

### Category 1: Application Failure

**Impact**: Single service or component failure  
**RTO**: 15 minutes  
**Recovery**: Auto-healing via Kubernetes, manual pod restart

### Category 2: Database Failure

**Impact**: Primary database unavailable  
**RTO**: 30 minutes  
**Recovery**: Failover to read replica, point-in-time recovery

### Category 3: Availability Zone Failure

**Impact**: Single AZ outage  
**RTO**: 1 hour  
**Recovery**: Automatic failover to secondary AZ

### Category 4: Regional Failure

**Impact**: Entire region unavailable  
**RTO**: 4 hours  
**Recovery**: Manual failover to DR region

---

## Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRIMARY REGION (us-east-1)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   AZ-1a     │  │   AZ-1b     │  │   AZ-1c     │              │
│  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │              │
│  │  │ App   │  │  │  │ App   │  │  │  │ App   │  │              │
│  │  │ Pods  │  │  │  │ Pods  │  │  │  │ Pods  │  │              │
│  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │              │
│  │  ┌───────┐  │  │  ┌───────┐  │  │             │              │
│  │  │Primary│  │  │  │Replica│  │  │             │              │
│  │  │  DB   │──┼──┼─▶│  DB   │  │  │             │              │
│  │  └───────┘  │  │  └───────┘  │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                         │                                        │
│                    S3 Replication                                │
│                         │                                        │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DR REGION (us-west-2)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐                               │
│  │   AZ-2a     │  │   AZ-2b     │  (Scaled down, activated      │
│  │  ┌───────┐  │  │  ┌───────┐  │   during DR event)            │
│  │  │ App   │  │  │  │Standby│  │                               │
│  │  │ Pods  │  │  │  │  DB   │  │                               │
│  │  └───────┘  │  │  └───────┘  │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backup Strategy

### Database Backups

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Continuous WAL | Real-time | 7 days | S3 (same region) |
| Automated Snapshots | Every 6 hours | 30 days | S3 (cross-region) |
| Daily Full Backup | Daily at 02:00 UTC | 90 days | S3 + Glacier |
| Weekly Archive | Sunday 03:00 UTC | 1 year | Glacier |

### File Storage Backups

| Type | Frequency | Retention |
|------|-----------|-----------|
| Document uploads | Continuous S3 replication | Indefinite |
| Contract PDFs | Cross-region replication | Per retention policy |

### Configuration Backups

- Kubernetes manifests: Git repository
- Environment variables: HashiCorp Vault (replicated)
- Infrastructure as Code: Terraform state in S3

---

## Recovery Procedures

### Procedure 1: Application Pod Failure

**Detection**: Kubernetes liveness probe failure, Prometheus alert  
**Automatic Recovery**: Kubernetes restarts pod  
**Manual Recovery** (if auto-recovery fails):

```bash
# 1. Check pod status
kubectl get pods -n contigo -l app=contigo-web

# 2. View logs
kubectl logs -n contigo <pod-name> --previous

# 3. Force restart deployment
kubectl rollout restart deployment/contigo-web -n contigo

# 4. Verify recovery
kubectl rollout status deployment/contigo-web -n contigo
```

### Procedure 2: Database Failover

**Detection**: Database connection failures, replica lag alerts  
**RTO**: 30 minutes

```bash
# 1. Verify primary is down
psql $PRIMARY_DATABASE_URL -c "SELECT 1" || echo "Primary is down"

# 2. Promote replica to primary
# AWS RDS:
aws rds promote-read-replica --db-instance-identifier contigo-replica

# Manual PostgreSQL:
psql $REPLICA_DATABASE_URL -c "SELECT pg_promote()"

# 3. Update connection strings
kubectl set env deployment/contigo-web \
  DATABASE_URL="$NEW_PRIMARY_URL" \
  -n contigo

# 4. Verify application connectivity
curl -f https://api.contigo.app/api/health/ready

# 5. Create new replica from promoted primary
aws rds create-db-instance-read-replica \
  --db-instance-identifier contigo-replica-new \
  --source-db-instance-identifier contigo-primary
```

### Procedure 3: Point-in-Time Recovery

**Use Case**: Accidental data deletion, corruption  
**RPO**: Up to 5 minutes before incident

```bash
# 1. Identify recovery point
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier contigo-cluster

# 2. Create recovery instance
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier contigo-primary \
  --target-db-instance-identifier contigo-recovery \
  --restore-time "2024-01-15T14:30:00Z"

# 3. Verify recovered data
psql $RECOVERY_DATABASE_URL -c "SELECT COUNT(*) FROM \"Contract\""

# 4. Export corrected data
pg_dump $RECOVERY_DATABASE_URL -t "Contract" > contracts_recovery.sql

# 5. Import to production (after validation)
psql $PRIMARY_DATABASE_URL < contracts_recovery.sql

# 6. Delete recovery instance
aws rds delete-db-instance --db-instance-identifier contigo-recovery
```

### Procedure 4: Regional Failover

**Detection**: AWS regional outage, multiple AZ failures  
**RTO**: 4 hours

```bash
#!/bin/bash
# regional-failover.sh

set -e

DR_REGION="us-west-2"
PRIMARY_REGION="us-east-1"

echo "=== REGIONAL FAILOVER INITIATED ==="
echo "Failing over from $PRIMARY_REGION to $DR_REGION"

# 1. Verify DR region is healthy
aws ec2 describe-availability-zones --region $DR_REGION

# 2. Promote DR database
echo "Promoting DR database..."
aws rds promote-read-replica \
  --db-instance-identifier contigo-dr-replica \
  --region $DR_REGION

# 3. Scale up DR application
echo "Scaling DR application..."
kubectl config use-context contigo-dr-cluster
kubectl scale deployment/contigo-web --replicas=6 -n contigo

# 4. Update DNS to point to DR region
echo "Updating DNS..."
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://dns-failover.json

# 5. Invalidate CDN cache
echo "Invalidating CDN cache..."
aws cloudfront create-invalidation \
  --distribution-id $CDN_DISTRIBUTION_ID \
  --paths "/*"

# 6. Notify team
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"🚨 Regional failover completed to us-west-2"}'

echo "=== FAILOVER COMPLETE ==="
echo "Verify: https://api.contigo.app/api/health"
```

---

## Communication Plan

### Internal Escalation

| Severity | Response Time | Notify |
|----------|---------------|--------|
| P1 - Critical | Immediate | On-call engineer + Engineering lead + CTO |
| P2 - High | 15 minutes | On-call engineer + Engineering lead |
| P3 - Medium | 1 hour | On-call engineer |
| P4 - Low | Next business day | Assigned engineer |

### External Communication

| Timeframe | Action |
|-----------|--------|
| 0-15 min | Acknowledge incident on status page |
| 15-30 min | Initial update with impact assessment |
| Every 30 min | Progress updates during outage |
| Resolution | Root cause analysis within 24 hours |
| Post-mortem | Detailed report within 72 hours |

### Status Page Updates

```bash
# Update status page (example with Statuspage.io API)
curl -X POST "https://api.statuspage.io/v1/pages/$PAGE_ID/incidents" \
  -H "Authorization: OAuth $STATUSPAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "name": "Database Connectivity Issues",
      "status": "investigating",
      "impact_override": "major",
      "body": "We are investigating reports of degraded service."
    }
  }'
```

---

## Testing Schedule

| Test Type | Frequency | Last Tested | Next Test |
|-----------|-----------|-------------|-----------|
| Backup Restore | Monthly | - | TBD |
| Database Failover | Quarterly | - | TBD |
| Regional Failover | Annually | - | TBD |
| Runbook Review | Quarterly | - | TBD |

### Failover Test Procedure

1. Schedule maintenance window
2. Notify customers 48 hours in advance
3. Execute failover to DR region
4. Run smoke tests against DR environment
5. Measure actual RTO/RPO
6. Fail back to primary region
7. Document results and update runbooks

---

## Recovery Checklist

### Pre-Recovery

- [ ] Incident declared and severity assigned
- [ ] On-call team notified
- [ ] Status page updated
- [ ] Customer communication sent (if P1/P2)

### During Recovery

- [ ] Root cause identified
- [ ] Recovery procedure selected
- [ ] Changes documented in incident log
- [ ] Progress updates every 30 minutes

### Post-Recovery

- [ ] Services verified operational
- [ ] All health checks passing
- [ ] Customer notification of resolution
- [ ] Incident log completed
- [ ] Post-mortem scheduled (within 72 hours)

---

## Appendix: Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Primary On-Call | Rotating | PagerDuty | <oncall@contigo.app> |
| Engineering Lead | TBD | TBD | <eng-lead@contigo.app> |
| Infrastructure Lead | TBD | TBD | <infra@contigo.app> |
| CTO | TBD | TBD | <cto@contigo.app> |

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-16 | Platform Team | Initial version |
