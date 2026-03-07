**Azure Migration Guide**

This document describes how to migrate the Contract Intelligence platform (Next.js frontend, Fastify backend, PostgreSQL + pgvector, Redis, MinIO, workers, and vector/RAG components) from a local/Docker setup into Microsoft Azure. It covers recommended Azure services, tradeoffs, migration steps, sample commands, and testing/rollback guidance.

**Decision Summary**:
- **Migrate core stateful services to managed Azure PaaS**: use Azure Database for PostgreSQL (Flexible Server) or a managed alternative, Azure Cache for Redis, and Azure Blob Storage in place of MinIO. Managed PaaS reduces operational burden and improves reliability.
- **Run application components as containers**: package the backend, workers, and any long-running services as Docker containers and run them on Azure Container Apps (serverless containers) or Azure Kubernetes Service (AKS) depending on scale and operational appetite. The Next.js frontend can be deployed to Azure Static Web Apps (or to Container Apps / App Service if server-side logic needed).
- **Vector/search options**: If you rely on `pgvector` in PostgreSQL, validate pgvector support on the selected managed Postgres. If pgvector support is not available or you want a fully-managed vector search, consider Azure Cognitive Search with vector capabilities as a lower operational-cost managed alternative.

**When it makes sense to migrate everything**
- **Migrate stateful services (DB, Redis, Storage)**: yes — almost always beneficial to move these to Azure-managed services for better reliability, backups, monitoring, and simplified ops.
- **Migrate compute (backend, workers, frontend)**: yes — containerizing and running on Azure reduces machine management and provides built-in scaling. For small teams, Azure Container Apps or App Service (Linux containers) is cheaper and faster to operate than AKS.
- **Keep some pieces self-hosted?** If you are cost-sensitive and already running everything cheaply on a single VM or small Docker host, you could keep MinIO/Redis/Postgres on a VM. However, this increases ops work and reduces reliability; for most production use-cases migrate to managed services.

**Azure Service Mapping (recommended)**
- **Next.js frontend**: `Azure Static Web Apps` (if mostly static + API via Azure Functions) or `Azure App Service (Linux)` / `Azure Container Apps` for SSR Next.js. Static Web Apps is the simplest and cheapest for static and API-based apps.
- **Fastify backend API**: `Azure Container Apps` (serverless containers) or `Azure App Service for Containers` for simpler deployments. Use `AKS` if you need advanced networking, custom CRDs, or very high scale.
- **Workers (BullMQ, background processors)**: `Azure Container Apps` with KEDA scaling or `Azure Container Instances` for short jobs. For event-driven tasks, consider `Azure Functions` (but migrating BullMQ requires rework — keep BullMQ + Redis on containers if you prefer less code change).
- **PostgreSQL + pgvector**: `Azure Database for PostgreSQL - Flexible Server` (preferred). Validate `pgvector` availability in your chosen SKU/region. If pgvector is not available, options are:
  - Run a managed Postgres on an Azure VM (self-managed) and enable pgvector
  - Use `Azure Cognitive Search` (vector search) and store embeddings there instead of pgvector
  - Use a vector DB on AKS (Milvus or similar) — higher ops cost
- **Vector search / RAG**: `Azure Cognitive Search` (supports vector search) or continue using `pgvector` if supported. Azure Cognitive Search is fully managed and integrates with Azure OpenAI.
- **Redis**: `Azure Cache for Redis` (PaaS) — use Basic/Premium tier depending on clustering needs.
- **MinIO / Object storage**: `Azure Blob Storage` (Hot/Cool/Archive tiers) — cheaper and fully managed. Use `Blob Storage` with SAS or private endpoints and update the application to use Azure SDK or keep S3-compatible MinIO client if you run MinIO in front of Blob (not necessary).
- **Secrets & keys**: `Azure Key Vault` for OpenAI keys, DB credentials, storage keys. Use Managed Identity for service-to-service auth.
- **LLM/Embeddings**: `Azure OpenAI Service` (recommended if you want integration with Azure billing and security). You can also continue to use OpenAI's public API.
- **Container registry**: `Azure Container Registry (ACR)` for storing images.
- **CI/CD**: `GitHub Actions` (recommended) or `Azure Pipelines` with deployment to ACR and Container Apps/App Service/AKS.
- **Logging & Monitoring**: `Azure Monitor`, `Application Insights`, and `Log Analytics`.

**Tradeoffs & cost-considerations (quick)**
- Azure PaaS reduces ops/time-to-market but may cost more than a single self-hosted VM at small scale.
- `Azure Container Apps` is typically cheaper and operationally simpler than `AKS` for microservices/containers.
- `Azure Cognitive Search` offloads vector search ops, but you may pay more per query; it simplifies scaling and reduces maintenance compared to self-managed pgvector clusters.

Migration Steps (high level)
1. Inventory & readiness
   - List all services, ports, env vars, secrets (see `SYSTEM_ARCHITECTURE.md` and `apps/*` env examples).
   - Identify any DB extensions required (`pgvector`, `pg_trgm`, etc.).
   - Decide whether to migrate vector storage to PostgreSQL or Azure Cognitive Search.

2. Containerize apps
   - Ensure each service has a `Dockerfile` (Next.js, Fastify API, workers). The repo already includes Dockerfiles (see repo root). Build and test images locally.
   - Tag images and push to ACR.

3. Provision core Azure resources (example using `az`)

PowerShell example (replace placeholders):

```powershell
# Login and set subscription
az login
az account set --subscription "<SUBSCRIPTION_ID>"

# Create resource group
az group create --name contract-rg --location eastus

# Create ACR
az acr create --resource-group contract-rg --name contractacr --sku Basic

# Create Azure Database for PostgreSQL Flexible Server (example)
az postgres flexible-server create --resource-group contract-rg --name contract-pg --location eastus --admin-user pgadmin --admin-password "<StrongPassword>" --sku-name Standard_B1ms --version 14

# Create Azure Cache for Redis
az redis create --name contract-redis --resource-group contract-rg --sku Basic --vm-size c0

# Create storage account for blobs
az storage account create --name contractstorageacct --resource-group contract-rg --location eastus --sku Standard_LRS --kind StorageV2

# Create ACR credentials and push images (local Docker auth to ACR)
az acr login --name contractacr
docker tag local-image contractacr.azurecr.io/contract-api:latest
docker push contractacr.azurecr.io/contract-api:latest
```

4. Database migration
   - Take a logical dump from local Postgres: `pg_dump -Fc -d contract_intelligence -f dumpfile.dump`
   - Create target PostgreSQL (Flexible Server) and enable required extensions. If pgvector is unavailable, create a plan to migrate embeddings into Azure Cognitive Search or run Postgres on a VM.
   - Restore: `pg_restore --host <pg_host> --username <user> --dbname <db> -v dumpfile.dump`
   - Validate data, indexes, and vector fields.

5. Storage migration (MinIO -> Blob)
   - If using the AWS S3 SDK, you can keep using it with the Azure Blob S3 gateway or switch to the Azure SDK. Simpler: copy objects using `rclone` or Azure Data Factory from MinIO to Blob Storage.
   - Update the application to use the new endpoint/credentials and test uploads/downloads.

6. Redis & queue
   - Provision `Azure Cache for Redis` and update `REDIS_URL` to point to the new instance.
   - Ensure network connectivity (VNet integration / private endpoints) and update firewall rules.

7. Deploy compute
   - Deploy the Fastify API and workers as container apps or App Service using images from ACR.
   - Deploy Next.js to `Static Web Apps` or App Service. If using SSR, prefer App Service or Container Apps with the built image.

8. Vector search / RAG
   - If moving to `Azure Cognitive Search`, create an index with vector fields and an ingestion pipeline for embeddings.
   - Re-run embedding generation (using Azure OpenAI or OpenAI API) and index embeddings into Cognitive Search.

9. Secrets & access
   - Store secrets in `Azure Key Vault` and grant Managed Identity permissions to services.
   - Use private endpoints for DB, Redis and Storage to keep traffic off the public internet.

10. Monitoring & alerts
   - Enable Application Insights for frontend/backend, configure Log Analytics, set SLO-based alerts, and add cost alerts.

11. Cutover & rollback plan
   - Deploy in a staging slot first and test end-to-end with synthetic uploads.
   - For DB cutover, consider a blue-green approach: stop writes to source DB, take final incremental dump, restore to target, switch application connection string.
   - Keep the old environment available for rollback for a defined period.

**Cheap/low-ops Azure alternatives**
- `Azure Container Apps` — cheaper and lower maintenance than AKS for microservices.
- `Azure Static Web Apps` — cheapest for static/SSR-friendly Next.js if your app fits the model.
- `Azure Cognitive Search` — managed vector search alternative to self-hosted `pgvector` or Milvus.
- `Azure Database for PostgreSQL Flexible Server (Basic tiers)` — managed and simpler vs self-hosted VMs; use smallest SKU initially.
- `Azure Cache for Redis (Basic)` — low-cost cache for development and small production workloads.

**Caveats & things to validate**
- Confirm `pgvector` availability on Azure Database for PostgreSQL in your region/SKU. If not available, evaluate Cognitive Search or self-managed Postgres on an Azure VM.
- If your code relies heavily on S3-specific features, audit storage access code and map to Blob Storage APIs or use an S3 gateway.
- Evaluate network architecture early: use VNets and private endpoints to avoid exposing DB/Redis publicly.

**Testing checklist**
- End-to-end upload: upload a PDF, verify stored artifact in blob storage, verify DB record, verify worker processes artifacts and LLM calls.
- RAG query: run sample semantic queries and validate results/latency.
- Background jobs: ensure BullMQ workers can connect to Azure Cache for Redis.
- Failure & retry: simulate service outages and validate graceful retries.

**Appendix: Useful `az` commands (quick reference)**

Create resource group and ACR (PowerShell):

```powershell
az group create --name contract-rg --location eastus
az acr create --resource-group contract-rg --name contractacr --sku Basic
az acr login --name contractacr
```

Create PostgreSQL Flexible Server (PowerShell):

```powershell
az postgres flexible-server create --resource-group contract-rg --name contract-pg --location eastus --admin-user pgadmin --admin-password "<StrongPassword>" --sku-name Standard_B1ms --version 14
```

Create Azure Cache for Redis (PowerShell):

```powershell
az redis create --name contract-redis --resource-group contract-rg --sku Basic --vm-size c0
```

Create Storage account for blobs (PowerShell):

```powershell
az storage account create --name contractstorageacct --resource-group contract-rg --location eastus --sku Standard_LRS --kind StorageV2
```

Deploy Container App (very short example):

```powershell
az containerapp env create --name contract-env --resource-group contract-rg --location eastus
az containerapp create --name contract-api --resource-group contract-rg --environment contract-env --image contractacr.azurecr.io/contract-api:latest --registry-server contractacr.azurecr.io --cpu 0.5 --memory 1.0
```

**Next steps / Recommended plan**
- 1) Validate `pgvector` availability in your preferred Azure region and SKU. If confirmed, plan Postgres Flexible Server migration. If not, evaluate moving vector storage to Azure Cognitive Search.
- 2) Containerize all services (if not already), push images to ACR.
- 3) Provision resources in a staging resource group and run an end-to-end test with a sample dataset.
- 4) Iterate on networking (VNet / Private Endpoints), Key Vault integration, and CI/CD pipelines.

If you'd like, I can: containerize any service missing a Dockerfile, generate sample GitHub Actions workflows for CI/CD to ACR + Container Apps, or create Terraform templates to provision the resources described above. Tell me which next step you prefer.
