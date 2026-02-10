# Production Deployment Guide

## Contract Intelligence Platform - Complete Production Deployment

### Prerequisites

1. **Server Requirements**:
   - Linux server (Ubuntu 22.04+ recommended)
   - Minimum 4 CPU cores, 8GB RAM
   - 50GB+ storage
   - Docker & Docker Compose installed
   - Domain name with DNS configured

2. **Required Services**:
   - Docker Engine 24.0+
   - Docker Compose 2.20+
   - Certbot (for SSL certificates)

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/contract-intel.git
cd contract-intel

# 2. Copy environment template
cp .env.production.example .env

# 3. Edit environment variables
nano .env  # Configure all required variables

# 4. Setup SSL certificates
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh

# 5. Deploy
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

---

## Configuration Files

### Docker Compose (docker-compose.full.yml)

Full production stack including:

- **app**: Next.js application (port 3000)
- **websocket**: Socket.io server (port 3001)
- **postgres**: PostgreSQL with pgvector (port 5432)
- **redis**: Redis cache (port 6379)
- **nginx**: Reverse proxy with SSL (ports 80, 443)

### Nginx Configuration

Located in `nginx/` directory:

- `nginx.conf`: Main configuration with gzip, rate limiting
- `conf.d/default.conf`: Server blocks with SSL, WebSocket proxy

---

## Deployment Scripts

### deploy-production.sh

Main deployment script with:

- Pre-flight checks (Docker, environment)
- Database backup
- Image building
- Rolling deployment
- Database migrations
- Health checks

```bash
# Standard deployment
./scripts/deploy-production.sh

# Skip backup
SKIP_BACKUP=1 ./scripts/deploy-production.sh
```

### setup-ssl.sh

SSL certificate setup using Let's Encrypt:

```bash
./scripts/setup-ssl.sh
```

### backup.sh

Database and configuration backup:

```bash
./scripts/backup.sh
# Backups stored in ./backups/
```

### restore.sh

Restore from backup:

```bash
./scripts/restore.sh ./backups/backup_20240115_120000.tar.gz
```

### health-check.sh

System health monitoring:

```bash
./scripts/health-check.sh
```

---

## Environment Variables

Critical variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:SECURE_PASSWORD@postgres:5432/contract_intel
POSTGRES_PASSWORD=SECURE_PASSWORD

# Redis
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=generate-256-bit-secret
SESSION_SECRET=generate-256-bit-secret
NEXTAUTH_SECRET=generate-256-bit-secret

# URLs
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws

# OpenAI (for AI features)
OPENAI_API_KEY=sk-...

# OAuth (optional)
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
```

---

## Kubernetes Deployment

For larger scale deployments, use Kubernetes:

```bash
# Apply configurations
kubectl apply -f kubernetes/deployment.yaml

# Check status
kubectl get pods -n contract-intel
kubectl get services -n contract-intel

# View logs
kubectl logs -f deployment/app -n contract-intel
```

Features:

- Horizontal Pod Autoscaling (2-10 replicas)
- Pod Disruption Budget
- Persistent Volume Claims
- Ingress with TLS
- Resource limits and requests

---

## Monitoring

### Health Endpoints

- **App**: `GET /api/health`
- **WebSocket**: `GET /health`

### Docker Health Checks

All containers have built-in health checks:

```bash
docker compose -f docker-compose.full.yml ps
```

### Resource Monitoring

```bash
# Container stats
docker stats

# Full health check
./scripts/health-check.sh
```

---

## Backup & Recovery

### Automated Backups

Set up cron job:

```bash
# Add to crontab
0 2 * * * /path/to/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### Manual Backup

```bash
./scripts/backup.sh
```

### Restore Procedure

```bash
# 1. Stop application
docker compose -f docker-compose.full.yml stop app websocket

# 2. Restore database
./scripts/restore.sh ./backups/backup_TIMESTAMP.tar.gz

# 3. Restart application
docker compose -f docker-compose.full.yml up -d
```

---

## SSL Certificate Renewal

Certificates auto-renew via certbot. To manually renew:

```bash
certbot renew --nginx
```

---

## Scaling

### Horizontal Scaling (Docker)

```yaml
# In docker-compose.full.yml
app:
  deploy:
    replicas: 3
```

### Kubernetes Scaling

```bash
# Scale app pods
kubectl scale deployment/app --replicas=5 -n contract-intel

# Autoscaling is configured in deployment.yaml
```

---

## Troubleshooting

### View Logs

```bash
# All services
docker compose -f docker-compose.full.yml logs -f

# Specific service
docker compose -f docker-compose.full.yml logs -f app

# Last 100 lines
docker compose -f docker-compose.full.yml logs --tail=100 app
```

### Container Access

```bash
# App shell
docker compose -f docker-compose.full.yml exec app sh

# PostgreSQL
docker compose -f docker-compose.full.yml exec postgres psql -U postgres

# Redis
docker compose -f docker-compose.full.yml exec redis redis-cli
```

### Common Issues

1. **Database connection failed**:
   - Check `DATABASE_URL` in `.env`
   - Ensure PostgreSQL is running
   - Verify network connectivity

2. **WebSocket not connecting**:
   - Check nginx WebSocket upgrade headers
   - Verify `NEXT_PUBLIC_WS_URL` is correct
   - Check firewall rules

3. **SSL certificate issues**:
   - Run `certbot renew`
   - Check domain DNS configuration

4. **Memory issues**:
   - Increase container memory limits
   - Check for memory leaks in logs

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong secrets (256-bit)
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Backup encryption

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │              Load Balancer              │
                    │           (Nginx + SSL)                 │
                    └────────────────┬────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │   App Server    │   │   App Server    │   │   App Server    │
    │   (Next.js)     │   │   (Next.js)     │   │   (Next.js)     │
    └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
             │                     │                     │
             └─────────────────────┼─────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────┐
        │                          │                      │
        ▼                          ▼                      ▼
┌───────────────┐         ┌───────────────┐      ┌───────────────┐
│   PostgreSQL  │         │    Redis      │      │   WebSocket   │
│   (Primary)   │         │   (Cache)     │      │    Server     │
└───────────────┘         └───────────────┘      └───────────────┘
```

---

## Support

For issues or questions:

1. Check logs with `docker compose logs`
2. Run health check: `./scripts/health-check.sh`
3. Review this guide's troubleshooting section
4. Create an issue in the repository

