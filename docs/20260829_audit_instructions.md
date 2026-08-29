# Full-Stack & Azure Infrastructure Audit — Instructions

**Date:** 2026-08-29
**Prepared for:** ConTigo / PactumAI Contract Intelligence Platform
**Audit lens:** *"I am an external client. I need my contract data to be safe, private, and recoverable — but I also expect the platform to be fast, to scale under load, and to be run at a cost that doesn't get passed on to me as unnecessary fees."*

This document is a **checklist and methodology for auditors** (human or AI agents) reviewing this repository and its Azure deployment (`infrastructure/azure/`, `kubernetes/`, `helm/`). It does not contain findings — it defines *what* to audit, *how* to audit it, and *what evidence/output* each audit should produce. Findings should be written up separately (e.g. `YYYYMMDD_audit_findings.md`) using the severity scale in [§0](#0-severity-scale--reporting-format).

---

## 0. Severity Scale & Reporting Format

Every finding produced from this audit must be classified consistently with prior audits in `docs/archive/` (e.g. `COMPREHENSIVE_AUDIT_REPORT.md`, `GAP_ANALYSIS_REPORT.md`):

| Severity | Definition | SLA to fix |
|---|---|---|
| **P0 / Critical** | Data breach risk, cross-tenant data leakage, auth bypass, secret exposure, total outage risk | Immediately, block release |
| **P1 / High** | Exploitable but requires specific conditions; significant perf/cost/reliability risk | This sprint |
| **P2 / Medium** | Best-practice deviation, latent tech debt, missing tests | This quarter |
| **P3 / Low** | Cosmetic, minor optimization, documentation gap | Backlog |

Each finding must include: **file/path evidence**, **reproduction/verification steps**, **client-impact statement** (what happens to *their* data/uptime/bill), and **recommended fix**.

Before starting, skim these existing artifacts so the audit doesn't duplicate known work — verify whether previously reported issues are actually fixed, rather than re-discovering them:
- [docs/GAP_ANALYSIS_REPORT.md](../docs/GAP_ANALYSIS_REPORT.md) — tenant isolation fallbacks, credential-key fallback, missing auth on API routes, mock data in prod paths
- [docs/PRODUCTION_READINESS_REPORT.md](../docs/PRODUCTION_READINESS_REPORT.md)
- [docs/archive/TENANT_ISOLATION_AUDIT_REPORT.md](../docs/archive/TENANT_ISOLATION_AUDIT_REPORT.md), `docs/archive/TENANT_ISOLATION_FINAL_STATUS.md`, `docs/archive/TENANT_ISOLATION_GAPS_FIX.md`
- [docs/SLO_SLA_DEFINITIONS.md](../docs/SLO_SLA_DEFINITIONS.md), `docs/DISASTER_RECOVERY_PLAN.md`, `docs/INCIDENT_RUNBOOKS.md`
- [DATA_SECURITY.md](../DATA_SECURITY.md) — the promises made to clients about data ownership and Swiss FADP/GDPR compliance
- `scripts/audit-tenant-isolation.sh`, `scripts/security-scan-simple.ps1`, `scripts/verify-production-readiness.ps1` — run these first, they may already surface issues

---

## 1. Security Audit (highest priority — this is what the client is actually paying to trust you with)

### 1.1 Multi-tenant data isolation
- [ ] Grep every API route under `apps/web/app/api/**` for tenant-fallback anti-patterns: `'demo'`, `'default'`, `?? 'demo'`, `getDefaultTenantId`. Any route that can resolve a tenant ID without a validated session is a **P0**.
- [ ] Confirm every Prisma query in `packages/clients/db/` and `apps/web/lib/**` includes an explicit `tenantId` (or organization scope) filter — no "trust the caller" queries.
- [ ] Confirm row-level security or query-layer isolation can't be bypassed via IDOR (e.g. requesting `/api/contracts/[id]` for a contract owned by another tenant).
- [ ] Check that background workers (`packages/workers/`) and the data-orchestration API (`packages/data-orchestration/`) enforce the same tenant scoping as the web app — async jobs are a common place isolation is forgotten.
- [ ] Re-run `scripts/audit-tenant-isolation.sh` and diff results against `docs/archive/TENANT_ISOLATION_FINAL_STATUS.md`.

### 1.2 AuthN / AuthZ
- [ ] Enumerate all routes in `apps/web/app/api/**/route.ts` and confirm each has an explicit auth check (session/JWT validation) before touching data — cross-reference against the "Missing Authentication" list in `docs/GAP_ANALYSIS_REPORT.md`.
- [ ] Verify `middleware.ts` (CSRF, rate limiting) actually covers all mutating routes, not just a subset.
- [ ] Check role/permission checks for admin-only endpoints (tenant management, user management, billing) — confirm a regular user cannot escalate.
- [ ] Verify session cookies are `HttpOnly`, `Secure`, `SameSite=strict/lax`, and JWTs (if used) have short expiry + refresh rotation.

### 1.3 Secrets & credential management
- [ ] Confirm `CREDENTIAL_ENCRYPTION_KEY` (and any other required secret) has **no fallback** to a derivable value like `DATABASE_URL` — must throw at startup if missing (`apps/web/lib/integrations/credential-manager.ts`).
- [ ] Confirm no secrets are committed to the repo (scan `.env*`, `docker-compose*.yml`, `kubernetes/secrets.yaml`, `helm/contigo/` values files, `infrastructure/azure/parameters.prod.json`).
- [ ] Confirm production secrets flow through **Azure Key Vault** (`infrastructure/azure/main.bicep` provisions this) via the AKS CSI Secrets Store driver, not plain Kubernetes `Secret` objects checked into git.
- [ ] Confirm `enableRbacAuthorization` and `enableSoftDelete` are on for Key Vault (already true in `main.bicep`) and that access policies follow least privilege (only the AKS kubelet identity + specific pipeline SPNs).
- [ ] Verify third-party API keys (OpenAI, SendGrid, storage) are scoped/rotated and not shared across dev/staging/prod.

### 1.4 Encryption
- [ ] In transit: confirm TLS is enforced everywhere — ingress (`kubernetes/ingress.yaml`), Postgres (`sslmode=require`), Redis (`enableNonSslPort: false`, `minimumTlsVersion: '1.2'` — verify in `main.bicep`), Storage (`supportsHttpsTrafficOnly: true`).
- [ ] At rest: confirm Azure Storage, PostgreSQL Flexible Server, and Redis have encryption-at-rest enabled (Azure default, but verify no overrides disable it) and that blob container `contracts` is truly private (`publicAccess: 'None'`, `allowBlobPublicAccess: false`).
- [ ] Confirm application-level encryption for especially sensitive fields (financial terms, PII) beyond disk encryption, consistent with claims in `DATA_SECURITY.md` §5.

### 1.5 Application security (OWASP Top 10)
- [ ] Injection: confirm Prisma parameterizes all queries; grep for any raw SQL (`$queryRaw`, `$executeRaw`) and verify inputs are sanitized/parameterized, not string-concatenated.
- [ ] XSS: verify `lib/xss.ts` sanitization is applied to all user-generated content rendered in the UI (contract text, chatbot output, comments).
- [ ] CSRF: verify `middleware.ts` CSRF protection covers all state-changing routes, including file upload and webhook endpoints.
- [ ] SSRF: check any server-side URL fetch (webhooks, integrations, OCR/document fetch) validates/allowlists destination hosts.
- [ ] File upload: verify `apps/web` upload endpoints validate file type/size/content (not just extension), scan for malware if feasible, and store uploads in the private blob container, never in a publicly served path.
- [ ] Dependency vulnerabilities: run `pnpm audit` (or `npm audit` per `docs/DEPLOYMENT_CHECKLIST.md`) and a container scan (Trivy/Grype) against images built from `Dockerfile`, `Dockerfile.production`, `Dockerfile.workers`, `Dockerfile.websocket`; flag anything High/Critical with a known exploit.
- [ ] Security headers: confirm `lib/security-headers.ts` sets CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`.
- [ ] Rate limiting: confirm it's applied per-tenant/per-IP on auth endpoints, AI/LLM endpoints (cost-sensitive), and file upload endpoints to prevent abuse.

### 1.6 Kubernetes / cluster security
- [ ] Confirm `kubernetes/security-policies.yaml` restricted Pod Security Standard is actually enforced on the namespace used in production (not just defined but unapplied).
- [ ] Confirm `automountServiceAccountToken: false` and least-privilege RBAC `Role`/`RoleBinding` match what's in `kubernetes/security-policies.yaml`.
- [ ] Confirm default-deny NetworkPolicy exists and only required ingress/egress paths (DB, Redis, storage, LLM API egress) are explicitly allowed.
- [ ] Confirm images are pulled from ACR (`main.bicep` `acrName`) with immutable tags (not `:latest`) and image pull secrets/ACR admin credentials are rotated (Basic ACR SKU has `adminUserEnabled: true` — verify this isn't the primary auth path; prefer managed identity + AcrPull role, which is already granted).
- [ ] Confirm AKS control plane and node OS are on a supported/patched Kubernetes version (bicep pins `1.28` — check current support window and patch cadence).

### 1.7 Network security (Azure)
- [ ] Review `infrastructure/azure/main.bicep` VNet/subnet layout: confirm AKS and data subnets are properly segmented, and Postgres is only reachable via the delegated `snet-data` subnet (private, not public endpoint).
- [ ] Confirm no resource has a public IP / public network access enabled unless explicitly required (check Postgres `network.publicNetworkAccess`, Redis firewall rules, Storage account network rules).
- [ ] Confirm NSGs restrict inter-subnet traffic to only necessary ports.
- [ ] Confirm ingress (`kubernetes/ingress.yaml`) terminates TLS with a valid, auto-renewing certificate (cert-manager / Let's Encrypt or Azure-managed cert) and enforces HTTPS redirect.

### 1.8 Compliance & data governance (Swiss FADP / GDPR)
- [ ] Confirm region pinning: all data-plane resources in `main.bicep` use `switzerlandnorth` (data residency promise in `DATA_SECURITY.md`) — check no dependent service (e.g. LLM provider, email provider, CDN) silently processes data outside CH/EU.
- [ ] Verify data subject rights are actually implemented, not just documented: data export endpoint, data deletion endpoint, and confirm deletion is a real hard-delete (or crypto-shred) within the promised 30-day window from `DATA_SECURITY.md` §2.3.
- [ ] Verify AI processing uses zero-data-retention configuration with the LLM provider (per `DATA_SECURITY.md` §2.4) — check actual API calls/config in `packages/agents` or `packages/clients` for retention/training flags.
- [ ] Confirm audit logging (`docs/archive/AUDIT_LOG_DASHBOARD_IMPLEMENTATION.md`) captures who accessed/modified what data and is itself tamper-resistant and retained appropriately.
- [ ] Confirm a signed Data Processing Agreement (DPA) template exists and matches actual system behavior (don't let legal promises outpace implementation, or vice versa).

---

## 2. Performance Audit

### 2.1 Database
- [ ] Review query patterns in `packages/clients/db` repositories for N+1 queries, missing `select`/`include` scoping, and unindexed filters. Cross-check against `schema.prisma` indexes.
- [ ] Confirm PgBouncer (`docker-compose.pgbouncer.yml`, referenced in `docs/PRODUCTION_READINESS_REPORT.md`) is deployed in prod with pool size tuned to actual Postgres `Standard_B2s` capacity — a 50-connection pool against a Burstable 2 vCPU/4GB instance can starve CPU credits under load; verify with real load data, not just config presence.
- [ ] Confirm pgvector similarity search queries (RAG/embeddings) use an appropriate index (`ivfflat`/`hnsw`) and aren't doing full sequential scans as the embeddings table grows.
- [ ] Load-test realistic query volumes and capture P50/P95/P99 latency; compare against `docs/SLO_SLA_DEFINITIONS.md` targets.

### 2.2 API / backend
- [ ] Run `scripts/load-test.js` (k6) and `scripts/run-load-tests.ps1` against staging; record throughput, error rate, and latency percentiles under 1x/5x/10x expected concurrent tenants.
- [ ] Identify synchronous long-running operations (document parsing, OCR, embedding generation, AI report generation) that block request threads instead of being queued to `packages/workers`.
- [ ] Confirm caching (Redis) is used for expensive/frequent reads (dashboards, analytics) with sane TTLs and cache-invalidation on writes — check `maxmemory-policy: allkeys-lru` on the Basic Redis tier is appropriate given eviction risk under memory pressure.
- [ ] Confirm pagination is enforced on all list endpoints (contracts, audit logs, activity feed) — unbounded queries are both a perf and cost risk.

### 2.3 Frontend
- [ ] Run Lighthouse/Web Vitals against key pages (dashboard, contract detail, chatbot) — reference `lighthouserc.json` thresholds already configured.
- [ ] Check bundle size and code-splitting in `apps/web` (Next.js) — flag any large synchronous imports of heavy libs (`pdf-parse`, `mammoth`, `jspdf`, `pptxgenjs`) into client bundles that should be server-only.
- [ ] Confirm images/static assets are served via CDN (`docs/CDN_CONFIGURATION.md`) with proper caching headers.
- [ ] Verify streaming/incremental rendering is used for the AI chatbot instead of blocking on full completion.

### 2.4 AI/LLM cost & latency
- [ ] Audit token usage per request (system prompts, RAG context size) — oversized prompts are a direct, recurring client cost.
- [ ] Confirm timeouts/retries/circuit breakers exist around LLM calls so a slow provider doesn't cascade into platform-wide latency.
- [ ] Confirm response caching or semantic caching is used for repeated/similar queries where safe.

### 2.5 Infrastructure sizing vs. load
- [ ] Cross-reference AKS node pool (`Standard_B4ms`, autoscale 2–5) and Postgres (`Standard_B2s` Burstable) against actual/expected concurrent tenant load. Burstable CPU credit exhaustion under sustained load is a real risk for a client-facing "fast" promise — verify CPU credit metrics in Azure Monitor, not just autoscaler activity.
- [ ] Confirm HPA (Horizontal Pod Autoscaler) is configured for the web/API deployments in `kubernetes/deployment.yaml`, not just cluster-level node autoscaling.

---

## 3. Testing & Quality Assurance Audit

- [ ] Verify actual coverage against configured thresholds in `apps/web/vitest.config.ts` (Statements 40%/Branches 30%/Functions 35%/Lines 40% per `docs/PRODUCTION_READINESS_REPORT.md`) — confirm these are enforced in CI, not just aspirational.
- [ ] Confirm critical paths have coverage above the global minimum: authentication, tenant isolation, payment/billing (if any), data deletion, encryption/decryption of credentials.
- [ ] Review `tests/load/` and `apps/web/tests/` (e2e) for realistic multi-tenant scenarios, not just happy-path single-tenant tests.
- [ ] Confirm CI pipeline (check `.github/` workflows if present, or `turbo.json` pipeline) runs: typecheck (`pnpm typecheck`), lint, unit tests, e2e tests, `pnpm audit`, and container scan on every PR before merge to main/release branch.
- [ ] Confirm there is a rollback-tested migration path: `scripts/db-rollback.sh` should be exercised (not just exist) as part of a staging deployment drill.
- [ ] Confirm no mock-data code paths (`generateMockTraces`, `x-data-mode: mock`, hardcoded fallback responses) can be triggered in production builds — verify via environment-gated flags and a build-time assertion, not just convention.
- [ ] Confirm chaos/failure testing exists for dependency outages (DB connection loss, Redis down, LLM provider timeout) — verify graceful degradation rather than 500s or data corruption.

---

## 4. Reliability, Stability & System Longevity

### 4.1 Availability & resilience
- [ ] Confirm `highAvailability: 'Disabled'` on Postgres and single-instance Basic-tier Redis (both currently cost-optimized, per `main.bicep`) are an explicit, documented risk tradeoff — not an oversight. If the client-facing SLA promises uptime beyond what a single-AZ, no-failover DB/cache can support, flag this as a **P1 mismatch between marketing/SLA and infrastructure**.
- [ ] Verify health probes (`/api/monitoring/health`, liveness/readiness) are wired into `kubernetes/deployment.yaml` so AKS actually restarts/reschedules unhealthy pods.
- [ ] Confirm graceful shutdown handling (SIGTERM) drains in-flight requests/jobs before pod termination — check workers especially, to avoid losing queued document-processing jobs.
- [ ] Review `docs/DISASTER_RECOVERY_PLAN.md` and confirm RTO/RPO targets are realistic given `backupRetentionDays: 7` and `geoRedundantBackup: 'Disabled'` on Postgres, and `Standard_LRS` (locally redundant, single-datacenter) storage. For a client trusting you with legally binding contracts, **regional data loss is a P0-level business risk** even if statistically rare — confirm this tradeoff is a conscious, documented decision with client sign-off, or recommend upgrading to at least `ZRS`/geo-redundant backups.
- [ ] Confirm automated backup restore has been tested end-to-end at least once (`scripts/restore.sh`) with a documented result, not just assumed to work.

### 4.2 Observability
- [ ] Confirm Prometheus metrics, Grafana dashboards (`kubernetes/grafana-dashboard.json`), and alert rules (`kubernetes/prometheus-alerts.yaml`) cover: error rate, latency percentiles, DB connection saturation, queue depth for workers, and disk/memory pressure.
- [ ] Confirm alerts route to a real on-call channel (email/Slack/PagerDuty) and `adminEmail` in `main.bicep` is monitored, not a dead mailbox.
- [ ] Confirm Log Analytics retention (`retentionInDays: 30`) is sufficient for incident forensics and any compliance requirement — 30 days may be too short for audit-log/compliance evidence; check against `DATA_SECURITY.md` and legal requirements.

### 4.3 Maintainability & tech debt
- [ ] Review dependency freshness across `package.json`, `pnpm-lock.yaml`, and workspace packages (`packages/*`) — flag major-version-behind or unmaintained/deprecated packages, especially security-relevant ones (auth, crypto, parsing libs like `pdf-parse`, `mammoth`).
- [ ] Confirm TypeScript strictness (`tsconfig.base.json`) and that `pnpm typecheck` is clean (zero errors) — check `docs/archive/TYPE_SAFETY_TRACKER.md` for outstanding debt and re-verify current status.
- [ ] Check for architectural drift: does the monorepo boundary between `apps/web`, `packages/agents`, `packages/workers`, `packages/data-orchestration` still reflect clean separation of concerns, or has logic leaked across boundaries in ways that will slow future changes?
- [ ] Confirm Infrastructure-as-Code (`infrastructure/azure/*.bicep`, `helm/contigo/`, `kubernetes/*.yaml`) is the actual source of truth for what's deployed — check for configuration drift (manual `kubectl`/portal changes not reflected in IaC).
- [ ] Confirm `docs/` isn't the only source of architectural truth — flag where documentation has clearly gone stale relative to code (e.g. ports, service names, env vars referenced in `SYSTEM_ARCHITECTURE.md` vs actual current config).

---

## 5. Cost & Scalability Audit (the "low cost, fast, scalable" client expectation)

- [ ] Pull actual Azure Cost Management data for the last 30/90 days per resource group (`rg-contigo-{env}`) and map spend to each resource in `main.bicep`. Identify idle/oversized resources (e.g. non-prod environments left running 24/7, orphaned disks/snapshots from `scripts/backup.sh`).
- [ ] Verify autoscaling bounds (`minCount: 2, maxCount: 5` for AKS system pool) are based on real traffic data, not guesses — check whether the pool has ever scaled to max (undersized) or never left minimum (oversized).
- [ ] Evaluate whether Burstable SKUs (`Standard_B2s` Postgres, `Standard_B4ms` AKS nodes) are still appropriate as tenant count grows, or whether the platform is silently throttling on CPU credits during peak hours (correlate Azure Monitor CPU credit metrics with user-reported slowness).
- [ ] Confirm storage tiering: contract documents accessed infrequently after initial processing could move from `Hot` to `Cool`/`Cold` tier for cost savings — check `accessTier: 'Hot'` in `main.bicep` against actual access patterns.
- [ ] Confirm ACR Basic tier's lack of geo-replication/vulnerability scanning isn't a blocker as the platform scales to more regions or requires compliance-grade image scanning — evaluate whether ACR Standard/Premium is now justified.
- [ ] Confirm no compute is billed for idle staging/dev environments outside business hours (auto-shutdown schedules) — check `docker-compose.staging.yml`, `Dockerfile.staging`, and whether staging AKS/DB resources scale down or are ephemeral.
- [ ] Model the cost curve: at 2x, 5x, 10x current tenant count, which resource hits its ceiling first (DB CPU, Redis memory, AKS node count, storage egress)? Document the next tier upgrade path and its cost so scaling is a *planned* expense, not a *reactive fire*.
- [ ] Confirm there's no single-tenant "noisy neighbor" risk — a heavy tenant (large document volume, heavy AI usage) shouldn't be able to degrade performance or inflate cost for all other tenants without per-tenant quotas/throttling.

---

## 6. Best Practices & Process Audit

- [ ] Confirm secrets/config management follows 12-factor principles — no environment-specific logic branching in application code (`if (env === 'prod')` scattered around) instead of config injection.
- [ ] Confirm PR/branch protection rules require review + passing CI before merge to protected branches.
- [ ] Confirm `docs/DEPLOYMENT_CHECKLIST.md` is actually followed for the most recent production deployment (spot-check against deployment history/commit log).
- [ ] Confirm error handling doesn't leak stack traces, SQL, or internal paths to clients in API error responses (check a sample of error responses in non-happy-path testing).
- [ ] Confirm structured logging avoids logging PII/secrets (contract content, credentials, tokens) in plaintext logs that might flow to Log Analytics or a third-party log sink.
- [ ] Confirm `docs/` sprawl (90+ files in `docs/archive/`) doesn't hide the *current* authoritative source for any given topic — recommend consolidating conflicting/duplicate docs (multiple audit reports, multiple gap analyses) so future audits start from one source of truth.

---

## 7. Audit Execution Checklist (order of operations)

1. **Automated scans first** (cheap, fast, objective):
   - `pnpm audit` / dependency scan
   - Container image scan (Trivy/Grype) on all `Dockerfile*`
   - IaC scan (checkov/tfsec-equivalent for Bicep, `kube-score`/`kubesec` for `kubernetes/*.yaml`)
   - `scripts/security-scan-simple.ps1`, `scripts/audit-tenant-isolation.sh`, `scripts/verify-production-readiness.ps1`
2. **Static/manual code review** using §1–§4 checklists above, prioritizing P0 security items (tenant isolation, secrets, auth).
3. **Dynamic testing**: load tests (`scripts/load-test.js`), Lighthouse, manual penetration-style probing of auth/tenant-boundary endpoints (with authorization from the workspace owner before any live-environment testing).
4. **Infrastructure review**: read through `infrastructure/azure/main.bicep` line-by-line against §1.6/§1.7/§5, then confirm the deployed Azure resources actually match the Bicep (no drift).
5. **Cost review**: pull real Azure Cost Management / Advisor recommendations and reconcile with §5.
6. **Write findings** using the format in [§0](#0-severity-scale--reporting-format), grouped by severity, each with a client-impact sentence written in plain language (e.g. *"An attacker who compromises one tenant's session could read another tenant's contracts"* rather than just "IDOR risk").
7. **Summarize for the client**: a short top-of-report section answering, in plain language: *Is my data safe? Is the system fast enough for my usage? Will it scale if my usage grows 10x? Am I paying for capacity I don't need?*

---

## 8. Definition of Done

The audit is complete when every checkbox above has either a ✅ verified-good result, or a filed finding with severity, evidence, and recommended fix — and the summary in §7.7 can be answered confidently and honestly to a client.
