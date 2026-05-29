# ConTigo Azure Deployment Plan

Status: Ready for Validation

## Goal

Prepare ConTigo for a fully live Azure deployment with application hosting, PostgreSQL, Redis, object storage, Azure OpenAI, Azure Document Intelligence, Key Vault secrets, Prisma migrations, RAG indexing, and a client-safe demo tenant.

## Deployment Mode

Primary recommendation: Azure Container Apps for lower operational overhead.

Supported existing path: AKS with the Helm chart under `helm/contigo` and the existing AKS-oriented Bicep under `infrastructure/azure`.

Fast demo fallback: Azure VM with Docker Compose using `docker-compose.vm.yml`.

## Architecture Decisions

| Area | Decision |
|---|---|
| Region | `switzerlandnorth` by default |
| Images | Azure Container Registry preferred; GHCR remains possible |
| Database | Azure Database for PostgreSQL Flexible Server |
| Database extensions | `vector`, `uuid-ossp`, `pg_trgm`, `btree_gin`, `pgcrypto` |
| Migrations | `pnpm db:migrate` / Prisma migrate deploy |
| Cache/queue | Azure Cache for Redis with TLS |
| Storage | MinIO/S3-compatible for first go-live because workers currently rely on S3/MinIO download paths |
| Azure Blob | Configured as an explicit later switch, after worker parity verification |
| Chat model | Azure OpenAI `gpt-4o` deployment |
| Embeddings | Azure OpenAI `text-embedding-3-small`, 1024 dimensions |
| OCR | Azure Document Intelligence `layout` model |
| Secrets | Azure Key Vault mapped into runtime environment |
| Demo tenant | `pnpm db:seed:demo:prod` with `DEMO_USER_PASSWORD` |

## Prepared Artifacts

- `docs/deployment/AZURE_GO_LIVE_RUNBOOK.md`: operational Azure go-live checklist.
- `apps/web/.env.production.example`: expanded production env template.
- `helm/contigo/templates/configmap.yaml`: renders runtime non-secret env from values.
- `helm/contigo/templates/secrets.yaml`: maps Key Vault objects to the app secret env names.
- `helm/contigo/values.yaml`: default runtime env and manual secret placeholders.
- `helm/contigo/values-azure.yaml`: Azure production defaults aligned to MinIO/S3 first go-live and 1024-dim RAG.
- `init/02-rag-performance-indexes.sql`: 1024-dim vector index helper.
- `init/03-halfvec-quantization.sql`: 1024-dim halfvec helper.
- `scripts/seed-production-demo.ts`: idempotent production demo tenant/user seed script.
- `package.json`: `db:seed:demo:prod` command.

## Validation Performed Locally

- `git diff --check`: passed.
- Runtime RAG fallback grep for `1536`: no remaining TypeScript/SQL runtime defaults.
- Focused TypeScript check for `scripts/seed-production-demo.ts`: passed.
- `pnpm exec tsx --version`: passed.

Helm was not installed in the current container, so Helm rendering must be run in an environment with Helm before deployment:

```bash
helm template contigo helm/contigo -f helm/contigo/values-azure.yaml >/tmp/contigo-helm-render.yaml
```

## Validation Still Required

1. Confirm Azure subscription, tenant, region, and quotas.
2. Confirm Key Vault object names match `helm/contigo/values.yaml`.
3. Render and lint the Helm chart with Helm installed.
4. Validate PostgreSQL Flexible Server supports required extensions in the chosen region/SKU.
5. Run Prisma migrations against a staging Azure database.
6. Upload a PDF and verify OCR, artifacts, RAG embeddings, and chat end to end.

## Deployment Execution Guardrail

This plan prepares deployment assets only. Do not run production deployment commands until validation is complete and the target Azure subscription/domain are confirmed.
