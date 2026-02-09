# ConTigo — System Architecture

**Comprehensive Architecture Reference**
**Version 2.0 — February 2026**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Application Layers](#3-application-layers)
4. [Data Architecture](#4-data-architecture)
5. [AI & Intelligence Architecture](#5-ai--intelligence-architecture)
6. [Multi-Tenancy Architecture](#6-multi-tenancy-architecture)
7. [Infrastructure & Deployment](#7-infrastructure--deployment)
8. [Security Architecture](#8-security-architecture)
9. [Scalability Design](#9-scalability-design)
10. [Integration Architecture](#10-integration-architecture)
11. [Observability & Reliability](#11-observability--reliability)
12. [Architecture Decision Records](#12-architecture-decision-records)
13. [Future Architecture Considerations](#13-future-architecture-considerations)

---

## 1. Architecture Overview

ConTigo is a **multi-tenant, AI-powered Contract Lifecycle Management (CLM) platform** built on a modern full-stack TypeScript monorepo. The architecture prioritises:

| Principle | Approach |
|---|---|
| **Data sovereignty** | All data in Swiss data centres (Azure Switzerland North) |
| **AI-first** | Every contract operation enhanced by AI extraction & analysis |
| **Type safety** | End-to-end TypeScript with Zod runtime validation |
| **Scalability** | Horizontal scaling via PM2 clusters + Azure Container Apps |
| **Modularity** | pnpm workspaces with clear package boundaries |
| **Resilience** | Queue-based async processing, circuit breakers, health checks |

### Architecture Classification

| Dimension | Choice |
|---|---|
| **Style** | Modular monolith (package-based boundaries) |
| **Rendering** | Hybrid — React Server Components + Client Components |
| **API** | REST (Next.js App Router API routes) |
| **Processing** | Event-driven (BullMQ job queues) |
| **Storage** | Polyglot — PostgreSQL + Redis + S3-compatible |
| **AI** | Multi-model with pluggable providers |

---

## 2. High-Level Architecture

```
                         ┌──────────────┐
                         │   Clients    │
                         │  (Browser)   │
                         └──────┬───────┘
                                │ HTTPS/TLS 1.3
                                ▼
                    ┌───────────────────────┐
                    │   Azure Front Door    │
                    │   (CDN / WAF / SSL)   │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │        Nginx          │
                    │   (Reverse Proxy)     │
                    └─────┬─────────┬───────┘
                          │         │
              ┌───────────┴──┐  ┌───┴───────────┐
              │  Next.js App │  │  WebSocket     │
              │  (Port 3000) │  │  (Port 3001)   │
              │              │  │  Socket.IO     │
              │  • SSR/RSC   │  │                │
              │  • API Routes│  │  • Real-time   │
              │  • Static    │  │  • Processing  │
              └──────┬───────┘  └────────────────┘
                     │
        ┌────────────┼────────────────┐
        │            │                │
   ┌────┴────┐  ┌────┴────┐    ┌─────┴──────┐
   │PostgreSQL│  │  Redis  │    │   MinIO/    │
   │(pgvector)│  │  7.x    │    │ Azure Blob │
   │          │  │         │    │            │
   │ • Data   │  │ • Cache │    │ • Files    │
   │ • Vectors│  │ • Queues│    │ • Artifacts│
   │ • Search │  │ • Rate  │    │ • Backups  │
   └──────────┘  │   Limit │    └────────────┘
                 └────┬────┘
                      │
              ┌───────┴────────┐
              │   BullMQ       │
              │   Workers      │
              │                │
              │ • Contract     │
              │   Processing   │
              │ • AI Analysis  │
              │ • Sync Jobs    │
              │ • Notifications│
              └────────────────┘
```

---

## 3. Application Layers

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                         │
│  Next.js App Router │ React 19 │ RSC │ Radix UI │ Tailwind  │
├─────────────────────────────────────────────────────────────┤
│                      API LAYER                               │
│  Next.js API Routes │ Zod Validation │ RBAC Middleware       │
├─────────────────────────────────────────────────────────────┤
│                    SERVICE LAYER                              │
│  packages/agents │ packages/data-orchestration │ packages/*  │
├─────────────────────────────────────────────────────────────┤
│                      DATA LAYER                              │
│  Prisma ORM │ Redis (ioredis) │ MinIO (S3 SDK) │ BullMQ    │
├─────────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE LAYER                         │
│  PostgreSQL 16 │ Redis 7 │ MinIO │ Docker │ PM2            │
└─────────────────────────────────────────────────────────────┘
```

### Presentation Layer

| Component | Technology | Rendering |
|---|---|---|
| **Page Shell** | Next.js App Router | Server-side (RSC) |
| **Interactive UI** | React 19 Client Components | Client-side |
| **Design System** | Radix UI + Tailwind | — |
| **State** | Zustand (client), React Query (server) | — |
| **Charts** | Recharts | Client-side |
| **Animations** | Framer Motion | Client-side |
| **Notifications** | Sonner (toasts) | Client-side |

### API Layer

```
Request → CSRF Check → Auth Middleware → Rate Limiter
         → Tenant Resolver → Zod Validation → Handler
         → Response (JSON)
```

| Middleware | Purpose | Location |
|---|---|---|
| **CSRF** | Double-submit cookie validation | Global |
| **Auth** | NextAuth session validation | Per-route |
| **Rate limiter** | Redis sliding window | Per-route group |
| **Tenant resolver** | Injects tenantId from session | Global (authenticated) |
| **Zod validation** | Request body/params validation | Per-route |

### Service Layer (Packages)

| Package | Responsibility | Key Exports |
|---|---|---|
| `agents` | Multi-agent AI orchestration | Agent runners, prompt chains |
| `data-orchestration` | ETL pipelines, bulk processing | Processor classes |
| `clients/db` | Prisma schema, client, seeds | `prisma`, models, types |
| `clients/openai` | OpenAI/Azure OpenAI wrapper | `chat()`, `embed()` |
| `clients/queue` | BullMQ queue definitions | Queue instances, job types |
| `clients/rag` | RAG pipeline (embed + retrieve) | `query()`, `ingest()` |
| `clients/storage` | MinIO/S3/Blob wrapper | `upload()`, `download()` |
| `schemas` | Shared Zod validation | Contract, RateCard, User schemas |
| `utils` | Shared helpers | Logger, formatters, constants |
| `workers` | BullMQ job processors | Queue handlers |

### Data Layer

| Store | Purpose | Access Pattern |
|---|---|---|
| **PostgreSQL** | Primary data, vectors | Prisma ORM (connection pool) |
| **Redis** | Cache, queues, sessions, rate limits | ioredis (cluster-ready) |
| **MinIO/S3** | File storage (contracts, artifacts) | AWS S3 SDK |

---

## 4. Data Architecture

### Entity Relationship Overview

```
Tenant (1)
  ├── Users (N)
  │     ├── Roles & Permissions
  │     ├── Sessions
  │     └── Preferences
  ├── Contracts (N)
  │     ├── Metadata
  │     ├── Versions (N)
  │     ├── Artifacts (N) — files in S3
  │     ├── Clauses (N) — AI extracted
  │     ├── Parties (N) — counterparties
  │     ├── Embeddings (N) — pgvector
  │     ├── Analyses (N) — AI results
  │     ├── Comments (N) — collaboration
  │     └── Obligations (N) — deadlines
  ├── Rate Cards (N)
  │     ├── Entries (N) — role/rate pairs
  │     ├── Benchmarks (N)
  │     └── Supplier Scores (N)
  ├── Workflows (N)
  │     ├── Steps (N)
  │     └── Executions (N)
  ├── Chat Conversations (N)
  │     └── Messages (N)
  └── Processing Jobs (N)
        └── Runs (N)
```

### Data Flow

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│  Upload  │───▶│  Queue   │───▶│   Worker     │───▶│ Database │
│  (API)   │    │  (Redis) │    │  Processing  │    │ (Prisma) │
└──────────┘    └──────────┘    └──────────────┘    └──────────┘
     │                               │                    │
     ▼                               ▼                    ▼
┌──────────┐                   ┌──────────────┐    ┌──────────┐
│  MinIO   │                   │  AI Models   │    │ pgvector │
│  Storage │                   │  (Azure)     │    │ Embeddings│
└──────────┘                   └──────────────┘    └──────────┘
```

### Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|---|---|---|---|
| **User session** | Redis | 24 hours | On logout/token refresh |
| **Contract list** | Redis | 5 minutes | On contract mutation |
| **Analytics** | Redis | 15 minutes | On new processing job |
| **AI responses** | Redis | 1 hour | Manual/TTL |
| **Rate limits** | Redis | 1 minute (sliding window) | Automatic |
| **Static assets** | CDN (Azure Front Door) | 1 year | Build hash |

### Backup Strategy

| Data | Frequency | Retention | Location |
|---|---|---|---|
| **PostgreSQL** | Continuous (WAL) | 35 days | Azure geo-redundant |
| **File storage** | Real-time (S3 replication) | Indefinite | Azure ZRS |
| **Redis** | AOF persistence | In-memory rebuild | — |
| **Audit logs** | Immutable append-only | 7 years | Azure Compliance Storage |

---

## 5. AI & Intelligence Architecture

### Multi-Model Strategy

```
                    ┌─────────────────────┐
                    │   Model Router      │
                    │   (Cost/Quality/    │
                    │    Residency)       │
                    └──────┬──┬──┬────────┘
                           │  │  │
              ┌────────────┘  │  └────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────┐  ┌──────────────┐
      │ Azure OpenAI │ │ Mistral  │  │  Anthropic   │
      │ (Switzerland)│ │  (EU)    │  │    (US)      │
      │              │ │          │  │              │
      │ GPT-4o       │ │ Mistral  │  │ Claude 3.5   │
      │ GPT-4o-mini  │ │ Large    │  │ Sonnet       │
      └──────────────┘ └──────────┘  └──────────────┘
       🇨🇭 Primary      🇪🇺 Fallback   🇺🇸 Opt-in
```

### Agent System

```
┌────────────────────────────────────────────────────┐
│                Agent Orchestrator                    │
│  (packages/agents)                                  │
├────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  Contract     │  │  Rate Card  │                │
│  │  Analyser     │  │  Analyser   │                │
│  │              │  │             │                │
│  │ • Extraction │  │ • Normalise │                │
│  │ • Risk score │  │ • Benchmark │                │
│  │ • Clause map │  │ • Outliers  │                │
│  └──────────────┘  └──────────────┘                │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  Q&A / Chat  │  │  Drafting   │                │
│  │  Agent       │  │  Agent      │                │
│  │              │  │             │                │
│  │ • RAG search │  │ • Templates │                │
│  │ • Context    │  │ • Clauses   │                │
│  │ • Streaming  │  │ • Review    │                │
│  └──────────────┘  └──────────────┘                │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  Risk        │  │  Obligation │                │
│  │  Agent       │  │  Agent      │                │
│  │              │  │             │                │
│  │ • Compliance │  │ • Extract   │                │
│  │ • Anomalies  │  │ • Schedule  │                │
│  │ • Scoring    │  │ • Monitor   │                │
│  └──────────────┘  └──────────────┘                │
└────────────────────────────────────────────────────┘
```

### RAG (Retrieval-Augmented Generation)

```
User Query: "What is the liability cap in our Swisscom MSA?"
        │
        ▼
┌───────────────────┐
│ 1. Embed Query    │  text-embedding-3-small → 1536 dims
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 2. Vector Search  │  pgvector: cosine similarity, top-k=5
│    + Tenant Filter│  WHERE tenantId = :tenantId
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 3. Context Build  │  Relevant chunks + metadata
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 4. LLM Generate   │  System prompt + context + query → GPT-4o
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ 5. Stream Reply   │  SSE streaming to client
└───────────────────┘
```

---

## 6. Multi-Tenancy Architecture

### Isolation Model

ConTigo uses **shared database, shared schema** with **row-level isolation**:

```
┌────────────────────────────────────────────────┐
│                 Shared PostgreSQL                │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Tenant A │  │ Tenant B │  │ Tenant C │     │
│  │          │  │          │  │          │     │
│  │ tenantId │  │ tenantId │  │ tenantId │     │
│  │ = AAA    │  │ = BBB    │  │ = CCC    │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                  │
│  Every domain table has tenantId column          │
│  + composite index (tenantId, ...)               │
└────────────────────────────────────────────────┘
```

### Enforcement Layers

| Layer | Mechanism |
|---|---|
| **API middleware** | Auto-injects `tenantId` from session |
| **Prisma middleware** | `$use()` — adds `tenantId` to all queries |
| **Database indexes** | Composite `(tenantId, id)` on all tables |
| **Application logic** | Never accepts `tenantId` from client |
| **AI context** | Embeddings filtered by tenant in vector search |

### Tenant Hierarchy

```
Tenant
  ├── TenantConfig (feature flags, limits)
  ├── TenantSubscription (plan, billing)
  ├── TenantSettings (UI preferences)
  ├── SecuritySettings (MFA, IP allowlist)
  ├── Departments
  │     └── Users
  │           └── Roles → Permissions
  └── UsageLogs (API calls, AI tokens, storage)
```

---

## 7. Infrastructure & Deployment

### Production Topology (Azure)

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Switzerland North                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Azure Container Apps                    │     │
│  │                                                      │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │     │
│  │  │ Web ×2-4 │  │Workers ×2│  │WebSocket │          │     │
│  │  │ (Next.js)│  │ (BullMQ) │  │ ×1       │          │     │
│  │  └──────────┘  └──────────┘  └──────────┘          │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌───────────────┐  ┌───────────┐  ┌──────────────┐         │
│  │ Azure PG      │  │ Azure     │  │ Azure Blob   │         │
│  │ Flexible      │  │ Cache for │  │ Storage      │         │
│  │ Server        │  │ Redis     │  │              │         │
│  │ (pgvector)    │  │           │  │              │         │
│  └───────────────┘  └───────────┘  └──────────────┘         │
│                                                               │
│  ┌───────────────┐  ┌───────────┐  ┌──────────────┐         │
│  │ Azure OpenAI  │  │ Azure     │  │ Azure Key    │         │
│  │ (GPT-4o)      │  │ Monitor   │  │ Vault        │         │
│  └───────────────┘  └───────────┘  └──────────────┘         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │    Azure Front Door     │
         │    (Global CDN + WAF)   │
         └─────────────────────────┘
                      │
                 contigo-app.ch
```

### Docker Build Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Stage 1:      │     │   Stage 2:      │     │   Stage 3:      │
│   deps          │────▶│   builder       │────▶│   runner        │
│                 │     │                 │     │                 │
│ • node:22-alpine│     │ • Prisma gen   │     │ • Standalone    │
│ • pnpm install  │     │ • Next.js build│     │ • Non-root user │
│ • 900 MB        │     │ • 8 GB heap    │     │ • ~180 MB       │
│                 │     │ • 2 GB         │     │ • Port 3000     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Process Management (PM2)

```
PM2 Daemon
  ├── contigo-web         (cluster, max CPUs)     → Port 3000
  ├── contigo-workers     (cluster, ×2)           → No port
  ├── contigo-websocket   (fork, ×1)              → Port 3001
  └── contigo-contract-sync (fork, ×1)            → No port
```

### Startup Sequence (`start.sh`)

```
1. Prisma generate            → Generate client
2. Prisma migrate deploy      → Apply pending migrations
3. PM2 start ecosystem.config → Start all processes
4. PM2 logs                   → Tail output
```

---

## 8. Security Architecture

### Defence in Depth

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Network                                     │
│  Azure Front Door WAF │ DDoS Protection │ TLS 1.3    │
├─────────────────────────────────────────────────────┤
│  Layer 2: Application                                 │
│  CSRF tokens │ Rate limiting │ CSP headers │ CORS    │
├─────────────────────────────────────────────────────┤
│  Layer 3: Authentication                              │
│  NextAuth v5 │ bcrypt (12 rounds) │ TOTP MFA │ JWT  │
├─────────────────────────────────────────────────────┤
│  Layer 4: Authorisation                               │
│  RBAC │ Tenant isolation │ Permission checks         │
├─────────────────────────────────────────────────────┤
│  Layer 5: Data                                        │
│  AES-256 at rest │ TLS in transit │ Field encryption │
├─────────────────────────────────────────────────────┤
│  Layer 6: Audit                                       │
│  AuditLog table │ Immutable │ 7-year retention       │
└─────────────────────────────────────────────────────┘
```

### Authentication Flow

```
Client                    Server                      Database
  │                         │                            │
  │ POST /api/auth/signin   │                            │
  │ {email, password}       │                            │
  │────────────────────────▶│                            │
  │                         │ Verify CSRF token          │
  │                         │ Rate limit check           │
  │                         │                            │
  │                         │ SELECT user WHERE email    │
  │                         │───────────────────────────▶│
  │                         │ bcrypt.compare(password)   │
  │                         │◀───────────────────────────│
  │                         │                            │
  │  IF MFA enabled:        │                            │
  │◀────────────────────────│                            │
  │  Enter TOTP code        │                            │
  │────────────────────────▶│                            │
  │                         │ Verify TOTP                │
  │                         │                            │
  │  Set-Cookie: session    │ Create session (Redis)     │
  │◀────────────────────────│                            │
```

### Data Classification

| Classification | Examples | Handling |
|---|---|---|
| **Public** | Marketing pages, FAQ | CDN cacheable |
| **Internal** | Analytics, dashboards | Authenticated access |
| **Confidential** | Contracts, rate cards | RBAC + tenant isolation |
| **Restricted** | API keys, passwords | Encrypted, never logged |

---

## 9. Scalability Design

### Horizontal Scaling Points

| Component | Current | Scale-Out Strategy |
|---|---|---|
| **Web** | 2–4 replicas (PM2 cluster) | Auto-scale by CPU/Memory |
| **Workers** | 2 instances | Add replicas per queue depth |
| **WebSocket** | 1 instance | Redis adapter for multi-instance |
| **PostgreSQL** | Single primary | Read replicas → sharding (future) |
| **Redis** | Single instance | Redis Cluster |
| **Storage** | MinIO/Azure Blob | Auto-scaling (Azure) |

### Load Capacity Estimates

| Tier | Users | Contracts | AI Queries/Day | Infra |
|---|---|---|---|---|
| **Starter** | <50 | <5,000 | 500 | 2 vCPU, 4 GB, single DB |
| **Growth** | 50–500 | 5K–50K | 5,000 | 4 vCPU, 8 GB, DB + read replica |
| **Scale** | 500–5,000 | 50K–500K | 50,000 | 8 vCPU, 16 GB, PgBouncer, Redis cluster |
| **Enterprise** | 5,000+ | 500K+ | 100,000+ | Multi-region, dedicated DB, CDN |

### Database Scaling Path

```
Phase 1 (Current)        Phase 2                  Phase 3
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Single PG   │     │ PG Primary       │     │ PG Primary       │
│ + pgvector  │────▶│ + Read Replicas  │────▶│ + Read Replicas  │
│ + PgBouncer │     │ + PgBouncer Pool │     │ + Citus Sharding │
│             │     │ + Connection Mgr │     │ + Dedicated pgvec│
└─────────────┘     └──────────────────┘     └──────────────────┘
```

### Queue Scaling

```
Low Load           Medium Load         High Load
┌────────────┐    ┌────────────┐     ┌────────────┐
│ Workers ×2 │    │ Workers ×4 │     │ Workers ×8 │
│            │    │ + Priority │     │ + Priority  │
│ Shared     │    │   Queues   │     │ + Dedicated │
│ Queues     │    │            │     │   per queue │
└────────────┘    └────────────┘     └────────────┘
```

---

## 10. Integration Architecture

### Integration Patterns

```
                    ConTigo Core
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐
    │  Webhooks │ │ REST API  │ │ File Sync │
    │ (Outbound)│ │ (Inbound) │ │  (SFTP)   │
    └───────────┘ └───────────┘ └───────────┘
```

### External Integrations

| System | Pattern | Protocol | Auth |
|---|---|---|---|
| **DocuSign** | Bidirectional | REST + Webhooks | OAuth 2.0 |
| **SAP** | Bidirectional | REST / RFC | API Key |
| **SharePoint** | Bidirectional | MS Graph API | OAuth 2.0 |
| **Outlook** | Outbound | MS Graph API | OAuth 2.0 |
| **Slack/Teams** | Outbound | Webhooks | Webhook URL |
| **Custom** | Outbound | Webhooks (configurable) | HMAC signature |

### Webhook Architecture

```
Event (contract.created, contract.signed, obligation.due)
    │
    ▼
┌─────────────────┐
│ Event Dispatcher │
│ (BullMQ queue)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐     ┌──────────┐
│ Webhook Worker  │────▶│ HTTP POST    │────▶│ External │
│                 │     │ + HMAC sig   │     │ System   │
│ • Retry (×3)   │     │ + Payload    │     │          │
│ • Exp. backoff  │     │              │     │          │
│ • Dead letter   │     └──────────────┘     └──────────┘
└─────────────────┘
```

---

## 11. Observability & Reliability

### Observability Stack

```
Application ──┬── Pino (structured JSON logs) ──▶ Azure Monitor / Log Analytics
              ├── OpenTelemetry (traces) ──────▶ Azure Monitor / Jaeger
              ├── prom-client (metrics) ───────▶ Prometheus → Grafana
              ├── Sentry (errors) ──────────────▶ Sentry.io
              └── web-vitals (frontend perf) ──▶ Analytics
```

### SLO Targets

| Metric | Target | Measurement |
|---|---|---|
| **Availability** | 99.9% (8.76 hrs/year downtime) | Health check uptime |
| **API latency (p95)** | <500 ms | Prometheus histogram |
| **Contract processing** | <120 seconds (95th percentile) | Queue metrics |
| **AI response time** | <3 seconds (streaming start) | OTel spans |
| **Error rate** | <0.1% | Sentry + Prometheus |

### Health Check Chain

```
/api/health     → App alive (fast, for load balancer)
/api/healthz    → App + PostgreSQL + Redis + MinIO (deep, for k8s liveness)
/api/ready      → All of healthz + migrations applied + queues connected (k8s readiness)
```

### Alerting Rules

| Alert | Condition | Severity | Channel |
|---|---|---|---|
| **High error rate** | >1% errors in 5 min | Critical | PagerDuty + Slack |
| **Slow API** | p95 >2s for 10 min | Warning | Slack |
| **Queue backlog** | >100 waiting jobs | Warning | Slack |
| **DB connections** | >80% pool used | Warning | Slack |
| **Disk usage** | >85% | Critical | PagerDuty |
| **AI cost spike** | >150% daily budget | Warning | Email + Slack |

---

## 12. Architecture Decision Records

### ADR-001: Modular Monolith over Microservices

| Field | Value |
|---|---|
| **Date** | 2024-Q1 |
| **Decision** | Modular monolith with package boundaries instead of microservices |
| **Rationale** | Small team (1–3 devs), shared database, simpler deployment, lower operational overhead. Package structure enables future extraction. |
| **Status** | Active |

### ADR-002: PostgreSQL + pgvector over Dedicated Vector DB

| Field | Value |
|---|---|
| **Date** | 2024-Q2 |
| **Decision** | Use pgvector extension in PostgreSQL instead of ChromaDB/Pinecone |
| **Rationale** | Single database for all data (relational + vectors), simpler operations, Swiss hosting available, sufficient scale for 500K+ embeddings |
| **Status** | Active (migrated from ChromaDB) |

### ADR-003: Azure Switzerland North for Data Residency

| Field | Value |
|---|---|
| **Date** | 2024-Q2 |
| **Decision** | Deploy all services to Azure Switzerland North (Zurich) |
| **Rationale** | Swiss data protection (nDSG), customer trust, Azure OpenAI availability in CH, full compliance without complex data routing |
| **Status** | Active |

### ADR-004: BullMQ over Direct Processing

| Field | Value |
|---|---|
| **Date** | 2024-Q3 |
| **Decision** | Process contracts via BullMQ queues instead of synchronous API calls |
| **Rationale** | Contract processing takes 30–120 seconds; queues provide retry, priority, rate limiting, and progress tracking without blocking API |
| **Status** | Active |

### ADR-005: Next.js App Router over Pages Router

| Field | Value |
|---|---|
| **Date** | 2024-Q3 |
| **Decision** | Migrate to Next.js 15 App Router with React Server Components |
| **Rationale** | Server components reduce client JS bundle, API routes collocated with pages, streaming support, improved caching primitives |
| **Status** | Active |

### ADR-006: Multi-Model AI Strategy

| Field | Value |
|---|---|
| **Date** | 2024-Q4 |
| **Decision** | Support multiple AI providers (Azure OpenAI, Mistral, Anthropic) |
| **Rationale** | Avoid vendor lock-in, data residency options (Swiss/EU), cost optimisation by routing to cheapest capable model, fallback resilience |
| **Status** | Active |

---

## 13. Future Architecture Considerations

### Near-Term (0–6 Months)

- **Redis Cluster** — Required when WebSocket scales beyond 1 instance
- **Read Replicas** — PostgreSQL read replicas for analytics queries
- **CDN for documents** — Serve PDFs and previews via Azure Front Door
- **OpenAPI spec** — Auto-generate from Zod schemas

### Medium-Term (6–18 Months)

- **Event sourcing** — For contract state changes (full audit trail)
- **GraphQL** — For complex portfolio queries (alongside REST)
- **Service extraction** — AI pipeline as separate service (if team grows >5)
- **Multi-region** — EU region (Frankfurt/Amsterdam) for non-Swiss customers
- **Kubernetes (AKS)** — When >1,000 concurrent users

### Long-Term (18+ Months)

- **CQRS** — Separate read/write models for analytics scale
- **Data warehouse** — Dedicated analytics store (Azure Synapse)
- **ML pipeline** — Custom model fine-tuning for extraction accuracy
- **Edge deployment** — CDN-based preview generation
- **Federation** — On-premise deployment option for enterprise

---

*ConTigo GmbH — Zurich, Switzerland*
*Last updated: February 2026*
