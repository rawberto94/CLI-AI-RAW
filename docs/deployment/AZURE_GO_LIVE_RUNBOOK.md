# Azure Go-Live Runbook — V2

**Version 2 — May 2026**
Supersedes `AZURE_GO_LIVE_RUNBOOK.md` for the current ConTigo deployment.

---

## Why V1 Option A No Longer Applies

V1 of this runbook presented **Option A (Azure VM + Docker Compose)** as the recommended fast path. That was written for a greenfield deployment with no existing infrastructure. It is now inaccurate because:

- The Azure Container App `contigo` is **already live** in resource group `contigoContainerApps` (Switzerland North) at `https://www.mycontigo.app`.
- Azure Container Registry (`contigoacr2026`), Key Vault (`contigo`), Azure OpenAI (`contigo-openai`), Document Intelligence (`ConTigoDocumentIntelligence`), Application Insights, and Log Analytics are **already provisioned**.
- Neon Serverless Postgres is **already connected** and all Prisma migrations are applied.
- The CI/CD pipeline (`.github/workflows/deploy-container-apps.yml`) deploys directly to the existing Container App via `workflow_dispatch`.

Provisioning a VM and running Docker Compose would create a parallel environment and duplicate cost. Do not follow V1 Option A.

---

## Current State

| Resource | Name | Status |
|---|---|---|
| Container App | `contigo` | ✅ Running — `www.mycontigo.app` |
| Container Registry | `contigoacr2026` | ✅ Running |
| Azure OpenAI | `contigo-openai` | ✅ Running — `gpt-4o` + `text-embedding-3-small` wired |
| Document Intelligence | `ConTigoDocumentIntelligence` | ✅ Provisioned — ❌ **not wired to app** |
| Key Vault | `contigo` | ✅ Running |
| Application Insights | `contigo-insights` | ✅ Running — wired |
| Neon DB | `ep-long-wildflower-*` (gwc, Azure) | ✅ Connected — migrations applied |
| Redis | — | ❌ **Does not exist** |
| File Storage | — | ❌ **Does not exist** — uploads fall back to ephemeral container disk |

### What Works Right Now Without the Missing Pieces

The app has deliberate fallbacks that explain why processing worked without Redis or storage:

- **No Redis**: `queue-init.ts` detects missing `REDIS_HOST`/`REDIS_URL` in production and disables BullMQ, falling back to **inline synchronous processing**. Artifacts are generated directly inside the upload API request. This works but the upload request blocks until all 14 artifacts are done (~30–90 seconds per contract).
- **No storage**: `upload-single.ts` tries S3/MinIO first and, on failure, writes to the **container's local filesystem** (`uploads/contracts/{tenantId}/`). The contract metadata and extracted text are saved to Neon (durable). The PDF file lands on ephemeral container disk and is **wiped on every redeploy, scale event, or restart**.

This means existing contract records in the database are safe, but their original PDF files are likely already gone from disk if the container has restarted since upload.

---

## What Needs to Be Done

Three steps, in order of priority:

| Step | What | Time | Cost |
|---|---|---|---|
| 1 | Wire Document Intelligence | ~5 min | Free (resource exists) |
| 2 | Set up Cloudflare R2 for file storage | ~10 min | Free (10 GB / 1M ops) |
| 3 | Create Redis for fast bulk uploads | ~15 min | ~€16/month |

Steps 1 and 2 are **required** before a customer demo. Step 3 is **strongly recommended** if you plan to upload 100 contracts — without it, each upload blocks for 30–90 seconds and bulk uploading 100 contracts would take 2–3 hours of sequential waiting. With Redis, the same batch completes in 15–20 minutes.

---

## Step 1 — Wire Document Intelligence

The `ConTigoDocumentIntelligence` resource exists in `contigoContainerApps` but its credentials are not set on the Container App. Without them, OCR falls back to basic PDF text extraction instead of Azure's layout model.

Get the key:

```bash
az cognitiveservices account keys list \
  --name ConTigoDocumentIntelligence \
  --resource-group contigoContainerApps \
  --query key1 -o tsv
```

Wire it to the Container App:

```bash
az containerapp update \
  --name contigo \
  --resource-group contigoContainerApps \
  --set-env-vars \
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://contigodocumentintelligence.cognitiveservices.azure.com/ \
    AZURE_DOCUMENT_INTELLIGENCE_KEY=<key-from-above> \
    AZURE_DI_DEFAULT_MODEL=layout \
    AZURE_DI_FEATURES=keyValuePairs
```

---

## Step 2 — File Storage with Cloudflare R2

The app's `storage-service.ts` uses the MinIO S3 client and supports any S3-compatible endpoint. It does **not** have a native Azure Blob write path — the Azure Blob references in V1 were aspirational and would require code changes. Cloudflare R2 is S3-compatible, requires zero code changes, and has a free tier large enough for a demo (10 GB storage, 1 million Class A operations per month).

### Create the R2 bucket

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**.
2. Name it `contracts`.
3. For jurisdiction, select **European Union** if data residency matters for the demo.
4. Note your **Account ID** from the R2 overview page URL: `dash.cloudflare.com/<account-id>/r2`.

### Create an API token

1. In R2 → **Manage R2 API tokens** → **Create API token**.
2. Set permissions: **Object Read & Write**.
3. Scope to bucket `contracts`.
4. Copy the **Access Key ID** and **Secret Access Key** — they are shown only once.

### Wire to the Container App

```bash
az containerapp update \
  --name contigo \
  --resource-group contigoContainerApps \
  --set-env-vars \
    S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
    S3_ACCESS_KEY=<r2-access-key-id> \
    S3_SECRET_KEY=<r2-access-key-secret> \
    S3_BUCKET=contracts \
    S3_USE_SSL=true \
    S3_REGION=auto \
    MINIO_BUCKET=contracts
```

After this change the Container App restarts. Verify by uploading a test contract and checking the R2 bucket in the Cloudflare dashboard.

---

## Step 3 — Redis for Fast Bulk Uploads

Without Redis, the app processes each contract inline and the upload request does not return until all 14 artifacts are generated. For 100 contracts this means:

- **Without Redis**: ~30–90 seconds per contract → 50–150 minutes total if uploading sequentially.
- **With Redis**: uploads return immediately, BullMQ workers process jobs in parallel → ~15–20 minutes total, limited mainly by Azure OpenAI rate limits.

The Container App already runs PM2 workers inside the container (4 vCPU / 8 GB). Adding Redis activates them.

### Create Azure Cache for Redis

```bash
az redis create \
  --resource-group contigoContainerApps \
  --name redis-contigo \
  --location switzerlandnorth \
  --sku Basic \
  --vm-size c1 \
  --enable-non-ssl-port false
```

Creation takes about 10–15 minutes. Wait for `provisioningState` to be `Succeeded`:

```bash
az redis show \
  --resource-group contigoContainerApps \
  --name redis-contigo \
  --query provisioningState -o tsv
```

### Get the connection details

```bash
az redis show \
  --resource-group contigoContainerApps \
  --name redis-contigo \
  --query hostName -o tsv

az redis list-keys \
  --resource-group contigoContainerApps \
  --name redis-contigo \
  --query primaryKey -o tsv
```

### Wire to the Container App

```bash
az containerapp update \
  --name contigo \
  --resource-group contigoContainerApps \
  --set-env-vars \
    REDIS_URL=rediss://:<primary-key>@redis-contigo.redis.cache.windows.net:6380 \
    REDIS_HOST=redis-contigo.redis.cache.windows.net \
    REDIS_PORT=6380 \
    REDIS_PASSWORD=<primary-key> \
    REDIS_TLS=true
```

---

## Deploying a New Version

Deployments are manual and require confirmation to prevent accidental production pushes. Trigger via GitHub Actions:

1. Go to **Actions** → **Deploy to Azure Container Apps** → **Run workflow**.
2. Select environment: `production`.
3. Type `deploy-production` in the confirmation field.
4. The workflow builds the image, pushes to `contigoacr2026`, and updates the Container App.

The current live image is `contigoacr2026.azurecr.io/contigo:v20260417-admin2` (4 vCPU / 8 GB). Any `az containerapp update --set-env-vars` command triggers an automatic restart with zero downtime.

---

## Customer Onboarding — No Seed Script Required

The signup route (`/auth/signup`) supports open self-registration. Each new registration with an organization name creates an isolated tenant automatically. Customers can register at:

```
https://www.mycontigo.app/auth/signup
```

Pre-seeding a demo tenant (`pnpm db:seed:demo:prod`) is only needed if you want to walk a customer through a pre-loaded environment with sample contracts. For a live evaluation where the customer uploads their own 100 contracts, self-registration is the correct flow.

### Password requirements

The signup route enforces: minimum 8 characters, at least one uppercase, one lowercase, one number, one special character.

---

## Bulk Uploading 100 Contracts

Once Steps 1–3 are complete, upload contracts through the UI using the **Upload** button or in batch using the **New Contract → Batch** flow.

For scripted bulk upload (faster than clicking through the UI):

```bash
# 1. Get CSRF token
CSRF=$(curl -s -c /tmp/cookies.txt https://www.mycontigo.app/api/auth/csrf \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")

# 2. Sign in
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST https://www.mycontigo.app/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=$CSRF&email=user@example.com&password=YourPassword1!&redirect=false"

# 3. Upload all PDFs (the upload endpoint is CSRF-exempt for multipart)
for f in ./contracts/*.pdf; do
  curl -s -b /tmp/cookies.txt \
    -F "file=@$f" \
    https://www.mycontigo.app/api/contracts/upload
  echo "Uploaded: $f"
done
```

With Redis in place, each upload queues immediately and workers process in parallel. Without Redis, add `sleep 5` between uploads to avoid overloading the inline processor.

---

## Post-Deploy Verification Checklist

Run these after completing all three steps.

```bash
# App is healthy
curl -I https://www.mycontigo.app/api/health

# Upload a test contract and verify processing completes
# Check in the UI: contract should move from PROCESSING → status shows artifacts

# Verify file is in R2 (not on ephemeral disk)
# Check Cloudflare R2 dashboard → contracts bucket → should contain the uploaded file

# Verify DI is being used (check Application Insights logs for DI calls)
az monitor app-insights query \
  --app contigo-insights \
  --resource-group contigoContainerApps \
  --analytics-query "traces | where message contains 'DocumentIntelligence' | order by timestamp desc | take 10"
```

---

## Cost Summary (Demo)

The Container App runs on the **Consumption plan** with `minReplicas: 0`. This means compute is billed per second only when the app is actually running — when idle it scales to zero and costs nothing. Azure includes a free monthly grant of 180,000 vCPU-seconds and 360,000 GB-seconds, which covers roughly 12 hours of a 4 vCPU replica before any charges begin.

| Item | Cost |
|---|---|
| Container App idle (scaled to zero) | €0 |
| Container App active @ 4 vCPU / 8 GB | ~€0.70/hour per replica |
| Full demo day (8 hours, minReplicas=1) | ~€5.60 |
| Azure OpenAI GPT-4o (100 contracts × ~50K tokens) | ~€15–30 one-time |
| Azure Document Intelligence (100 contracts) | ~€5–15 one-time |
| Azure Cache for Redis Basic C1 | ~€16/mo |
| Cloudflare R2 storage | Free (10 GB / 1M ops) |
| Neon Serverless Postgres (free tier, 0.5 GB) | Free |
| **Total for a demo day** | **~€25–55** |
| **Ongoing when idle** | **~€16/mo (Redis only)** |

Neon's 0.5 GB free tier comfortably covers 100 contracts (~14 MB of data). Upgrade to Neon Launch (~€19/mo) only if you exceed the free tier.

### Avoiding cold starts on demo day

With `minReplicas: 0`, the first request after an idle period triggers a cold start (~15–30 seconds blank screen). Before a demo, set the minimum to 1 to keep the app warm, then reset it afterwards:

```bash
# Before the demo
az containerapp update --name contigo --resource-group contigoContainerApps --min-replicas 1

# After the demo
az containerapp update --name contigo --resource-group contigoContainerApps --min-replicas 0
```

### Reducing the container size after adding Redis

The current 4 vCPU / 8 GB allocation was sized for inline processing (no Redis). Once Redis is active and workers handle artifact generation asynchronously, the web container only serves HTTP requests and can be safely downsized to 1 vCPU / 2 GB, cutting active compute cost to ~€0.18/hour:

```bash
az containerapp update \
  --name contigo \
  --resource-group contigoContainerApps \
  --cpu 1 --memory 2Gi
```

---

## Known Remaining Gaps

These are not blocking for the demo but should be addressed before a production customer goes live:

1. **No persistent Redis if Container App restarts** — Azure Cache for Redis is a separate managed service and is unaffected by Container App restarts. This is fine.
2. **`NEXTAUTH_URL` must match the exact origin** — currently set to `https://www.mycontigo.app`. If a new custom domain is added, update this env var and restart.
3. **Secrets stored as plaintext env vars** — `AZURE_OPENAI_API_KEY`, `NEXTAUTH_SECRET`, and `DATABASE_URL` are currently set as plain values on the Container App, not as Key Vault references. For production hardening, migrate them to Key Vault secrets and reference via managed identity.
4. **No separate workers Container App** — workers run inside the main container via PM2. For high volume (>500 contracts/day), extract workers into a dedicated Container App scaled independently.

*ConTigo GmbH — Zurich, Switzerland*
*Last updated: May 2026*
