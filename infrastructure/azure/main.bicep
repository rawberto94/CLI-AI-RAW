// ============================================
// ConTigo Platform - Azure Infrastructure
// Region: Switzerland North (GDPR Compliant)
// Cost-Optimized Configuration
// ============================================

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Location for all resources')
param location string = 'switzerlandnorth'

@description('PostgreSQL administrator password')
@secure()
param postgresPassword string

@description('Application admin email for alerts')
param adminEmail string = 'admin@contigo.ch'

// Resource naming
var prefix = 'contigo'
var resourceGroupName = 'rg-${prefix}-${environment}'
var aksName = 'aks-${prefix}-${environment}'
var postgresName = 'psql-${prefix}-${environment}'
var redisName = 'redis-${prefix}-${environment}'
var storageName = 'st${prefix}${environment}'
var keyVaultName = 'kv-${prefix}-${environment}'
var acrName = 'acr${prefix}${environment}'
var logAnalyticsName = 'log-${prefix}-${environment}'

// ============================================
// Log Analytics Workspace (for monitoring)
// ============================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'  // Pay-as-you-go, cost effective
    }
    retentionInDays: 30  // Minimum retention to save costs
  }
}

// ============================================
// Virtual Network
// ============================================
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: 'vnet-${prefix}-${environment}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'snet-aks'
        properties: {
          addressPrefix: '10.0.0.0/22'  // 1024 IPs for AKS
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'snet-data'
        properties: {
          addressPrefix: '10.0.4.0/24'  // 256 IPs for databases
          privateEndpointNetworkPolicies: 'Disabled'
          delegations: [
            {
              name: 'postgres-delegation'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

// ============================================
// Azure Container Registry (Basic tier - cost optimized)
// ============================================
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'  // Cheapest option, sufficient for small team
  }
  properties: {
    adminUserEnabled: true
  }
}

// ============================================
// Azure Kubernetes Service (Cost Optimized)
// ============================================
resource aks 'Microsoft.ContainerService/managedClusters@2023-08-01' = {
  name: aksName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: '${prefix}-${environment}'
    kubernetesVersion: '1.28'
    
    agentPoolProfiles: [
      {
        name: 'system'
        count: 2  // Minimum for HA
        vmSize: 'Standard_B4ms'  // Burstable, cost-effective: 4 vCPU, 16GB
        osType: 'Linux'
        mode: 'System'
        vnetSubnetID: vnet.properties.subnets[0].id
        enableAutoScaling: true
        minCount: 2
        maxCount: 5
      }
    ]
    
    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'calico'
      serviceCidr: '10.1.0.0/16'
      dnsServiceIP: '10.1.0.10'
    }
    
    addonProfiles: {
      omsagent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalytics.id
        }
      }
      azureKeyvaultSecretsProvider: {
        enabled: true
      }
    }
    
    // Cost optimization: disable unnecessary features
    oidcIssuerProfile: {
      enabled: true
    }
  }
}

// Grant AKS pull access to ACR
resource aksAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aks.id, acr.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Azure Database for PostgreSQL Flexible Server
// Cost Optimized: Burstable tier
// ============================================
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: postgresName
  location: location
  sku: {
    name: 'Standard_B2s'  // Burstable: 2 vCPU, 4GB - cheapest production option
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: 'contigoadmin'
    administratorLoginPassword: postgresPassword
    storage: {
      storageSizeGB: 32  // Minimum, can expand later
    }
    backup: {
      backupRetentionDays: 7  // Minimum to save costs
      geoRedundantBackup: 'Disabled'  // Save costs, enable if needed
    }
    network: {
      delegatedSubnetResourceId: vnet.properties.subnets[1].id
    }
    highAvailability: {
      mode: 'Disabled'  // Save costs for non-critical; enable for prod
    }
  }
}

// PostgreSQL Database
resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgres
  name: 'contigo'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Enable pgvector extension
resource postgresExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgres
  name: 'azure.extensions'
  properties: {
    value: 'vector,uuid-ossp,pg_trgm'
    source: 'user-override'
  }
}

// ============================================
// Azure Cache for Redis (Basic tier - cost optimized)
// ============================================
resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisName
  location: location
  properties: {
    sku: {
      name: 'Basic'  // Cheapest option
      family: 'C'
      capacity: 1  // 1GB cache
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// ============================================
// Storage Account (LRS - cheapest redundancy)
// ============================================
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'  // Locally redundant - cheapest option
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
    allowBlobPublicAccess: false
  }
}

// Blob container for contracts
resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storage.name}/default/contracts'
  properties: {
    publicAccess: 'None'
  }
}

// ============================================
// Key Vault
// ============================================
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7  // Minimum
  }
}

// Grant AKS access to Key Vault
resource aksKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aks.id, keyVault.id, 'keyvaultsecretsuser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: aks.properties.addonProfiles.azureKeyvaultSecretsProvider.identity.objectId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// Outputs
// ============================================
output aksName string = aks.name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output redisHost string = redis.properties.hostName
output storageAccountName string = storage.name
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
