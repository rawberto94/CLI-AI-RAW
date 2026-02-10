# Architecture Audit — ConTigo Platform

**Date**: February 2026  
**Auditor**: AI Architecture Review  
**Overall Grade**: B-  
**Verdict**: Your friend is **wrong for your stage**. Separating would hurt you right now. Read why below.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture](#2-current-architecture)
3. [The "Separate Frontend & Backend" Question](#3-the-separate-frontend--backend-question)
4. [What You Actually Have (It's Not What You Think)](#4-what-you-actually-have)
5. [Strengths](#5-strengths)
6. [Real Problems (Not Separation)](#6-real-problems-not-separation)
7. [When Separation Actually Makes Sense](#7-when-separation-actually-makes-sense)
8. [Recommended Architecture Roadmap](#8-recommended-architecture-roadmap)
9. [Appendix: Codebase Metrics](#9-appendix-codebase-metrics)

---

## 1. Executive Summary

ConTigo is a **Next.js 15 full-stack monorepo** that uses Next.js API routes as the backend. Your friend's advice to "separate frontend and backend" is the **#1 most common premature architecture mistake** in the startup world.

**The short answer**: You already have separation where it matters (workers, data-orchestration, agents are all separate packages). What you have inside `apps/web` is not "frontend + backend jammed together" — it's a **single full-stack application** using Next.js as designed. This is the architecture that Vercel, Supabase, Cal.com, and hundreds of YC companies use at your stage.

**The long answer**: Read on.

---

## 2. Current Architecture

```
┌─────────────────────────────────────────────────────┐
│                    MONOREPO (pnpm)                   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            apps/web (Next.js 15)              │   │
│  │  ┌────────────┐  ┌──────────────────────┐    │   │
│  │  │  Frontend   │  │   Backend (API Routes) │    │   │
│  │  │ 156 pages   │  │   507 route handlers  │    │   │
│  │  │ 686 comps   │  │   104K lines of code  │    │   │
│  │  │ React 19    │  │   Prisma, Redis, S3   │    │   │
│  │  └────────────┘  └──────────────────────┘    │   │
│  │           ↕ shared lib/ (115K lines)          │   │
│  │           ↕ shared middleware.ts               │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │ packages/workers │  │ packages/data-orchestration│   │
│  │  BullMQ jobs     │  │  DAL, services, RAG      │   │
│  │  32K lines       │  │  91K lines               │   │
│  │  Separate Docker │  │  Shared library          │   │
│  └─────────────────┘  └─────────────────────────┘   │
│                                                      │
│  ┌───────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ packages/     │  │ packages/│  │ packages/    │  │
│  │  agents (4K)  │  │ schemas  │  │ clients/     │  │
│  │  AI agent defs│  │ Zod types│  │ db, rag, s3  │  │
│  └───────────────┘  └──────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────┘

Docker Production Topology:
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐
│   web   │  │ workers  │  │   api    │  │ nginx │
│ :3000   │  │ (×3)     │  │  :8080   │  │ :80   │
└────┬────┘  └────┬─────┘  └────┬─────┘  └───┬───┘
     │            │             │             │
     └────────────┴─────────────┴─────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────┴───┐  ┌────┴───┐  ┌────┴───┐
    │Postgres│  │ Redis  │  │ MinIO  │
    │+pgvec  │  │        │  │  (S3)  │
    └────────┘  └────────┘  └────────┘
```

### Key Numbers

| Metric | Count |
|--------|-------|
| Frontend pages | 156 |
| API route files | 507 |
| React components | 686 |
| API route code | 104,241 lines |
| Frontend page code | 72,000 lines |
| Component code | 308,478 lines |
| Shared lib/ | 115,239 lines |
| Workers | 32,353 lines |
| Data orchestration | 91,083 lines |
| Agents | 4,199 lines |
| **Total estimated** | **~730K lines** |

---

## 3. The "Separate Frontend & Backend" Question

Your friend's advice comes from a real pattern: **3-tier architecture** (React SPA → Express/NestJS API → Database). It's valid for certain scenarios. But applying it to a Next.js app is like telling someone to stop using their dishwasher and wash dishes by hand because "that's how real restaurants do it."

### What "Separation" Would Mean For You

If you split today, here's what happens:

```
BEFORE (current):
  1 deploy → web goes live → API routes work → done

AFTER (separated):
  apps/api/           ← NEW Express/NestJS server
  apps/web/           ← Client-only React/Next.js
  
  Problems created:
  ├── CORS configuration for every endpoint
  ├── Separate auth token management (JWT instead of session cookies)
  ├── Two deploy pipelines instead of one
  ├── Network latency between frontend↔backend (instead of in-process)
  ├── 507 route handlers to rewrite as Express controllers
  ├── 115K lines of shared lib/ to duplicate or extract
  ├── Server Components stop working (they need server access)
  ├── SSR/ISR stops working for authenticated pages
  ├── Middleware.ts auth/CSRF/rate-limiting → rewrite for both
  ├── Lost: Automatic code splitting, tree shaking of server code
  ├── Lost: Edge middleware capabilities
  ├── Lost: Next.js built-in optimizations (Image, Font, etc.)
  └── 2-4 weeks of pure refactoring, zero features shipped
```

### The Real Cost

| Factor | Monorepo Full-Stack | Separated FE/BE |
|--------|-------------------|-----------------|
| Deploy complexity | 1 pipeline | 2+ pipelines |
| Auth implementation | NextAuth (session cookies) | JWT + refresh tokens |
| CORS | Not needed | Required for every route |
| SSR capability | Full | Lost or complex proxy |
| Server Components | Yes | No |
| Type safety FE↔BE | Automatic (shared types) | Manual or tRPC/OpenAPI |
| Network latency | 0ms (in-process) | 1-10ms per API call |
| Dev experience | `pnpm dev` → done | 2 terminals, CORS debugging |
| Team size needed | 1-3 devs | 2-5 devs (FE + BE teams) |

---

## 4. What You Actually Have

Your architecture is **already separated** — just not in the way your friend imagines:

### ✅ Already Properly Separated

1. **Background Workers** → `packages/workers/` → **Separate Docker container** (Dockerfile.workers)
   - BullMQ job processors, OCR, RAG indexing, obligation tracking
   - Scales independently (3 replicas in docker-compose.prod.yml)
   - 32K lines, completely independent runtime

2. **Data Access Layer** → `packages/data-orchestration/` → **Shared library**
   - 91K lines of services, DAL, validation, caching
   - Has its own `api-server.js` for external integrations
   - Already has a Docker service (`api` on port 8080)

3. **WebSocket Server** → `apps/web/server/` → **Separate Docker container** (Dockerfile.websocket)
   - Real-time notifications, collaboration events
   - Independent scaling

4. **AI Agents** → `packages/agents/` → **Separate package**
   - 4K lines of autonomous agent definitions

5. **Database Client** → `packages/clients/db/` → **Shared package**
   - Prisma schema, migrations, seeds
   - Consumed by web, workers, and data-orchestration

6. **Schemas** → `packages/schemas/` → **Shared Zod types**
   - Contract, workflow, rate-card schemas
   - Single source of truth for validation

### ❌ The Only Thing Not Separated

The **API route handlers** (507 files, 104K lines) live inside `apps/web/app/api/`. This is by design in Next.js — they run on the same server process as SSR, share authentication context, and benefit from server-side optimizations.

**This is a feature, not a bug.**

---

## 5. Strengths

### Architecture Strengths (Grade: A-)

| Strength | Details |
|----------|---------|
| **Monorepo with Turborepo** | Proper workspace isolation, task caching, parallel builds |
| **Package boundaries** | Workers, data-orchestration, schemas, clients all properly isolated |
| **Docker multi-container** | web, workers, websocket, api all have separate Dockerfiles |
| **K8s ready** | HPA autoscaling configs, separate deployments for web + workers |
| **Shared types** | Zod schemas in `packages/schemas`, Prisma types shared across packages |
| **Connection pooling** | PgBouncer in production, proper pool management |
| **Background job processing** | BullMQ workers in separate process, scalable replicas |

### Deployment Strengths (Grade: A)

| Strength | Details |
|----------|---------|
| **Standalone output** | `output: "standalone"` in next.config — minimal Docker image |
| **Multi-stage Dockerfiles** | Builder → Runner pattern, ~150MB production image |
| **Health checks** | Every service has HEALTHCHECK in Docker + `/healthz` endpoint |
| **Infrastructure as Code** | Helm charts, K8s manifests, Prometheus alerts, Grafana dashboards |

---

## 6. Real Problems (Not Separation)

These are the actual issues worth fixing, ranked by impact:

### P0 — Critical

#### 6.1 API Route Bloat (507 routes, 104K lines)

**Problem**: 507 route files is excessive. Many are duplicative, poorly organized, or serve niche features that no user has asked for.

**Evidence**:

- `/api/example-data-consistency` — test/example code in production routes
- `/api/example-secure-route` — test/example code in production routes  
- `/api/test` — test endpoint in production
- `/api/ai/*` has 30+ sub-routes, many overlapping (chat, compare, compare-contracts, critique, explain, etc.)
- `/api/contracts/*` has deep nesting (contracts → [id] → ai, analyze, compare, export, legal-review, sign, etc.)

**Impact**: Slow builds, bloated bundle, maintenance burden, security surface area.

**Fix**: Consolidate. You likely need ~100-150 routes, not 507.

#### 6.2 Shared `lib/` is a God Directory (332 files, 115K lines)

**Problem**: `apps/web/lib/` has 332 files with 115K lines of mixed concerns — server-only business logic, client utilities, AI services, caching, auth, all in one flat(ish) directory.

**Evidence**: API routes import from `@/lib/prisma` (308 times), `@/lib/auth` (193 times), `@/lib/tenant-server` (163 times), `@/lib/security/*`, `@/lib/rag/*`, etc.

**Impact**: Any change to lib/ theoretically affects every route. No clear dependency graph. Hard to test in isolation.

**Fix**: Extract pure-server logic into `packages/data-orchestration/` services. The lib/ directory should contain only:

- Client utilities (formatters, hooks helpers)
- Thin server wrappers (auth config, prisma singleton)
- Shared types

#### 6.3 Component Explosion (686 components, 308K lines)

**Problem**: 686 component files is 3-5x what a well-organized app this size needs. Phase 14H cleaned up from 125→70 in `components/ui/`, but `components/` overall still has 686 files.

**Impact**: Slow IDE, slow builds, difficult discoverability, likely many dead/duplicate components.

### P1 — High

#### 6.4 No API Versioning in Practice

**Problem**: All routes are at `/api/*` with no version prefix. The `packages/data-orchestration/api-server.js` uses `/api/v1/*` but the main Next.js routes don't.

**Impact**: No safe path for breaking changes to mobile/external consumers.

#### 6.5 Tight Prisma Coupling in Route Handlers

**Problem**: Many API route handlers do raw Prisma queries directly (`prisma.contract.findMany(...)`) instead of going through the data-orchestration service layer. This means business logic is scattered across 507 route files.

**Evidence**: 308 direct imports of `@/lib/prisma` in API routes.

**Impact**: Can't swap databases, can't test business logic without HTTP, can't reuse queries across routes.

#### 6.6 Missing Request/Response Type Contracts

**Problem**: API routes use ad-hoc request parsing and response shapes. No generated OpenAPI spec, no shared request/response types.

**Impact**: Frontend can't auto-generate API clients. No API documentation for external integrations. No contract testing.

### P2 — Medium

#### 6.7 Duplicate Infrastructure Configs

**Problem**: 3 different K8s/deployment configs:

- `k8s/deployment.yaml` (single file, 11K lines)
- `kubernetes/*.yaml` (7 files, full setup)
- `helm/contigo/` (Helm chart)

**Impact**: Config drift between the three. Unclear which is canonical.

#### 6.8 No Feature Flags / Config Service

**Problem**: Feature toggles are env vars scattered across Docker configs. No runtime feature flag system.

---

## 7. When Separation Actually Makes Sense

Your friend's advice becomes correct **when these conditions are met**:

| Trigger | Your Status | Threshold |
|---------|-------------|-----------|
| Team size | ~1-3 devs | 8+ devs, separate FE/BE teams |
| External API consumers | None (just your SPA) | Mobile apps, partner APIs, public API |
| Deploy frequency mismatch | Same cadence | Frontend: 5x/day, Backend: 1x/week |
| Scale mismatch | Same load | API: 10x web's resource usage |
| Tech stack divergence | All TypeScript | Backend needs Python ML, Go perf, etc. |
| Regulatory requirements | Standard SaaS | Need PCI DSS-level backend isolation |

**You meet zero of these triggers today.**

### The Evolution Path

```
Stage 1 (YOU ARE HERE): Next.js Full-Stack Monorepo
  └─ Single deploy, fast iteration, small team
  └─ Perfect for: 0 → product-market fit

Stage 2 (10-20 devs): Extract API Service
  └─ apps/api/ with NestJS or Hono
  └─ apps/web/ becomes SSR frontend calling internal API
  └─ Trigger: separate FE/BE teams or external API consumers

Stage 3 (20-50 devs): Microservices
  └─ contracts-service, ai-service, analytics-service
  └─ API gateway (Kong, Traefik)
  └─ Trigger: domain teams, independent deploy cadence

Stage 4 (50+ devs): Platform Architecture
  └─ Internal developer platform
  └─ Service mesh (Istio)
  └─ Trigger: organizational complexity
```

---

## 8. Recommended Architecture Roadmap

Instead of premature separation, fix the **real problems**:

### Phase 1: API Route Cleanup (1-2 weeks, HIGH impact)

1. **Delete** example/test routes (`/api/example-*`, `/api/test`)
2. **Consolidate** AI routes: merge overlapping endpoints
3. **Add route inventory**: create an `API_ROUTES.md` with ownership and usage data
4. **Target**: 507 → ~200 routes

### Phase 2: Service Layer Migration (2-3 weeks, HIGH impact)

1. **Move business logic** from route handlers into `packages/data-orchestration/` services
2. **Route handlers become thin**: parse request → call service → format response
3. **Result**: Route handlers drop from 104K lines to ~30K lines

```typescript
// BEFORE (current): Fat route handler
export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = getTenantId(session);
  const contracts = await prisma.contract.findMany({
    where: { tenantId, status: 'ACTIVE' },
    include: { parties: true, obligations: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  // ... 50 more lines of business logic
  return NextResponse.json({ data: contracts });
}

// AFTER: Thin route handler
export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);   // auth + tenant
  const params = parseQueryParams(req);   // validation
  const result = await contractService.list(ctx, params);  // service layer
  return NextResponse.json(result);       // response
}
```

### Phase 3: lib/ Decomposition (1-2 weeks, MEDIUM impact)

1. **Server-only business logic** → `packages/data-orchestration/src/services/`
2. **AI/RAG services** → `packages/agents/` or new `packages/ai/`
3. **lib/ retains**: auth config, prisma singleton, client utils, types
4. **Target**: lib/ drops from 332 files to ~80

### Phase 4: API Contracts (1 week, MEDIUM impact)

1. Add Zod schemas for all request/response types in `packages/schemas/`
2. Generate OpenAPI spec from Zod schemas
3. Optional: Add tRPC or ts-rest for type-safe API client

### Phase 5: Infra Cleanup (1 day, LOW impact)

1. Pick ONE deployment config: Helm chart (recommended)
2. Archive or delete the other two (`k8s/`, `kubernetes/`)
3. Single source of truth for deployment

---

## 9. Appendix: Codebase Metrics

### File Distribution

```
apps/web/
  app/api/        → 507 route handlers (104K lines) — BACKEND
  app/*/page.tsx  → 156 pages (72K lines)           — FRONTEND
  components/     → 686 components (308K lines)      — FRONTEND
  lib/            → 332 files (115K lines)           — SHARED
  middleware.ts   → Auth, CSRF, rate-limit           — BACKEND
  server/         → WebSocket server                 — BACKEND

packages/
  workers/        → BullMQ jobs (32K lines)          — BACKEND (separate container)
  data-orchestration/ → DAL + services (91K lines)   — BACKEND (shared lib)
  agents/         → AI agents (4K lines)             — BACKEND
  schemas/        → Zod types                        — SHARED
  clients/db/     → Prisma                           — BACKEND (shared)
  clients/rag/    → RAG pipeline                     — BACKEND (shared)
  clients/storage/→ S3 client                        — BACKEND (shared)
  utils/          → Shared utilities                 — SHARED
```

### Backend vs Frontend Split

| Category | Lines | % |
|----------|-------|---|
| Frontend (pages + components) | ~380K | 52% |
| Backend (API routes + lib + services) | ~310K | 42% |
| Shared (schemas, utils, types) | ~40K | 6% |

### Docker Containers in Production

| Container | Dockerfile | Scales Independently |
|-----------|-----------|---------------------|
| web | Dockerfile.production | Yes (HPA 2-10 pods) |
| workers | Dockerfile.workers | Yes (3 replicas default) |
| websocket | Dockerfile.websocket | Yes |
| api | (data-orchestration) | Yes |
| postgres | pgvector/pgvector:pg16 | Stateful |
| pgbouncer | edoburu/pgbouncer | Yes |
| redis | redis:7-alpine | Stateful |
| minio | minio/minio | Stateful |

### Import Dependency Map (API Routes)

```
API Route Handlers (507 files)
    ├── @/lib/prisma ........... 308 imports (direct DB access — should reduce)
    ├── @/lib/auth ............. 193 imports (auth context — correct)
    ├── @/lib/tenant-server .... 163 imports (multi-tenancy — correct)
    ├── @/lib/security/* ....... 55 imports  (CORS, audit, tenant — correct)
    ├── @/lib/cache ............ ~30 imports (Redis cache — correct)
    ├── @/lib/realtime/* ....... ~15 imports (WebSocket publish — correct)
    ├── @/lib/rag/* ............ ~10 imports (should be in packages/agents)
    └── @/lib/data-orchestration ~6 imports (should be 300+, not 6)
```

The last line tells the whole story: `data-orchestration` is barely used by API routes. Business logic lives in the route handlers instead of the service layer. **That's** the real architectural problem — not separation.

---

## Bottom Line

> **Don't separate your frontend and backend. Separate your business logic from your HTTP handlers.**

The monorepo full-stack Next.js pattern is correct for your stage. What needs work is:

1. Too many API routes (507 → ~200)
2. Business logic in route handlers instead of service layer
3. lib/ is a dump truck — decompose it into packages
4. Pick one infra config and delete the rest

Fix those four things and you'll have a cleaner architecture than 95% of startups — without the 2-4 week tax of premature backend separation.

---

*Previous audit: [DESIGN_AUDIT.md](DESIGN_AUDIT.md) | Related: [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md)*
