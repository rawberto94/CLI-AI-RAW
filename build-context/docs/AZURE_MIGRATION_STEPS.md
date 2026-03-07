# Azure Container Apps Migration Guide

This document describes the complete process of deploying the Contigo application to Azure Container Apps with a Neon PostgreSQL database.

## Overview

| Component | Technology |
|-----------|------------|
| Container Platform | Azure Container Apps |
| Container Registry | Docker Hub |
| Database | Neon PostgreSQL (Free Tier) |
| Runtime | Node.js 22 Alpine |
| Framework | Next.js 15.5.9 |
| ORM | Prisma 5.22.0 |

## Prerequisites

- Azure CLI installed and authenticated
- Docker Desktop installed
- Docker Hub account
- Neon account (free tier available at https://neon.tech)

---

## Step 1: Dockerfile Configuration

### Key Requirements for Alpine + Prisma

The Dockerfile uses a multi-stage build with specific configurations for Prisma on Alpine Linux:

```dockerfile
# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Install OpenSSL and libc6-compat for Prisma
RUN apk add --no-cache libc6-compat openssl

# Install pnpm
RUN npm install -g pnpm@8.9.0

# Copy source and install dependencies
COPY . .
RUN pnpm install --frozen-lockfile || pnpm install

# Generate Prisma client
RUN pnpm --filter clients-db exec prisma generate

# Build packages and Next.js app
RUN pnpm --filter @repo/data-orchestration build
RUN pnpm --filter clients-db build || true

WORKDIR /app/apps/web
ENV NODE_OPTIONS="--max-old-space-size=8192"
# Dummy env vars for build-time validation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN pnpm build

# Stage 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# CRITICAL: OpenSSL is required in the runner stage for Prisma
RUN apk add --no-cache libc6-compat openssl openssl-dev

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### Prisma Schema Configuration

Add binary targets for Alpine Linux in `packages/clients/db/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x", "linux-musl"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}
```

---

## Step 2: Build and Push Docker Image

### Build the image

```powershell
docker build -t <dockerhub-username>/contigo-web:v1.0.2 .
```

### Login to Docker Hub

```powershell
docker login
```

### Push to Docker Hub

```powershell
docker push <dockerhub-username>/contigo-web:v1.0.2
```

---

## Step 3: Set Up Neon PostgreSQL

### Create Neon Project

1. Go to https://console.neon.tech
2. Create a new project (Free tier available)
3. Select a region close to your Azure region (e.g., Frankfurt for Switzerland North)
4. Copy the connection string

### Enable pgvector Extension

In the Neon SQL Editor, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Push Database Schema

```powershell
$env:DATABASE_URL = "postgresql://user:password@host/neondb?sslmode=require"
cd packages/clients/db
npx prisma@5.22.0 db push
```

> **Important:** Use Prisma 5.22.0, not Prisma 7 which has breaking changes.

---

## Step 4: Create Azure Container Apps Environment

### Login to Azure

```powershell
az login
```

### Create Resource Group

```powershell
az group create --name contigoContainerApps --location switzerlandnorth
```

### Create Container Apps Environment

```powershell
az containerapp env create `
  --name managedEnvironment-contigo `
  --resource-group contigoContainerApps `
  --location switzerlandnorth
```

### Deploy Container App

```powershell
az containerapp create `
  --name contigo `
  --resource-group contigoContainerApps `
  --environment managedEnvironment-contigo `
  --image <dockerhub-username>/contigo-web:v1.0.2 `
  --target-port 3000 `
  --ingress external `
  --cpu 0.5 `
  --memory 1Gi `
  --min-replicas 1 `
  --max-replicas 10
```

---

## Step 5: Configure Environment Variables

### Generate NextAuth Secret

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### Set Environment Variables

```powershell
az containerapp update `
  --name contigo `
  --resource-group contigoContainerApps `
  --set-env-vars `
    "DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require" `
    "NEXTAUTH_SECRET=<generated-secret>" `
    "NEXTAUTH_URL=https://<app-name>.<env-id>.<region>.azurecontainerapps.io" `
    "AUTH_TRUST_HOST=true" `
    "NODE_ENV=production"
```

### Optional Environment Variables

```powershell
az containerapp update `
  --name contigo `
  --resource-group contigoContainerApps `
  --set-env-vars `
    "OPENAI_API_KEY=sk-..." `
    "REDIS_URL=redis://..."
```

---

## Step 6: Verify Deployment

### Check Container Status

```powershell
az containerapp show `
  --name contigo `
  --resource-group contigoContainerApps `
  --query "{status:properties.runningStatus,fqdn:properties.configuration.ingress.fqdn}"
```

### View Logs

```powershell
az containerapp logs show `
  --name contigo `
  --resource-group contigoContainerApps `
  --tail 50
```

### Expected Healthy Logs

```
[INFO] 📊 Service Status:
[INFO]    Database: ✅
[INFO]    Redis: ⚠️ (optional)
[INFO]    AI (OpenAI): ⚠️ (optional)
[INFO]    Storage: ⚠️ (optional)
[INFO]    Email: ⚠️ (optional)
✓ Ready in 215ms
```

---

## Troubleshooting

### Issue: Prisma "Query Engine not found"

**Error:** `Prisma Client could not locate the Query Engine for runtime "linux-musl"`

**Solution:** Add binary targets to schema.prisma:
```prisma
binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl"]
```

### Issue: libssl.so.1.1 not found

**Error:** `Error loading shared library libssl.so.1.1`

**Solution:** Add OpenSSL to the runner stage:
```dockerfile
RUN apk add --no-cache libc6-compat openssl openssl-dev
```

### Issue: Container OOM Killed (Exit Code 137)

**Solution:** Increase memory allocation:
```powershell
az containerapp update --name contigo --resource-group contigoContainerApps --memory 1Gi
```

### Issue: UntrustedHost Error

**Error:** `Host must be trusted`

**Solution:** Set AUTH_TRUST_HOST and correct NEXTAUTH_URL:
```powershell
az containerapp update --name contigo --resource-group contigoContainerApps `
  --set-env-vars "AUTH_TRUST_HOST=true" "NEXTAUTH_URL=https://full-app-url"
```

### Issue: 502 Bad Gateway

**Possible causes:**
1. Container not running - check logs
2. Missing environment variables
3. Database connection failed
4. Memory too low (OOM)

---

## Updating the Deployment

### Build and Push New Version

```powershell
docker build -t <dockerhub-username>/contigo-web:v1.0.3 .
docker push <dockerhub-username>/contigo-web:v1.0.3
```

### Update Container App

```powershell
az containerapp update `
  --name contigo `
  --resource-group contigoContainerApps `
  --image <dockerhub-username>/contigo-web:v1.0.3
```

---

## Cost Optimization

### Azure Container Apps (Consumption Tier)
- **vCPU:** $0.000024/vCPU-second
- **Memory:** $0.000003/GiB-second
- **Free grant:** 180,000 vCPU-seconds + 360,000 GiB-seconds per month

### Neon PostgreSQL (Free Tier)
- **Compute:** 191.9 hours/month
- **Storage:** 0.5 GB
- **Branches:** 10

---

## Final Configuration

| Setting | Value |
|---------|-------|
| App URL | `https://contigo.mangoglacier-821a6329.switzerlandnorth.azurecontainerapps.io` |
| Docker Image | `keakdasneak/contigo-web:v1.0.2` |
| CPU | 0.5 vCPU |
| Memory | 1 GiB |
| Min Replicas | 1 |
| Max Replicas | 10 |
| Database | Neon PostgreSQL (Frankfurt) |
| Region | Switzerland North |

---

## Next Steps

1. **Custom Domain:** Configure a custom domain with SSL
2. **CI/CD:** Set up GitHub Actions for automated deployments
3. **Monitoring:** Enable Azure Application Insights
4. **Scaling:** Configure autoscaling rules based on HTTP traffic
5. **Backup:** Configure Neon database backups
