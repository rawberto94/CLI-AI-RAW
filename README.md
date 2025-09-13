# Contract Intelligence

This is a full-stack monorepo for the Contract Intelligence system.

## Getting Started

1.  Install dependencies: `pnpm install`
2.  One-command launch (recommended): `pnpm launch`
	- This will: start Docker infra, push DB schema, free ports 3001/3002, and start API+Web with health checks.
3.  Alternatively, start manually: `pnpm dev` (or `pnpm dev:local`)

This will start the Fastify API, Next.js web app, and BullMQ workers.

### Health checks

- API: http://localhost:3001/healthz
- Web: http://localhost:3002/api/healthz

### Troubleshooting

- If ports are stuck: `pnpm kill-ports`
- If Docker isn't installed/running, the launcher skips infra; ensure Postgres/Redis/MinIO are available or update `apps/api/.env` to use remote services.

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
