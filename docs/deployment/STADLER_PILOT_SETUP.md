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

## ✅ Resolved — Azure Infra Status (updated 2026-06-06)

| Step | Status | Notes |
|---|---|---|
| Roberto's access | ✅ Fixed | Contributor granted on `contigoContainerApps` RG |
| Container App warmed | ✅ Done | `minReplicas=1` — no cold start |
| Document Intelligence | ✅ Wired | `AZURE_DI_ENABLED=true`, key injected |
| Cloudflare R2 storage | ❌ Needs browser | Must be done manually in dash.cloudflare.com (see Step 4) |
| Redis | ⏳ Provisioning | Started — takes ~10–15 min, then wire keys (see Step 5) |

**Actual resource names (confirmed):**
- Resource group: `contigoContainerApps`
- Container App: `contigo`
- Document Intelligence: `ConTigoDocumentIntelligence`
- Subscription ID: `42f90129-b16b-4416-8785-eed869e76361`

> ⚠️ **`ConTigoVM` is still running** in resource group `ConTigoVM_group` (Standard_B2ats_v2). This VM appears unused — verify and deallocate it to stop billing: `az vm deallocate --name ConTigoVM --resource-group ConTigoVM_group`

---

## Steps Remaining for Roberto

---

## Step 1 — ✅ Done — Resource Names Confirmed

All resource names are known. No discovery needed.

| Resource | Name | Resource Group |
|---|---|---|
| Container App | `contigo` | `contigoContainerApps` |
| Document Intelligence | `ConTigoDocumentIntelligence` | `contigoContainerApps` |
| Azure OpenAI | `contigo-openai` | `contigoContainerApps` |
| Key Vault | `contigo` | `contigoContainerApps` |

---

## Step 2 — ✅ Done — Container App Warmed

`minReplicas=1` is already set. The app will not cold-start.

After the demo, scale back to save money:

```bash
az containerapp update \
  --name contigo \
  --resource-group contigoContainerApps \
  --min-replicas 0
```

---

## Step 3 — ✅ Done — Document Intelligence Wired

The following env vars are now live on the Container App:
- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://contigodocumentintelligence.cognitiveservices.azure.com/`
- `AZURE_DOCUMENT_INTELLIGENCE_KEY` — injected
- `AZURE_DI_DEFAULT_MODEL=layout`
- `AZURE_DI_FEATURES=keyValuePairs`
- `AZURE_DI_ENABLED=true`

---

## Step 4 — ❌ TODO — Cloudflare R2 File Storage (browser required)

**Why:** Uploaded PDFs currently land on ephemeral container disk. A container restart wipes them. R2 makes them persistent.

**In the Cloudflare dashboard:**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**
2. Name: `contracts`, Jurisdiction: **European Union**
3. **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**, Scope: bucket `contracts`
4. Copy **Access Key ID** and **Secret Access Key** (shown only once)
5. Copy your **Account ID** from the URL: `dash.cloudflare.com/<account-id>/r2`

**Then wire it (Roberto can now run this):**

```bash
az containerapp update \
  --name contigo \
  --resource-group contigoContainerApps \
  --set-env-vars \
    S3_ENDPOINT=https://<ACCOUNT-ID>.r2.cloudflarestorage.com \
    S3_ACCESS_KEY=<access-key-id> \
    S3_SECRET_KEY=<secret-access-key> \
    S3_BUCKET=contracts \
    S3_USE_SSL=true \
    S3_REGION=auto \
    MINIO_BUCKET=contracts
```

---

## Step 5 — ⏳ Redis Provisioning Started (wire keys when ready)

Redis creation was kicked off (`redis-contigo`, Basic C1, Switzerland North). Takes ~10–15 min.

Check if it's ready:

```bash
az redis show \
  --resource-group contigoContainerApps \
  --name redis-contigo \
  --query provisioningState -o tsv
# Should return: Succeeded
```

Once `Succeeded`, wire the keys:

```bash
REDIS_HOST=$(az redis show \
  --resource-group contigoContainerApps \
  --name redis-contigo \
  --query hostName -o tsv)

REDIS_KEY=$(az redis list-keys \
  --resource-group contigoContainerApps \
  --name redis-contigo \
  --query primaryKey -o tsv)

az containerapp update \
  --name contigo \
  --resource-group contigoContainerApps \
  --set-env-vars \
    REDIS_HOST="$REDIS_HOST" \
    REDIS_PORT=6380 \
    REDIS_PASSWORD="$REDIS_KEY" \
    REDIS_TLS=true
```

---

## Verification

```bash
# App is reachable
curl -I https://www.mycontigo.app/api/health

# Check all expected env vars are present
az containerapp show \
  --name contigo \
  --resource-group contigoContainerApps \
  --query 'properties.template.containers[0].env[*].{name:name}' \
  -o table
```

Expected env vars to see: `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY`, `AZURE_DI_ENABLED`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `REDIS_HOST` (after Redis is wired).

Then log in as `stadler@contigodemo.com` / `Stadler123!` and upload a test PDF. It should:
1. Return without a 30–90 second wait (Redis queued)
2. Process with Azure DI full layout extraction (not basic)
3. Show all 14 artifact types in the contract view
4. Have the PDF file appear in the R2 `contracts` bucket

---

## ⚠️ ConTigoVM — Unused VM Billing

`ConTigoVM` (Standard_B2ats_v2) in resource group `ConTigoVM_group` is **currently running** and being billed. If it is not in use, deallocate it:

```bash
az vm deallocate --name ConTigoVM --resource-group ConTigoVM_group
```

This stops compute billing while preserving the disk.

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
