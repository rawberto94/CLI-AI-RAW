# Azure Go-Live Runbook

This runbook lists what must be set up in Azure to make ConTigo fully live, including PostgreSQL extensions, Prisma migrations, AI services, storage, secrets, deployment, and demo tenant seeding.

## Scope

ConTigo is a containerized Next.js 15 application with Prisma/PostgreSQL, Redis, object storage, Azure OpenAI, Azure Document Intelligence, and background workers.

The live environment needs these runtime pieces:

| Capability | Required service |
|---|---|
| Web UI and API | Containerized `apps/web` service |
| Background OCR/RAG/artifact processing | Worker container |
| Database | Azure Database for PostgreSQL Flexible Server with pgvector |
| Cache and queues | Azure Cache for Redis |
| Contract files | MinIO/S3-compatible storage, or Azure Blob after worker compatibility is verified |
| AI extraction/chat/artifacts | Azure OpenAI chat deployment |
| Embeddings/RAG | Azure OpenAI embedding deployment |
| OCR/PDF extraction | Azure Document Intelligence |
| Secrets | Azure Key Vault |
| Images | Azure Container Registry, or GHCR if intentionally kept |
| HTTPS/domain | Custom domain, TLS certificate, and ingress/proxy |
| Logs/metrics | Log Analytics, Application Insights, Sentry, or equivalent |

## Deployment Path Decision

Choose one hosting path before provisioning resources.

### Option A: Fast client demo on Azure VM

Use this for the shortest path to a client demo.

- Run Docker Compose on the Azure VM.
- Use [docker-compose.vm.yml](../../docker-compose.vm.yml) for web, PostgreSQL, Redis, and MinIO.
- Fix public ingress with Nginx, Azure Load Balancer/Application Gateway, or Cloudflare Tunnel.
- Keep MinIO for object storage because the worker code still expects MinIO/S3 variables in production.
- Seed a demo tenant and user after migrations.

This is the least risky near-term route because it matches the current runtime assumptions.

### Option B: Managed Azure production

Use this for a cleaner production architecture.

- Host web and worker containers on Azure Container Apps or AKS.
- Use Azure Database for PostgreSQL Flexible Server.
- Use Azure Cache for Redis.
- Use Key Vault for secrets.
- Use ACR for image hosting.
- Use Azure OpenAI and Azure Document Intelligence.
- Decide whether to keep MinIO/S3-compatible storage or complete the Azure Blob migration.

Container Apps is the lower-operations recommendation. AKS is already partially represented by [infrastructure/azure/main.bicep](../../infrastructure/azure/main.bicep) and [helm/contigo](../../helm/contigo), but the Helm secrets and storage settings need cleanup before production use.

## Azure Prerequisites

1. Confirm subscription and region.
   - Recommended region: `switzerlandnorth` for Swiss/GDPR alignment.
   - Confirm Azure OpenAI model availability and quota in the chosen region.

2. Create a resource group.

   ```bash
   az group create \
     --name rg-contigo-prod \
     --location switzerlandnorth \
     --tags Environment=prod Project=ConTigo
   ```

3. Set naming conventions.
   - Resource group: `rg-contigo-prod`
   - Container registry: `acrcontigoprod`
   - PostgreSQL server: `psql-contigo-prod`
   - Redis: `redis-contigo-prod`
   - Key Vault: `kv-contigo-prod`
   - Storage account, if Azure Blob is used: `stcontigoprod`
   - Container Apps environment or AKS cluster: `cae-contigo-prod` or `aks-contigo-prod`

4. Decide public domain.
   - Example: `mycontigo.app` or `app.mycontigo.app`.
   - Production `NEXTAUTH_URL` must exactly match the public HTTPS origin.

## Container Registry

Create ACR unless you intentionally keep using GHCR.

```bash
az acr create \
  --resource-group rg-contigo-prod \
  --name acrcontigoprod \
  --sku Basic \
  --admin-enabled false

az acr login --name acrcontigoprod
```

Build and push images from the repository root.

```bash
export ACR_LOGIN_SERVER="acrcontigoprod.azurecr.io"
export IMAGE_TAG="$(git rev-parse --short HEAD)"

docker build -f Dockerfile.production -t "$ACR_LOGIN_SERVER/contigo-web:$IMAGE_TAG" .
docker push "$ACR_LOGIN_SERVER/contigo-web:$IMAGE_TAG"

docker build -f Dockerfile.workers -t "$ACR_LOGIN_SERVER/contigo-workers:$IMAGE_TAG" .
docker push "$ACR_LOGIN_SERVER/contigo-workers:$IMAGE_TAG"
```

Also tag `latest` only if that is the deployment convention.

## PostgreSQL Flexible Server

### Create the server

Use PostgreSQL 16 if pgvector support is available in the target Azure region. Otherwise use PostgreSQL 15, which is what the existing Bicep file currently provisions.

Recommended baseline for production:

- SKU: General Purpose for production, Burstable only for demo/low traffic.
- Storage: start at 64 GB or higher for live use.
- Backups: at least 7 days, preferably 14-35 days for production.
- Networking: private access through VNet where possible.
- High availability: enable for real production, optional for client demo.

Example server creation:

```bash
az postgres flexible-server create \
  --resource-group rg-contigo-prod \
  --name psql-contigo-prod \
  --location switzerlandnorth \
  --version 16 \
  --database-name contigo \
  --admin-user contigoadmin \
  --sku-name Standard_D2ds_v5 \
  --tier GeneralPurpose \
  --storage-size 64 \
  --backup-retention 14
```

For a cheaper demo, use a Burstable SKU and shorter backup retention.

### Allow required extensions

Azure PostgreSQL requires the `azure.extensions` server parameter before some extensions can be created.

```bash
az postgres flexible-server parameter set \
  --resource-group rg-contigo-prod \
  --server-name psql-contigo-prod \
  --name azure.extensions \
  --value "vector,uuid-ossp,pg_trgm,btree_gin,pgcrypto"
```

Then connect to the database and create extensions.

```bash
psql "$DIRECT_DATABASE_URL" -f init/01-enable-extensions.sql

psql "$DIRECT_DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'

psql "$DIRECT_DATABASE_URL" -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm', 'btree_gin', 'pgcrypto') ORDER BY extname;"
```

Required extensions:

- `vector` for RAG embeddings.
- `uuid-ossp` for UUID support used by older migrations/scripts.
- `pg_trgm` for fuzzy/full-text search support.
- `btree_gin` for composite GIN indexes.
- `pgcrypto` for older SQL migration support.

### Configure database URLs

The app needs both pooled and direct database URLs.

```text
DATABASE_URL=postgresql://contigoadmin:<password>@psql-contigo-prod.postgres.database.azure.com:5432/contigo?sslmode=require&connection_limit=20&pool_timeout=10
DIRECT_DATABASE_URL=postgresql://contigoadmin:<password>@psql-contigo-prod.postgres.database.azure.com:5432/contigo?sslmode=require
```

If PgBouncer or another pooler is added later, keep `DIRECT_DATABASE_URL` pointed directly at PostgreSQL for migrations and interactive transactions.

### Run Prisma migrations

Run migrations from a trusted machine that can reach the database. If the database is private, run these from a jumpbox, the Azure VM, Cloud Shell with VNet access, or CI with private networking.

```bash
pnpm install --frozen-lockfile
pnpm db:generate

DATABASE_URL="$DATABASE_URL" \
DIRECT_DATABASE_URL="$DIRECT_DATABASE_URL" \
pnpm db:migrate
```

Equivalent direct Prisma command:

```bash
DATABASE_URL="$DATABASE_URL" \
DIRECT_DATABASE_URL="$DIRECT_DATABASE_URL" \
pnpm exec prisma migrate deploy --schema packages/clients/db/schema.prisma
```

### Run RAG indexes

After migrations, run the RAG performance index SQL.

Important: align embedding dimensions before running the vector index scripts.

- Current repo instructions say the active Azure embedding deployment uses `text-embedding-3-small` with `RAG_EMBED_DIMENSIONS=1024`.
- Some SQL/docs still reference `1536`.
- Do not bulk-index production contracts until the `ContractEmbedding.embedding` vector dimension and `RAG_EMBED_DIMENSIONS` agree.

Recommended current setting:

```text
RAG_EMBED_MODEL=text-embedding-3-small
RAG_EMBED_DIMENSIONS=1024
```

If using 1024 dimensions, update or parameterize [init/02-rag-performance-indexes.sql](../../init/02-rag-performance-indexes.sql) and [init/03-halfvec-quantization.sql](../../init/03-halfvec-quantization.sql) before running them, because they currently force `1536` in places.

Then run:

```bash
psql "$DIRECT_DATABASE_URL" -f init/02-rag-performance-indexes.sql

# Optional only after the dimension is aligned and pgvector supports halfvec.
psql "$DIRECT_DATABASE_URL" -f init/03-halfvec-quantization.sql
```

Verify tables and migrations:

```bash
psql "$DIRECT_DATABASE_URL" -c 'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 10;'
psql "$DIRECT_DATABASE_URL" -c 'SELECT COUNT(*) FROM "Tenant";'
psql "$DIRECT_DATABASE_URL" -c 'SELECT COUNT(*) FROM "Contract";'
```

## Redis

Create Azure Cache for Redis.

```bash
az redis create \
  --resource-group rg-contigo-prod \
  --name redis-contigo-prod \
  --location switzerlandnorth \
  --sku Basic \
  --vm-size c1 \
  --enable-non-ssl-port false
```

Get the host and primary key:

```bash
az redis show \
  --resource-group rg-contigo-prod \
  --name redis-contigo-prod \
  --query hostName -o tsv

az redis list-keys \
  --resource-group rg-contigo-prod \
  --name redis-contigo-prod \
  --query primaryKey -o tsv
```

Set both URL and host/port variables because different parts of the app use different forms.

```text
REDIS_URL=rediss://:<primary-key>@redis-contigo-prod.redis.cache.windows.net:6380
REDIS_HOST=redis-contigo-prod.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=<primary-key>
```

## Object Storage

### Recommended for immediate go-live: keep MinIO/S3-compatible storage

The web app has an Azure Blob adapter, but workers still explicitly expect MinIO/S3 variables in production for OCR file retrieval. For the fastest reliable live demo, keep MinIO or another S3-compatible endpoint.

Set:

```text
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=<internal-minio-host>
MINIO_PORT=9000
MINIO_ACCESS_KEY=<secure-access-key>
MINIO_SECRET_KEY=<secure-secret-key>
MINIO_BUCKET=contracts
MINIO_USE_SSL=false
S3_BUCKET=contracts
```

If MinIO is hosted publicly or separately, enable TLS and set `MINIO_USE_SSL=true`.

### Azure Blob option

Azure Blob can be used after worker compatibility is verified or patched.

Required variables:

```text
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT_NAME=stcontigoprod
AZURE_STORAGE_ACCOUNT_KEY=<storage-key>
AZURE_STORAGE_CONTAINER_NAME=contracts
AZURE_STORAGE_REGION=switzerlandnorth
```

Before choosing Azure Blob only, verify upload, OCR worker download, artifact generation, deletion, and signed URL flows end to end.

## Azure OpenAI

Create or use an Azure OpenAI resource and deploy:

- Chat deployment: `gpt-4o`
- Embedding deployment: `text-embedding-3-small`

Required variables:

```text
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-02-01
RAG_EMBED_MODEL=text-embedding-3-small
RAG_EMBED_DIMENSIONS=1024
```

Confirm quota before the demo. Upload and artifact generation can make many calls.

## Azure Document Intelligence

Create an Azure AI Document Intelligence resource.

Required variables:

```text
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<key>
AZURE_DI_DEFAULT_MODEL=layout
AZURE_DI_FEATURES=keyValuePairs
```

If using separate EU variables, set these too:

```text
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_EU=<endpoint>
AZURE_DOCUMENT_INTELLIGENCE_KEY_EU=<key>
```

## Key Vault

Store all secrets in Key Vault and grant the hosting identity read access.

Create Key Vault:

```bash
az keyvault create \
  --resource-group rg-contigo-prod \
  --name kv-contigo-prod \
  --location switzerlandnorth \
  --enable-rbac-authorization true
```

Minimum secrets:

```text
database-url
direct-database-url
redis-url
redis-password
auth-secret
jwt-secret
session-secret
azure-openai-endpoint
azure-openai-api-key
azure-document-intelligence-endpoint
azure-document-intelligence-key
minio-access-key
minio-secret-key
minio-endpoint
storage-account-key, if Azure Blob is used
sentry-dsn, if enabled
sendgrid-api-key, if email is enabled
```

Generate strong app secrets:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Never use `change-me-in-production` or demo secrets in Azure.

## Required Application Environment

Set these on the web container and worker container, adjusting storage variables based on the chosen provider.

```text
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
LOG_LEVEL=info

NEXTAUTH_URL=https://<your-domain>
AUTH_TRUST_HOST=true
AUTH_SECRET=<secret>
JWT_SECRET=<secret>
SESSION_SECRET=<secret>
REQUIRE_AUTH=true

DATABASE_URL=<pooled-or-direct-db-url>
DIRECT_DATABASE_URL=<direct-db-url>

REDIS_URL=<redis-url>
REDIS_HOST=<redis-host>
REDIS_PORT=6380
REDIS_PASSWORD=<redis-key>

AZURE_OPENAI_ENDPOINT=<endpoint>
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-02-01
RAG_EMBED_MODEL=text-embedding-3-small
RAG_EMBED_DIMENSIONS=1024
RAG_INTEGRATION_ENABLED=true
RAG_AUTO_INDEX=true

AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=<endpoint>
AZURE_DOCUMENT_INTELLIGENCE_KEY=<key>
AZURE_DI_DEFAULT_MODEL=layout
AZURE_DI_FEATURES=keyValuePairs

STORAGE_PROVIDER=minio
MINIO_ENDPOINT=<host>
MINIO_PORT=9000
MINIO_ACCESS_KEY=<key>
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=contracts
MINIO_USE_SSL=false
S3_BUCKET=contracts
```

Optional but recommended:

```text
SENTRY_DSN=<dsn>
ENABLE_HEALTH_CHECKS=true
ENABLE_AI_FEATURES=true
SLOW_QUERY_THRESHOLD=1000
```

## Hosting Setup

### Azure Container Apps recommendation

Create a Container Apps environment with Log Analytics.

Deploy at least two apps:

- `contigo-web`: external ingress enabled, target port `3000`.
- `contigo-workers`: no external ingress.

Assign a managed identity to both apps and grant:

- Key Vault Secrets User on `kv-contigo-prod`.
- AcrPull on `acrcontigoprod` if using managed identity image pulls.

For MinIO on Container Apps, either:

- Run MinIO as a separate internal container app with persistent Azure Files mounted, or
- Use a managed S3-compatible service.

For production, avoid ephemeral filesystem storage for contract files.

### AKS existing path

The repo has AKS-oriented IaC and Helm:

- [infrastructure/azure/main.bicep](../../infrastructure/azure/main.bicep)
- [infrastructure/azure/deploy.sh](../../infrastructure/azure/deploy.sh)
- [helm/contigo/values-azure.yaml](../../helm/contigo/values-azure.yaml)

Before using this path:

1. Confirm the Bicep SKU choices and PostgreSQL version.
2. Add all missing production secrets to [helm/contigo/templates/secrets.yaml](../../helm/contigo/templates/secrets.yaml).
3. Fix storage mode: the Azure values set `STORAGE_PROVIDER=azure`, while workers still require MinIO/S3 settings.
4. Add `DIRECT_DATABASE_URL`, Azure OpenAI, Document Intelligence, RAG, Redis host/port, and storage variables to the chart.
5. Install NGINX ingress and cert-manager.
6. Configure a `ClusterIssuer` for TLS.
7. Use immutable image tags instead of only `latest`.

### VM/Docker Compose path

For immediate live demo:

1. Provision or reuse the Azure VM.
2. Install Docker and Docker Compose.
3. Copy production env values to the VM.
4. Start [docker-compose.vm.yml](../../docker-compose.vm.yml).
5. Add Nginx or Cloudflare Tunnel for HTTPS.
6. Set `NEXTAUTH_URL` to the final HTTPS domain.
7. Confirm ports `80` and `443` are reachable through Azure NSG and any Cloudflare settings.

## Demo Tenant and Seed Data

Run this after migrations.

```bash
DATABASE_URL="$DATABASE_URL" \
DIRECT_DATABASE_URL="$DIRECT_DATABASE_URL" \
pnpm tsx scripts/create-demo-user.ts
```

The script creates:

```text
Tenant ID: demo
Tenant slug: demo
User: demo@example.com
Default password: demo123
```

For a real client demo, immediately change the password or create a client-specific user.

Optional demo renewal data:

```bash
DATABASE_URL="$DATABASE_URL" \
DIRECT_DATABASE_URL="$DIRECT_DATABASE_URL" \
pnpm tsx scripts/seed-renewals-demo.ts
```

Be careful with [scripts/seed-all-demo-data.sql](../../scripts/seed-all-demo-data.sql). It uses tenant ID `demo-tenant`, while the login demo user belongs to tenant ID `demo`. Adapt it before using it for the client demo tenant.

Verify demo data:

```bash
psql "$DIRECT_DATABASE_URL" -c 'SELECT id, name, slug, status FROM "Tenant" ORDER BY "createdAt" DESC LIMIT 10;'
psql "$DIRECT_DATABASE_URL" -c 'SELECT email, "tenantId", status FROM "User" WHERE email = '\''demo@example.com'\'';'
```

## DNS and HTTPS

1. Configure the final domain.
2. Point DNS to the Azure ingress endpoint, VM public IP, Application Gateway, or Cloudflare Tunnel.
3. Enable TLS.
4. If Cloudflare is used, prefer Full Strict mode with a valid origin certificate.
5. Set `NEXTAUTH_URL=https://<domain>`.
6. Restart the web app after changing auth/domain variables.

Validation:

```bash
curl -I https://<domain>/api/health
curl -I https://<domain>/login
```

## Post-Deploy Verification

Run these checks before giving the client access.

### Health and auth

- `GET /api/health` returns healthy.
- Login works with the demo user or client-specific user.
- Session cookies are secure over HTTPS.
- `NEXTAUTH_URL` matches the browser URL exactly.

### Database

- Prisma migrations are applied.
- Required extensions exist.
- `Tenant`, `User`, `Contract`, `Artifact`, and `ContractEmbedding` tables exist.
- The demo tenant exists.

### Upload and AI pipeline

1. Upload a PDF contract.
2. Confirm the contract leaves `PROCESSING` status.
3. Confirm `rawText` and `searchableText` are saved.
4. Confirm Azure Document Intelligence extracted text.
5. Confirm Azure OpenAI generated artifacts.
6. Confirm the 14 expected artifact types are created.
7. Confirm RAG embeddings are created when enabled.
8. Ask the chat a question about the uploaded contract.

Useful checks:

```bash
psql "$DIRECT_DATABASE_URL" -c 'SELECT id, status, filename, "tenantId", "createdAt" FROM "Contract" ORDER BY "createdAt" DESC LIMIT 5;'
psql "$DIRECT_DATABASE_URL" -c 'SELECT type, COUNT(*) FROM "Artifact" GROUP BY type ORDER BY type;'
psql "$DIRECT_DATABASE_URL" -c 'SELECT COUNT(*) FROM "ContractEmbedding";'
```

### Storage

- Uploaded contract files persist after container restart.
- Workers can download the uploaded file.
- Delete/archive flows do not leave broken references.

### Redis/workers

- Workers start without missing env errors.
- Queues process upload/OCR/RAG jobs.
- Redis TLS settings work in production.

### Observability

- Container logs are visible.
- Health checks are configured.
- Error tracking is configured if Sentry is used.
- Azure Monitor alerts exist for app down, worker failures, database CPU/storage, Redis memory, and AI error spikes.

## Security Checklist

- Rotate demo passwords before client access.
- Disable or restrict public PostgreSQL access.
- Disable or restrict public Redis access.
- Store secrets only in Key Vault or the hosting platform secret store.
- Enable backups for PostgreSQL.
- Enable soft delete on Key Vault.
- Use least-privilege managed identities.
- Use HTTPS only.
- Set strong `AUTH_SECRET`, `JWT_SECRET`, and `SESSION_SECRET`.
- Confirm `REQUIRE_AUTH=true` in production.
- Confirm no `.env.production` or secrets are committed.

## Known Repo Gaps To Resolve Before Managed Production

1. No `.azure/deployment-plan.md` currently exists. Create one before running the Azure prepare/validate/deploy workflow.
2. [helm/contigo/templates/secrets.yaml](../../helm/contigo/templates/secrets.yaml) does not expose all required production variables.
3. [helm/contigo/values-azure.yaml](../../helm/contigo/values-azure.yaml) sets `STORAGE_PROVIDER=azure`, but worker code still requires MinIO/S3 credentials in production.
4. RAG embedding dimension defaults are inconsistent across docs/scripts. Align `RAG_EMBED_DIMENSIONS`, vector column dimensions, and index SQL before production RAG indexing.
5. [apps/web/.env.production.example](../../apps/web/.env.production.example) is missing several Azure-specific variables used by the app.
6. [infrastructure/azure/main.bicep](../../infrastructure/azure/main.bicep) is AKS-oriented. Prefer Container Apps for lower operational load unless AKS is required.

## Minimal Go-Live Order

Use this order for the first live Azure deployment.

1. Choose VM demo or managed Azure hosting.
2. Create resource group and networking.
3. Create Key Vault.
4. Create PostgreSQL Flexible Server.
5. Enable PostgreSQL extensions.
6. Create Redis.
7. Set up storage, preferably MinIO/S3-compatible for the first go-live.
8. Create or confirm Azure OpenAI deployments.
9. Create or confirm Document Intelligence.
10. Build and push container images.
11. Configure app secrets/env vars.
12. Run Prisma migrations.
13. Run RAG index SQL after dimension alignment.
14. Deploy web and workers.
15. Configure HTTPS/domain.
16. Seed demo tenant/user.
17. Upload a real demo contract and verify OCR/artifacts/RAG/chat.
18. Rotate demo credentials and hand over the final URL.