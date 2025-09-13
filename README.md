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
