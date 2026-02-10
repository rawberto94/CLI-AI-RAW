# API Route Audit — `/apps/web/app/api/`

**Date:** 2026-02-08  
**Total top-level directories:** 75  
**AI sub-routes:** 39

---

## 1. EXAMPLE/TEST ROUTES — DELETE ALL

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/example-data-consistency` | Demo of optimistic locking/data consistency services | **DELETE** | Explicitly labeled "Example API Route" — tutorial code, 197 lines |
| `/api/example-secure-route` | Demo of security middleware (validation, rate-limiting) | **DELETE** | Explicitly labeled "Example Secure API Route" — tutorial code, 200 lines |
| `/api/test/send-email` | Admin-only test endpoint to verify email config | **DELETE** | Test harness, not a production endpoint |
| `/api/admin/data-connections/test` | Test a database connection (admin only) | **DELETE** | Test harness for data-connections feature |
| `/api/contract-sources/test` | Test a contract source connection | **DELETE** | Test harness, 76 lines |
| `/api/ocr/test` | Test OCR enhancement pipeline (dev-only gated) | **DELETE** | Explicitly dev-only (`if (!isDev) return 403`), 157 lines |
| `/api/webhooks/[id]/test` | Send test payload to a webhook | **DELETE** | Test harness for webhook verification |

**Subtotal: 7 routes to delete**

---

## 2. HEALTH/STATUS ENDPOINT DUPLICATION

There are **10** health/monitoring endpoints doing overlapping work:

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/health` | Basic health check via `healthCheckService.getOverallHealth()` — status, uptime, version | **KEEP** | Canonical health endpoint for load balancers |
| `/api/health/detailed` | Comprehensive health for all system components via same service | CONSOLIDATE → `/api/health?detail=true` | Just adds system metrics on top of `/api/health` |
| `/api/health/cache` | Cache-specific health via `healthCheckService.checkCache()` | CONSOLIDATE → `/api/health?component=cache` | Single-component sub-check |
| `/api/health/database` | Database-specific health via same service | CONSOLIDATE → `/api/health?component=database` | Single-component sub-check |
| `/api/health/events` | Event bus health via same service | CONSOLIDATE → `/api/health?component=events` | Single-component sub-check |
| `/api/health/sse` | SSE connection health via same service | CONSOLIDATE → `/api/health?component=sse` | Single-component sub-check |
| `/api/healthz` | Full health check with DB, AI, Redis checks — independent impl (109 lines) | **CONSOLIDATE → `/api/health`** | Duplicates `/api/health` with different implementation (raw SQL `SELECT 1`, checks AI keys). Merge unique checks into the canonical health route |
| `/api/ready` | Kubernetes readiness probe — deep dependency checks (284 lines) | **KEEP** | Distinct purpose: K8s readiness probe with all-dependency checks. Standard pattern |
| `/api/web-health` | Trivial 4-line JSON: `{status: 'healthy', service: 'web-frontend'}` | **DELETE** | Returns static hardcoded response — no actual checks. Useless |
| `/api/monitoring/health` | *Another* full health check: DB, Redis, K8s probes (204 lines) | **CONSOLIDATE → `/api/health`** | Third implementation of the same health check pattern. Overlaps with `/api/health` + `/api/healthz` |
| `/api/admin/health/contracts` | Contract system health: stuck jobs, orphans, errors | **KEEP** | Domain-specific health (contract processing), distinct from infra health |
| `/api/intelligence/health` | Contract health *scores* from dedicated table | **KEEP** | Business intelligence endpoint, not infra health despite the name |

**Summary:** Consolidate `/api/healthz`, `/api/monitoring/health`, `/api/health/{detailed,cache,database,events,sse}` into a single `/api/health` with query params. Delete `/api/web-health`.

---

## 3. METRICS/MONITORING DUPLICATION

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/metrics` | Prometheus-compatible metrics via `getMetrics()` (26 lines) | **CONSOLIDATE → `/api/monitoring/prometheus`** | Exact same purpose as prometheus route below |
| `/api/monitoring/prometheus` | Prometheus text-format metrics with helpers (249 lines) | **KEEP** | More complete implementation; keep as canonical |
| `/api/monitoring/metrics` | System metrics via `monitoringService` — JSON format | **KEEP** | JSON metrics for internal dashboards, different from Prometheus format |
| `/api/monitoring/alerts` | Active alerts via `alertingService` | **KEEP** | Distinct alerting concern |
| `/api/monitoring/errors` | Client-side error ingestion | **KEEP** | Error reporting endpoint |
| `/api/monitoring/memory` | Memory/cache stats via `memoryManager` | **KEEP** | Distinct resource monitoring |
| `/api/monitoring/resources` | CPU/memory/connections via `resourceMonitor` | **KEEP** | Distinct but overlaps with `/api/monitoring/memory` — consider merging later |
| `/api/admin/metrics/taxonomy` | Taxonomy adoption/classification metrics | **KEEP** | Domain-specific admin metrics |

---

## 4. AI ROUTE DUPLICATION & OVERLAP (`/api/ai/`)

### 4A. Definite Duplicates — CONSOLIDATE

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/ai/compare` | Compare 2+ contracts via OpenAI (220 lines) | **CONSOLIDATE** into `/api/ai/compare` | Simple pair comparison |
| `/api/ai/compare-contracts` | Compare 2 *groups* of contracts with deep analysis (411 lines) | **CONSOLIDATE** into `/api/ai/compare` | Enhanced version of the same concept. Merge as `mode: 'group'` param |
| `/api/ai/ab-test` | A/B testing — execute tests, record ratings (247 lines) | **CONSOLIDATE** with `/api/ai/experiments` | Both manage A/B test experiments |
| `/api/ai/experiments` | A/B testing — create/start/stop experiments, analyze results (245 lines) | **CONSOLIDATE** with `/api/ai/ab-test` | Nearly identical purpose: A/B test management. Keep one route |
| `/api/ai/analyze` | Deep contract analysis — risks, terms, obligations (232 lines) | Review overlap with `/api/ai/contract-analyst` | `/analyze` = static analysis; `/contract-analyst` = RAG-based Q&A. Different approaches but overlapping outputs |
| `/api/ai/contract-analyst` | RAG-based contract Q&A with citations (370 lines) | **KEEP** | Distinct: interactive Q&A vs batch analysis |
| `/api/ai/insights` | Cross-contract pattern detection, risk aggregation (329 lines) | Review overlap with `/api/ai/analytics` | `/insights` = AI-generated cross-contract intelligence; `/analytics` = usage metrics. Different enough |
| `/api/ai/analytics` | AI usage metrics tracking (116 lines) | **KEEP** | Operational analytics, not contract insights |
| `/api/ai/rag/batch` | Batch RAG embedding processing (300 lines) | **CONSOLIDATE** with `/api/rag/batch-process` | Both batch-process contracts for RAG embeddings: **exact duplicate concept** |
| `/api/rag/batch-process` | Batch RAG processing with status tracking (201 lines) | **CONSOLIDATE** into `/api/rag/batch-process` | Keep the top-level `/api/rag/` version since `/api/ai/rag/batch` is less discoverable |
| `/api/ai/quality` | Extraction quality dashboard metrics | May overlap with `/api/extraction/accuracy` | Both measure extraction quality, different angles |
| `/api/extraction/accuracy` | Extraction accuracy stats from user feedback (326 lines) | **KEEP** | Feedback-driven accuracy is distinct from AI quality dashboard |
| `/api/ai/webhooks` | Manage extraction webhook subscriptions | Review overlap with `/api/webhooks` | `/api/ai/webhooks` = extraction-specific; `/api/webhooks` = general webhook management. Similar pattern |
| `/api/knowledge-graph` | Knowledge graph build/query with real service (216 lines) | **KEEP** | Real implementation using `knowledgeGraphService` |
| `/api/ai/graph` | Query contract knowledge graph (294 lines) | **CONSOLIDATE** into `/api/knowledge-graph` | Both query the knowledge graph. Merge into one canonical route |

### 4B. AI Routes to KEEP (distinct functionality)

| Route | Purpose | Rec |
|---|---|---|
| `/api/ai/anomalies` | Extraction anomaly detection | KEEP |
| `/api/ai/audit` | AI decision audit trail, compliance reports | KEEP |
| `/api/ai/batch-regenerate` | Bulk re-processing with new AI settings (615 lines) | KEEP |
| `/api/ai/boost` | Boost extraction confidence with multiple strategies | KEEP |
| `/api/ai/calibration` | Confidence score calibration | KEEP |
| `/api/ai/chat` | Main AI chat (8341 lines — massive, needs refactor but not a duplicate) | KEEP |
| `/api/ai/costs` | AI cost optimization and budgeting | KEEP |
| `/api/ai/critique` | Self-critique / response validation (86 lines) | KEEP |
| `/api/ai/explain` | AI explainability — evidence for extraction decisions | KEEP |
| `/api/ai/extraction-insights` | Extraction performance insights | KEEP |
| `/api/ai/feedback` | User corrections for AI learning | KEEP |
| `/api/ai/generate` | Artifact generation with multi-model orchestration | KEEP |
| `/api/ai/history` | AI query history tracking | KEEP |
| `/api/ai/language` | Multi-language contract processing | KEEP |
| `/api/ai/memory/recall` | Episodic memory retrieval for personalization | KEEP |
| `/api/ai/memory/store` | Episodic memory storage | KEEP |
| `/api/ai/models` | Model registry, performance, recommendations | KEEP |
| `/api/ai/obligations` | AI-powered obligation tracking | KEEP |
| `/api/ai/predictions` | Contract/portfolio predictions | KEEP |
| `/api/ai/prompts` | Prompt version management and optimization | KEEP |
| `/api/ai/similarity` | Embedding-based contract similarity search | KEEP |
| `/api/ai/status` | AI system health (OpenAI, RAG, embeddings) | KEEP |
| `/api/ai/streaming` | SSE for real-time extraction progress | KEEP |
| `/api/ai/suggestions` | AI search suggestions | KEEP |
| `/api/ai/summarize` | Contract summary generation | KEEP |
| `/api/ai/templates` | Contract template learning | KEEP |
| `/api/ai/transcribe` | Voice transcription via Whisper | KEEP |
| `/api/ai/validate` | Semantic field validation | KEEP |

---

## 5. MOCK/DEAD/PROTOTYPE ROUTES

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/forecast` | Returns **100% mock data** — `generateTimeSeriesData()` with hardcoded `mockForecasts` | **DELETE** | No real data source. Pure mock generating random numbers. 316 lines of fake data |
| `/api/intelligence/search` | Returns **hardcoded mock documents** (`mockDocuments` array) | **DELETE** | Entirely mock — `const mockDocuments = [...]`. No database queries. Never wired to real search |
| `/api/intelligence/graph` | Returns **hardcoded mock** nodes/edges (`mockNodes`, `mockEdges`) | **DELETE** | 100% mock data. Duplicates `/api/knowledge-graph` which has real implementation |
| `/api/intelligence/negotiate` | Returns **hardcoded mock** playbook rules | **DELETE** | All mock data (`const playbookRules = [...]`). Never connected to real playbook engine |
| `/api/processing-status` | Has **mock fallback data** (`mockJobs`), reads from filesystem | Review | Has real logic (reads status files) but opens with large mock data block. May be partially real |
| `/api/contact` | Contact form handler — logs to console, no email integration | Review | Comment says "In production, this would send to email service". May be a landing page form — check if used |
| `/api/docs/openapi` | Static OpenAPI spec (467 lines of hardcoded JSON) | **KEEP** | Standard pattern for API docs. Could be auto-generated but serves a purpose |

---

## 6. ADMIN AUDIT LOG DUPLICATION

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/admin/audit/export` | Audit log export with permissions check, CSV/JSON (189 lines) | **KEEP** | More complete: uses `hasPermission()` |
| `/api/admin/audit-logs/export` | Audit log export, simpler impl (103 lines) | **DELETE** | Duplicate of above with less security. Two routes for the same export |
| `/api/admin/queue-control` | Queue operations: pause/resume/clear/retry | **KEEP** | Distinct admin operation |
| `/api/admin/queue-status` | Queue status info | **KEEP** | Distinct from queue-control (read vs write) |

---

## 7. COLLABORATION OVERLAP

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/collaborators` | External collaborator CRUD (invite, manage, permissions) — 434 lines | **KEEP** | Full CRUD for collaborator management |
| `/api/collaborate/[token]` | Token-based portal access for collaborators | **KEEP** | Distinct purpose: external token auth |
| `/api/portal` | Supplier portal — contracts, tasks, messages by magic link | Review overlap with `/api/collaborate` | Both provide external party access. `/portal` is supplier-focused, `/collaborate` is general. Consider merging long-term |

---

## 8. DRAFTING OVERLAP

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/drafting` | Real-time drafting actions & document management | **KEEP** | Active drafting operations |
| `/api/drafts` | CRUD for contract generation drafts | **KEEP** | Distinct: draft *records* vs drafting *actions* |
| `/api/copilot` | AI drafting copilot (suggestions, completions, risks) | **KEEP** | AI layer on top of drafting |

---

## 9. RAG OVERLAP

| Route | Purpose | Rec | Reason |
|---|---|---|---|
| `/api/rag/search` | Hybrid RAG search with RRF, reranking (180 lines) | **KEEP** | Canonical RAG search |
| `/api/rag/batch-process` | Batch RAG embedding processing (201 lines) | **KEEP** (merge `/api/ai/rag/batch` into this) | |
| `/api/rag/reindex` | Trigger RAG re-indexing (262 lines) | **KEEP** | Distinct re-indexing trigger |
| `/api/ai/rag/batch` | Duplicate batch RAG processing (300 lines) | **DELETE** (duplicate of `/api/rag/batch-process`) | Same concept, different path |

---

## 10. OTHER ROUTES — KEEP (verified non-duplicate)

| Route | Purpose |
|---|---|
| `/api/activity` | Activity feed |
| `/api/admin/*` (remaining) | Admin management (users, groups, security, etc.) |
| `/api/agents` | AI agent management |
| `/api/analytics` | Business analytics |
| `/api/approvals` | Approval workflows |
| `/api/auth` | Authentication |
| `/api/baselines` | Rate card baselines |
| `/api/benchmarking` | Rate benchmarking |
| `/api/chat/conversations` | Chat history persistence |
| `/api/clauses` | Clause library |
| `/api/connections` | SSE connection management |
| `/api/contract-sources` (non-test) | Contract source management |
| `/api/contracts` | Core contract CRUD |
| `/api/cron` | Scheduled jobs |
| `/api/csrf` | CSRF token issuance |
| `/api/dashboard` | Dashboard data |
| `/api/deadlines` | Deadline management |
| `/api/events` | Event management |
| `/api/gdpr` | GDPR compliance |
| `/api/governance` | Governance policies |
| `/api/import` | Data import |
| `/api/integrations` | Third-party integrations |
| `/api/intelligence` (main route) | Intelligence hub — real DB queries |
| `/api/intelligence/health` | Contract health scores |
| `/api/internal/send-email` | Internal worker email dispatch |
| `/api/jobs` | Job management |
| `/api/legal-review` | Legal review workflow |
| `/api/notifications` | Notification management |
| `/api/obligations` | Obligation tracking |
| `/api/ocr` (non-test) | OCR processing |
| `/api/platform/tenants` | Multi-tenant platform admin |
| `/api/playbooks` | Negotiation playbooks |
| `/api/policies` | Policy management |
| `/api/push/subscribe` | Push notification subscriptions |
| `/api/rate-cards` | Rate card management |
| `/api/rate-cards-ingestion` | Rate card ingestion |
| `/api/renewals` | Contract renewals |
| `/api/reports` | Report generation |
| `/api/search` | Search |
| `/api/settings` | User/tenant settings |
| `/api/sharing` | Document sharing |
| `/api/signatures` | E-signature integration |
| `/api/suppliers` | Supplier management |
| `/api/tags` | Tag management |
| `/api/taxonomy` | Contract taxonomy |
| `/api/team` | Team management |
| `/api/templates` | Template management |
| `/api/upload` | File upload |
| `/api/user` | User profile |
| `/api/users` | User management |
| `/api/webhooks` (non-test) | Webhook management |
| `/api/workflows` | Workflow engine |

---

## SUMMARY — Action Items

### DELETE (14 routes)

1. `/api/example-data-consistency/` — example code
2. `/api/example-secure-route/` — example code
3. `/api/test/send-email/` — test harness
4. `/api/admin/data-connections/test/` — test harness
5. `/api/contract-sources/test/` — test harness
6. `/api/ocr/test/` — dev-only test harness
7. `/api/webhooks/[id]/test/` — test harness
8. `/api/web-health/` — static fake health response
9. `/api/forecast/` — 100% mock data
10. `/api/intelligence/search/` — 100% mock data
11. `/api/intelligence/graph/` — 100% mock data
12. `/api/intelligence/negotiate/` — 100% mock data
13. `/api/admin/audit-logs/export/` — duplicate of `/api/admin/audit/export`
14. `/api/ai/rag/batch/` — duplicate of `/api/rag/batch-process`

### CONSOLIDATE (8 routes → 3 targets)

1. `/api/healthz` → merge into `/api/health`
2. `/api/monitoring/health` → merge into `/api/health`
3. `/api/health/detailed` → merge into `/api/health?detail=full`
4. `/api/health/cache` → merge into `/api/health?component=cache`
5. `/api/health/database` → merge into `/api/health?component=database`
6. `/api/health/events` → merge into `/api/health?component=events`
7. `/api/health/sse` → merge into `/api/health?component=sse`
8. `/api/metrics` → merge into `/api/monitoring/prometheus`
9. `/api/ai/compare-contracts` → merge into `/api/ai/compare` with `mode` param
10. `/api/ai/experiments` → merge into `/api/ai/ab-test`
11. `/api/ai/graph` → merge into `/api/knowledge-graph`

### REVIEW (3 routes)

1. `/api/processing-status` — has mock fallback but may have real logic
2. `/api/contact` — landing page form, check if actually used
3. `/api/portal` — potential long-term merge with `/api/collaborate`

### NET REDUCTION: ~22 route files eliminated or consolidated
