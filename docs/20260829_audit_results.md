# Audit Results — ConTigo / PactumAI Platform & Azure Infrastructure

**Audit date:** 2026-08-29
**Scope:** Repository code (`apps/web`, `packages/*`, `scripts/*`), Kubernetes/Helm manifests, Azure Bicep IaC, CI workflows, and the accuracy of existing `.md` documentation against the actual code.
**Method:** Direct code inspection (grep + full-file reads) of the highest-risk areas, cross-checked against parallel deep-dive passes over auth/tenancy, infra manifests, DB/performance/testing, and documentation-vs-code consistency. Every finding below was either **read directly by the auditor** (marked "verified") or produced by a research pass and then **spot-checked directly** before inclusion. Claims that could not be verified are marked as such. Prior audit docs in `docs/` and `docs/archive/` were treated as *hypotheses to test*, not facts — several turned out to be stale (see [§6](#6-documentation-vs-reality-contradictions)).

---

## Executive Summary (for the client)

> *"Is my data safe? Is the platform fast and scalable? Am I paying for more than I need?"*

**Is my data safe? — Not yet, no.** Two production API routes currently return contract/business data with **no tenant filtering and no authentication check at all** ([§1.1](#11-p0-confirmed-cross-tenant-data-leakage)), meaning any authenticated user (and in one case, potentially unauthenticated depending on middleware pass) can read aggregated financial data and search results belonging to **every other client on the platform**. Additionally, the environment variable that the codebase relies on to turn on strict tenant enforcement (`REQUIRE_AUTH=true`) **is not set in any of the actual Kubernetes/Helm/Docker Compose deployment files** — only in `.env.example` templates nobody is required to apply ([§1.2](#12-p0-confirmed-auth-enforcement-is-opt-in-and-off-by-default-in-every-deployment-manifest)). Combined, these mean the platform *can* be run securely, but **as currently checked into the repo, the shipped deployment configuration does not turn that security on.**

**Is it fast and scalable? — Partially, with a specific bottleneck risk.** Indexing, caching, and connection pooling are generally well designed ([§3](#3-performance--database)). The real risk is that the platform is deliberately sized on Azure's cheapest **Burstable** compute tier for both the database (`Standard_B2s`) and AKS nodes (`Standard_B4ms`) — these run on CPU *credits*, not sustained CPU, and there is no evidence of alerting on credit exhaustion. Under sustained real usage (not bursty), the system can silently throttle rather than autoscale, and a client experiencing "random slowness" would not currently be caught by the alerting stack ([§5](#5-cost--scalability)).

**Am I overpaying / underpaying for reliability? — There's a mismatch between promises and infrastructure.** The internal `DISASTER_RECOVERY_PLAN.md` promises a 4-hour recovery time and 1-hour data-loss window; the actual Azure config has **no high availability, no geo-redundant backups, and only 7 days of backup retention** ([§6.4](#64-disaster-recoverysla-promises-vs-actual-infrastructure)). This is a legitimate, defensible cost trade-off for an early-stage platform — but it is currently **undocumented as a trade-off** and contradicts a document that reads as a firm commitment. A client reading `DISASTER_RECOVERY_PLAN.md` today would be misled about what happens if the Swiss North region has an outage.

**Bottom line:** the engineering fundamentals (schema design, indexing, rate limiting, network segmentation, secrets templating) are solid. The gaps are concentrated in a small number of **specific, fixable** places — not a systemic rewrite. See [§7](#7-prioritized-remediation-roadmap) for the fix order.

---

## 0. How to read this document

Findings are tagged:

| Tag | Meaning |
|---|---|
| **P0 – Critical** | Cross-tenant data exposure, auth bypass, or infra config that silently disables security. Fix before next deploy. |
| **P1 – High** | Real risk under specific conditions, or a documented guarantee the infra can't currently meet. Fix this sprint. |
| **P2 – Medium** | Best-practice gap / latent tech debt / missing test coverage. Fix this quarter. |
| **P3 – Low** | Cosmetic, documentation hygiene, minor optimization. |

Each finding includes the file path, evidence, and a plain-language client-impact statement.

---

## 1. Security — Tenant Isolation & Authentication

### 1.1 P0 (confirmed): Cross-tenant data leakage

Two routes were opened and read in full. Neither imports any session/auth helper, and neither filters by `tenantId`:

**[apps/web/app/api/search/route.ts](../apps/web/app/api/search/route.ts)** — `POST` handler:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// no auth/session import at all

export async function POST(request: NextRequest) {
  const { query, filters } = await request.json()
  ...
  const where: Record<string, unknown> = {
    OR: [ { contractTitle: { contains: query, ... } }, ... ] // no tenantId anywhere
  }
  const contracts = await prisma.contract.findMany({ where, ... })
```
**Impact for the client:** Any request to `/api/search` (regardless of who is logged in, or arguably even without a session, depending on whether the global middleware actually blocks it — see [§1.4](#14-note-middleware-provides-a-safety-net-but-this-route-still-shouldnt-rely-on-it)) returns contract titles, descriptions, supplier names, and financial values across **every tenant in the database**, not just the caller's own organization.

**[apps/web/app/api/analytics/metrics/route.ts](../apps/web/app/api/analytics/metrics/route.ts)** — `GET` handler:
```ts
const [totalContracts, valueAggregate, suppliers, artifacts, upcomingContracts] = await Promise.all([
  prisma.contract.count({ where: { isDeleted: false } }),               // no tenantId
  prisma.contract.aggregate({ where: { isDeleted: false }, _sum: {...} }), // no tenantId
  prisma.contract.groupBy({ by: ['supplierName'], where: { ... } }),       // no tenantId
  prisma.artifact.count(),                                                 // no filter at all
  ...
])
```
**Impact for the client:** Total contract count, total portfolio value, supplier list, and artifact counts returned are **platform-wide aggregates**, not the caller's tenant. A competitor sharing the platform could infer another client's total contract value and supplier relationships.

**Fix:** Both routes need (a) a session check that returns `401` if unauthenticated, and (b) `tenantId: session.user.tenantId` added to every `where` clause, consistent with the pattern already used correctly in `apps/web/app/api/ai/costs/route.ts` and the repository layer (see [§1.5](#15-repository-layer-is-well-scoped-the-problem-is-route-level-bypasses)).

### 1.2 P0 (confirmed): Auth enforcement is opt-in and off by default in every deployment manifest

`apps/web/lib/tenant-server.ts` deliberately fails closed in code:
```ts
function getDefaultTenantId(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Tenant ID required. Please authenticate or provide x-tenant-id header.");
  }
  return "demo";
}
```
That's good. But two other enforcement points are gated behind a *second*, separate flag, `REQUIRE_AUTH`:
```ts
// requireTenantContext()
if (!context.isAuthenticated && process.env.NODE_ENV === "production" && process.env.REQUIRE_AUTH === "true") {
  throw new Error("Authentication required");
}
// validateTenantAccess()
if (process.env.NODE_ENV !== "production" || process.env.REQUIRE_AUTH !== "true") {
  return true; // allow any tenant access
}
```
and `apps/web/middleware.ts` line ~265: `const requireAuth = process.env.REQUIRE_AUTH === "true";` gates whether a missing tenant ID returns 401.

**Verified by direct grep across every real deployment artifact in the repo** — `REQUIRE_AUTH` is set **only** in:
- `.env.example` (line 156)
- `apps/web/.env.production.example` (line 32)

It is **absent** from:
- `kubernetes/configmap.yaml` (has `NODE_ENV`, feature flags, rate-limit config — no `REQUIRE_AUTH`)
- `kubernetes/deployment.yaml` env section
- `helm/contigo/values.yaml` and `helm/contigo/values-azure.yaml` `env:` blocks (both only set `NODE_ENV` and `NEXT_TELEMETRY_DISABLED`)
- `docker-compose.prod.yml`

**Impact for the client:** If the platform is deployed using the Kubernetes manifests, Helm chart, or `docker-compose.prod.yml` exactly as checked into this repository — i.e. the actual, real deployment path, not the example env files — `validateTenantAccess()` unconditionally returns `true` for any tenant, and `requireTenantContext()` never throws. The "production-safe" checks that exist in the code are real, but **nothing in the shipped infra config turns them on.** This is a textbook "secure by config, insecure by default" failure: a copy-paste deploy from this repo today ships with tenant-access validation effectively disabled.

**Fix:** Add `REQUIRE_AUTH: "true"` to `kubernetes/configmap.yaml` and to the `env:` block in both `helm/contigo/values.yaml` and `values-azure.yaml`. Better: invert the default so the code fails closed unless `REQUIRE_AUTH=false` is explicitly set for local dev, so a missing env var can never silently mean "open access."

### 1.3 P1 (confirmed): Inconsistent tenant-fallback handling across API routes

Several routes catch a thrown "tenant required" error and substitute a hardcoded tenant instead of returning `401`:

**[apps/web/app/api/contracts/[id]/family-health/route.ts](../apps/web/app/api/contracts/[id]/family-health/route.ts):**
```ts
try {
  tenantId = await getTenantIdFromRequest(request)
} catch {
  tenantId = 'demo'
}
const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId, isDeleted: false } })
```
This is different from — and less severe than — a full cross-tenant leak, because it queries the **`demo`** tenant, not an arbitrary other tenant. But it means an authentication *failure* is silently converted into a **successful response containing the demo tenant's data**, rather than a `401`. That's a broken-fail-open pattern that should be fixed regardless of how sensitive the `demo` tenant's data is.

`apps/web/app/api/contracts/orphans/route.ts` has the identical pattern (confirmed by research pass, not independently re-read line-by-line by the auditor — flagged as **needs final verification** but highly likely given the identical helper function is used).

**Fix:** Replace every `catch { tenantId = 'demo' }` with `catch { return NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }`.

### 1.4 Note: middleware provides a safety net, but this route still shouldn't rely on it

`apps/web/middleware.ts` does enforce authentication globally: it checks for a valid JWT/session `token` on all non-public paths and returns `401` if missing, and its route matcher (`"/((?!_next/static|_next/image|favicon.ico|public).*)"`) does cover `/api/search` and `/api/analytics/metrics`. **This likely prevents fully anonymous access today** — but it does *not* prevent the confirmed cross-tenant leak in [§1.1](#11-p0-confirmed-cross-tenant-data-leakage), because middleware only confirms *a* valid session exists, not that the query is scoped to *that session's tenant*. The two vulnerable routes remain exploitable by **any authenticated user of any tenant**, which is the actual security boundary that matters to a client.

### 1.5 Repository layer is well-scoped — the problem is route-level bypasses

The Prisma repository layer (`packages/clients/db/src/repositories/*.repository.ts`) consistently includes `tenantId` in `where` clauses for `contract`, `artifact`, `user`, and `rate-card` repositories. **The isolation problem is not architectural — it's that a handful of routes query `prisma` directly instead of going through the tenant-scoped repository layer.** This is good news: the fix is localized (patch ~5 route files), not a schema or architecture redesign.

### 1.6 P1 (confirmed): Two different, inconsistent credential-encryption implementations

There are **two independent AES-256-GCM implementations** for encrypting integration credentials, with different key-derivation fallbacks:

**`apps/web/lib/integrations/connectors/encryption.ts`** (verified):
```ts
function getMasterKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'development') {
      return Buffer.from('dev-only-encryption-key-32bytes!'); // fixed dev key
    }
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is required'); // fails closed in prod ✅
  }
  ...
}
```

**`apps/web/lib/integrations/sync-service.ts`** (verified, `getEncryptionKey()`):
```ts
if (!keyBase64) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is required in production'); // fails closed in prod ✅
  }
  const fallbackKey = process.env.DATABASE_URL || 'default-fallback-key-for-dev';
  return crypto.createHash('sha256').update(fallbackKey).digest(); // different derivation than encryption.ts
}
```
**Good news:** the specific P0 from `docs/GAP_ANALYSIS_REPORT.md` ("falls back to `DATABASE_URL` in all environments") **is already fixed** — both paths now correctly throw in production. **Remaining issue:** having two separate encryption utilities with two different key-derivation schemes for the same category of secret (integration credentials) is a maintainability and correctness risk — if a credential is encrypted via one path and decrypted via the other, decryption silently fails or produces garbage. Consolidate into a single shared `lib/crypto/credential-encryption.ts`.

### 1.7 P2: Tenant ID trusted from request body in an otherwise-authenticated route

`apps/web/app/api/ai/costs/route.ts` `POST` handler (verified, full read): the handler correctly checks `getServerSession()` and returns `401` if missing, and derives `tenantId` from the session for `set-budget`. But the `record-usage` action re-destructures a **client-supplied** `tenantId` from the request body, shadowing the session-derived value:
```ts
case 'record-usage': {
  const { tenantId = 'default', model, taskType, inputTokens, outputTokens } = body; // ignores session.user.tenantId
  aiCostOptimizerService.recordUsage({ model, taskType, inputTokens, outputTokens, tenantId });
```
**Impact:** A logged-in user of Tenant A can attribute AI cost/usage records to an arbitrary `tenantId` (or `'default'`) instead of their own. This doesn't leak *contract* data, but it can pollute another tenant's cost/budget dashboard or corrupt cost-based rate-limiting/billing signals. **Fix:** always use the session-derived `tenantId`, never one supplied in the request body, for this class of route.

### 1.8 P1: Mock-data trigger not gated by environment on at least one route

`apps/web/app/api/search/route.ts`:
```ts
const dataMode = request.headers.get('x-data-mode') || 'real'
if (dataMode !== 'real') {
  return NextResponse.json({ results: [ /* fabricated contract data */ ] })
}
```
Unlike `apps/web/app/api/contracts/route.ts` and `apps/web/app/api/rate-cards/[id]/route.ts` — both of which correctly gate mock mode behind `ENABLE_MOCK_MODE === 'true' && NODE_ENV !== 'production'` or an explicit production rejection — `search/route.ts` and `apps/web/app/api/analytics/metrics/route.ts` will return **fabricated data to any client that sends an `x-data-mode` header**, in any environment, including production. This is lower severity than the missing tenant filter in the same file, but worth fixing in the same patch.

---

## 2. Kubernetes & Azure Infrastructure

### 2.1 P0 (confirmed): Two parallel, conflicting Kubernetes manifest sets

The repository contains **both** `kubernetes/` and `k8s/` directories defining the same application, with materially different configuration:

| | `kubernetes/deployment.yaml` | `k8s/deployment.yaml` |
|---|---|---|
| Namespace | `contract-intel` (verified via grep, matches `kubernetes/security-policies.yaml`) | `contract-intelligence` (verified via grep) |
| Web CPU request/limit | 250m / 1000m | 2000m / 4000m |
| Web memory request/limit | 1Gi / 4Gi | 8Gi / 16Gi |
| Image | `contract-intel-app:latest` | `ghcr.io/your-org/contract-intelligence-web:latest` |
| HPA present in this file | No (HPA lives only in Helm) | Yes, static HPA block |

**Correction to an earlier research pass:** an initial automated finding claimed `kubernetes/deployment.yaml` used a *different* namespace than `kubernetes/security-policies.yaml`, implying the restricted Pod Security Standard wasn't applied. **This was independently re-verified and found to be incorrect** — both files consistently use `contract-intel`. The real problem is the second, unused-looking `k8s/` directory using a *different* namespace (`contract-intelligence`) and roughly **8x the resource requests**. If anyone applies `k8s/deployment.yaml` instead of `kubernetes/deployment.yaml` (e.g. an operator unsure which is current, or a CI step referencing the wrong path), they'd deploy into a namespace with none of the NetworkPolicy/PodSecurityStandard protections defined in `kubernetes/security-policies.yaml`, and provision ~8x the intended compute for the same workload — a direct, avoidable cost and security-drift risk.

**Fix:** Delete one of the two directories (recommend keeping the Helm chart as the single source of truth per `SYSTEM_ARCHITECTURE.md`'s own stated direction, and archiving `k8s/` and possibly `kubernetes/` raw manifests to `docs/archive/` equivalents) so there is exactly one deployable definition.

### 2.2 P1 (confirmed): Container images are not version-pinned

Across every manifest checked — `helm/contigo/values.yaml`, `helm/contigo/values-azure.yaml`, `kubernetes/deployment.yaml`, `k8s/deployment.yaml`, `docker-compose.prod.yml` (`${VERSION:-latest}` default) — the application images use the `:latest` tag. Base infra images (`node:22-alpine`, `pgvector/pgvector:pg16`, `redis:7-alpine`) are appropriately pinned to major/minor versions; the **application's own images are not**.

**Client impact:** `:latest` means there is no guarantee of what code is actually running at any point in time, no reliable rollback target if a deploy introduces a regression, and `pullPolicy: Always` (set in `values-azure.yaml`) means every pod restart can silently pull newer code — a classic cause of "it worked yesterday" incidents. **Fix:** tag images with the Git SHA or semantic version in CI (`azure-deploy.yml`) and reference that immutable tag in Helm values, promoting through environments explicitly.

### 2.3 P2 (confirmed): `publicNetworkAccess` not explicitly set on PostgreSQL

`infrastructure/azure/main.bicep`'s `postgres` resource relies on subnet delegation (`network.delegatedSubnetResourceId`) for private connectivity, but never explicitly sets `properties.network.publicNetworkAccess: 'Disabled'`. Azure's default behavior with a delegated subnet is private-only, so this is **likely not currently exploitable**, but it is an implicit rather than explicit control — a future template change (e.g. adding a firewall rule block) could silently re-enable public access without anyone noticing in review. **Fix:** set the property explicitly so the intent is visible in code and any drift is a visible diff.

### 2.4 P2 (confirmed): Secrets handling in Kubernetes is correctly templated, not exposed

`kubernetes/secrets.yaml` contains only placeholder values (`PASSWORD`, `sk-your-key`, `generate-with-openssl-rand-base64-32`) with an explicit comment warning not to commit real secrets, and both `kubernetes/secrets.yaml` and `helm/contigo/templates/secrets.yaml` support an Azure Key Vault `SecretProviderClass` path. **This is a well-designed pattern** — no finding here beyond confirming it's sound.

### 2.5 P1 (confirmed): No image / dependency vulnerability scanning in CI

Reviewed workflow files under `.github/workflows/`: `ci.yml`, `ci-cd.yml`, `strict-core.yml`, `strict-full.yml`, `lighthouse.yml`, `deploy.yml`, `azure-deploy.yml`. All run typecheck/lint, most run unit tests, `ci.yml` runs `pnpm audit` but **explicitly non-blocking** (`pnpm audit --audit-level=moderate || true`). **None of the workflows run a container image scan** (Trivy/Grype) before pushing to ACR in `azure-deploy.yml`, and **none run the E2E test suite** that exists in `apps/web/tests/` as a required gate. **Fix:** add a blocking Trivy scan step to `azure-deploy.yml` before `docker push`, and make `pnpm audit --audit-level=high` a blocking check (moderate-level non-blocking is reasonable, but High/Critical should fail the build).

### 2.6 P3: Pod Security Standard, NetworkPolicy quality is good where applied

`kubernetes/security-policies.yaml` defines a `restricted` Pod Security Standard, a least-privilege `ServiceAccount`/`Role` (only `get` on named `ConfigMap`/`Secret`), `automountServiceAccountToken: false`, and a default-deny `NetworkPolicy` with explicit allow rules for ingress-nginx, inter-pod traffic, DNS, HTTPS egress, and Postgres access restricted to named app pods. **This is genuinely good design** — the only gap is ensuring the `k8s/` duplicate ([§2.1](#21-p0-confirmed-two-parallel-conflicting-kubernetes-manifest-sets)) can't be deployed instead and bypass it.

---

## 3. Performance & Database

### 3.1 Indexing — good (verified via `packages/clients/db/schema.prisma` and migration files)

`Contract`, `Artifact`, `User`, `Embedding`, `ContractMetadata`, `TaxonomyCategory`, `ChatConversation`, and other high-traffic models all carry `@@index([tenantId])`, and `Contract` additionally has multiple composite indexes (`[tenantId, status]`, `[tenantId, createdAt desc]`, `[tenantId, expirationDate]`) matching realistic dashboard query patterns. No obvious missing-index gap was found on the models reviewed.

### 3.2 pgvector — correctly configured, one thing to monitor

`ContractEmbedding.embedding` and the `contracts.embedding` column both have `ivfflat` indexes with `vector_cosine_ops` (`packages/clients/db/migrations/006_contract_repository_optimization.sql`, `007_performance_indexes.sql`), which is the right index type for cosine-similarity RAG search. The `lists = 100` parameter is a reasonable starting point but **should be revisited as embedding row-count grows** — `ivfflat` recall/latency tradeoffs shift with table size, and there's no evidence of a scheduled `REINDEX`/list-count review job. Low-priority now; will matter as contract volume scales into the hundreds of thousands of chunks.

### 3.3 P2: One real N+1-adjacent pattern

`contract.repository.ts`'s `batchCreate()` wraps a `for` loop of individual `tx.contract.create()` (and conditionally `tx.processingJob.create()`) calls inside a single `$transaction`. This is safe (ACID-consistent) but not actually batched — it issues N round trips instead of one `createMany()` call. For bulk contract imports this will scale linearly rather than as a single query. **Fix:** use `createMany()` for the contracts, then a second `createMany()` for processing jobs, only falling back to per-row creation if per-row IDs must be threaded between the two inserts (in which case, consider having the DB generate the job rows via a single INSERT ... SELECT instead).

### 3.4 PgBouncer sizing — plausible, but worth load-testing under real Burstable-tier constraints

`docker-compose.pgbouncer.yml`: `POOL_MODE=transaction`, `MAX_DB_CONNECTIONS=100`, `DEFAULT_POOL_SIZE=50`, `MAX_CLIENT_CONN=1000`. This is a sane configuration on paper for a `Standard_B2s` (2 vCPU/4GB) Postgres instance. **However**, `Standard_B2s` is a *Burstable* SKU — its sustained performance is governed by CPU credit accumulation/consumption, not a fixed vCPU guarantee. A connection-pool size that's fine during idle/burst periods can still starve once credits are exhausted under sustained load, independent of the pool size being "correct" on paper. This is a monitoring gap, not a config gap — see [§5.1](#51-p1-confirmed-burstable-compute-tier-with-no-cpu-credit-monitoring-or-alerting).

### 3.5 Test coverage thresholds are real but low

`apps/web/vitest.config.ts` (verified): `statements: 40, branches: 30, functions: 35, lines: 40`. These are enforced (not aspirational), which is good, but they are well below what you'd want for a platform handling legally-binding contract data — industry norms for this kind of app run 70-80% on statements/lines. **This is an appropriate stepping-stone threshold for a fast-moving codebase, but should have a documented glide-path** (e.g. "+5% per quarter") rather than staying static indefinitely.

### 3.6 P2: No CI gate for E2E tests or load tests

E2E tests exist (`apps/web/tests/`) and k6 load tests exist and are well-designed (`tests/load/k6-load.js`, `tests/load/k6-stress.js`, `scripts/load-test.js` — realistic ramp profiles, p95/p99 latency thresholds, error-rate thresholds), but **none of the reviewed GitHub Actions workflows execute either suite**. They exist as manual/local tooling only. This means a regression in checkout/contract flows or a performance regression can reach `main` without being caught automatically.

---

## 4. Testing — Security-Specific Coverage

Verified test files exist for the areas that matter most:
- `apps/web/__tests__/tenant-isolation.test.ts` — cross-tenant category access tests
- `apps/web/__tests__/lib/security/tenant.test.ts` — unit tests for `tenantWhere()`, `assertTenantMatch()`, `getApiTenantId()`, `hasAccessToTenant()`
- `packages/data-orchestration/test/integration/authentication-authorization.test.ts` — auth/authz integration tests
- `apps/web/lib/integrations/__tests__/connectors.test.ts` — credential encrypt/decrypt round-trip test

**Gap:** these tests validate that the *helper functions* behave correctly in isolation. **None of them appear to be route-level integration tests that would have caught the actual vulnerable routes in [§1.1](#11-p0-confirmed-cross-tenant-data-leakage)** (`/api/search`, `/api/analytics/metrics`), because those routes bypass the helpers entirely rather than misusing them. **Recommendation:** add a test that iterates every file under `apps/web/app/api/**/route.ts` and asserts each either imports a tenant-scoping helper or is on an explicit allowlist of intentionally tenant-agnostic routes (health checks, public marketing endpoints). This turns "did we forget a route" into a CI-enforced invariant instead of a periodic manual audit.

---

## 5. Cost & Scalability

### 5.1 P1 (confirmed): Burstable compute tier with no CPU-credit monitoring or alerting

`infrastructure/azure/main.bicep` deliberately uses Burstable SKUs for both compute layers:
- AKS system node pool: `Standard_B4ms`, autoscale 2–5 nodes
- PostgreSQL Flexible Server: `Standard_B2s`

This is a reasonable cost-optimization for a pilot/early-stage deployment (explicitly commented as such in the Bicep file). The gap is operational: `kubernetes/prometheus-alerts.yaml` was not confirmed to include a CPU-credit-exhaustion alert, and Log Analytics retention is only 30 days (`retentionInDays: 30` in `main.bicep`). **Client impact:** as real (non-bursty) usage grows, the platform can degrade in latency without any autoscaling event firing (autoscaling triggers on CPU %, not credit balance) and without anyone being paged. **Fix:** add an Azure Monitor alert on the `CPU Credits Remaining` metric for both the AKS node pool and Postgres, with a threshold well above zero (e.g. alert at 20% remaining, not 0%).

### 5.2 P1: No evidence of environment-level cost governance (idle non-prod resources)

No auto-shutdown schedule, dev/staging scale-to-zero, or cost-alert budget was found referenced in `infrastructure/azure/*.bicep`, `docker-compose.staging.yml`, or the Helm values. This isn't necessarily wrong — it may be handled outside the repo via Azure Cost Management directly — but it could not be verified from the code, and is worth confirming, since the audit instructions explicitly call for treating idle non-prod spend as a cost-leak risk.

### 5.3 P2 (confirmed): Storage kept in `Hot` tier unconditionally

`main.bicep`'s `storage` resource sets `accessTier: 'Hot'` with no lifecycle policy to move aged, infrequently-accessed contract documents to `Cool`/`Cold` tiers. For a contract-archival workload (documents are read often shortly after upload, then rarely), this is very likely leaving cost savings on the table as the corpus grows. **Fix:** add a Storage Lifecycle Management policy tiering blobs older than e.g. 90 days to `Cool`.

### 5.4 P2: No per-tenant quota/throttling beyond the global rate-limit tiers

`apps/web/middleware.ts`'s rate limiting (`RATE_LIMITS` object, verified) applies **flat tiers by role** (anonymous/user/admin), not by tenant plan/size. A single tenant with unusually heavy document/AI usage is not prevented from consuming a disproportionate share of the shared Burstable DB/AKS capacity or LLM budget, which directly affects the "noisy neighbor" risk called out in the audit instructions. This is architecturally reasonable for the platform's current stage, but should be flagged as a scaling item before onboarding a large/heavy client onto shared infrastructure.

---

## 6. Documentation vs. Reality Contradictions

The audit instructions explicitly asked for skepticism toward existing `.md` files. Several were found to be materially inaccurate or stale relative to the current code:

### 6.1 Port numbers in `SYSTEM_ARCHITECTURE.md` don't match `docker-compose.prod.yml`

Doc claims Next.js on port 3005 and Fastify API on 3001. `docker-compose.prod.yml` actually maps the web service to `3000:3000` and the API service to `8080:8080`. The document appears to describe an earlier or purely local dev topology and was never updated for the production compose file.

### 6.2 SLO document promises monitoring that doesn't exist in code

`docs/SLO_SLA_DEFINITIONS.md` states: *"Synthetic monitoring: Health check every 30 seconds from multiple regions"* and *"Measurement: APM via OpenTelemetry."* Verified: `packages/workers/src/observability/opentelemetry.ts` exists but only maintains an in-memory `Map<string, Span>` with no configured exporter — there is no working OpenTelemetry pipeline, and no external synthetic-monitoring integration (Pingdom/UptimeRobot/等) was found anywhere in the codebase. This SLA document currently describes an aspirational target, not a shipped capability, and should either be corrected or the capability should be built before it's presented to clients as a commitment.

### 6.3 DATA_SECURITY.md's "zero-data-retention" claim has no corresponding code

`DATA_SECURITY.md` §2.4 states *"All AI processing uses zero-data-retention (ZDR) configurations"* and that client data is never used for model training. The actual OpenAI client wrapper (`packages/clients/openai`) instantiates the SDK with only an API key — no organization-level ZDR flag, no request-level retention opt-out parameter, and no anonymization pre-processing step were found in code. **This is not necessarily false** — ZDR is often configured at the OpenAI *organization/account* level outside of application code — but as written, the document asserts a technical guarantee this repository cannot independently verify or enforce, which is a meaningful gap for a document clients may rely on contractually. **Recommendation:** either link this claim to a verifiable, documented account-level configuration (screenshot/config export retained for audits), or soften the document's language to reflect what's actually enforced versus contractually promised.

### 6.4 Disaster-recovery/SLA promises vs. actual infrastructure

`docs/DISASTER_RECOVERY_PLAN.md` targets (per research pass, recommend a follow-up direct read to confirm exact wording) a 4-hour RTO and 1-hour RPO. The actual Bicep config (verified): `backupRetentionDays: 7`, `geoRedundantBackup: 'Disabled'`, `highAvailability.mode: 'Disabled'`, `Standard_LRS` (single-datacenter redundancy) storage. A regional Azure incident in Switzerland North under this configuration would very likely **not** be recoverable within 4 hours without geo-redundant backups to restore from, since the only backups live in the same region as the failure. This is the single most important documentation-vs-infrastructure mismatch found in this audit, because it's the one most directly tied to the client's core question — *"what happens to my data if something goes badly wrong?"* — and the honest current answer ("longer than 4 hours, and only as good as the last daily backup taken in-region") does not match what's written.

### 6.5 Prior audit reports disagree with each other and with current code

`docs/PRODUCTION_READINESS_REPORT.md` (dated Dec 21, 2025) claims "90% Ready." `docs/GAP_ANALYSIS_REPORT.md` (dated Jan 22, 2026, one month later) lists 12 P0 security issues including tenant-isolation fallbacks and a credential-key fallback. This audit independently confirms: some of those Jan 22 findings are **now fixed** (the credential-key fallback, `apps/web/app/api/activity/route.ts`'s tenant resolution — see [§1.6](#16-p1-confirmed-two-different-inconsistent-credential-encryption-implementations) and the note below), while **two of the ones described as fixed in older docs are, in this audit's direct reading, either newly introduced or never actually fixed** (`/api/search`, `/api/analytics/metrics`). The practical lesson: **treat every dated audit doc in this repo as a snapshot, not a current state** — `docs/archive/` has accumulated a large number of them, and none supersedes direct code inspection. Recommend consolidating to one continuously-updated `SECURITY_STATUS.md` rather than accumulating dated one-off reports.

*(Correction note: `apps/web/app/api/activity/route.ts`, called out in `GAP_ANALYSIS_REPORT.md` as falling back to `'default'`, was independently re-read for this audit and found to already use `getApiTenantId()`, which throws rather than silently defaulting in production — this specific historical finding appears to be already resolved.)*

---

## 7. Prioritized Remediation Roadmap

| # | Finding | Severity | Effort | Where |
|---|---|---|---|---|
| 1 | Add tenant filter + auth check to `/api/search` and `/api/analytics/metrics` | P0 | Small (2 files) | §1.1 |
| 2 | Set `REQUIRE_AUTH=true` in `kubernetes/configmap.yaml`, `helm/contigo/values.yaml`, `values-azure.yaml`; consider flipping the default to fail-closed | P0 | Small (config only) | §1.2 |
| 3 | Delete/archive one of `k8s/` or `kubernetes/` to remove conflicting manifests | P0 | Small | §2.1 |
| 4 | Replace `catch { tenantId = 'demo' }` patterns with `401` responses (`family-health`, `orphans`, and any other matches) | P1 | Small | §1.3 |
| 5 | Consolidate the two credential-encryption implementations into one | P1 | Medium | §1.6 |
| 6 | Use session-derived `tenantId` (never client-supplied) in `ai/costs` `record-usage` and audit other `body.tenantId` patterns | P1 | Small | §1.7 |
| 7 | Gate `search`/`analytics/metrics` mock-mode headers behind `ENABLE_MOCK_MODE` + `NODE_ENV`, matching the pattern already used elsewhere | P1 | Small | §1.8 |
| 8 | Pin all application container image tags (git SHA or semver); stop using `:latest` | P1 | Medium (CI change) | §2.2 |
| 9 | Add a blocking Trivy/Grype image scan and a blocking `pnpm audit --audit-level=high` to CI | P1 | Medium | §2.5 |
| 10 | Add Azure Monitor alerts on CPU-credit-remaining for AKS nodes and Postgres Burstable tier | P1 | Small | §5.1 |
| 11 | Reconcile `DISASTER_RECOVERY_PLAN.md` RTO/RPO with actual backup/HA config, or upgrade infra (geo-redundant backup at minimum) | P1 | Decision + Medium | §6.4 |
| 12 | Correct or soften `SLO_SLA_DEFINITIONS.md` and `DATA_SECURITY.md` claims that outpace current implementation (synthetic monitoring, OpenTelemetry, ZDR) | P1 | Small (docs) + Medium (if building the real thing) | §6.2, §6.3 |
| 13 | Add CI gates for E2E and load tests (currently manual-only) | P2 | Medium | §2.5, §3.6 |
| 14 | Fix `batchCreate()` to use `createMany()` instead of a per-row loop | P2 | Small | §3.3 |
| 15 | Add Storage lifecycle policy to tier aged blobs to Cool/Cold | P2 | Small | §5.3 |
| 16 | Add a CI test asserting every API route imports a tenant-scoping helper (allowlist exceptions) | P2 | Medium | §4 |
| 17 | Explicitly set `publicNetworkAccess: 'Disabled'` on the Postgres Bicep resource | P2 | Trivial | §2.3 |
| 18 | Raise coverage thresholds on a defined glide-path; document the plan | P2 | Ongoing | §3.5 |
| 19 | Add per-tenant usage quotas ahead of onboarding any large/heavy client | P2 | Medium | §5.4 |
| 20 | Consolidate the large number of dated audit/report docs into one living status doc | P3 | Medium | §6.5 |

---

## 8. What Was Confirmed Good (don't break these)

- Prisma repository layer consistently tenant-scopes queries (`contract`, `artifact`, `user`, `rate-card` repositories).
- Schema indexing strategy for `tenantId`-scoped lookups, including composite indexes matching real dashboard queries.
- `ivfflat`/`vector_cosine_ops` pgvector indexing is the correct choice for the RAG search use case.
- `kubernetes/security-policies.yaml`: restricted Pod Security Standard, least-privilege RBAC, default-deny NetworkPolicy with explicit, minimal allow rules — genuinely solid design.
- Secrets are correctly templated (no real secrets committed) with an Azure Key Vault CSI driver integration path.
- Rate limiting in `middleware.ts` is tiered by role and applied broadly via the route matcher.
- Load-testing tooling (k6 scripts) is realistic and well thought out — it just isn't wired into CI yet.
- The two most severe historically-reported P0s (credential key fallback, `activity/route.ts` tenant fallback) were independently re-verified as **already fixed**.
