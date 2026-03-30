---
applyTo: "**"
---

# Contigo Platform — Copilot Instructions

## Project Overview
Contigo is a contract intelligence platform (Next.js 15, TypeScript, Prisma/PostgreSQL, Azure AI).
It processes PDF contracts via Azure Document Intelligence, extracts metadata via Azure OpenAI,
generates 14 artifact types, and provides a streaming AI chatbot over contracts.

**Monorepo layout (pnpm workspaces + Turborepo):**
```
apps/web/          — Next.js 15 App Router (main app)
packages/clients/db/ — Prisma schema + generated client
packages/workers/  — Background OCR/artifact workers
packages/shared/   — Shared types and utilities
```

---

## Running the App

### Local Docker (preferred)
```bash
# Build image
docker build -f Dockerfile -t contigo-web-local:latest .

# Rebuild env file from running container
docker inspect contigo-web-local-run --format '{{json .Config.Env}}' \
  | python3 -c "import sys,json; [print(e) for e in json.load(sys.stdin)]" \
  > /tmp/container_env.txt

# Start (uses app_default network for postgres + redis)
docker run -d --rm --name contigo-web-local-run --network app_default -p 3005:3000 \
  --env-file /tmp/container_env.txt contigo-web-local:latest

# Health check
curl http://localhost:3005/api/health
```

### Services
| Service | Container | Port |
|---|---|---|
| Next.js app | `contigo-web-local-run` | 3005 |
| PostgreSQL | `contract-intelligence-postgres-dev` | 5432 |
| Redis | `contigo-redis` | 6379 |

### Database access
```bash
docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts
```

---

## Authentication

### Seeded users

| Email | Tenant | Password | Script |
|---|---|---|---|
| `florian@florian.com` | `tenant-florian` | `password123` | seed-tenants.ts |
| `roberto@roberto.com` | `tenant-roberto` | `password123` | seed-tenants.ts |
| `admin@acme.com` | `acme` | `password123` | seed-users.ts |
| `demo@example.com` | `demo` | `demo123` | create-demo-user.ts |

### Login flow (for scripted API calls)
```bash
# 1. Get CSRF token
curl -s -c /tmp/cookies.txt http://localhost:3005/api/auth/csrf

# 2. POST credentials
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST http://localhost:3005/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=<token>&email=admin%40acme.com&password=password123&redirect=false"

# 3. Extract session token
SESSION=$(grep "authjs.session-token" /tmp/cookies.txt | awk '{print $7}')
```

### CSRF token for API routes (HMAC-SHA256)
```python
import hmac, hashlib, json, base64, time, os
secret = os.environ['NEXTAUTH_SECRET']
payload = json.dumps({'timestamp': int(time.time()*1000)})
sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
token = base64.b64encode((payload + '.' + sig).encode()).decode()
# Pass as: -H "x-csrf-token: TOKEN"
```
`/api/contracts/upload` is CSRF-exempt (multipart).

---

## Key Architecture & Schema Quirks

### Prisma / Database
- `Contract.fileName` → maps to `filename` (lowercase) via `@map("filename")` — **raw SQL must use `filename`**
- `ChatConversation` → `chat_conversations` table (`@@map`)
- `ChatMessage` → `chat_messages` table (`@@map`)
- `signatureStatus` is plain `String?` — allowed values: `signed`, `partially_signed`, `unsigned`, `unknown`
- `ContractArtifact` (key-value pairs) ≠ `Artifact` (JSON blobs, 14 types) — **separate models/tables**
- `AuditLog.tenantId` is required (non-null), must be a valid `Tenant.id` (`acme` or `demo`)
- `Tenant` IDs are plain strings: `acme`, `demo` (not cuid format)
- `textVector` is a `tsvector` column auto-populated by DB trigger `update_contract_text_vector()`

### Contract Processing Pipeline (`apps/web/lib/real-artifact-generator.ts`)
1. PDF text extraction via Azure Document Intelligence
2. `rawText` + `searchableText` persisted **immediately** after extraction
3. `extractContractMetadata()` runs **before** the artifact loop (pre-artifact metadata block)
4. Signature detection via regex → `signatureStatus` + `signatureRequiredFlag` set in pre-artifact block
5. 14 artifact types generated: `OVERVIEW`, `CLAUSES`, `COMPLIANCE`, `RISK`, `FINANCIAL`, `OBLIGATIONS`, `RENEWAL`, `NEGOTIATION_POINTS`, `AMENDMENTS`, `CONTACTS`, `PARTIES`, `TIMELINE`, `DELIVERABLES`, `EXECUTIVE_SUMMARY`
6. Without Azure OpenAI deployment → all 14 artifacts saved as `_mode: basic` (regex-based)

### Azure AI Configuration
- **Azure OpenAI**: `https://switzerlandnorth.api.cognitive.microsoft.com/`
  - Env: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`
  - Active deployment: `gpt-4o` (model `gpt-4o-2024-11-20`) — working ✅
  - API version: `2024-02-01` (`AZURE_OPENAI_API_VERSION`)
  - **Embedding model not yet deployed** — RAG hybrid search falls back to keyword-only
- **Azure Document Intelligence**: `https://contigodocumentintelligence.cognitiveservices.azure.com/`
  - Env: `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY`
  - Status: working ✅

### Chat Stream API
```json
POST /api/ai/chat/stream
{
  "message": "...",
  "conversationHistory": [],
  "context": { "contractId": "..." }
}
```
Response: SSE events — `metadata` → `content` (or `error`) → `done`

### RAG / Context Gathering
- `context-gathering.ts` uses `prisma.contractArtifact` (key-value, usually empty) NOT `prisma.artifact` (JSON blobs)
- When `ContractArtifact` is empty → full `rawText` (8000 chars) used as system prompt context
- `ContractEmbedding` rows only created when embedding model deployed (currently 0 rows)
- RAG fallback searches `rawText` via FTS (`textVector` column)

### Audit Logging
- `auditLog()` helper in `apps/web/lib/security/audit.ts`
- **Important**: writes to DB via lazy Prisma import (bypasses Next.js module bundle isolation)
- Do NOT rely on the `setAuditStorage` singleton — it doesn't cross Next.js bundle boundaries
- `AuditLog.tenantId` is required — always pass `options.tenantId` when calling `auditLog()`

---

## Development Conventions

### Code style
- TypeScript strict mode throughout
- `@/` path alias maps to `apps/web/` root
- Prefer `prisma.model.findFirst/findMany` over raw SQL; when raw SQL is necessary, quote column names that contain uppercase letters (e.g., `"contractId"`) but use lowercase unquoted for `@map` columns (e.g., `filename`)
- API routes live under `apps/web/app/api/`
- All AI calls go through `apps/web/lib/ai/ai-client.ts` — do not instantiate `new OpenAI()` or `new AzureOpenAI()` directly in route handlers

### Error handling
- `DeploymentNotFound` errors from Azure OpenAI should be caught and surfaced as user-friendly messages
- The chat stream fail-fast condition is in `apps/web/app/api/ai/chat/stream/route.ts`

### DB migrations
- Schema source of truth: `packages/clients/db/schema.prisma`
- Generate client: `cd packages/clients/db && pnpm prisma generate`
- Run migrations: `cd packages/clients/db && pnpm prisma migrate dev`
- One-time SQL fixes go in `scripts/migrations/` (not `scripts/archive/`)

### Build & deploy
```bash
# Build Docker image
docker build -f Dockerfile -t contigo-web-local:latest .

# Production image
docker build -f Dockerfile.production -t contigo-web:prod .

# Workers image
docker build -f Dockerfile.workers -t contigo-workers:latest .
```

### Seeding
```bash
# Minimal seed (users + tenants)
docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts -f /path/to/scripts/seed-tenants.sql

# Full demo data
cd apps/web && pnpm tsx ../../scripts/seed-comprehensive.ts
```

---

## Known Limitations (require Azure action to resolve)

- `contractType` defaults to `"NDA"` (regex false-match) — AI extraction will correct this
- `clientName` / `supplierName` stay null for inline `("Buyer")`/`("Supplier")` format — AI will fix
- `ContractEmbedding` has 0 rows — requires `text-embedding-3-small` deployment + `/api/contracts/{id}/rag-process`
- `chat_conversations` / `chat_messages` empty until AI responds successfully
- `ContractVersion` tracking not triggered by upload flow — needs investigation

**To enable full AI pipeline:**
1. Go to https://oai.azure.com → Deployments → Create deployment named `gpt-4o`
2. Create deployment named `text-embedding-3-small` for RAG indexing
3. Re-upload a contract — artifacts will be AI-generated, metadata fully populated

---

## Important Files

| File | Purpose |
|---|---|
| `apps/web/lib/real-artifact-generator.ts` | Core processing pipeline — most critical file |
| `apps/web/lib/security/audit.ts` | Audit logging; `auditLog()` writes to DB via lazy Prisma |
| `apps/web/instrumentation.ts` | Next.js startup hook; initializes audit storage |
| `apps/web/app/api/ai/chat/stream/route.ts` | Main SSE chatbot endpoint |
| `apps/web/lib/ai/chat-stream/context-gathering.ts` | Builds system prompt from RAG + rawText |
| `apps/web/lib/rag/advanced-rag.service.ts` | RAG hybrid search (raw SQL uses `filename` not `"fileName"`) |
| `apps/web/lib/rag/parallel-rag.service.ts` | Parallel multi-query RAG (same SQL fix) |
| `apps/web/middleware.ts` | CSRF validation; exempt paths include `/api/contracts/upload` |
| `packages/clients/db/schema.prisma` | Source of truth for all DB models |
| `apps/web/lib/auth.ts` | NextAuth credentials provider + audit logging |
| `scripts/` | Operational scripts: user management, seeding, health checks |
| `init/` | DB init SQL: extensions, RAG indexes, halfvec quantization |
| `infra/` | Nginx config + Prometheus alerting rules |
| `infrastructure/azure/` | Azure Bicep IaC (Switzerland North, GDPR) |
