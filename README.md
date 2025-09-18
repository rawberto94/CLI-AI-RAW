# Contract Intelligence

A full-stack monorepo for intelligent contract analysis with multi-tenancy and RAG capabilities.

## 🚀 Quick Start

### Universal Launcher (Recommended)

The project includes a unified launcher that automatically detects your environment and sets up everything:

```bash
# One-time setup (any environment)
pnpm launch:setup

# Start full development environment
pnpm launch
```

**Supports all environments**:
- 🏠 **Local**: Docker Compose infrastructure
- ☁️ **GitHub Codespaces**: Pre-configured cloud development
- 🐳 **Dev Container**: Containerized development

### Manual Setup

1. Install dependencies: `pnpm install`
2. Start infrastructure: `pnpm setup:infra`
3. Setup database: `pnpm db:push`
4. Start services: `pnpm dev:local`

## 📖 Documentation

- **[📋 Launcher Guide](./LAUNCHER.md)** - Comprehensive launcher documentation
- **[🏗️ API Documentation](./docs/api.md)** - API endpoints and schemas
- **[📊 Production Guide](./docs/production-readiness.md)** - Deployment and monitoring

## 🎯 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| **API** | http://localhost:3001 | REST API ([docs](http://localhost:3001/docs)) |
| **Web** | http://localhost:3002 | Next.js interface |
| **Health** | /healthz | Health endpoints |

## 🎮 Quick Commands

| Command | Action |
|---------|--------|
| `pnpm launch` | Start everything |
| `pnpm launch:api` | API only |
| `pnpm launch:web` | Web only |
| `pnpm launch:health` | Health checks |
| `pnpm launch:stop` | Stop all services |
| `pnpm launch:env` | Show configuration |

## Multi-tenancy & RAG

- Multi-tenancy is enforced via the `x-tenant-id` header. Set `TENANT_ENFORCE=true` to require it on API requests.
- RAG is enabled via env flags and uses `pgvector` in Postgres for similarity search.
- Ensure infra is running: `pnpm launch` starts Docker with `pgvector/pgvector:pg16` and creates the `vector` extension.
- At API start, indexes are ensured:
	- `Embedding_embedding_ivfflat_idx` (cosine, lists tunable via `RAG_IVFFLAT_LISTS`)
	- `Embedding_tenant_contract_idx` btree

Env (in `apps/api/.env`):

```
RAG_ENABLED=true
RAG_EMBED_MODEL=text-embedding-3-small
RAG_CHUNK_SIZE=1200
RAG_CHUNK_OVERLAP=150
RAG_TOP_K=6
TENANT_ENFORCE=true
RAG_IVFFLAT_LISTS=100
```

Scripts:

- `pnpm db:push` to sync Prisma schema
- `node scripts/smoke-test.mjs` basic upload and artifact fetch
- `node scripts/smoke-rag.mjs <docId> "your question" --tenant demo` tenant-aware RAG check

## RAG (Retrieval-Augmented Generation)

Optional lightweight RAG is included.

When enabled (RAG_ENABLED=true):

- Ingestion worker chunks contract text and generates embeddings per chunk.
- Embeddings are stored via Prisma in the `Embedding` model (JSON vector; no pgvector required).
- Overview and Rates workers retrieve top-K chunks and include them as CONTEXT in LLM prompts.
- A simple endpoint is available: `GET /api/rag/search?docId=...&q=...&k=6`.

Env flags (set in apps/api/.env):

- `RAG_ENABLED=true`
- `RAG_EMBED_MODEL=text-embedding-3-small`
- `RAG_CHUNK_SIZE=1200`
- `RAG_CHUNK_OVERLAP=150`
- `RAG_TOP_K=6`

Notes:

- Requires `OPENAI_API_KEY`.
- Apply schema: `pnpm db:push`.
- This is minimal; consider pgvector or a managed vector DB for production.

## 🛠️ Operations & Production

### Simplified Analysis Pipeline (Local Dev)
If Redis or workers are not running you can force a dependency‑free analysis enqueue path so uploads succeed without BullMQ parent/child relationships.

Run API in simplified mode:

```bash
PIPELINE_SIMPLE=1 pnpm -w --filter api dev
```

Behavior:
- Skips parent job linkage; enqueues each stage independently.
- Automatic fallback: even without the flag, if full pipeline enqueue fails the server logs a warning and falls back to the simplified mode.
- Use full mode by unsetting the variable and ensuring Redis + workers are running.

Environment values accepted: `1`, `true` (case-insensitive) enable the flag.

### Health & Readiness
- Liveness: `GET /healthz` returns `{ status: 'ok' }`.
- Readiness: `GET /api/ready` performs best-effort DB (Prisma) and queue (BullMQ) pings; returns 503 if a core dependency is down.
- Detailed health: `GET /api/health` includes memory, contract stats, placeholders for infra dependencies.

### Metrics & Monitoring
- System metrics: `GET /metrics/system` (JSON aggregate of request, upload, analysis, error metrics).
- Endpoint stats: `GET /metrics/endpoints` aggregated per method+path.
- Slow requests: `GET /metrics/slow` (threshold > 1000ms, adjustable in code).
- Prometheus-style basics: `GET /metrics/prom` minimal exposition for RAG counters.
- Request ID header: All requests receive `x-request-id` for correlation.

### OpenAPI
- Spec: `GET /openapi.json` (initial minimal spec; extend `apps/api/src/openapi.ts`).
- Add new endpoints: augment `paths` object; later integrate generator or `zod-to-openapi` for automation.

### Error Handling
- Centralized via plugin `apps/api/src/plugins/error-handler.ts`.
- Custom `AppError` (status, message, operational flag, metadata) ensures consistent 4xx/5xx formatting.
- Non-production exposes no internal stack in responses.

### Graceful Shutdown
- Signals `SIGINT` / `SIGTERM` trigger: stop Fastify, close discovered BullMQ queues, exit cleanly (15s timeout).
- Implementation: `apps/api/src/shutdown.ts` registered after server start.

### Tracing (Opt-In)
- Enable by setting `TRACING_ENABLED=true` before starting API.
- Minimal OTEL init: `packages/utils/src/tracing-init.ts` (auto-instrumentations, resource tags).
- Extend with exporters (e.g., OTLP HTTP) by adding dependencies and configuring exporter in `tracing-init.ts`.

### Docker Build
- Production Dockerfile: `apps/api/Dockerfile` (multi-stage, Node 22 Alpine, selective workspace build).
- Build command (from repo root):
	```bash
	docker build -f apps/api/Dockerfile -t contract-intelligence-api:latest .
	docker run -p 3001:3001 --env-file apps/api/.env contract-intelligence-api:latest
	```

### CI
- Workflow: `.github/workflows/ci.yml` executes lint → type-check → tests → build → audit.
- Add required status checks in your Git provider to gate merges on `lint`, `typecheck`, `test`, and `build` jobs.

### Environment Hardening (Recommended Next)
- Add secret scanning (e.g., Gitleaks) stage in CI.
- Integrate SBOM generation (e.g., `cyclonedx` for Node) for dependency audit trail.
- Add structured logs (JSON) shipping to OpenSearch / Loki.
- Implement rate-limit tuning using env (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`).

### Operational Scripts
- Smoke tests: `node scripts/smoke-test.mjs` basic ingestion flow.
- Batch upload: `node scripts/batch-upload.mjs` multi-file ingestion.
- Launch helpers: `pnpm launch:*` orchestrate dev environment.

### Observability Extension Ideas
- Add histogram for response durations (Prometheus client) and unify with existing JSON metrics.
- Export OpenTelemetry traces to collector (Jaeger / Tempo) once `TRACING_ENABLED` flows are validated.

### Security Notes
- Input sanitation middleware (SQL & XSS) mounted early.
- Optional tenant enforcement via `TENANT_ENFORCE=true`.
- Add WAF / reverse proxy (NGINX or Cloud provider) for TLS, request size policing, IP filtering.

---
This section will evolve; contributions welcome.
