# ConTigo — Technical Documentation

**Comprehensive Developer Reference**
**Version 2.0 — February 2026**

---

## Table of Contents

1. [Overview & Purpose](#1-overview--purpose)
2. [Tech Stack & Versions](#2-tech-stack--versions)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Environment Setup](#4-environment-setup)
5. [Database Architecture](#5-database-architecture)
6. [API Reference](#6-api-reference)
7. [Authentication & Authorisation](#7-authentication--authorisation)
8. [AI & Machine Learning Pipeline](#8-ai--machine-learning-pipeline)
9. [Background Processing (Workers)](#9-background-processing-workers)
10. [Real-Time Features (WebSocket)](#10-real-time-features-websocket)
11. [File Processing & Storage](#11-file-processing--storage)
12. [Observability & Monitoring](#12-observability--monitoring)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & CI/CD](#14-deployment--cicd)
15. [Security Architecture](#15-security-architecture)
16. [Contributing Guide](#16-contributing-guide)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Overview & Purpose

ConTigo is an **AI-powered Contract Lifecycle Management (CLM)** platform. It automates contract ingestion, AI-driven clause extraction, risk analysis, obligation tracking, rate card benchmarking, and collaborative drafting.

### Key Capabilities

| Module | Description |
|---|---|
| **Contract Intelligence** | Upload → OCR → AI extraction → structured metadata |
| **Rate Card Analysis** | Ingestion, normalisation, benchmarking, outlier detection |
| **AI Agents** | Multi-agent orchestration for contract analysis, Q&A, drafting |
| **Obligation Tracking** | Automated deadline monitoring, renewal alerts, calendar sync |
| **Collaborative Drafting** | Template-based generation, redline, approval workflows |
| **Analytics & Reporting** | Dashboards, forecasting, scheduled reports, custom metrics |
| **Integrations** | Google Drive, Word Add-in, webhooks, e-signatures, SCIM v2 |

---

## 2. Tech Stack & Versions

### Core Runtime

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | 22 (Alpine) | Server runtime |
| **Language** | TypeScript | 5.7.2 | Type safety |
| **Framework** | Next.js | 15.1.4 | Full-stack (App Router, RSC) |
| **UI Library** | React | 19.0.0 | UI rendering (Server Components) |
| **Build** | Turborepo | 2.7.2 | Monorepo build orchestration |
| **Package Manager** | pnpm | 8.9.0 | Workspace management |

### Data Layer

| Technology | Version | Purpose |
|---|---|---|
| **PostgreSQL** | 16 | Primary database |
| **pgvector** | 0.5+ | Vector similarity search (RAG) |
| **Prisma** | 5.22 | ORM, migrations, schema management |
| **Redis** | 7 (Alpine) | Caching, rate limiting, sessions, queues |
| **BullMQ** | 4.18 | Job queues (contract processing, AI, sync) |
| **MinIO** | Latest | S3-compatible object storage |

### AI & ML

| Technology | Version | Purpose |
|---|---|---|
| **Azure OpenAI** | SDK 4.10 | GPT-4o — primary extraction & analysis |
| **Anthropic Claude** | SDK 0.71 | Alternative model for document analysis |
| **Mistral AI** | SDK 1.7.5 | EU-hosted fallback for data residency |
| **tiktoken** | Latest | Token counting & context management |
| **pgvector** | Via Prisma | Embedding storage (1536-dim) |

### Frontend

| Technology | Purpose |
|---|---|
| **Tailwind CSS 3.4** | Utility-first styling |
| **Radix UI** (14+ primitives) | Accessible component primitives |
| **Zustand** | Client state management |
| **React Query / TanStack** | Server state, caching, mutations |
| **Framer Motion** | Animations |
| **Recharts** | Data visualisation & charts |
| **Sonner** | Toast notifications |
| **Lucide Icons** | Icon set |

### Infrastructure & Observability

| Technology | Purpose |
|---|---|
| **Docker** | Containerisation |
| **PM2** | Process management (cluster mode) |
| **Sentry 8.45** | Error tracking, performance monitoring |
| **OpenTelemetry 1.28** | Distributed tracing |
| **prom-client** | Prometheus metrics (custom + auto) |
| **Pino** | Structured JSON logging |
| **web-vitals** | Frontend performance |

### Testing

| Technology | Purpose |
|---|---|
| **Playwright 1.49** | E2E browser testing |
| **Vitest 2.1** | Unit & integration tests |
| **Testing Library** | Component testing |

---

## 3. Monorepo Structure

```
CLI-AI-RAW/
├── apps/
│   └── web/                          # Next.js 15 application
│       ├── app/                      # App Router (80+ route groups)
│       │   ├── (dashboard)/          # Dashboard layout group
│       │   ├── (marketing)/          # Marketing/public pages
│       │   ├── api/                  # API routes (83+ groups)
│       │   ├── contracts/            # Contract management pages
│       │   ├── rate-cards/           # Rate card pages
│       │   ├── analytics/            # Analytics & reporting
│       │   ├── settings/             # User/tenant settings
│       │   └── ...                   # 70+ more route groups
│       ├── components/               # UI components (200+)
│       ├── lib/                      # Client utilities
│       ├── hooks/                    # Custom React hooks
│       └── styles/                   # Global styles
├── packages/
│   ├── agents/                       # AI agent system (multi-agent orchestration)
│   ├── clients/
│   │   ├── db/                       # Prisma schema, migrations, seed
│   │   ├── openai/                   # OpenAI/Azure OpenAI client
│   │   ├── queue/                    # BullMQ queue client
│   │   ├── rag/                      # RAG pipeline (embedding + retrieval)
│   │   └── storage/                  # MinIO/S3/Azure Blob storage client
│   ├── data-orchestration/           # ETL pipelines, data processing API
│   ├── schemas/                      # Zod validation schemas (shared)
│   ├── utils/                        # Shared utilities
│   └── workers/                      # BullMQ background processors
├── scripts/                          # Admin/utility scripts
├── src/                              # Legacy/shared server code
├── tests/
│   └── load/                         # Load testing (k6/Artillery)
├── infra/                            # Infrastructure configs
│   ├── nginx/                        # Nginx reverse proxy
│   └── prometheus/                   # Prometheus + alerting
├── helm/                             # Helm charts (Kubernetes)
├── k8s/                              # Kubernetes manifests
├── infrastructure/
│   └── azure/                        # Azure-specific IaC
├── docker-compose.*.yml              # Docker Compose variants
├── Dockerfile*                       # Multi-stage Dockerfiles
├── turbo.json                        # Turborepo configuration
├── pnpm-workspace.yaml               # pnpm workspace definition
└── tsconfig.base.json                # Shared TypeScript config
```

### Workspace Aliases

| Alias | Path | Description |
|---|---|---|
| `@/*` | `apps/web/*` | Next.js app imports |
| `utils` | `packages/utils/src` | Shared utilities |
| `schemas` | `packages/schemas/src` | Zod schemas |
| `clients-db` | `packages/clients/db/src` | Prisma client |
| `clients-openai` | `packages/clients/openai/src` | AI client |
| `clients-queue` | `packages/clients/queue/src` | Queue client |
| `clients-rag` | `packages/clients/rag/src` | RAG pipeline |
| `clients-storage` | `packages/clients/storage/src` | Storage client |
| `agents` | `packages/agents/src` | AI agents |
| `data-orchestration` | `packages/data-orchestration/src` | ETL APIs |

---

## 4. Environment Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥22.x | `nvm install 22` |
| pnpm | 8.9.0 | `npm install -g pnpm@8.9.0` |
| Docker & Compose | Latest | [docker.com](https://docker.com) |
| Git | Latest | Pre-installed |

### Quick Start

```bash
# 1. Clone the repository
git clone git@github.com:rawberto94/CLI-AI-RAW.git
cd CLI-AI-RAW

# 2. Start infrastructure services
docker compose -f docker-compose.dev.yml up -d

# 3. Install dependencies
pnpm install

# 4. Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 5. Set up database
pnpm db:generate
pnpm db:push
pnpm db:seed

# 6. Start development
pnpm dev           # Web + Workers (default)
pnpm dev:lite      # Web only (faster)
pnpm dev:all       # All services
```

### Docker Services (Development)

| Service | Image | Port(s) | Resources |
|---|---|---|---|
| **PostgreSQL** | `pgvector/pgvector:pg16` | 5432 | 1–2 GB RAM, 256 MB shared_buffers |
| **Redis** | `redis:7-alpine` | 6379 | 256 MB–1 GB, AOF persistence |
| **MinIO** | `minio/minio:latest` | 9000 (API), 9001 (Console) | 512 MB–1 GB |

### Key Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `NEXTAUTH_SECRET` | Yes | NextAuth session encryption key |
| `NEXTAUTH_URL` | Yes | App URL (e.g., `http://localhost:3000`) |
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |
| `MINIO_ENDPOINT` | Yes | MinIO/S3 endpoint |
| `MINIO_ACCESS_KEY` | Yes | MinIO/S3 access key |
| `MINIO_SECRET_KEY` | Yes | MinIO/S3 secret key |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `MISTRAL_API_KEY` | No | Mistral AI fallback key |

### Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start web + workers (parallel) |
| `pnpm dev:lite` | Start web only |
| `pnpm dev:all` | Start all services (via start-all.sh) |
| `pnpm build` | Production build (Next.js standalone) |
| `pnpm workers` | Start workers (dev mode) |
| `pnpm workers:build` | Build workers for production |
| `pnpm workers:start` | Start pre-built workers |
| `pnpm websocket` | Start WebSocket server |
| `pnpm api` | Start data orchestration API |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema changes (dev) |
| `pnpm db:seed` | Seed database with test data |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | ESLint (Next.js rules) |
| `pnpm test` | Run full test suite |
| `pnpm test:e2e` | Run Playwright E2E tests |

---

## 5. Database Architecture

### Overview

- **Engine:** PostgreSQL 16 with pgvector extension
- **ORM:** Prisma 5.22
- **Schema:** 130+ models, 46 enums (5,300+ lines)
- **Multi-tenancy:** Row-level isolation via `tenantId` on all domain models
- **Vector storage:** 1536-dimensional embeddings for RAG (pgvector)

### Core Domain Models

```
┌─────────────────────────────────────────────────────────┐
│                    TENANT LAYER                          │
│  Tenant → TenantConfig → TenantSubscription → Usage     │
│         → TenantSettings → SecuritySettings → IpAllowlist│
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────┐
│                    USER LAYER                            │
│  User (MFA) → Role → Permission                         │
│            → UserSession → UserPreferences               │
│            → Department → UserGroup                      │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────┐
│                 CONTRACT LAYER                           │
│  Contract → ContractMetadata → ContractVersion           │
│          → ContractArtifact → ContractEmbedding          │
│          → Clause → Party → ContractAnalysis             │
│          → ContractHealthScore → ContractExpiration       │
│          → ContractActivity → ContractComment            │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────┐
│              INTELLIGENCE LAYER                           │
│  RateCard → RoleRate → RateCardEntry → SupplierScore     │
│  BenchmarkSnapshot → MarketRateIntelligence              │
│  Obligation → ObligationNotification                     │
│  ChatConversation → ChatMessage → AgentEvent             │
│  Workflow → WorkflowStep → WorkflowExecution             │
└─────────────────────────────────────────────────────────┘
```

### Key Enums

| Enum | Values | Used By |
|---|---|---|
| `ContractStatus` | DRAFT, ACTIVE, EXPIRED, TERMINATED, RENEWED, PENDING_REVIEW, ARCHIVED | Contract |
| `JobStatus` | PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED | ProcessingJob |
| `SubscriptionPlan` | FREE, STARTER, PROFESSIONAL, ENTERPRISE | TenantSubscription |
| `ObligationStatus` | PENDING, IN_PROGRESS, COMPLETED, OVERDUE, WAIVED | Obligation |
| `RateCardStatus` | DRAFT, ACTIVE, EXPIRED, ARCHIVED | RateCard |

### Database Management

```bash
# Development workflow
pnpm db:push          # Apply schema changes without migration
pnpm db:studio        # Open visual DB browser at localhost:5555

# Production workflow
pnpm db:generate      # Generate Prisma Client
pnpm db:migrate       # Run migration files (prisma migrate deploy)
```

### Performance Optimisations

| Optimisation | Implementation |
|---|---|
| **Connection pooling** | PgBouncer (docker-compose.pgbouncer.yml) |
| **Read replicas** | Prisma `$extends` read replica support |
| **Indexing** | Composite indexes on `(tenantId, status)`, `(tenantId, createdAt)` |
| **Vector indexes** | IVFFlat index on embedding columns |
| **Query optimisation** | Selective field loading, cursor pagination |

---

## 6. API Reference

### Route Structure

All API routes are served under `/api/` via Next.js App Router API routes.

### Authentication Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signin` | Sign in (NextAuth) |
| POST | `/api/auth/signout` | Sign out |
| GET | `/api/auth/session` | Get current session |
| GET | `/api/csrf` | Get CSRF token |
| GET | `/api/user` | Get current user profile |
| GET | `/api/users` | List users (admin) |

### Contract Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/contracts` | List contracts (paginated, filtered) |
| POST | `/api/contracts` | Create contract (metadata) |
| GET | `/api/contracts/[id]` | Get contract detail |
| PATCH | `/api/contracts/[id]` | Update contract |
| DELETE | `/api/contracts/[id]` | Delete contract |
| POST | `/api/upload` | Upload contract file (chunked) |
| GET | `/api/contracts/[id]/versions` | List contract versions |
| GET | `/api/contracts/[id]/artifacts` | List contract artifacts |
| GET | `/api/clauses` | List extracted clauses |
| POST | `/api/extraction/[id]` | Trigger AI extraction |

### AI & Chat Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/chat` | Send chat message (streaming) |
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/ai/analyze` | Analyse contract with AI |
| POST | `/api/copilot` | AI copilot suggestions |
| POST | `/api/agents/[type]` | Trigger AI agent |
| GET | `/api/intelligence` | Get AI insights |
| POST | `/api/rag/query` | RAG vector search |

### Rate Card Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/rate-cards` | List rate cards |
| POST | `/api/rate-cards` | Create rate card |
| POST | `/api/rate-cards-ingestion` | Upload & process rate card |
| GET | `/api/benchmarking` | Get benchmarking data |
| GET | `/api/baselines` | Get rate baselines |
| GET | `/api/forecast` | Rate forecasting |

### Workflow & Job Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |
| POST | `/api/workflows/[id]/execute` | Execute workflow |
| GET | `/api/jobs` | List processing jobs |
| GET | `/api/runs` | List processing runs |
| GET | `/api/processing-status/[id]` | Real-time processing status |
| POST | `/api/approvals/[id]` | Approve/reject workflow step |

### Health Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Application health check |
| GET | `/api/healthz` | Kubernetes liveness probe |
| GET | `/api/ready` | Kubernetes readiness probe |

### Common Query Parameters

| Parameter | Type | Description | Example |
|---|---|---|---|
| `page` | number | Page number (1-based) | `?page=2` |
| `limit` | number | Items per page (default: 20, max: 100) | `?limit=50` |
| `sort` | string | Sort field | `?sort=createdAt` |
| `order` | string | Sort direction | `?order=desc` |
| `search` | string | Full-text search | `?search=NDA` |
| `status` | string | Filter by status | `?status=ACTIVE` |
| `tenantId` | string | Tenant scope (auto from session) | — |

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Contract title is required",
    "details": [...]
  }
}
```

---

## 7. Authentication & Authorisation

### Auth Stack

| Component | Technology | Description |
|---|---|---|
| **Session** | NextAuth v5 (beta.30) | JWT-based sessions (Redis-backed) |
| **Password** | bcryptjs | Password hashing (12 rounds) |
| **MFA** | TOTP | Time-based OTP (Google Authenticator compatible) |
| **CSRF** | Token-based | Server-side CSRF token validation |
| **API Auth** | Bearer Token | Service-to-service authentication |

### RBAC Model

```
User ──┬── UserRole ──── Role ──── RolePermission ──── Permission
       └── UserGroup ─── Group ── GroupPermission
```

### Permissions

Permissions follow `resource:action` format:

| Resource | Actions |
|---|---|
| `contracts` | `create`, `read`, `update`, `delete`, `export`, `share` |
| `rate_cards` | `create`, `read`, `update`, `delete`, `import` |
| `workflows` | `create`, `read`, `execute`, `approve` |
| `admin` | `manage_users`, `manage_roles`, `manage_tenant` |
| `analytics` | `read`, `export`, `create_reports` |

### Multi-Tenancy

- All API routes enforce tenant isolation via middleware
- `tenantId` auto-injected from session
- Cross-tenant access is impossible at the ORM level
- Admin super-tenant can access all tenants (platform operations only)

---

## 8. AI & Machine Learning Pipeline

### Architecture

```
Contract Upload
      │
      ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  OCR/Parse  │────▶│  Chunking &  │────▶│  Embedding  │
│  (PDF/DOCX) │     │  Preprocessing│     │ Generation  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                                                 ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Agent     │◀───│  RAG Vector  │◀───│  pgvector    │
│  Selection  │     │   Retrieval  │     │   Storage   │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│              AI Agent Orchestration            │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Analysis │ │ Drafting │ │  Q&A / Chat  │ │
│  │  Agent   │ │  Agent   │ │    Agent     │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Rate Card│ │ Risk     │ │  Obligation  │ │
│  │  Agent   │ │  Agent   │ │    Agent     │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└──────────────────────────────────────────────┘
```

### AI Models

| Model | Provider | Use Case | Data Residency |
|---|---|---|---|
| GPT-4o | Azure OpenAI (Switzerland North) | Primary extraction, analysis | 🇨🇭 Switzerland |
| GPT-4o-mini | Azure OpenAI (Switzerland North) | Fast parsing, classification | 🇨🇭 Switzerland |
| Mistral Large | Mistral AI (EU) | EU fallback, rate card analysis | 🇪🇺 EU |
| Claude 3.5 | Anthropic (US) | Document analysis (optional) | 🇺🇸 US (opt-in) |

### RAG Pipeline

1. **Ingestion:** Documents → chunked (512 tokens, 50-token overlap) → embedded (text-embedding-3-small, 1536 dimensions) → stored in pgvector
2. **Retrieval:** User query → embedded → cosine similarity search (top-k=5) → context assembled
3. **Generation:** Context + query + system prompt → LLM → streamed response
4. **Feedback loop:** User corrections → stored as `ExtractionCorrection` → used to improve future extractions

### Cost Management

| Feature | Implementation |
|---|---|
| **Token counting** | tiktoken pre-calculation before API calls |
| **Usage logging** | `AIUsageLog` table tracks tokens, cost, model per request |
| **Cost thresholds** | `CostThreshold` per tenant with alerts |
| **Model routing** | Cheap model for classification → expensive model for extraction |
| **Caching** | Redis caching of repeated queries (TTL: 1 hour) |

---

## 9. Background Processing (Workers)

### Worker Architecture

Workers run as separate Node.js processes via **BullMQ** (Redis-backed queues).

### PM2 Process Configuration

| Process | Mode | Instances | Memory | Notes |
|---|---|---|---|---|
| `contigo-web` | Cluster | max CPUs | 1 GB | Production web server |
| `contigo-workers` | Cluster | 2 | 2 GB | Background job processors |
| `contigo-websocket` | Fork | 1 | 512 MB | Single-instance WebSocket |
| `contigo-contract-sync` | Fork | 1 | 1 GB | Long-running sync operations |

### Queue Types

| Queue | Priority | Concurrency | Description |
|---|---|---|---|
| `contract-processing` | High | 3 | OCR, parsing, extraction |
| `ai-analysis` | High | 2 | AI model calls (rate-limited) |
| `rate-card-ingestion` | Medium | 2 | Rate card parsing & normalisation |
| `embedding-generation` | Medium | 5 | Vector embedding generation |
| `sync-operations` | Low | 1 | External system sync |
| `notifications` | Low | 5 | Email, push, in-app notifications |
| `reporting` | Low | 1 | Scheduled report generation |
| `maintenance` | Low | 1 | Cleanup, archival, metrics |

### Job Lifecycle

```
PENDING → PROCESSING → COMPLETED / FAILED
                ↑              │
                └── RETRY ─────┘ (max 3 retries, exponential backoff)
```

---

## 10. Real-Time Features (WebSocket)

### Socket.IO Server

| Setting | Value |
|---|---|
| **Port** | 3001 |
| **Transport** | WebSocket (polling fallback) |
| **Authentication** | JWT token verification |
| **Namespace** | `/` (default) |

### Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `processing:status` | Server → Client | `{ jobId, status, progress }` | Job progress updates |
| `contract:updated` | Server → Client | `{ contractId, changes }` | Real-time contract changes |
| `notification:new` | Server → Client | `{ notification }` | Push notification |
| `chat:message` | Bidirectional | `{ conversationId, message }` | AI chat streaming |
| `collaboration:cursor` | Bidirectional | `{ userId, position }` | Real-time cursor sharing |

---

## 11. File Processing & Storage

### Upload Flow

```
Client (chunked upload, 5MB chunks)
    │
    ▼
Next.js API Route (/api/upload)
    │
    ▼
MinIO/S3 Storage (multipart upload)
    │
    ▼
BullMQ Job (contract-processing queue)
    │
    ├── PDF: pdf-parse + pdfjs-dist
    ├── DOCX: Mammoth
    ├── Image: Sharp + AWS Textract (OCR)
    └── XLSX: xlsx library
    │
    ▼
Structured data → Prisma → PostgreSQL
    │
    ▼
Embedding generation → pgvector
```

### Storage Configuration

| Provider | Use Case | Configuration |
|---|---|---|
| **MinIO** (default) | Development, self-hosted | `MINIO_ENDPOINT`, port 9000 |
| **Azure Blob Storage** | Production (Switzerland North) | `AZURE_STORAGE_CONNECTION_STRING` |
| **AWS S3** | Alternative cloud | `AWS_S3_BUCKET`, `AWS_REGION` |

### File Size Limits

| Tier | Max File Size | Max Files/Month | Max Storage |
|---|---|---|---|
| Starter | 25 MB | 500 | 10 GB |
| Professional | 100 MB | 5,000 | 100 GB |
| Enterprise | 500 MB | Unlimited | Custom |

---

## 12. Observability & Monitoring

### Logging (Pino)

```json
{
  "level": "info",
  "time": 1707350400000,
  "msg": "Contract processed",
  "contractId": "uuid",
  "tenantId": "uuid",
  "duration_ms": 2341,
  "service": "contract-processing"
}
```

- **Format:** Structured JSON
- **Levels:** trace, debug, info, warn, error, fatal
- **Correlation:** Request ID propagated across services

### Metrics (Prometheus)

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Total HTTP requests by route, method, status |
| `http_request_duration_seconds` | Histogram | Request latency |
| `contracts_processed_total` | Counter | Contracts processed by type, status |
| `ai_tokens_used_total` | Counter | AI tokens consumed by model |
| `queue_jobs_active` | Gauge | Active jobs per queue |
| `queue_jobs_waiting` | Gauge | Waiting jobs per queue |
| `db_connections_active` | Gauge | Active database connections |

### Tracing (OpenTelemetry)

- **Exporter:** OTLP (configurable: Jaeger, Zipkin, Azure Monitor)
- **Auto-instrumentation:** HTTP, fetch, Prisma, Redis
- **Custom spans:** AI calls, file processing, queue operations
- **Sampling:** 10% in production, 100% in development

### Error Tracking (Sentry)

- **Frontend:** React error boundaries, unhandled rejections
- **Backend:** Express error handler, unhandled exceptions
- **Performance:** Transaction sampling (10%)
- **Releases:** Git commit SHA tagging

### Health Checks

| Endpoint | Checks | Used By |
|---|---|---|
| `/api/health` | App alive + basic response | Load balancer |
| `/api/healthz` | All services (DB, Redis, MinIO) | Kubernetes liveness |
| `/api/ready` | Migrations applied, queues running | Kubernetes readiness |

---

## 13. Testing Strategy

### Test Pyramid

| Layer | Tool | Location | Coverage Target |
|---|---|---|---|
| **Unit** | Vitest | `**/*.test.ts` | 80%+ |
| **Integration** | Vitest + Prisma | `**/*.integration.test.ts` | 60%+ |
| **E2E** | Playwright | `tests/e2e/` | Critical paths |
| **Load** | k6 / Artillery | `tests/load/` | Key APIs |

### Running Tests

```bash
# Unit tests
pnpm test:unit

# E2E tests (requires Docker services running)
pnpm test:e2e

# Full test suite
pnpm test

# Tests with coverage
pnpm test:unit -- --coverage
```

### E2E Test Scenarios

| Scenario | Coverage |
|---|---|
| **Authentication** | Login, MFA, session management |
| **Contract Upload** | Upload → OCR → extraction → metadata |
| **AI Chat** | Conversation, streaming, context |
| **Rate Cards** | Upload → normalisation → benchmarking |
| **Workflows** | Create → execute → approve/reject |
| **Multi-tenant** | Isolation, switching, permissions |

---

## 14. Deployment & CI/CD

### Docker Build (Multi-Stage)

```dockerfile
# Stage 1: deps — Install all workspace packages
# Stage 2: builder — Prisma generate + Next.js build (8GB heap)
# Stage 3: runner — Standalone server, non-root user, port 3000
```

### Dockerfiles

| File | Purpose |
|---|---|
| `Dockerfile` | Main app (Next.js standalone) |
| `Dockerfile.production` | Production-optimised build |
| `Dockerfile.staging` | Staging with debug tools |
| `Dockerfile.websocket` | WebSocket server |
| `Dockerfile.workers` | Background workers |

### Docker Compose Variants

| File | Use Case |
|---|---|
| `docker-compose.dev.yml` | Local development |
| `docker-compose.prod.yml` | Production deployment |
| `docker-compose.staging.yml` | Staging environment |
| `docker-compose.full.yml` | All services (app + infra) |
| `docker-compose.pgbouncer.yml` | With PgBouncer connection pooling |
| `docker-compose.rag.yml` | Full RAG pipeline services |

### Deployment Targets

| Target | Technology | Details |
|---|---|---|
| **Primary** | Azure Container Apps | Switzerland North region |
| **Alternative** | Azure AKS | For scale >1000 users |
| **Database** | Azure Database for PostgreSQL (Flexible) | Geo-redundant backups |
| **Storage** | Azure Blob Storage | Switzerland North |
| **CDN** | Azure Front Door | Global edge caching |

---

## 15. Security Architecture

### Security Layers

| Layer | Implementation |
|---|---|
| **Transport** | HTTPS/TLS 1.3 (enforced) |
| **Authentication** | NextAuth v5 + TOTP MFA |
| **Authorisation** | RBAC with row-level tenant isolation |
| **Input validation** | Zod schemas on all API inputs |
| **CSRF** | Double-submit cookie pattern |
| **Rate limiting** | Redis-backed sliding window (configurable per endpoint) |
| **IP allowlisting** | Tenant-level IP restrictions |
| **CSP** | Content Security Policy headers |
| **Secrets** | Azure Key Vault / environment variables |
| **Data at rest** | AES-256 encryption (Azure Storage) |
| **Data in transit** | TLS 1.3 |
| **Audit logging** | All mutations logged to `AuditLog` table |

### Compliance

| Standard | Status |
|---|---|
| **nDSG / FADP** | Compliant — Swiss data protection (September 2023) |
| **GDPR** | Compliant — EU data subjects |
| **SOC 2 Type II** | Planned (post-Series A) |
| **ISO 27001** | Planned (post-Series A) |

### Data Residency

All customer data stored in **Azure Switzerland North** (Zurich). AI processing via Azure OpenAI in Switzerland North. No data leaves Swiss/EU jurisdiction.

---

## 16. Contributing Guide

### Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code |
| `develop` | Integration branch |
| `feature/*` | Feature development |
| `fix/*` | Bug fixes |
| `hotfix/*` | Production hot fixes |

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(contracts): add bulk export functionality
fix(auth): resolve MFA timeout issue
docs(api): update rate card API documentation
chore(deps): upgrade Prisma to 5.22.0
```

### Code Standards

| Standard | Tool |
|---|---|
| **Formatting** | Prettier (via `prettier.config.js`) |
| **Linting** | ESLint (Next.js configuration) |
| **Type checking** | TypeScript strict mode |
| **Imports** | Absolute imports via workspace aliases |
| **Components** | Functional components, TSX, Radix UI primitives |
| **API routes** | Next.js App Router, Zod validation, consistent error handling |

### Pull Request Checklist

- [ ] TypeScript builds without errors (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Unit tests pass (`pnpm test:unit`)
- [ ] New features have tests
- [ ] Breaking changes documented
- [ ] Database migrations included (if schema changed)

---

## 17. Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|---|---|---|
| `PrismaClientInitializationError` | Missing binary targets | `pnpm db:generate` + rebuild |
| `ECONNREFUSED 5432` | PostgreSQL not running | `docker compose -f docker-compose.dev.yml up -d postgres` |
| `ECONNREFUSED 6379` | Redis not running | `docker compose -f docker-compose.dev.yml up -d redis` |
| `Module not found: '@/*'` | Workspace aliases broken | `pnpm install` in root |
| `Next.js build OOM` | Insufficient memory | Set `NODE_OPTIONS="--max-old-space-size=8192"` |
| `Rate limit exceeded` | Too many AI calls | Check `AIUsageLog`, increase tenant threshold |
| `WebSocket disconnect` | Token expired | Re-authenticate, check JWT TTL |
| `File upload timeout` | File too large | Enable chunked upload, check `MAX_FILE_SIZE` |

### Useful Debug Commands

```bash
# Check service health
curl http://localhost:3000/api/health

# Check database connectivity
pnpm db:studio

# View worker queue status
redis-cli -u $REDIS_URL KEYS "bull:*"

# Check Docker logs
docker compose -f docker-compose.dev.yml logs -f postgres
docker compose -f docker-compose.dev.yml logs -f redis

# Reset database (DESTRUCTIVE)
pnpm db:push --force-reset
pnpm db:seed
```

---

*ConTigo GmbH — Zurich, Switzerland*
*Last updated: February 2026*
