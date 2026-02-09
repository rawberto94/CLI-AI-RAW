# API Route Inventory — ConTigo Platform

**Generated**: February 2026  
**Total Routes**: 475 route files  
**Previous**: 507 (32 dead/mock/duplicate routes removed)  

---

## Summary

| Domain | Routes | Description |
|--------|--------|-------------|
| contracts | 99 | Core CLM — CRUD, AI analysis, signing, export, obligations |
| rate-cards | 95 | Rate card management, comparisons, clustering, benchmarks |
| ai | 42 | AI services — chat, extraction, critique, RAG, embeddings |
| admin | 22 | Admin panel — users, security, queues, audit, tenant config |
| analytics | 18 | Dashboards — cost savings, suppliers, compliance, trends |
| auth | 14 | Authentication — NextAuth, MFA, sessions, SSO |
| obligations | 12 | Obligation tracking, compliance, alerts |
| reports | 10 | Report generation, scheduling, templates |
| cron | 9 | Scheduled jobs — cleanup, sync, alerts, health checks |
| workflows | 8 | Approval workflows, execution, templates |
| templates | 8 | Contract templates — CRUD, AI generation |
| monitoring | 8 | Health checks, Prometheus metrics, alerts |
| agents | 8 | AI agents — autonomous tasks, orchestration |
| taxonomy | 7 | Contract type taxonomy, categories |
| health | 6 | Health check variants (LB, deep, service checks) |
| ocr | 6 | Document OCR processing |
| dashboard | 6 | Dashboard widgets — stats, activity, cross-module |
| import | 5 | Bulk contract/data import |
| contract-sources | 5 | External contract source integrations |
| approvals | 5 | Approval requests, decisions |
| Other (33 dirs) | 77 | See detailed breakdown below |

**Total: 475 route files across 66 top-level API directories**

---

## Detailed Route Map

### `/api/contracts/` — Core CLM (99 routes)

The largest route group. Handles the full contract lifecycle.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/contracts` | GET, POST | List/create contracts |
| `/contracts/[id]` | GET, PUT, DELETE | Single contract CRUD |
| `/contracts/[id]/ai-*` | POST | AI analysis (categorize, summarize, extract) |
| `/contracts/[id]/analyze` | POST | Deep contract analysis |
| `/contracts/[id]/compare` | POST | Compare with other contracts |
| `/contracts/[id]/export` | GET | Export to PDF/DOCX |
| `/contracts/[id]/legal-review` | POST | AI legal review |
| `/contracts/[id]/obligations` | GET, POST | Contract obligations |
| `/contracts/[id]/sign` | POST | Digital signature workflow |
| `/contracts/[id]/workflow` | GET, POST | Approval workflow |
| `/contracts/[id]/amendments` | GET, POST | Contract amendments |
| `/contracts/[id]/versions` | GET | Version history |
| `/contracts/[id]/clauses` | GET, POST | Clause extraction/management |
| `/contracts/[id]/renewal` | GET | Renewal details |
| `/contracts/[id]/renew` | POST | Execute renewal |
| `/contracts/bulk-*` | POST | Bulk operations |
| `/contracts/categorize` | POST | Bulk categorization |
| `/contracts/compare` | POST | Rule-based comparison |
| `/contracts/health-scores` | GET | Portfolio health scores |
| `/contracts/search` | GET | Full-text search |
| `/contracts/stats` | GET | Contract statistics |
| `/contracts/sync-health-scores` | POST | Recalculate health scores |

### `/api/rate-cards/` — Rate Card Management (95 routes)

Second-largest group. Financial rate card analysis and benchmarking.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/rate-cards` | GET, POST | List/create rate cards |
| `/rate-cards/[id]` | GET, PATCH, DELETE | Single rate card CRUD |
| `/rate-cards/[id]/rates` | GET, POST | Individual rates |
| `/rate-cards/baselines` | GET, POST | Rate baselines for comparison |
| `/rate-cards/clusters` | GET, POST | K-means clustering analysis |
| `/rate-cards/comparisons` | GET, POST | Saved comparison records |
| `/rate-cards/comparisons/[id]/export` | GET | Export comparison report |
| `/rate-cards/market-intelligence` | GET | Market rate intelligence |
| `/rate-cards/performance` | GET | System performance metrics |
| `/rate-cards/suppliers` | GET | Supplier rate cards |
| `/rate-cards/analytics` | GET | Rate card analytics |
| `/rate-cards/trends` | GET | Rate trend detection |

### `/api/ai/` — AI Services (42 routes)

AI-powered features: chatbot, extraction, comparison, embeddings.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/ai/chat` | POST | Main AI chatbot (intent detection, RAG, contract queries) |
| `/ai/chat/stream` | POST | Streaming chat with model failover |
| `/ai/chat/actions` | POST | Execute chatbot actions |
| `/ai/chat/feedback` | POST | Chat message feedback |
| `/ai/compare` | POST | AI-powered contract comparison |
| `/ai/critique` | POST | AI contract critique |
| `/ai/explain` | POST | AI clause explanation |
| `/ai/extract` | POST | AI data extraction |
| `/ai/extract/stream` | POST | Streaming extraction |
| `/ai/feedback` | POST | Extraction correction feedback |
| `/ai/models` | GET | Available AI models |
| `/ai/ab-test` | GET, POST | A/B testing management |
| `/ai/embeddings` | POST | Generate embeddings |
| `/ai/streaming` | GET | SSE extraction progress |
| `/ai/summarize` | POST | Document summarization |

### `/api/admin/` — Administration (22 routes)

Tenant administration, security, audit, queue management.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/admin/audit` | GET | Audit log query |
| `/admin/audit/export` | POST | Export audit logs |
| `/admin/permissions` | GET, POST | Permission management |
| `/admin/queue-control` | POST | Pause/resume/clear queues |
| `/admin/queue-status` | GET | Queue health and job status |
| `/admin/roles` | GET, POST | Role management |
| `/admin/security/ip-allowlist` | GET, POST, DELETE | IP allowlist (canonical) |
| `/admin/security-settings` | GET, PUT | Security configuration |
| `/admin/sessions` | GET, DELETE | Org-wide session management |
| `/admin/users` | GET | User directory |

### `/api/analytics/` — Analytics (18 routes)

Dashboard analytics and business intelligence.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/analytics/compliance` | GET, POST | Compliance analytics |
| `/analytics/contracts` | GET | Contract analytics |
| `/analytics/cost-savings` | GET | Cost savings opportunities |
| `/analytics/overview` | GET | Executive analytics overview |
| `/analytics/renewal-radar` | GET | Renewal calendar/alerts |
| `/analytics/savings` | GET | Savings pipeline |
| `/analytics/suppliers` | GET | Supplier analytics |
| `/analytics/trends` | GET | Business trends |

### `/api/auth/` — Authentication (14 routes)

NextAuth callbacks, MFA, sessions, SSO.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/auth/[...nextauth]` | GET, POST | NextAuth.js handler |
| `/auth/mfa/*` | GET, POST | MFA setup, verify, disable |
| `/auth/sessions` | GET, DELETE | Personal session management |
| `/auth/sso/*` | GET, POST | SSO configuration |

### `/api/monitoring/` — Monitoring (8 routes)

Production health checks, Prometheus metrics, alerting.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/monitoring/health` | GET | K8s probes (?probe=liveness\|readiness\|startup) |
| `/monitoring/prometheus` | GET | Prometheus metrics endpoint (248 lines) |
| `/monitoring/alerts` | GET, POST | Alert configuration |
| `/monitoring/sla` | GET | SLA compliance metrics |

### `/api/health/` — Health Checks (6 routes)

Simplified health endpoints for load balancers and external monitors.

| Sub-path | Methods | Purpose |
|----------|---------|---------|
| `/health` | GET | Simple health (via healthCheckService) |
| `/health/deep` | GET | Deep service check |
| `/health/dependencies` | GET | Dependency status |

### Other Route Groups

| Group | Routes | Purpose |
|-------|--------|---------|
| `/api/obligations` | 12 | Obligation tracking, compliance monitoring, alerts |
| `/api/reports` | 10 | Report generation (PDF/Excel), scheduling, templates |
| `/api/cron` | 9 | Scheduled jobs: cleanup, sync, obligation alerts, health |
| `/api/workflows` | 8 | Approval workflows, execution history, templates |
| `/api/templates` | 8 | Contract template CRUD, AI-powered generation |
| `/api/agents` | 8 | Autonomous AI agent orchestration |
| `/api/taxonomy` | 7 | Contract type taxonomy management |
| `/api/ocr` | 6 | Document OCR processing |
| `/api/dashboard` | 6 | Dashboard widgets, stats, activity feed |
| `/api/import` | 5 | Bulk contract/data import pipelines |
| `/api/contract-sources` | 5 | External contract source integrations |
| `/api/approvals` | 5 | Approval requests and decisions |
| `/api/webhooks` | 4 | Webhook registration, delivery, retry |
| `/api/chat` | 4 | Chat conversation persistence (not AI — see ai/chat) |
| `/api/benchmarking` | 4 | Rate benchmarking |
| `/api/users` | 3 | User directory (admin-oriented) |
| `/api/user` | 3 | Current user profile/preferences/favorites |
| `/api/signatures` | 3 | Digital signatures |
| `/api/search` | 3 | Full-text search (contracts, clauses, global) |
| `/api/rag` | 3 | RAG pipeline operations |
| `/api/notifications` | 3 | Notification delivery and preferences |
| `/api/copilot` | 3 | AI drafting copilot (suggestions, completions, risks) |
| `/api/clauses` | 3 | Clause library |
| `/api/baselines` | 3 | Rate baselines |
| `/api/settings` | 2 | User/tenant settings |
| `/api/renewals` | 2 | Renewal management |
| `/api/playbooks` | 2 | Negotiation playbooks |
| `/api/platform` | 2 | Platform info/version |
| `/api/legal-review` | 2 | Legal review workflows |
| `/api/jobs` | 2 | Background job management |
| `/api/integrations` | 2 | Third-party integrations |
| `/api/gdpr` | 2 | GDPR compliance (export, deletion requests) |
| `/api/events` | 2 | Event log/audit trail |
| `/api/drafts` | 2 | Contract drafts CRUD |
| `/api/deadlines` | 2 | Deadline tracking |
| `/api/upload` | 1 | File upload (S3/MinIO) |
| `/api/team` | 1 | Team management |
| `/api/tags` | 1 | Contract tagging |
| `/api/suppliers` | 1 | Supplier directory |
| `/api/sharing` | 1 | Contract sharing |
| `/api/push` | 1 | Push notification subscriptions |
| `/api/processing-status` | 1 | Document processing status |
| `/api/portal` | 1 | External portal |
| `/api/policies` | 1 | Policy management |
| `/api/knowledge-graph` | 1 | Knowledge graph queries |
| `/api/internal` | 1 | Internal system endpoints |
| `/api/intelligence` | 1 | Intelligence module root |
| `/api/governance` | 1 | Governance dashboard |
| `/api/extraction` | 1 | Data extraction |
| `/api/docs` | 1 | API documentation (Swagger/OpenAPI) |
| `/api/csrf` | 1 | CSRF token generation |
| `/api/contact` | 1 | Contact form submission |
| `/api/connections` | 1 | External connections |
| `/api/collaborators` | 1 | External collaborator management |
| `/api/collaborate` | 1 | Token-based external access portal |
| `/api/activity` | 1 | Activity feed |

---

## Route Cleanup History

### Deleted Routes (32 total)

**Test/Example routes** (7):
- `example-data-consistency`, `example-secure-route`, `test`, `web-health`
- `admin/data-connections/test`, `contract-sources/test`, `ocr/test`

**Mock data routes** (4):
- `forecast` (Math.random() mock data)
- `intelligence/search`, `intelligence/negotiate`, `intelligence/graph` (hardcoded arrays)

**Duplicate routes** (21):
- `metrics` → use `monitoring/prometheus`
- `ai/compare-contracts` → use `ai/compare`
- `ai/experiments` → use `ai/ab-test`
- `ai/graph` → use `knowledge-graph`
- `admin/audit-logs/export` → use `admin/audit/export`
- `healthz` → use `health` (simple) or `monitoring/health` (K8s probes)
- `ready` → use `monitoring/health?probe=readiness`
- `drafting` → use `drafts`
- `rate-cards-ingestion` → use `rate-cards`
- `admin/ip-allowlist` → use `admin/security/ip-allowlist`
- `user/notifications` → use `notifications`
- `settings/notifications` → use `notifications/preferences`
- `contracts/health` → use `contracts/health-scores`
- `intelligence/health` → use `contracts/health-scores`
- `analytics/renewals` → use `renewals`
- `rate-cards/performance-metrics` → use `rate-cards/performance`
- `rate-cards/cluster` → merged into `rate-cards/clusters`
- `contracts/[id]/categorize` → use `contracts/[id]/ai-categorize`

---

## Architecture Notes

### Import Dependencies (API Routes → Libraries)

| Import | Count | Status |
|--------|-------|--------|
| `@/lib/prisma` | ~290 | **Too high** — should migrate to service layer |
| `@/lib/auth` | ~190 | Correct — auth context |
| `@/lib/tenant-server` | ~160 | Correct — multi-tenancy |
| `@/lib/security/*` | ~55 | Correct — CORS, audit, tenant security |
| `@/lib/cache` | ~30 | Correct — Redis cache |
| `data-orchestration` | ~6 | **Too low** — should be primary service layer |

### Next Steps

1. **Phase 2**: Migrate business logic from fat route handlers → `packages/data-orchestration/` services
2. **Phase 3**: Decompose `lib/` (332 files) → move server-only logic to packages
3. **Phase 4**: Add Zod request/response schemas to `packages/schemas/`

---

*Related: [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md) | [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md)*
