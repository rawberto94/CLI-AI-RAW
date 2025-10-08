# Contract Intelligence System - Architecture & Setup

## 🎯 System Overview

This is a full-stack contract intelligence platform with AI-powered analysis, built using:

- **Frontend**: Next.js 15 (port 3005)
- **Backend API**: Fastify (port 3001)
- **Database**: PostgreSQL with pgvector extension (port 5432)
- **Cache**: Redis (port 6379)
- **Storage**: MinIO S3-compatible storage (ports 9000, 9001)

## 🔧 What Was Fixed

### 1. Prisma Binary Target Issue

**Problem**: Prisma Client was generated for `linux-musl-openssl-3.0.x` but the runtime needed `debian-openssl-1.1.x`

**Fix**: Updated `packages/clients/db/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "linux-musl-openssl-3.0.x"]
  previewFeatures = ["postgresqlExtensions"]
}
```

### 2. Database Setup

**Problem**: PostgreSQL wasn't running

**Fix**:

- Started PostgreSQL with pgvector using Docker
- Ran database migrations
- Enabled required extensions (vector, pg_trgm, btree_gin, uuid-ossp)

### 3. Repository TypeScript Errors

**Problem**: Schema changes caused field name mismatches

**Fix**:

- Changed `filename` → `fileName` in artifact and contract repositories
- Commented out `ProcessingStatus` enum usage (not in current schema)
- Updated to use `status` field instead

### 4. Missing Backend API

**Problem**: Only the Next.js frontend was running

**Fix**:

- Built all workspace packages in correct order
- Started Fastify API server on port 3001
- Configured environment variables

### 5. Workspace Package Dependencies

**Problem**: Workspace packages weren't compiled

**Fix**: Built packages in dependency order:

1. `utils`
2. `schemas`
3. `clients/db`
4. `clients/openai`
5. `clients/storage`
6. `agents`
7. `api`

## 📁 System Architecture

```
CLI-AI-RAW/
├── apps/
│   ├── web/                    # Next.js frontend (port 3005)
│   │   ├── app/               # App router pages
│   │   ├── components/        # React components
│   │   └── lib/               # Client utilities
│   │
│   ├── api/                    # Fastify backend (port 3001)
│   │   ├── src/               # API routes and services
│   │   ├── index.ts           # Main API entry
│   │   └── .env               # API environment config
│   │
│   ├── core/                   # Core business logic
│   │   ├── ai/                # AI/LLM integrations
│   │   ├── contracts/         # Contract processing
│   │   └── streaming/         # Stream processing
│   │
│   └── workers/                # Background job workers
│
├── packages/
│   ├── clients/
│   │   ├── db/                # Prisma database client
│   │   ├── openai/            # OpenAI client wrapper
│   │   ├── storage/           # MinIO/S3 storage client
│   │   ├── queue/             # BullMQ queue client
│   │   └── rag/               # RAG/vector search
│   │
│   ├── schemas/               # Shared TypeScript schemas
│   ├── utils/                 # Shared utilities
│   └── agents/                # AI agent implementations
│
└── infra/                      # Infrastructure configs
```

## 🚀 How the System Works

### 1. Contract Upload Flow

```
User uploads PDF → Web App (port 3005)
                ↓
    Next.js API Route (/api/contracts/upload)
                ↓
    Stores in MinIO → Creates DB record
                ↓
    Triggers processing job
                ↓
    Backend API (port 3001) processes
                ↓
    Generates artifacts (overview, analysis, risks, etc.)
```

### 2. Artifact Generation

The system generates multiple artifacts for each contract:

- **Overview**: Summary, parties, key terms
- **Financial**: Payment terms, rates, benchmarks
- **Risk Assessment**: Risk factors, compliance issues
- **Clauses**: Extracted and analyzed clauses
- **Compliance**: Regulatory compliance check
- **Benchmarks**: Market rate comparisons

### 3. Data Flow

**Frontend (Next.js)**:

- Makes API calls to both `/api/*` (Next.js API routes) and `http://localhost:3001/api/*` (Fastify API)
- Next.js routes handle: uploads, real-time status, UI data
- Fastify API handles: heavy processing, LLM analysis, artifact generation

**Backend (Fastify)**:

- Receives requests at `http://localhost:3001`
- Processes contracts using AI/LLM services
- Stores artifacts in PostgreSQL
- Uses Redis for caching and job queues
- Stores files in MinIO

**Database Layer**:

- PostgreSQL stores: contracts, artifacts, embeddings, clauses
- pgvector enables semantic search
- Prisma ORM provides type-safe database access

## 🔌 Service Ports

| Service       | Port | Purpose              |
| ------------- | ---- | -------------------- |
| Next.js Web   | 3005 | Frontend application |
| Fastify API   | 3001 | Backend API server   |
| PostgreSQL    | 5432 | Primary database     |
| Redis         | 6379 | Cache & job queue    |
| MinIO API     | 9000 | Object storage       |
| MinIO Console | 9001 | Storage admin UI     |

## 🎯 Current State

### ✅ Running Services

- PostgreSQL with pgvector ✓
- Redis ✓
- MinIO ✓
- Fastify API on port 3001 ✓
- Next.js Web on port 3005 ✓

### ⚠️ Configuration Needed

- `OPENAI_API_KEY` in `.env` and `apps/api/.env` (currently set to placeholder)
- Redis connection may need configuration for distributed workers

### 🔍 How to Verify It's Working

1. **Check Web App**: Visit `http://localhost:3005`
2. **Check API Health**: `curl http://localhost:3001/health`
3. **Upload a Contract**: Use the web UI to upload a PDF
4. **Check Artifacts**: After processing, artifacts should appear in contract details

## 📝 Environment Variables

### Root `.env`

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contract_intelligence?schema=public"
OPENAI_API_KEY="your_openai_api_key_here"
REDIS_URL="redis://localhost:6379"
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
NODE_ENV="development"
PORT="3002"
```

### `apps/api/.env`

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contract_intelligence?schema=public"
OPENAI_API_KEY="your_openai_api_key_here"
REDIS_URL="redis://localhost:6379"
PORT="3001"
ANALYSIS_USE_LLM="true"
```

## 🐛 Troubleshooting

### "Error Loading Contract" / No Artifacts

**Cause**: The API server isn't running or the contract hasn't been processed yet

**Solutions**:

1. Ensure API server is running: `ps aux | grep "node dist/server.js"`
2. Check API logs for processing errors
3. Verify database contains the contract: Check PostgreSQL
4. Re-trigger artifact generation if needed

### Prisma Client Errors

**Cause**: Prisma client not generated or wrong binary target

**Solution**:

```bash
cd packages/clients/db
npx prisma generate
```

### Database Connection Errors

**Cause**: PostgreSQL not running

**Solution**:

```bash
docker ps | grep postgres
# If not running:
docker start codespaces-postgres
```

## 🚦 Starting Everything

```bash
# 1. Start services
docker start codespaces-postgres codespaces-redis codespaces-minio

# 2. Start API server (in background or separate terminal)
cd apps/api && node dist/server.js

# 3. Start web app
cd apps/web && pnpm dev
```

## 📊 Next Steps

1. **Add Real OpenAI Key**: Replace placeholder in `.env` files
2. **Test Contract Upload**: Upload a PDF and verify artifacts are generated
3. **Enable LLM Analysis**: With real API key, LLM-powered analysis will activate
4. **Configure Workers**: Set up background workers for async processing
5. **Enable RAG**: Configure vector search for intelligent contract queries

## 🔗 Key Integration Points

**Where Artifacts Are Generated**:

- `packages/clients/db/src/services/artifact-population.service.ts` - Mock data generation
- `apps/api/src/index.ts` - LLM-powered analysis (when OPENAI_API_KEY is set)
- `apps/workers/shared/llm-utils.ts` - Shared LLM utilities

**Where Artifacts Are Displayed**:

- `apps/web/app/contracts/[id]/page.tsx` - Contract detail page
- `apps/web/lib/mock-database.ts` - Fallback mock data (when DB fails)

**API Endpoints**:

- `POST /api/contracts` - Create contract
- `GET /api/contracts/:id` - Get contract details
- `GET /api/contracts/:id/artifacts/:type` - Get specific artifact
- `POST /api/contracts/upload` - Upload contract file
