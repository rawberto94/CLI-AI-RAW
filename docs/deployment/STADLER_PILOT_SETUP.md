# Stadler Pilot — Colleague Handoff

> Created: 2026-06-01
> Context: Stadler pilot tenant is created. Azure infra still needs three wiring steps before the demo.

---

## ✅ Already Done (by Kimi)

1. **Pilot tenant created**
   - Name: `Stadler`
   - Slug: `stadler`
   - Admin: `stadler@contigodemo.com` / `Stadler123!`
   - `pilotMode: true` is enforced server-side (tenant cannot escape demo view)
   - Demo mode toggle is locked in the UI (shows "Demo Mode: Locked")

2. **Code fix applied**
   - `apps/web/components/layout/EnhancedNavigation.tsx` — `DemoModeToggle` now respects `session.user.pilotMode` and renders a non-interactive "Locked" state instead of a fake toggle.

---

## ❌ Still Missing — 3 Steps for You

These must be done by someone with **Azure Contributor/Owner** on the correct subscription/resource group.

> **Current blocker:** The Azure CLI session in the codespace (`roberto.ostojic94@gmail.com`) cannot read or modify the Container App. It gets `AuthorizationFailed`. We need either the role assignment fixed or you to run the commands directly.

---

## Step 1 — Find the Real Azure Resource Names

The runbook assumes names that may not match reality. Run these first and **note the output**.

```bash
# 1. Confirm subscription
az account show --query '{name:name, id:id}' -o json

# 2. Find the Container App
az containerapp list \
  --query '[].{name:name, resourceGroup:resourceGroup, fqdn:properties.configuration.ingress.fqdn}' \
  -o table

# 3. Find the Document Intelligence resource
az cognitiveservices account list \
  --query "[?kind=='FormRecognizer' || kind=='DocumentIntelligence'].{name:name, rg:resourceGroup, kind:kind}" \
  -o table

# 4. List resource groups
az group list --query '[].name' -o table
```

**Write down:**
- Resource group name: `_________________`
- Container App name: `_________________`
- Document Intelligence name: `_________________`

---

## Step 2 — Warm the Container App (prevents cold start)

Before the demo, set `minReplicas: 1` so the first page load isn't a 15–30 second blank screen.

```bash
az containerapp update \
  --name <CONTAINER-APP-NAME> \
  --resource-group <RESOURCE-GROUP-NAME> \
  --min-replicas 1
```

> After the demo you can scale back to `0` to save money.

---

## Step 3 — Wire Azure Document Intelligence

The resource exists but its key is **not set** on the Container App. Without this, OCR falls back to basic PDF text extraction.

```bash
# Get the key
DI_KEY=$(az cognitiveservices account keys list \
  --name <DOCUMENT-INTELLIGENCE-NAME> \
  --resource-group <RESOURCE-GROUP-NAME> \
  --query key1 -o tsv)

# Inject into the Container App
az containerapp update \
  --name <CONTAINER-APP-NAME> \
  --resource-group <RESOURCE-GROUP-NAME> \
  --set-env-vars \
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<DOCUMENT-INTELLIGENCE-NAME>.cognitiveservices.azure.com/ \
    AZURE_DOCUMENT_INTELLIGENCE_KEY="$DI_KEY" \
    AZURE_DI_DEFAULT_MODEL=layout \
    AZURE_DI_FEATURES=keyValuePairs \
    AZURE_DI_ENABLED=true
```

---

## Step 4 — Set Up Cloudflare R2 for File Storage

**Why:** Right now uploaded PDFs are saved to the container's ephemeral disk. If the container restarts, the PDFs are gone (the database records survive, but the files don't). R2 fixes this.

**You must do this in Cloudflare:**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**
2. Name it `contracts`
3. Jurisdiction: **European Union** (recommended for Swiss demos)
4. Go to **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Scope: bucket `contracts`
5. Copy the **Access Key ID** and **Secret Access Key** (shown only once)

**Then wire it to the Container App:**

```bash
az containerapp update \
  --name <CONTAINER-APP-NAME> \
  --resource-group <RESOURCE-GROUP-NAME> \
  --set-env-vars \
    S3_ENDPOINT=https://<YOUR-ACCOUNT-ID>.r2.cloudflarestorage.com \
    S3_ACCESS_KEY=<paste-access-key-id> \
    S3_SECRET_KEY=<paste-secret-access-key> \
    S3_BUCKET=contracts \
    S3_USE_SSL=true \
    S3_REGION=auto
```

> Your Cloudflare **Account ID** is in the URL when you're in the R2 dashboard: `dash.cloudflare.com/<account-id>/r2`

---

## Step 5 — Optional: Redis (only for bulk uploads)

If Stadler will upload 100+ contracts, Redis queues the work so uploads return instantly. Without it, each upload blocks for 30–90 seconds.

For a pilot demo with 5–10 contracts, **skip this**.

```bash
az redis create \
  --resource-group <RESOURCE-GROUP-NAME> \
  --name redis-contigo \
  --location switzerlandnorth \
  --sku Basic --vm-size c1 \
  --enable-non-ssl-port false

# Wait for provisioningState = Succeeded, then get keys
REDIS_HOST=$(az redis show \
  --resource-group <RESOURCE-GROUP-NAME> \
  --name redis-contigo \
  --query hostName -o tsv)

REDIS_KEY=$(az redis list-keys \
  --resource-group <RESOURCE-GROUP-NAME> \
  --name redis-contigo \
  --query primaryKey -o tsv)

az containerapp update \
  --name <CONTAINER-APP-NAME> \
  --resource-group <RESOURCE-GROUP-NAME> \
  --set-env-vars \
    REDIS_HOST="$REDIS_HOST" \
    REDIS_PORT=6380 \
    REDIS_PASSWORD="$REDIS_KEY" \
    REDIS_TLS=true
```

---

## Verification After Steps 2–4

```bash
# App is reachable
curl -I https://www.mycontigo.app/api/health

# Check env vars were applied
az containerapp show \
  --name <CONTAINER-APP-NAME> \
  --resource-group <RESOURCE-GROUP-NAME> \
  --query 'properties.template.containers[0].env[*].{name:name}' \
  -o table
```

Then log in as `stadler@contigodemo.com` / `Stadler123!` and upload a test PDF. It should process with Azure DI and the file should land in the R2 bucket.

---

## Context: Why the Runbook Names Might Be Wrong

The `AZURE_GO_LIVE_RUNBOOK_V2.md` assumes:
- Container App: `contigo`
- Resource Group: `contigoContainerApps`
- Document Intelligence: `ConTigoDocumentIntelligence`

Your screenshot showed `The containerapp 'contigo' does not exist`, so **at least one of those names is different in the actual subscription**. That's why Step 1 (discovery) is mandatory.

---

## Cost Recap (from Runbook)

| Item | Approx Cost |
|---|---|
| Container App active (4 vCPU / 8 GB, minReplicas=1) | ~€0.70/hour |
| Document Intelligence | Pay-per-use (~€0.05–0.15 per contract) |
| Cloudflare R2 | Free tier (10 GB / 1M ops) |
| Redis (Basic C1) | ~€16/month |
| Neon DB | Free tier (0.5 GB) |

---

*If anything above fails, paste the exact error output here and we can debug.*
