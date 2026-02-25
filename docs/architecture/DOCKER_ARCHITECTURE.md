# Docker Container Architecture

> **DEPRECATED:** See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §7 (Infrastructure & Deployment) and [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) §14 (Deployment) for current Docker documentation. Retained for historical reference only.

---

This document explains the Docker container setup for the CLI-AI Contract Intelligence Platform, including the multi-container architecture, multi-tenancy strategy, and deployment configurations.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Container Inventory](#2-container-inventory)
3. [Multi-Tenancy Strategy](#3-multi-tenancy-strategy)
4. [Docker Compose Configurations](#4-docker-compose-configurations)
5. [Dockerfile Details](#5-dockerfile-details)
6. [Networking](#6-networking)
7. [Resource Allocation](#7-resource-allocation)
8. [Kubernetes Deployment](#8-kubernetes-deployment)
9. [Scaling Strategy](#9-scaling-strategy)

---

## 1. Architecture Overview

### Container-Per-Service Architecture

The application uses a **microservices-inspired architecture** with separate containers for each service component:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          NGINX (Reverse Proxy)                       │
│                         Port 80/443 (HTTP/HTTPS)                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web (Next.js)│     │   WebSocket     │     │      API        │
│   Port 3000    │     │   Port 3001     │     │   Port 8080     │
└───────┬───────┘     └────────┬────────┘     └────────┬────────┘
        │                      │                       │
        └──────────────────────┼───────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   PostgreSQL  │     │     Redis     │     │    MinIO      │
│   Port 5432   │     │   Port 6379   │     │  Port 9000    │
└───────────────┘     └───────────────┘     └───────────────┘
        │
        ▼
┌───────────────┐     ┌───────────────┐
│   Workers     │     │   ChromaDB    │
│  (BullMQ)     │     │  Port 8000    │
└───────────────┘     └───────────────┘
```

### NOT One Container Per Tenant

The architecture is **NOT one container per tenant**. Instead:

- **Single shared infrastructure** serves all tenants
- **Database-level isolation** with `tenantId` on every table
- **Horizontal scaling** of application containers for performance
- **Multi-tenant at the application layer**

---

## 2. Container Inventory

### Application Containers

| Container | Image | Purpose | Replicas |
|-----------|-------|---------|----------|
| **web** | `contract-intel-web` | Next.js frontend + API routes | 1-10 (auto-scaled) |
| **websocket** | `contract-intel-websocket` | Real-time WebSocket server | 2 |
| **workers** | `contract-intel-workers` | Background job processing | 2-8 (auto-scaled) |
| **api** | `contract-intel-api` | REST API (optional, in prod config) | 1-3 |

### Infrastructure Containers

| Container | Image | Purpose | Replicas |
|-----------|-------|---------|----------|
| **postgres** | `pgvector/pgvector:pg16` | Primary database with vector support | 1 |
| **redis** | `redis:7-alpine` | Job queues, caching, pub/sub | 1 |
| **minio** | `minio/minio:latest` | S3-compatible file storage | 1 |
| **chromadb** | `chromadb/chroma:latest` | Vector database for RAG | 1 |
| **nginx** | `nginx:alpine` | Reverse proxy, SSL termination | 1 |

---

## 3. Multi-Tenancy Strategy

### Database-Level Multi-Tenancy

All tenants share the same database with row-level isolation:

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    contracts table                    │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ id | tenant_id | title        | status     │    │   │
│  │  ├─────────────────────────────────────────────┤    │   │
│  │  │ 1  | tenant_A  | Contract 1   | COMPLETED  │    │   │
│  │  │ 2  | tenant_B  | Contract 2   | PROCESSING │    │   │
│  │  │ 3  | tenant_A  | Contract 3   | UPLOADED   │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  WHERE tenant_id = ? (applied to all queries)              │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Isolation Guarantees

1. **Every table has `tenantId`**: All data is tagged with tenant identifier
2. **Query filtering**: Middleware automatically adds tenant filter
3. **API authentication**: JWT tokens contain tenant context
4. **Storage isolation**: MinIO buckets/prefixes per tenant
5. **Redis namespacing**: Queue names include tenant prefix

### Why This Approach?

| Approach | Pros | Cons |
|----------|------|------|
| **Shared DB (current)** | Cost-effective, simple ops, efficient resource use | Requires careful query filtering |
| Container per tenant | Strong isolation | High cost, complex orchestration |
| Database per tenant | Good isolation | Moderate cost, migration complexity |

---

## 4. Docker Compose Configurations

### Development (`docker-compose.dev.yml`)

Minimal setup for local development:

```yaml
services:
  postgres:     # Port 5432 - pgvector:pg16
  redis:        # Port 6379 - redis:7-alpine  
  minio:        # Port 9000/9001 - minio/minio
```

**Usage:**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Resource Limits:**

- PostgreSQL: 1GB memory
- Redis: 512MB memory
- MinIO: 512MB memory

### Staging (`docker-compose.staging.yml`)

Full application with separate port mappings:

```yaml
services:
  postgres:     # Port 5433 (external) → 5432 (internal)
  redis:        # Port 6380 (external) → 6379 (internal)
  minio:        # Port 9002/9003 → 9000/9001
  web:          # Port 3001 → 3000
```

**Usage:**

```bash
docker-compose -f docker-compose.staging.yml up -d
```

### Production (`docker-compose.prod.yml`)

Full production stack with all services:

```yaml
services:
  postgres:     # Database
  redis:        # Cache & queues
  minio:        # Object storage
  api:          # API server (optional)
  workers:      # Background processing (3 replicas)
  web:          # Frontend
  nginx:        # Reverse proxy (optional profile)
```

**Usage:**

```bash
docker-compose -f docker-compose.prod.yml up -d

# With nginx:
docker-compose -f docker-compose.prod.yml --profile nginx up -d
```

### Full Stack (`docker-compose.full.yml`)

Complete production deployment with all components:

```yaml
services:
  nginx:        # Reverse proxy
  web:          # Next.js application
  websocket:    # WebSocket server
  postgres:     # Database
  redis:        # Cache
  minio:        # Storage
  chromadb:     # Vector database
```

### RAG System (`docker-compose.rag.yml`)

Vector database only (add-on):

```yaml
services:
  chroma:       # ChromaDB for vector search
```

**Usage:**

```bash
docker-compose -f docker-compose.dev.yml -f docker-compose.rag.yml up -d
```

---

## 5. Dockerfile Details

### Main Application (`Dockerfile`)

Multi-stage build for Next.js:

```dockerfile
# Stage 1: deps - Install dependencies
FROM node:22-alpine AS deps
# Install pnpm, copy package files, install deps

# Stage 2: builder - Build application
FROM node:22-alpine AS builder
# Copy deps, generate Prisma client, build Next.js

# Stage 3: runner - Production runtime
FROM node:22-alpine AS runner
# Non-root user, copy standalone build
# CMD ["node", "apps/web/server.js"]
```

**Key Features:**

- Multi-stage build reduces image size
- Non-root user for security
- Standalone Next.js output mode

### Workers (`Dockerfile.workers`)

Background job processor:

```dockerfile
# Separate build for worker processes
# Runs BullMQ workers for:
# - Contract processing
# - AI analysis
# - Embedding generation
# - Report generation
```

### WebSocket Server (`Dockerfile.websocket`)

Real-time communication:

```dockerfile
# Dedicated WebSocket server
# Health check endpoint at /health
# Port 3001
```

---

## 6. Networking

### Docker Networks

| Environment | Network | Subnet |
|-------------|---------|--------|
| Development | `bridge` (default) | Auto-assigned |
| Staging | `contract-intelligence-staging` | 172.21.0.0/16 |
| Production | `contract-intelligence` | 172.20.0.0/16 |
| Full Stack | `contract-intel-network` | 172.28.0.0/16 |

### Service Discovery

Containers communicate via service names:

```
web → postgres:5432
web → redis:6379
web → minio:9000
workers → postgres:5432
workers → redis:6379
websocket → redis:6379
```

### External Ports

| Service | Dev | Staging | Production |
|---------|-----|---------|------------|
| Web | - | 3001 | 3000 (via nginx) |
| PostgreSQL | 5432 | 5433 | Internal only |
| Redis | 6379 | 6380 | Internal only |
| MinIO API | 9000 | 9002 | Internal only |
| MinIO Console | 9001 | 9003 | Internal only |

---

## 7. Resource Allocation

### Development Resources

```yaml
postgres:   512MB-1GB memory
redis:      128MB-512MB memory
minio:      256MB-512MB memory
```

### Production Resources

```yaml
postgres:
  limits:     2GB memory, 2 CPU
  requests:   1GB memory, 1 CPU

redis:
  limits:     768MB memory, 0.5 CPU
  requests:   256MB memory, 0.25 CPU

web:
  limits:     2GB memory, 2 CPU
  requests:   1GB memory, 1 CPU

workers:
  limits:     2GB memory, 2 CPU
  requests:   512MB memory, 0.5 CPU
  replicas:   3

websocket:
  limits:     512MB memory, 0.5 CPU
  requests:   256MB memory, 0.25 CPU

chromadb:
  limits:     1GB memory, 1 CPU
  requests:   512MB memory, 0.5 CPU
```

---

## 8. Kubernetes Deployment

For production at scale, Kubernetes configuration is provided:

### Deployments

| Deployment | Replicas | HPA | Notes |
|------------|----------|-----|-------|
| `app` | 3 (min 2, max 10) | CPU 70%, Memory 80% | Main application |
| `websocket` | 2 | - | WebSocket server |
| `workers` | 3 (min 2, max 8) | CPU 80% | Background jobs |
| `redis` | 1 | - | In-memory cache |

### StatefulSets

| StatefulSet | Replicas | Storage |
|-------------|----------|---------|
| `postgres` | 1 | 20Gi PVC |
| `minio` | 1 | 50Gi PVC |

### Ingress Configuration

```yaml
paths:
  - /ws    → websocket-service:3001
  - /      → app-service:3000
```

### Security

- **NetworkPolicy**: Default deny ingress
- **PodDisruptionBudget**: Minimum 1 pod available
- **Resource limits**: Prevent noisy neighbor issues

---

## 9. Scaling Strategy

### Horizontal Pod Autoscaling

```yaml
# Application pods
minReplicas: 2
maxReplicas: 10
targetCPU: 70%
targetMemory: 80%

# Worker pods
minReplicas: 2
maxReplicas: 8
targetCPU: 80%
```

### When to Scale

| Metric | Scale Up | Scale Down |
|--------|----------|------------|
| CPU > 70% | Add pod | - |
| CPU < 30% | - | Remove pod |
| Memory > 80% | Add pod | - |
| Queue depth > 100 | Add workers | - |

### Database Scaling (Future)

For higher scale, consider:

- **Read replicas**: PostgreSQL streaming replication
- **Connection pooling**: PgBouncer
- **Redis cluster**: Multiple Redis nodes

---

## Quick Reference

### Start Development Environment

```bash
# Infrastructure only
docker-compose -f docker-compose.dev.yml up -d

# Check status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Start Full Production Stack

```bash
# Build and start
docker-compose -f docker-compose.full.yml up -d --build

# Scale workers
docker-compose -f docker-compose.full.yml up -d --scale workers=5
```

### Common Commands

```bash
# View all containers
docker ps -a

# Database shell
docker exec -it contract-intelligence-postgres psql -U postgres -d contracts

# Redis CLI
docker exec -it contract-intelligence-redis redis-cli

# View logs
docker logs -f contract-intel-web

# Resource usage
docker stats
```

---

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/contracts
DB_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://redis:6379

# MinIO
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=contracts

# OpenAI
OPENAI_API_KEY=sk-...

# Auth
JWT_SECRET=your_jwt_secret
AUTH_SECRET=your_auth_secret
NEXTAUTH_URL=https://your-domain.com
```

### Optional Variables

```bash
# Features
RAG_ENABLED=true
ANALYSIS_USE_LLM=true

# Monitoring
SENTRY_DSN=https://...
LOG_LEVEL=info

# Scaling
WORKER_REPLICAS=3
WORKER_CONCURRENCY=5
```

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Container Strategy** | One container per service (not per tenant) |
| **Multi-tenancy** | Database-level with `tenantId` isolation |
| **Scaling** | Horizontal pod autoscaling |
| **Database** | Shared PostgreSQL with pgvector |
| **Queue** | Redis with BullMQ |
| **Storage** | MinIO (S3-compatible) |
| **Orchestration** | Docker Compose (dev/staging) or Kubernetes (production) |

