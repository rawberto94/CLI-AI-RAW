# CI/CD Setup Guide

This document describes the automated deployment pipeline for the Contigo application using GitHub Actions and Azure Container Apps.

## Overview

| Component | Technology |
|-----------|------------|
| CI/CD Platform | GitHub Actions |
| Container Registry | Azure Container Registry (contigoacr2026) |
| Deployment Target | Azure Container Apps |
| Region | Switzerland North |

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   GitHub Repo   │──────│  GitHub Actions │──────│   Azure ACR     │
│   (push/main)   │      │   (build job)   │      │   (registry)    │
└─────────────────┘      └─────────────────┘      └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ Container Apps  │
                                                  │   (contigo)     │
                                                  └─────────────────┘
```

## Workflow File

Location: `.github/workflows/deploy-container-apps.yml`

### Triggers

| Trigger | Description |
|---------|-------------|
| `push` to `main` | Automatic deployment on every merge to main |
| `workflow_dispatch` | Manual trigger with optional version tag |

### Jobs

**build-and-deploy:**
1. Checkout code
2. Login to Azure
3. Build image in ACR (no local Docker required)
4. Deploy to Container Apps
5. Verify deployment status

## Setup Instructions

### 1. Create Azure Service Principal

Run this command to create credentials for GitHub Actions:

```powershell
az ad sp create-for-rbac `
  --name "github-actions-contigo" `
  --role contributor `
  --scopes /subscriptions/42f90129-b16b-4416-8785-eed869e76361/resourceGroups/contigoContainerApps `
  --sdk-auth
```

This outputs JSON like:
```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "42f90129-b16b-4416-8785-eed869e76361",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  ...
}
```

### 2. Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `AZURE_CREDENTIALS`
5. Value: Paste the entire JSON output from step 1
6. Click **Add secret**

### 3. Verify Setup

Push a commit to `main` or manually trigger the workflow:
1. Go to **Actions** tab in GitHub
2. Select **Deploy to Azure Container Apps**
3. Click **Run workflow** (for manual trigger)

## Manual Deployment

If you need to deploy manually without GitHub Actions:

```powershell
# 1. Login to Azure
az login --use-device-code

# 2. Create source archive
git archive --format=tar -o source.tar HEAD
Remove-Item -Path ".\build-context" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -Path ".\build-context" -ItemType Directory -Force | Out-Null
tar -xf source.tar -C .\build-context

# 3. Build in ACR
az acr build --registry contigoacr2026 --image contigo-web:v1.0.X --file Dockerfile .\build-context

# 4. Deploy
az containerapp update --name contigo --resource-group contigoContainerApps --image contigoacr2026.azurecr.io/contigo-web:v1.0.X
```

## Version Tagging

### Automatic (default)
When triggered by push, images are tagged with: `sha-<first-8-chars-of-commit-hash>`

### Manual version
When using workflow_dispatch, specify a version:
1. Go to **Actions** → **Deploy to Azure Container Apps**
2. Click **Run workflow**
3. Enter version (e.g., `v1.0.5`)
4. Click **Run workflow**

## Monitoring

### Application Insights
- Resource: `contigo-insights`
- View logs and metrics in Azure Portal
- Connection string is automatically injected as `APPLICATIONINSIGHTS_CONNECTION_STRING`

### Container App Logs
```powershell
az containerapp logs show --name contigo --resource-group contigoContainerApps --follow
```

### Check Deployment Status
```powershell
az containerapp show --name contigo --resource-group contigoContainerApps --query "{state:properties.provisioningState, image:properties.template.containers[0].image, replicas:properties.runningStatus}" -o json
```

## Autoscaling

The app is configured to scale automatically:

| Setting | Value |
|---------|-------|
| Min replicas | 1 |
| Max replicas | 10 |
| Scale trigger | HTTP concurrent requests > 50 |
| Cooldown period | 300 seconds |

## Rollback

To rollback to a previous version:

```powershell
# List available images
az acr repository show-tags --name contigoacr2026 --repository contigo-web -o table

# Deploy specific version
az containerapp update --name contigo --resource-group contigoContainerApps --image contigoacr2026.azurecr.io/contigo-web:<tag>
```

## Troubleshooting

### Build fails
- Check ACR build logs in Azure Portal → `contigoacr2026` → **Runs**
- Common issues: TypeScript errors, missing dependencies

### Deployment stuck "InProgress"
```powershell
# Check status
az containerapp show --name contigo --resource-group contigoContainerApps --query "properties.provisioningState" -o tsv

# View revision logs
az containerapp revision list --name contigo --resource-group contigoContainerApps -o table
```

### Container crashes
```powershell
# Check container logs
az containerapp logs show --name contigo --resource-group contigoContainerApps --type console

# Check environment variables
az containerapp show --name contigo --resource-group contigoContainerApps --query "properties.template.containers[0].env" -o json
```

## Related Resources

| Resource | Link |
|----------|------|
| Azure Portal | https://portal.azure.com |
| Container Apps | `contigoContainerApps` → `contigo` |
| Container Registry | `contigoacr2026` |
| Application Insights | `contigo-insights` |
| App URL | https://www.mycontigo.app |
| Alt URL | https://contigo.mangoglacier-821a6329.switzerlandnorth.azurecontainerapps.io |
