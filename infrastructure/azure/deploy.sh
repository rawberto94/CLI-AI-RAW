#!/bin/bash
# ============================================
# ConTigo Azure Deployment Script
# Switzerland North Region - Cost Optimized
# ============================================

set -e

# Configuration
RESOURCE_GROUP="rg-contigo-prod"
LOCATION="switzerlandnorth"
ENVIRONMENT="prod"

echo "🇨🇭 ConTigo Azure Deployment - Switzerland North"
echo "================================================"

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not installed. Install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Login check
echo "📝 Checking Azure login..."
az account show &> /dev/null || az login

# Get subscription
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "✅ Using subscription: $SUBSCRIPTION_ID"

# Create resource group
echo "📦 Creating resource group..."
az group create \
    --name $RESOURCE_GROUP \
    --location $LOCATION \
    --tags Environment=$ENVIRONMENT Project=ConTigo

# Generate secure password for PostgreSQL
echo "🔐 Generating PostgreSQL password..."
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Deploy infrastructure
echo "🚀 Deploying Azure infrastructure (this takes ~15-20 minutes)..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
    --resource-group $RESOURCE_GROUP \
    --template-file main.bicep \
    --parameters environment=$ENVIRONMENT \
    --parameters location=$LOCATION \
    --parameters postgresPassword="$POSTGRES_PASSWORD" \
    --query properties.outputs -o json)

# Extract outputs
AKS_NAME=$(echo $DEPLOYMENT_OUTPUT | jq -r '.aksName.value')
ACR_NAME=$(echo $DEPLOYMENT_OUTPUT | jq -r '.acrName.value')
ACR_LOGIN_SERVER=$(echo $DEPLOYMENT_OUTPUT | jq -r '.acrLoginServer.value')
POSTGRES_HOST=$(echo $DEPLOYMENT_OUTPUT | jq -r '.postgresHost.value')
REDIS_HOST=$(echo $DEPLOYMENT_OUTPUT | jq -r '.redisHost.value')
STORAGE_ACCOUNT=$(echo $DEPLOYMENT_OUTPUT | jq -r '.storageAccountName.value')
KEY_VAULT_NAME=$(echo $DEPLOYMENT_OUTPUT | jq -r '.keyVaultName.value')

echo "✅ Infrastructure deployed!"
echo ""
echo "📋 Resources Created:"
echo "  AKS Cluster: $AKS_NAME"
echo "  Container Registry: $ACR_LOGIN_SERVER"
echo "  PostgreSQL: $POSTGRES_HOST"
echo "  Redis: $REDIS_HOST"
echo "  Storage: $STORAGE_ACCOUNT"
echo "  Key Vault: $KEY_VAULT_NAME"

# Store secrets in Key Vault
echo ""
echo "🔐 Storing secrets in Key Vault..."

# Get Redis access key
REDIS_KEY=$(az redis list-keys --resource-group $RESOURCE_GROUP --name "redis-contigo-$ENVIRONMENT" --query primaryKey -o tsv)

# Get Storage access key
STORAGE_KEY=$(az storage account keys list --resource-group $RESOURCE_GROUP --account-name $STORAGE_ACCOUNT --query '[0].value' -o tsv)

# Store secrets
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "postgres-password" --value "$POSTGRES_PASSWORD" > /dev/null
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "database-url" --value "postgresql://contigoadmin:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/contigo?sslmode=require" > /dev/null
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "redis-url" --value "rediss://:${REDIS_KEY}@${REDIS_HOST}:6380" > /dev/null
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-storage-key" --value "$STORAGE_KEY" > /dev/null
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "nextauth-secret" --value "$(openssl rand -hex 32)" > /dev/null
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "encryption-key" --value "$(openssl rand -hex 32)" > /dev/null

echo "✅ Secrets stored in Key Vault"

# Get AKS credentials
echo ""
echo "🔑 Configuring kubectl..."
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME --overwrite-existing

# Install NGINX Ingress Controller
echo ""
echo "📥 Installing NGINX Ingress Controller..."
kubectl create namespace ingress-nginx --dry-run=client -o yaml | kubectl apply -f -
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --set controller.replicaCount=2 \
    --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz \
    --wait

# Install cert-manager for TLS
echo ""
echo "📥 Installing cert-manager..."
kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --set installCRDs=true \
    --wait

echo ""
echo "✅ Azure infrastructure setup complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Add your OpenAI API key to Key Vault:"
echo "     az keyvault secret set --vault-name $KEY_VAULT_NAME --name openai-api-key --value 'sk-your-key'"
echo ""
echo "  2. Build and push Docker images:"
echo "     az acr login --name $ACR_NAME"
echo "     docker build -t $ACR_LOGIN_SERVER/contigo-web:latest ."
echo "     docker push $ACR_LOGIN_SERVER/contigo-web:latest"
echo ""
echo "  3. Deploy application:"
echo "     helm upgrade --install contigo ./helm/contigo -f ./helm/contigo/values-azure.yaml"
echo ""
echo "💰 Estimated Monthly Cost: ~CHF 250-350"
