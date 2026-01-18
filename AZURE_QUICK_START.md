# Azure Deployment Quick Start Guide

## Prerequisites

1. **Azure CLI** installed and authenticated
2. **Helm 3** installed
3. **kubectl** installed
4. Azure subscription with Owner/Contributor access

## Quick Deployment (3 Commands)

```bash
# 1. Login to Azure
az login

# 2. Deploy infrastructure (creates all Azure resources)
cd infrastructure/azure
chmod +x deploy.sh
./deploy.sh

# 3. Configure kubectl and deploy app
az aks get-credentials --resource-group contigo-prod-rg --name contigo-prod-aks
helm upgrade --install contigo ./helm/contigo -f ./helm/contigo/values-azure.yaml --namespace contigo --create-namespace
```

## What Gets Created

| Resource | SKU/Size | Est. Monthly Cost (CHF) |
|----------|----------|------------------------|
| AKS Cluster | Standard_B4ms (2-5 nodes) | ~120-300 |
| PostgreSQL | Standard_B2s (Burstable) | ~40 |
| Redis Cache | Basic C0 (1GB) | ~20 |
| Blob Storage | Standard LRS | ~5-10 |
| Container Registry | Basic | ~5 |
| Key Vault | Standard | ~1 |
| **Total Estimated** | | **~190-375** |

## First-Time Setup Checklist

### 1. Create Azure Service Principal for GitHub Actions

```bash
# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "contigo-github-actions" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/contigo-prod-rg \
  --sdk-auth
```

Copy the JSON output and add it as GitHub secret `AZURE_CREDENTIALS`.

### 2. Configure DNS

Point your domain to the Load Balancer IP:
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

Create A record: `your-domain.com` → Load Balancer IP

### 3. Update Helm Values

Edit `helm/contigo/values-azure.yaml`:
```yaml
ingress:
  host: your-domain.com  # Your actual domain

config:
  nextPublicAppUrl: "https://your-domain.com"
  nextPublicWsUrl: "wss://your-domain.com/ws"
```

### 4. Add Secrets to Key Vault

```bash
# Database URL is added automatically by deploy.sh
# Add these manually:
az keyvault secret set --vault-name contigo-prod-kv --name "nextauth-secret" --value "$(openssl rand -base64 32)"
az keyvault secret set --vault-name contigo-prod-kv --name "encryption-key" --value "$(openssl rand -hex 32)"
az keyvault secret set --vault-name contigo-prod-kv --name "openai-api-key" --value "your-openai-key"
```

### 5. Run Database Migration

```bash
# Connect to a pod and run migration
kubectl exec -it deployment/contigo-web -n contigo -- npx prisma migrate deploy
```

## Monitoring

### View Logs
```bash
# Web app logs
kubectl logs -f deployment/contigo-web -n contigo

# Worker logs
kubectl logs -f deployment/contigo-workers -n contigo

# All pods
kubectl get pods -n contigo
```

### Check Health
```bash
# Application health
kubectl exec deployment/contigo-web -n contigo -- curl -s localhost:3000/api/health

# Pod status
kubectl describe pod -l app.kubernetes.io/name=contigo -n contigo
```

## Scaling

### Manual Scaling
```bash
# Scale web pods
kubectl scale deployment contigo-web -n contigo --replicas=3

# Scale workers
kubectl scale deployment contigo-workers -n contigo --replicas=2
```

### Adjust Auto-scaling
Edit `helm/contigo/values-azure.yaml`:
```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
```

## Cost Optimization Tips

1. **Development/Testing**: Use staging deployment with smaller resources
2. **Reserved Instances**: Commit to 1-year reservation for ~40% savings
3. **Auto-shutdown**: Stop AKS nodes during non-business hours (saves ~60%)
4. **Right-sizing**: Monitor actual usage and adjust SKUs accordingly

## Troubleshooting

### Pod not starting
```bash
kubectl describe pod <pod-name> -n contigo
kubectl logs <pod-name> -n contigo --previous
```

### Database connection issues
```bash
# Check secrets are mounted
kubectl exec deployment/contigo-web -n contigo -- ls /mnt/secrets-store

# Verify connection string
kubectl exec deployment/contigo-web -n contigo -- printenv DATABASE_URL
```

### Ingress not working
```bash
# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Check ingress resource
kubectl describe ingress contigo -n contigo
```

## Rollback

```bash
# View release history
helm history contigo -n contigo

# Rollback to previous version
helm rollback contigo -n contigo

# Rollback to specific version
helm rollback contigo 2 -n contigo
```
