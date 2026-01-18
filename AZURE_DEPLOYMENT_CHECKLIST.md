# Azure Deployment Checklist

> **Goal:** Deploy ConTigo to Azure with AKS + Azure PostgreSQL + Azure Blob Storage
> **Estimated Time:** 2-3 weeks for full production deployment

---

## Phase 1: Azure Infrastructure Setup (Week 1)

### 1.1 Azure Account & Subscription
- [ ] Create/access Azure subscription
- [ ] Set up Resource Group: `rg-contigo-prod`
- [ ] Configure Azure Cost Management alerts
- [ ] Enable Azure Defender for Cloud

### 1.2 Azure Container Registry (ACR)
```bash
# Create ACR
az acr create \
  --resource-group rg-contigo-prod \
  --name contigoacr \
  --sku Premium \
  --location westeurope

# Login to ACR
az acr login --name contigoacr

# Build and push images
docker build -t contigoacr.azurecr.io/contigo-web:latest .
docker build -t contigoacr.azurecr.io/contigo-workers:latest -f Dockerfile.workers .
docker build -t contigoacr.azurecr.io/contigo-websocket:latest -f Dockerfile.websocket .

docker push contigoacr.azurecr.io/contigo-web:latest
docker push contigoacr.azurecr.io/contigo-workers:latest
docker push contigoacr.azurecr.io/contigo-websocket:latest
```

### 1.3 Azure Kubernetes Service (AKS)
```bash
# Create AKS cluster
az aks create \
  --resource-group rg-contigo-prod \
  --name aks-contigo-prod \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-managed-identity \
  --enable-addons monitoring \
  --attach-acr contigoacr \
  --network-plugin azure \
  --network-policy calico \
  --generate-ssh-keys \
  --location westeurope

# Get credentials
az aks get-credentials --resource-group rg-contigo-prod --name aks-contigo-prod

# Verify connection
kubectl get nodes
```

### 1.4 Azure Database for PostgreSQL Flexible Server
```bash
# Create PostgreSQL server
az postgres flexible-server create \
  --resource-group rg-contigo-prod \
  --name psql-contigo-prod \
  --location westeurope \
  --admin-user contigoadmin \
  --admin-password '<SECURE_PASSWORD>' \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 15 \
  --high-availability ZoneRedundant

# Create database
az postgres flexible-server db create \
  --resource-group rg-contigo-prod \
  --server-name psql-contigo-prod \
  --database-name contigo

# Enable pgvector extension
az postgres flexible-server parameter set \
  --resource-group rg-contigo-prod \
  --server-name psql-contigo-prod \
  --name azure.extensions \
  --value vector

# Configure firewall (allow AKS)
az postgres flexible-server firewall-rule create \
  --resource-group rg-contigo-prod \
  --name psql-contigo-prod \
  --rule-name allow-aks \
  --start-ip-address <AKS_OUTBOUND_IP> \
  --end-ip-address <AKS_OUTBOUND_IP>
```

### 1.5 Azure Cache for Redis
```bash
# Create Redis cache
az redis create \
  --resource-group rg-contigo-prod \
  --name redis-contigo-prod \
  --location westeurope \
  --sku Premium \
  --vm-size P1 \
  --enable-non-ssl-port false \
  --minimum-tls-version 1.2
```

### 1.6 Azure Blob Storage
```bash
# Create storage account
az storage account create \
  --resource-group rg-contigo-prod \
  --name stcontigoprod \
  --location westeurope \
  --sku Standard_GRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2

# Create container
az storage container create \
  --account-name stcontigoprod \
  --name contracts \
  --public-access off
```

### 1.7 Azure Key Vault
```bash
# Create Key Vault
az keyvault create \
  --resource-group rg-contigo-prod \
  --name kv-contigo-prod \
  --location westeurope \
  --enable-rbac-authorization

# Store secrets
az keyvault secret set --vault-name kv-contigo-prod --name "DATABASE-URL" \
  --value "postgresql://contigoadmin:<PASSWORD>@psql-contigo-prod.postgres.database.azure.com:5432/contigo?sslmode=require"

az keyvault secret set --vault-name kv-contigo-prod --name "REDIS-URL" \
  --value "rediss://:ACCESS_KEY@redis-contigo-prod.redis.cache.windows.net:6380"

az keyvault secret set --vault-name kv-contigo-prod --name "NEXTAUTH-SECRET" \
  --value "$(openssl rand -hex 32)"

az keyvault secret set --vault-name kv-contigo-prod --name "OPENAI-API-KEY" \
  --value "sk-your-key"

az keyvault secret set --vault-name kv-contigo-prod --name "AZURE-STORAGE-KEY" \
  --value "$(az storage account keys list --account-name stcontigoprod --query '[0].value' -o tsv)"
```

---

## Phase 2: Kubernetes Configuration (Week 2)

### 2.1 Update Kubernetes Manifests for Azure

Create `kubernetes/azure-secrets.yaml`:
```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: azure-keyvault-secrets
  namespace: contract-intel
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    userAssignedIdentityID: "<MANAGED_IDENTITY_CLIENT_ID>"
    keyvaultName: "kv-contigo-prod"
    objects: |
      array:
        - |
          objectName: DATABASE-URL
          objectType: secret
        - |
          objectName: REDIS-URL
          objectType: secret
        - |
          objectName: NEXTAUTH-SECRET
          objectType: secret
        - |
          objectName: OPENAI-API-KEY
          objectType: secret
        - |
          objectName: AZURE-STORAGE-KEY
          objectType: secret
    tenantId: "<AZURE_TENANT_ID>"
  secretObjects:
    - secretName: app-secrets
      type: Opaque
      data:
        - objectName: DATABASE-URL
          key: DATABASE_URL
        - objectName: REDIS-URL
          key: REDIS_URL
        - objectName: NEXTAUTH-SECRET
          key: NEXTAUTH_SECRET
        - objectName: OPENAI-API-KEY
          key: OPENAI_API_KEY
        - objectName: AZURE-STORAGE-KEY
          key: AZURE_STORAGE_KEY
```

### 2.2 Update ConfigMap for Azure
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: contract-intel
data:
  NODE_ENV: "production"
  NEXT_PUBLIC_APP_URL: "https://contigo.yourdomain.com"
  NEXT_PUBLIC_WS_URL: "wss://contigo.yourdomain.com/ws"
  AZURE_STORAGE_ACCOUNT: "stcontigoprod"
  AZURE_STORAGE_CONTAINER: "contracts"
  STORAGE_PROVIDER: "azure"
```

### 2.3 Update Deployments for ACR
```yaml
# In kubernetes/deployment.yaml, update image references:
spec:
  containers:
    - name: app
      image: contigoacr.azurecr.io/contigo-web:latest
```

### 2.4 Install Required AKS Add-ons
```bash
# Enable Secrets Store CSI Driver
az aks enable-addons \
  --resource-group rg-contigo-prod \
  --name aks-contigo-prod \
  --addons azure-keyvault-secrets-provider

# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz

# Install cert-manager for TLS
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

---

## Phase 3: Deploy Application (Week 2-3)

### 3.1 Run Database Migrations
```bash
# Create a migration job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: prisma-migrate
  namespace: contract-intel
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: contigoacr.azurecr.io/contigo-web:latest
          command: ["npx", "prisma", "migrate", "deploy"]
          envFrom:
            - secretRef:
                name: app-secrets
            - configMapRef:
                name: app-config
      restartPolicy: Never
  backoffLimit: 3
EOF

# Check migration status
kubectl logs -f job/prisma-migrate -n contract-intel
```

### 3.2 Deploy Application
```bash
# Apply all manifests
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/security-policies.yaml

# Watch deployment
kubectl rollout status deployment/app -n contract-intel --timeout=300s

# Check pods
kubectl get pods -n contract-intel

# Check logs
kubectl logs -l app=contract-intel-app -n contract-intel --tail=50
```

### 3.3 Configure DNS & TLS
```bash
# Get Ingress IP
kubectl get svc -n ingress-nginx

# Update DNS (Azure DNS or external)
az network dns record-set a add-record \
  --resource-group rg-contigo-prod \
  --zone-name yourdomain.com \
  --record-set-name contigo \
  --ipv4-address <INGRESS_IP>

# Apply TLS certificate issuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### 3.4 Verify Deployment
```bash
# Health check
curl https://contigo.yourdomain.com/api/health

# Check all services
kubectl get all -n contract-intel

# Test WebSocket
wscat -c wss://contigo.yourdomain.com/ws
```

---

## Phase 4: Production Hardening

### 4.1 Enable Azure Monitor
```bash
az aks enable-addons \
  --resource-group rg-contigo-prod \
  --name aks-contigo-prod \
  --addons monitoring \
  --workspace-resource-id <LOG_ANALYTICS_WORKSPACE_ID>
```

### 4.2 Configure Backup
```bash
# Enable PostgreSQL backup (automatic in Flexible Server)
az postgres flexible-server update \
  --resource-group rg-contigo-prod \
  --name psql-contigo-prod \
  --backup-retention 35

# Enable Blob versioning and soft delete
az storage account blob-service-properties update \
  --account-name stcontigoprod \
  --enable-versioning true \
  --enable-delete-retention true \
  --delete-retention-days 30
```

### 4.3 Set Up Azure Front Door (Optional - for CDN)
```bash
az afd profile create \
  --resource-group rg-contigo-prod \
  --profile-name afd-contigo-prod \
  --sku Premium_AzureFrontDoor

# Add endpoint and origin for AKS ingress
```

---

## Environment Variables for Azure

```bash
# .env.azure.production
DATABASE_URL=postgresql://contigoadmin:PASSWORD@psql-contigo-prod.postgres.database.azure.com:5432/contigo?sslmode=require
REDIS_URL=rediss://:ACCESS_KEY@redis-contigo-prod.redis.cache.windows.net:6380
NEXTAUTH_URL=https://contigo.yourdomain.com
NEXTAUTH_SECRET=<from-keyvault>

# Storage
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT=stcontigoprod
AZURE_STORAGE_KEY=<from-keyvault>
AZURE_STORAGE_CONTAINER=contracts

# AI
OPENAI_API_KEY=<from-keyvault>

# App
NODE_ENV=production
CORS_ORIGIN=https://contigo.yourdomain.com
```

---

## Estimated Azure Costs (Monthly)

| Service | Configuration | Estimated Cost |
|---------|---------------|----------------|
| AKS | 3x Standard_D4s_v3 | ~$450 |
| Azure PostgreSQL | GP_Standard_D4s_v3, HA | ~$400 |
| Azure Redis | Premium P1 | ~$200 |
| Blob Storage | 500GB + transactions | ~$30 |
| Key Vault | Standard | ~$5 |
| Azure Monitor | Full APM | ~$100 |
| Azure Front Door | Premium (optional) | ~$100 |
| **Total** | | **~$1,285/month** |

> 💡 **Cost Optimization Tips:**
> - Use Reserved Instances (1-year) for 30-40% savings
> - Enable autoscaling to scale down during off-hours
> - Use Spot instances for non-critical workers

---

## Quick Start Commands

```bash
# 1. Login to Azure
az login

# 2. Set subscription
az account set --subscription "<SUBSCRIPTION_ID>"

# 3. Create resource group
az group create --name rg-contigo-prod --location westeurope

# 4. Run the infrastructure setup (see sections above)

# 5. Deploy to AKS
kubectl apply -f kubernetes/

# 6. Check status
kubectl get all -n contract-intel
```

---

## Support Resources

- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Azure PostgreSQL Flexible Server](https://docs.microsoft.com/en-us/azure/postgresql/flexible-server/)
- [Azure Blob Storage](https://docs.microsoft.com/en-us/azure/storage/blobs/)
- [Azure Key Vault with AKS](https://docs.microsoft.com/en-us/azure/aks/csi-secrets-store-driver)
