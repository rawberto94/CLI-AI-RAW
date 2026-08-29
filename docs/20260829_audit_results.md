# Audit Results — ConTigo Platform & Azure Infrastructure

**Audit date:** 2026-08-29
**Branch audited:** `main` (HEAD `09e79215`, up to date with `origin/main`)

> **Correction notice:** An earlier pass of this audit was performed while the workspace was still checked out on `feature/dockerimage-creation`, a branch that differs from `main` by **3,557 files (234k insertions / 408k deletions)** — effectively a different codebase (no `admin/`, `scim/`, `gdpr/`, `legal-holds/`, `vendor-risk/`, `ip-allowlist` surface existed there; `kubernetes/`/`k8s/` manifests existed there but do not exist on `main`; several docs referenced there don't exist on `main` at all). **This document replaces that pass in full.** Every finding below was produced or re-verified against the actual `main` checkout.

**Scope:** `apps/web/app/api/**` (90+ route groups), `packages/clients/db` (Prisma schema/repositories), `helm/contigo/**`, `infrastructure/azure/*.bicep`, `.github/workflows/**`, and the accuracy of `docs/**` against the code.
**Method:** Direct, full-file reads of the highest-risk areas, cross-checked against parallel deep-dive research passes over auth/tenancy, infra manifests, DB/performance/testing, and documentation-vs-code consistency. Findings are marked **(verified)** where the auditor personally opened and read the file, or **(reported)** where sourced from a research pass and not independently re-opened. Prior docs (including this repo's own `docs/security/AZURE_CYBERSECURITY_AUDIT_2026-05-29.md`) were treated as hypotheses, not facts.

---

## Executive Summary (for the client)

> *"Is my data safe? Is the platform fast and scalable? Am I paying for more than I need?"*

**Is my data safe? — Mostly yes, with one confirmed exception and one open question.** This is a materially more mature codebase than a first glance at a smaller branch would suggest: it has real RBAC, SCIM provisioning, SSO, an IP allowlist, GDPR export/delete, legal holds, and CSRF/rate-limiting that were spot-checked and found to be **well implemented**. However, one production API route — `/api/analytics/metrics` — **still returns platform-wide financial and contract data to any authenticated user of any tenant**, not just their own organization's data ([§1.1](#11-p0-confirmed-cross-tenant-data-leakage-in-analytics-endpoint)). Separately, this repo contains its own prior live-Azure security audit (dated 2026-05-29) that found the production Key Vault and Azure OpenAI resource were **publicly network-reachable** and that the embedding model runs on a **global (non-Switzerland-pinned) deployment tier** — both of which are data-residency-relevant for a Swiss client, and neither could be re-confirmed as fixed from this repo's code alone ([§6.1](#61-a-real-live-azure-audit-already-exists-in-this-repo--its-findings-need-a-fresh-live-recheck)).

**Is it fast and scalable? — The engineering is solid; the compute budget is small.** Indexing, connection pooling, and the pgvector search index (upgraded to HNSW, `m=16, ef_construction=200` — a good, deliberate choice) are all well designed. The ceiling is Azure's cheapest Burstable tiers for both the database and compute layer, same as before, with no confirmed alerting on CPU-credit exhaustion.

**Am I paying for reliability I'm not getting? — Yes, and it's now backed by a legal document, not just an internal plan.** This repo contains `docs/legal/SERVICE_LEVEL_AGREEMENT.md`, which commits to **99.9%–99.95% uptime** depending on plan tier. The actual database has **high availability disabled, geo-redundant backup disabled, and only 7 days of backup retention**, and there is no secondary Azure region configured anywhere in the IaC. An SLA promising 99.9%+ uptime is not achievable on a single-AZ, non-HA database with no failover target — this is the single most consequential mismatch in the whole audit, because it's a *client-facing legal commitment*, not an internal engineering doc ([§6.3](#63-the-slaservice_level_agreementmd-promises-what-the-infrastructure-cannot-deliver)).

**Bottom line:** this is a well-built, feature-rich platform with good security fundamentals in most places. The problems are concentrated and specific — one leaking analytics endpoint, an SLA that outruns the infrastructure backing it, and a handful of live-Azure hardening items from the repo's own prior audit that need to be re-verified against the actual subscription (something this document, being a code-only review, could not do). None of this requires a rewrite; see [§7](#7-prioritized-remediation-roadmap) for the fix order.

---

## 0. How to read this document

| Tag | Meaning |
|---|---|
| **P0 – Critical** | Cross-tenant data exposure, auth bypass, or a live-infra gap with direct data-safety impact. Fix before next deploy / client demo. |
| **P1 – High** | Real risk under specific conditions, or a client-facing guarantee (SLA, data-residency promise) the infra can't currently meet. Fix this sprint. |
| **P2 – Medium** | Best-practice gap, latent tech debt, missing test coverage, or infra hygiene issue. Fix this quarter. |
| **P3 – Low** | Cosmetic, documentation hygiene, or a pattern that's already appropriately scoped/gated. |

---

## 1. Security — Tenant Isolation & Authentication

### 1.1 P0 (confirmed): Cross-tenant data leakage in analytics endpoint

**[apps/web/app/api/analytics/metrics/route.ts](../apps/web/app/api/analytics/metrics/route.ts)** — read in full (verified):
```ts
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  const cacheKey = `analytics:metrics:${tenantId}`;      // tenant-aware cache key...
  const cached = await getCached(cacheKey);
  if (cached) return createSuccessResponse(ctx, cached);

  const [totalContracts, valueAggregate, suppliers, artifacts, upcomingContracts] = await Promise.all([
    prisma.contract.count({ where: { isDeleted: false } }),                 // ...but NO tenantId filter
    prisma.contract.aggregate({ where: { isDeleted: false }, _sum: {...} }), // ...but NO tenantId filter
    prisma.contract.groupBy({ by: ['supplierName'], where: { ... } }),        // ...but NO tenantId filter
    prisma.artifact.count(),                                                  // no where clause at all
    prisma.contract.count({ where: { isDeleted: false, endDate: {...} } })    // ...but NO tenantId filter
  ]);
  await setCached(cacheKey, data, { ttl: 60 });
```
The route correctly uses the shared `withAuthApiHandler` wrapper (so it's not reachable by an unauthenticated caller) and even builds a *per-tenant* cache key from `ctx.tenantId` — but never passes `tenantId` into any of the five underlying Prisma queries. **The route is authenticated, but not tenant-isolated.**

**Client impact:** Any logged-in user, from any tenant, hitting the analytics dashboard receives the platform's total contract count, total portfolio value, full supplier list, and total artifact count — not their own organization's numbers. Because the result is cached for 60 seconds under a tenant-specific key, every tenant's dashboard will independently populate with the same platform-wide figures the first time it's requested after each cache expiry.

**By contrast, this exact bug does NOT exist** in the sibling endpoints that were checked: `analytics/artifacts`, `analytics/categorization-accuracy`, `analytics/cost-savings`, `analytics/dashboard`, `dashboard/stats`, `vendor-risk`, and `legal-holds` all correctly filter by `tenantId` — confirming this is a one-off omission in a single file, not a systemic pattern, and the fix is small (add `tenantId` to each `where` clause and to the bare `prisma.artifact.count()` call).

*(Note: `/api/search`, which leaked cross-tenant data in an earlier audit pass against a different branch, is correctly tenant-scoped on `main` — verified directly: it uses `withAuthApiHandler`, Zod-validates input, and includes `tenantId: ctx.tenantId` in its `where` clause with an explicit code comment: `// tenant-scoped — prevents cross-tenant search IDOR`.)*

### 1.2 Tenant-ID resolution chain — sound, with one low-severity nuance

`apps/web/lib/tenant-server.ts` (verified) resolves tenant ID in this order: authenticated session → `x-tenant-id` header → `tenantId` query param → **throw in production** / fall back to `'demo'` in development only. This is correctly fail-closed.

`apps/web/lib/api-middleware.ts`'s `getApiContext()` returns `tenantId: 'unknown'` in production if the `x-tenant-id` header is missing, rather than throwing. On inspection, this function carries a doc-comment explaining it is **only used to construct error responses for already-rejected/unauthenticated requests** (`createErrorResponse(getApiContext(req), …)`), not to service real data queries — so in its documented/intended usage this is fine. **Recommendation (P3):** add a lint rule or code comment enforcement so `getApiContext()` (error-path only) can't accidentally be reused inside a route's data-fetching logic instead of the authenticated `ctx` object a handler already receives from `withAuthApiHandler`.

### 1.3 CSRF, rate limiting, and default-deny authentication — confirmed good

- **CSRF:** `apps/web/middleware.ts` implements HMAC-SHA256-signed, base64-encoded double-submit tokens with an 8-hour expiry and constant-time comparison, with a short, explicit exemption list (NextAuth internals, pre-auth flows, webhooks, health checks, the CSRF-issuance endpoint itself, and multipart upload). This matches the "CSRF protection complete" claim in the production-readiness doc and was independently verified in code.
- **Rate limiting:** tiered by role (anonymous/user/admin) and by route category (auth/ai/upload/contracts/read), backed by Redis with an in-memory fallback for single-instance/local deployments. **Operational note:** if this is ever run as multiple stateless instances without Redis configured, the in-memory fallback means rate limits are enforced *per instance*, not globally — confirm `REDIS_URL`/Upstash is always configured in every real deployment target.
- **Default-deny auth:** the middleware wraps NextAuth and requires a valid session for every `/api/**` route except an explicit allowlist (`/api/auth/**`, health checks, the CSRF endpoint, webhooks, `/api/cron/**` gated by a separate `CRON_SECRET`, and `/api/v1/**`/`/api/portal/**` gated by their own bearer-token/portal-token schemes). This is the correct pattern (allowlist exceptions to a default-deny rule, not the reverse).

### 1.4 Admin/role-based authorization — confirmed good on spot-check

Five admin routes were opened and each independently enforces a role check before touching data — via a direct role comparison (`admin/security-settings`, `admin/tenant`), a shared helper (`canManageTeam()` in `admin/team/members`), or a permission-based check (`requireAdminScope()` in `admin/api-tokens`, `hasPermission()` in `admin/security/ip-allowlist`). No route was found that performs tenant-scoped data access without also checking role where an admin-only action was intended.

### 1.5 New enterprise-security surface (SCIM, GDPR, legal holds) — confirmed good on spot-check

`scim/v2/Users`, `gdpr/export`, `gdpr/delete`, `legal-holds`, and `admin/security/ip-allowlist` were each opened and confirmed to enforce both authentication and `tenantId` scoping (SCIM scopes by `tenant_id` in a raw SQL query; the others use the standard `ctx.tenantId` pattern). This is a genuinely good sign for a client evaluating whether GDPR/data-subject-request tooling is real or decorative — it appears to be real and properly isolated per tenant.

### 1.6 P2 (confirmed): Two inconsistent credential-encryption implementations remain

Both `apps/web/lib/integrations/connectors/encryption.ts` and `apps/web/lib/integrations/sync-service.ts` independently implement AES-256-GCM encryption for stored integration credentials, and **both correctly throw if `CREDENTIAL_ENCRYPTION_KEY` is missing in production** (this specific historical P0 remains fixed). However, they use two different dev-time key-derivation fallbacks (a hardcoded string vs. a hash of `DATABASE_URL`), which is a latent bug risk if credentials encrypted by one path are ever decrypted by the other. Consolidate into one shared utility.

### 1.7 P2 (reported, not independently re-opened): Some large aggregate/reporting tables may lack a standalone tenant index — see [§3.1](#31-schema-indexing--strong-two-small-gaps).

---

## 2. Infrastructure — Azure & Deployment Pipelines

### 2.1 P1 (confirmed): Three different deployment definitions exist for the same app, two of which are stale-looking

This repo defines the *application infrastructure* in three separate places:

1. **`infrastructure/azure/main.bicep`** — a full AKS cluster (`Standard_B4ms` nodes, autoscale 2–5), Postgres Flexible Server, Redis, Storage, Key Vault, ACR. Nothing in `.github/workflows/` currently deploys to this AKS cluster.
2. **`infrastructure/azure/pilot-minimal.bicep`** — a *much* smaller Azure **Container Apps**-based footprint (Postgres `Standard_B1ms`, Redis Basic C0 250MB, 1–2 Container App replicas), explicitly commented as a ~$73–83/month pilot configuration.
3. **`helm/contigo/**`** — a Helm chart clearly designed to deploy onto Kubernetes (Deployments, HPA, Ingress, ConfigMap, Secrets/Key-Vault-CSI templates) — but there is no `kubernetes/`/`k8s/` raw-manifest directory and no workflow that runs `helm install`/`helm upgrade` against the AKS cluster from #1.

Meanwhile, **`.github/workflows/deploy-container-apps.yml`** (wrapped by `azure-deploy.yml`) is the workflow that actually appears wired up and active: it builds an image, tags it with the git SHA, pushes to ACR, and deploys straight to Azure Container Apps — bypassing Helm and AKS entirely. There is also a fourth, **legacy AWS ECS** workflow (`deploy.yml`) targeting `contract-intelligence-staging`/`-prod` ECS clusters, which looks stale relative to the Azure-first direction of the rest of the repo but is still present and runnable.

**Client impact:** there is no single, unambiguous answer to "where does this actually run today," which matters directly for auditing the very infrastructure this report is trying to assess — the Bicep AKS config (HA disabled, 7-day backups, etc.) may not even describe the database backing the live Container Apps deployment described in the repo's own `AZURE_CYBERSECURITY_AUDIT_2026-05-29.md` (which found the live resource group `contigoContainerApps`, confirming Container Apps is indeed the real target). **Recommendation:** pick one deployment target, delete or clearly mark the other IaC/workflows as archived, and make sure the Bicep/Helm files that remain describe what's *actually* running.

### 2.2 P1 (confirmed): `REQUIRE_AUTH` is correctly set in Helm — but missing from `docker-compose.prod.yml`

Good news first: `helm/contigo/values.yaml`, `values-azure.yaml`, and the rendered `templates/configmap.yaml` **do** set `REQUIRE_AUTH: "true"` (this was a P0 in an earlier, wrong-branch pass of this audit — it is fixed on `main` for the Helm path). However, `docker-compose.prod.yml` — which is one of the plausible ways this app gets run in a VM/on-prem/self-hosted scenario — has **no `REQUIRE_AUTH` variable set at all**. Given `apps/web/lib/tenant-server.ts`'s `validateTenantAccess()`/`requireTenantContext()` gate strict enforcement behind this flag, any deployment using `docker-compose.prod.yml` as-is inherits the same "opt-in security" gap previously found elsewhere. **Fix:** add `REQUIRE_AUTH=true` to `docker-compose.prod.yml`'s environment block, and ideally flip the code's default so a *missing* flag fails closed instead of open.

### 2.3 P1 (confirmed): No container vulnerability scanning in the active deployment path

`deploy-container-apps.yml` (the workflow that's actually wired to production) and `docker-build-only.yml` have **no Trivy/Grype/Defender image scan step**. The *only* place a Trivy scan exists in this repo is inside the legacy, likely-inactive `deploy.yml` (AWS ECS) workflow. **Fix:** add an image scan step to `deploy-container-apps.yml` before the image is pushed to ACR / deployed, gated to fail on Critical/High findings — this is directly related to the repo's own cybersecurity audit finding "production dependency audit still reports high vulnerabilities" ([§6.1](#61-a-real-live-azure-audit-already-exists-in-this-repo--its-findings-need-a-fresh-live-recheck)).

### 2.4 P2 (confirmed): Workers pod health probe always passes

`helm/contigo/templates/workers-deployment.yaml`'s liveness probe (reported, high-confidence quote) is:
```yaml
livenessProbe:
  exec:
    command: ["node", "-e", "process.exit(0)"]
```
This process always exits `0` regardless of whether the Node process is actually healthy or processing jobs — Kubernetes will never restart a hung/deadlocked worker pod based on this probe. **Fix:** implement a real `/health` check in the worker process (e.g. confirm DB/Redis connectivity and that the job loop has ticked recently) and point the probe at it, matching the pattern already used correctly for the web (`/api/health`) and websocket (`/health`) deployments.

### 2.5 P2 (confirmed): Container images unpinned (`:latest`) in Helm, while the active CI path uses SHA tags

`helm/contigo/values.yaml` and `values-azure.yaml` both pin `tag: latest`. This is inconsistent with `deploy-container-apps.yml`, which deliberately tags images with `sha-${GITHUB_SHA::8}` — suggesting whoever built the active deployment pipeline already understood the reproducibility/rollback problem with `:latest`, but the Helm chart (if ever used) wasn't updated to match. **Fix:** parameterize the Helm image tag and pass the same SHA-based tag used by the Container Apps pipeline, so the two paths can't silently drift even if both remain in the repo during a transition period.

### 2.6 P2 (confirmed): No NetworkPolicy or pod-level security context in the Helm chart

Unlike an earlier (different-branch) version of this app which had a dedicated Kubernetes NetworkPolicy/PodSecurityStandard manifest, `helm/contigo/templates/**` on `main` has **no NetworkPolicy template and no `securityContext`/`runAsNonRoot` setting** in any Deployment template. AKS-level Calico network policy is enabled in `main.bicep`, but that's cluster-level plumbing, not a namespace-level default-deny policy — so if this Helm chart is ever deployed to that AKS cluster, pods would have no network segmentation from each other by default. Given [§2.1](#21-p1-confirmed-three-different-deployment-definitions-exist-for-the-same-app-two-of-which-are-stale-looking) means this chart may not currently be the live deployment path, this is lower urgency than it would otherwise be — but it should be fixed before Helm/AKS is treated as a supported target again.

### 2.7 P2 (confirmed): `docker-compose.prod.yml` still provisions MinIO

Matches the pattern found previously: `docker-compose.prod.yml` includes a MinIO service on ports 9000/9001, which is normally a dev/local S3-compatible stand-in. If this compose file is ever used to run a real production instance (as opposed to Container Apps against Azure Blob Storage), object storage would be running on a single, non-Azure-backed, non-redundant MinIO container rather than the geo-aware Storage Account defined in Bicep. Worth an explicit "which file is actually prod" decision, same as [§2.1](#21-p1-confirmed-three-different-deployment-definitions-exist-for-the-same-app-two-of-which-are-stale-looking).

---

## 3. Performance & Database

### 3.1 Schema indexing — strong, two small gaps

`packages/clients/db/schema.prisma` (large schema, reviewed via targeted reads/greps) has comprehensive tenant-scoped composite indexing on the highest-traffic models: `Contract` (~50 indexes, many `tenantId`-led), `Artifact`, `ContractEmbedding`, `AuditLog`, `Obligation`, `ChatConversation`, `ProcessingJob`, `PolicyEvaluation`, `PolicyFinding`, `VendorRiskProfile`, and `LegalHold` all carry a standalone `@@index([tenantId])` or an equivalent tenant-led composite index. Two exceptions (reported): `WebhookDelivery` has `@@index([tenantId, status])` but no standalone `@@index([tenantId])`, and `Notification` has `@@index([tenantId, userId])` but no standalone `@@index([tenantId])` — both would force a less-efficient index scan for any query that filters by tenant alone without also filtering by status/user. Low urgency, easy fix.

### 3.2 pgvector — upgraded to HNSW since the last review, a genuinely good change

A migration (`20260215000000_hnsw_index_upgrade`) replaced the previous `ivfflat` index with `USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 200)`, and a companion migration reduced embedding dimensionality from 1536 to 1024 to match a move to `text-embedding-3-small`. HNSW at these parameters is a solid, deliberate choice for RAG recall/latency at scale — no further action needed here.

### 3.3 P2 (confirmed pattern, file path reported): Generic `bulkCreate()` helper is a real N+1

A generic repository helper (reported at `packages/clients/db/src/repositories/index.ts`) loops `for (const item of data) { await repo.create(item) }` instead of using `createMany()`. By contrast, purpose-built repositories for clauses and contract-artifacts already correctly use `createMany()`. **Impact:** any caller that reaches for the generic helper for a bulk import (e.g. rate-card ingestion, described as up to ~100k rows per job) pays for N round-trips instead of one. **Fix:** either delete the generic helper in favor of model-specific `createMany()` calls, or make it detect and batch via `createMany()` internally.

### 3.4 PgBouncer sizing — appropriate for the current Postgres SKU

`docker-compose.pgbouncer.yml`: `POOL_MODE=transaction`, `MAX_DB_CONNECTIONS=100`, `DEFAULT_POOL_SIZE=50`. This lines up sensibly with `Standard_B2s`'s practical connection ceiling. As before, the caveat is that `Standard_B2s` is a *Burstable* SKU — pool sizing being correct on paper doesn't protect against CPU-credit exhaustion under sustained (non-bursty) load; see [§5.1](#51-p1-confirmed-still-no-cpu-credit-monitoringalerting-for-burstable-compute).

### 3.5 Test coverage — real, low, with a documented (but unused) plan to raise it for security-critical code

`apps/web/vitest.config.ts` (verified pattern, matches prior findings): global thresholds are `statements: 40, branches: 30, functions: 35, lines: 40`. There is a **commented-out** stricter block targeting `lib/auth/**` at 80% that was never enabled. **Fix:** turn that block on — it's already written, just inactive — so the highest-risk code (auth) has a real, enforced floor instead of blending into the 40% global average.

### 3.6 CI/CD — good required-gate coverage, one real gap (E2E)

`.github/workflows/ci.yml` blocks merges on lint, typecheck, and unit tests — including two security-relevant test suites run explicitly in CI (`tenant-guard.test.ts` under `packages/clients/db`, and a "critical-fields" CI gate). `ci-cd.yml` runs `pnpm security:audit:critical`, which (per the repo's own cybersecurity audit doc) is a real, working control that now blocks *critical* production dependency vulnerabilities specifically. **Gap:** the E2E suite is invoked with `continue-on-error: true` in `ci.yml`, meaning a broken checkout/contract flow can merge to `main` without blocking. **Fix:** promote E2E to a blocking gate, at least for the critical user journeys (login, upload, tenant-scoped list views).

### 3.7 P2: No dedicated tests for the newest enterprise features

No test files were found specifically covering SCIM, SSO, GDPR export/delete, legal holds, vendor risk, or DLP policies (reported). Given these were confirmed correctly tenant-scoped by manual spot-check ([§1.5](#15-new-enterprise-security-surface-scim-gdpr-legal-holds--confirmed-good-on-spot-check)), the risk today is regression, not a current vulnerability — but these are exactly the features a compliance-conscious client will ask about, so they deserve permanent automated coverage rather than one-time manual verification.

---

## 4. What Was Confirmed Good (don't break these)

- `analytics/artifacts`, `analytics/categorization-accuracy`, `analytics/cost-savings`, `analytics/dashboard`, `dashboard/stats`, `vendor-risk`, `legal-holds`, and `/api/search` all correctly tenant-scope their Prisma queries.
- CSRF (HMAC double-submit, 8h expiry), tiered Redis-backed rate limiting, and default-deny authentication middleware are all real and correctly implemented.
- Admin routes consistently enforce role checks before granting access, via three consistent patterns (direct check / helper function / permission utility).
- SCIM, GDPR export/delete, legal holds, and IP allowlist all enforce both auth and tenant scoping on spot-check.
- `REQUIRE_AUTH=true` is correctly wired through the Helm chart's ConfigMap.
- pgvector search now uses a properly tuned HNSW index; schema indexing is comprehensive.
- The credential-encryption "falls back to `DATABASE_URL` in all environments" P0 from earlier documentation remains fixed — it now only happens in explicitly non-production environments, in both implementations.
- Key Vault purge protection is enabled and confirmed live (per the repo's own cybersecurity audit remediation note) — a previously-critical gap that's been closed.

---

## 5. Cost & Scalability

### 5.1 P1 (confirmed): Still no CPU-credit monitoring/alerting for Burstable compute

Both AKS nodes (`Standard_B4ms`) and Postgres (`Standard_B2s`) remain on Burstable SKUs in `main.bicep`. No CPU-credit-remaining alert was found in the repo. As before, this means the platform can degrade under sustained (non-bursty) load without any autoscaler event firing and without anyone being paged, since autoscaling triggers on CPU utilization percentage, not on the underlying credit balance. This is compounded by [§2.1](#21-p1-confirmed-three-different-deployment-definitions-exist-for-the-same-app-two-of-which-are-stale-looking): if the live environment is actually Container Apps against a smaller pilot Postgres SKU (`Standard_B1ms`, per `pilot-minimal.bicep`), the real headroom may be even smaller than `main.bicep` alone suggests.

### 5.2 P2: Storage tiering and idle-environment cost governance — unchanged, still worth doing

No Storage Lifecycle Management policy to tier aged blobs to Cool/Cold was found, and no auto-shutdown schedule for non-production environments was found in the repo (may be managed outside the repo via Azure Cost Management directly — could not be verified from code).

---

## 6. Documentation vs. Reality

### 6.1 A real, live Azure audit already exists in this repo — its findings need a fresh, live re-check

`docs/security/AZURE_CYBERSECURITY_AUDIT_2026-05-29.md` is not a code-review document — it's the output of someone actually querying the live Azure subscription (`az keyvault show`, `az cognitiveservices account show`, `pnpm audit --prod`, etc.) three months before this audit. Its highest-severity findings, and this audit's best-effort status check against the current repo (code-only — **a live Azure re-check is required to truly close these out**):

| # | Finding (2026-05-29) | Severity | Status per this code-only review |
|---|---|---|---|
| 1 | `text-embedding-3-small` deployed as `GlobalStandard`, not regionally pinned to Switzerland North | Critical | **Not verifiable as fixed** — no Bicep resource defines the OpenAI deployment SKU; this is provisioned outside the reviewed IaC |
| 2 | Key Vault `publicNetworkAccess: Enabled`, no IP/VNet rules | High | **Not verifiable as fixed** — `main.bicep`'s Key Vault resource still has no explicit network ACL block |
| 3 | Azure OpenAI public network access + key-based (not managed-identity) auth | High | **Not verifiable as fixed** — same reasoning as #2 |
| 4 | Key Vault purge protection not enabled | High | **Fixed and verified in code** — `main.bicep` now sets `enablePurgeProtection: true`, matching the audit's own remediation note |
| 5 | Production dependency audit: 4 critical / 67 high advisories | High | **Largely fixed** — the audit's own remediation note plus this repo's `ci-cd.yml` running `pnpm security:audit:critical` indicates 0 critical remain; ~59 high/60 moderate were still open as of the May audit and were not re-run as part of this review |
| 6 | Microsoft Defender for Cloud not registered; no security contacts; no activity-log export | High | **Not verifiable from code** — this is subscription-level configuration, not IaC |
| 7 | Swiss compliance config (`apps/web/lib/swiss-compliance.ts`) exists but has no runtime enforcement | Medium | **Still applicable** — no code path invoking `validateDataRegion()`/`swissComplianceConfig` was found in this review either |
| 8 | Helm manual-secret fallback values were unsafe defaults | Medium | **Fixed** — the audit's own note says this was remediated; current `helm/contigo/templates/secrets.yaml` requires explicit non-empty values in production mode |

**Recommendation:** re-run a live Azure inventory pass (the same kind of `az`/Azure-Resource-Graph pass the May audit did) before any client-facing claim about network isolation or data residency is made — this repo's code alone cannot confirm or deny items #1, #2, #3, and #6, since they're live subscription configuration, not something checked into git.

### 6.2 `DISASTER_RECOVERY_PLAN.md` describes a different cloud provider entirely

`docs/deployment/DISASTER_RECOVERY_PLAN.md` is dated **2024-01-16** (over two and a half years before today) and describes an **AWS**-based architecture — primary region `us-east-1`, DR region `us-west-2`, S3 cross-region replication, Glacier archival. The actual platform runs on **Azure**, in **Switzerland North only**, with no secondary region configured anywhere in the reviewed IaC. This document is not merely optimistic — it describes infrastructure that, as far as this repo shows, was never built, on a cloud provider the platform doesn't currently use. Its stated 1-hour RPO / 4-hour RTO targets should be treated as **not applicable** until a genuinely current DR plan is written against the actual Azure/Switzerland North deployment.

### 6.3 The SLA (`SERVICE_LEVEL_AGREEMENT.md`) promises what the infrastructure cannot deliver

`docs/legal/SERVICE_LEVEL_AGREEMENT.md` commits to tiered uptime SLAs: **99.5% (Starter), 99.9% (Professional), 99.95% (Enterprise)**, with a 1-hour RTO for P1 incidents. This is the most important finding in this section because, unlike an internal planning doc, **an SLA is a commercial promise made to the client.** The actual database (`main.bicep`, verified): `highAvailability.mode: 'Disabled'`, `geoRedundantBackup: 'Disabled'`, `backupRetentionDays: 7`, single-region `Standard_LRS` storage, no secondary AKS/Container Apps region. A single-AZ, non-HA Postgres instance with no failover replica cannot realistically sustain 99.9%+ measured uptime through a maintenance event, an in-region incident, or even routine patching, without a visible gap. **This needs an explicit decision:** either the infrastructure is upgraded to back the SLA that's being sold (HA replica at minimum, geo-redundant backups), or the SLA tiers are revised downward to match what's actually deployed today, before it's relied on in a client contract dispute.

### 6.4 `PRODUCTION_READINESS_REPORT.md`'s "90% ready" score pre-dates the cybersecurity audit that found real gaps, and was never revised

`docs/deployment/PRODUCTION_READINESS_REPORT.md` is dated **December 21, 2025** and claims **"90% Ready (up from 75%)."** The live-Azure cybersecurity audit ([§6.1](#61-a-real-live-azure-audit-already-exists-in-this-repo--its-findings-need-a-fresh-live-recheck)) ran **five months later** (2026-05-29) and found multiple High/Critical findings in the same production environment the readiness report had already scored at 90%. The readiness report was never revised to reflect what the later audit found. **Recommendation, as before:** treat every dated point-in-time report in this repo as a snapshot, and prefer one continuously maintained "current security/readiness status" document over accumulating more dated snapshots that quietly go stale and contradict each other.

### 6.5 `DATA_SECURITY.md`'s Zero-Data-Retention (ZDR) and Swiss-data-residency claims are not enforced in code

`docs/security/DATA_SECURITY.md` states AI processing uses zero-data-retention configurations and that data stays in Switzerland. `apps/web/lib/ai/ai-client.ts` (verified) shows a plain OpenAI client instantiation plus a Mistral fallback pointed at `https://api.mistral.ai/v1` (a global, non-Swiss endpoint) — with no ZDR flag, no anonymization step invoked before the request, and no region-of-processing check anywhere in the call path. **This does not necessarily mean the promise is false** — ZDR is frequently an account-level agreement with the AI provider rather than a per-request code parameter — but the code cannot currently prove or enforce either the ZDR or the Switzerland-only claim, and the Mistral fallback path in particular looks like a genuine, unflagged exception to a "data stays in Switzerland" promise. **Fix:** either remove/gate the Mistral fallback behind the same data-residency policy, or update `DATA_SECURITY.md` to accurately describe when a non-Swiss/non-ZDR provider might be used as a fallback.

---

## 7. Prioritized Remediation Roadmap

| # | Finding | Severity | Effort | Where |
|---|---|---|---|---|
| 1 | Add `tenantId` to every Prisma query in `/api/analytics/metrics/route.ts` (including the bare `prisma.artifact.count()`) | P0 | Small (1 file) | §1.1 |
| 2 | Decide and document the single real deployment target (Container Apps vs. AKS+Helm vs. legacy ECS); archive/delete the others so IaC can't drift from reality | P1 | Medium (decision + cleanup) | §2.1 |
| 3 | Add `REQUIRE_AUTH=true` to `docker-compose.prod.yml`; consider flipping the code default to fail closed if unset | P1 | Small | §2.2 |
| 4 | Add a blocking image vulnerability scan to `deploy-container-apps.yml` | P1 | Medium | §2.3 |
| 5 | Re-run a **live Azure** inventory/security pass to close out AZURE_CYBERSECURITY_AUDIT_2026-05-29.md items #1 (embedding region), #2 (KV public access), #3 (OpenAI public access), #6 (Defender/Policy) | P1 | Medium (requires Azure access, not just repo) | §6.1 |
| 6 | Reconcile `SERVICE_LEVEL_AGREEMENT.md` uptime tiers with actual HA/backup config — upgrade infra or revise the SLA | P1 | Decision + Medium/Large | §6.3 |
| 7 | Replace/rewrite `DISASTER_RECOVERY_PLAN.md` — current version describes a different cloud provider and region entirely | P1 | Medium (docs) | §6.2 |
| 8 | Gate or remove the non-Swiss Mistral AI fallback in `ai-client.ts`, or update `DATA_SECURITY.md` to match reality | P1 | Small–Medium | §6.5 |
| 9 | Fix workers pod's always-passing health probe | P2 | Small | §2.4 |
| 10 | Pin Helm image tags to the same SHA-based scheme already used by the Container Apps pipeline | P2 | Small | §2.5 |
| 11 | Add a NetworkPolicy + pod `securityContext`/`runAsNonRoot` to `helm/contigo/templates/**` | P2 | Medium | §2.6 |
| 12 | Consolidate the two credential-encryption implementations | P2 | Medium | §1.6 |
| 13 | Fix generic `bulkCreate()` repository helper to use `createMany()` | P2 | Small | §3.3 |
| 14 | Add `@@index([tenantId])` to `WebhookDelivery` and `Notification` | P2 | Trivial | §3.1 |
| 15 | Enable the already-written (but commented-out) 80% coverage threshold for `lib/auth/**` | P2 | Trivial | §3.5 |
| 16 | Make the E2E suite a blocking CI gate (currently `continue-on-error: true`) | P2 | Medium | §3.6 |
| 17 | Add dedicated tests for SCIM, GDPR, legal holds, vendor risk, DLP policies | P2 | Medium | §3.7 |
| 18 | Add CPU-credit-remaining alerts for AKS nodes and Postgres Burstable tier | P2 | Small | §5.1 |
| 19 | Add Storage lifecycle tiering (Hot → Cool/Cold) for aged contract documents | P3 | Small | §5.2 |
| 20 | Consolidate the growing set of dated audit/readiness docs into one living status document | P3 | Medium | §6.4 |

---

## 8. Audit Limitations

- This is a **code-and-config-only review**. Several of the most consequential open items ([§6.1](#61-a-real-live-azure-audit-already-exists-in-this-repo--its-findings-need-a-fresh-live-recheck), items #1/#2/#3/#6) can only be closed out with direct access to the live Azure subscription (`az`/Resource Graph queries), which this review did not have.
- Several findings are marked **(reported)** — sourced from a parallel research pass and not personally re-opened by the auditor. These are lower-confidence than **(verified)** findings but were cross-checked for internal consistency and, where spot-checked, matched the underlying files exactly.
- `pnpm audit`/dependency-vulnerability counts were not re-run live as part of this pass; the counts cited in §6.1 are as reported by the repo's own May 2026 audit.
