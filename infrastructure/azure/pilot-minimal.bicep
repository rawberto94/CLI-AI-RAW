# ==============================================
# ConTigo - Minimal Pilot Deployment (Single VM)
# ==============================================
# Cost: ~$50-80/month for one pilot client
# 
# This uses Azure Container Apps instead of AKS
# Much simpler and cheaper for pilot/MVP phase
# ==============================================

@description('Environment name')
param environment string = 'pilot'

@description('Location - Switzerland for GDPR')
param location string = 'switzerlandnorth'

@description('PostgreSQL administrator password')
@secure()
param postgresPassword string

@description('OpenAI API Key')
@secure()
param openaiApiKey string

@description('NextAuth Secret')
@secure()
param nextAuthSecret string

// Resource naming
var prefix = 'contigo'
var uniqueSuffix = uniqueString(resourceGroup().id)

// ============================================
// Log Analytics (required for Container Apps)
// ============================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'log-${prefix}-${environment}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ============================================
// Container Apps Environment
// ============================================
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'cae-${prefix}-${environment}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ============================================
// PostgreSQL Flexible Server (Burstable B1ms - cheapest)
// ============================================
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: 'psql-${prefix}-${environment}-${uniqueSuffix}'
  location: location
  sku: {
    name: 'Standard_B1ms'  // 1 vCPU, 2GB - ~$13/month
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: 'contigoadmin'
    administratorLoginPassword: postgresPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// PostgreSQL Database
resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgres
  name: 'contigo'
}

// Enable pgvector
resource postgresExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgres
  name: 'azure.extensions'
  properties: {
    value: 'vector,uuid-ossp,pg_trgm'
    source: 'user-override'
  }
}

// Firewall rule to allow Azure services
resource postgresFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ============================================
// Redis Cache (Basic C0 - cheapest)
// ============================================
resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: 'redis-${prefix}-${environment}-${uniqueSuffix}'
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0  // 250MB - ~$16/month
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

// ============================================
// Storage Account
// ============================================
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'st${prefix}${environment}${uniqueSuffix}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storage.name}/default/contracts'
}

// ============================================
// Container App - Web Application
// ============================================
resource webApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'ca-${prefix}-web'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        { name: 'database-url', value: 'postgresql://contigoadmin:${postgresPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/contigo?sslmode=require' }
        { name: 'redis-url', value: 'rediss://:${redis.listKeys().primaryKey}@${redis.properties.hostName}:6380' }
        { name: 'nextauth-secret', value: nextAuthSecret }
        { name: 'openai-key', value: openaiApiKey }
        { name: 'storage-connection', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: 'ghcr.io/rawberto94/cli-ai-raw:latest'  // Or use ACR
          resources: {
            cpu: json('0.5')   // 0.5 vCPU
            memory: '1Gi'      // 1GB RAM
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'REDIS_URL', secretRef: 'redis-url' }
            { name: 'NEXTAUTH_SECRET', secretRef: 'nextauth-secret' }
            { name: 'NEXTAUTH_URL', value: 'https://ca-${prefix}-web.${containerAppEnv.properties.defaultDomain}' }
            { name: 'OPENAI_API_KEY', secretRef: 'openai-key' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection' }
            { name: 'AZURE_STORAGE_CONTAINER', value: 'contracts' }
          ]
        }
      ]
      scale: {
        minReplicas: 1   // Always on for pilot
        maxReplicas: 2   // Scale to 2 if needed
      }
    }
  }
}

// ============================================
// Outputs
// ============================================
output webAppUrl string = 'https://${webApp.properties.configuration.ingress.fqdn}'
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output redisHost string = redis.properties.hostName
output storageAccount string = storage.name

// ============================================
// Estimated Monthly Cost (Switzerland North)
// ============================================
// PostgreSQL B1ms:     ~$13/month
// Redis Basic C0:      ~$16/month
// Container Apps:      ~$20-30/month (0.5 vCPU, 1GB, always on)
// Storage (10GB):      ~$2/month
// Log Analytics:       ~$2/month
// -----------------------------------------
// TOTAL:               ~$53-63/month
// ============================================
