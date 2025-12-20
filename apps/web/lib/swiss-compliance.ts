/**
 * Swiss Data Protection & Compliance Configuration
 * 
 * This file configures the application for Swiss data protection requirements
 * including Swiss FADP (nDSG), GDPR compliance, and data residency controls.
 */

export interface SwissComplianceConfig {
  // Data Residency
  dataRegion: 'CH' | 'EU';
  allowedRegions: string[];
  blockNonCompliantRegions: boolean;
  
  // Encryption
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  encryptionAlgorithm: 'AES-256' | 'AES-128';
  
  // Data Retention
  defaultRetentionDays: number;
  maxRetentionDays: number;
  autoDeleteExpired: boolean;
  
  // Audit & Logging
  auditLogging: boolean;
  logRetentionDays: number;
  sensitiveDataMasking: boolean;
  
  // Data Subject Rights
  enableDataExport: boolean;
  enableDataDeletion: boolean;
  deletionVerification: boolean;
  
  // Cross-Border Transfer
  allowCrossBorderTransfer: boolean;
  requireSCCs: boolean; // Standard Contractual Clauses
  approvedCountries: string[];
}

// Default Swiss-compliant configuration
export const swissComplianceConfig: SwissComplianceConfig = {
  // Data Residency - Switzerland or EU only
  dataRegion: 'CH',
  allowedRegions: [
    'switzerland',
    'ch-zurich',
    'ch-geneva',
    'eu-central-1',      // AWS Frankfurt
    'eu-west-1',         // AWS Ireland
    'europe-west6',      // GCP Zürich
    'europe-west3',      // GCP Frankfurt
    'switzerlandnorth',  // Azure Zürich
    'westeurope',        // Azure Netherlands
  ],
  blockNonCompliantRegions: true,
  
  // Encryption - Required for Swiss FADP
  encryptionAtRest: true,
  encryptionInTransit: true,
  encryptionAlgorithm: 'AES-256',
  
  // Data Retention - Swiss legal requirements
  defaultRetentionDays: 3650, // 10 years for contracts
  maxRetentionDays: 3650,
  autoDeleteExpired: false, // Require explicit deletion
  
  // Audit & Logging - Required for compliance
  auditLogging: true,
  logRetentionDays: 365, // 1 year
  sensitiveDataMasking: true,
  
  // Data Subject Rights - FADP/GDPR requirements
  enableDataExport: true,
  enableDataDeletion: true,
  deletionVerification: true,
  
  // Cross-Border Transfer - Strict controls
  allowCrossBorderTransfer: false,
  requireSCCs: true,
  approvedCountries: [
    'CH', // Switzerland
    'DE', // Germany
    'FR', // France
    'AT', // Austria
    'NL', // Netherlands
    'BE', // Belgium
    'LU', // Luxembourg
    'IT', // Italy
    'LI', // Liechtenstein
  ],
};

// Cloud provider configurations for Swiss compliance
export const swissCloudConfigs = {
  azure: {
    region: 'switzerlandnorth',
    resourceGroup: 'rg-contracts-ch',
    subscription: 'Swiss Production',
    services: {
      kubernetes: 'aks-contracts-ch',
      database: 'psql-contracts-ch',
      redis: 'redis-contracts-ch',
      storage: 'stcontractsch',
      keyVault: 'kv-contracts-ch',
    },
    networking: {
      vnet: 'vnet-contracts-ch',
      subnet: 'snet-aks',
      privateEndpoints: true,
      serviceEndpoints: ['Microsoft.Sql', 'Microsoft.Storage', 'Microsoft.KeyVault'],
    },
  },
  gcp: {
    region: 'europe-west6', // Zürich
    project: 'contracts-ch-prod',
    services: {
      kubernetes: 'gke-contracts-ch',
      database: 'cloudsql-contracts-ch',
      redis: 'memorystore-contracts-ch',
      storage: 'contracts-ch-prod',
    },
    networking: {
      vpc: 'vpc-contracts-ch',
      privateGoogleAccess: true,
    },
  },
  aws: {
    region: 'eu-central-1', // Frankfurt (closest to Switzerland)
    services: {
      kubernetes: 'eks-contracts-ch',
      database: 'rds-contracts-ch',
      redis: 'elasticache-contracts-ch',
      storage: 'contracts-ch-prod',
      secretsManager: 'sm-contracts-ch',
    },
    networking: {
      vpc: 'vpc-contracts-ch',
      privateSubnets: true,
      natGateway: true,
    },
  },
};

// Validation functions
export function validateDataRegion(region: string): boolean {
  return swissComplianceConfig.allowedRegions.includes(region.toLowerCase());
}

export function validateCountryForTransfer(countryCode: string): boolean {
  if (!swissComplianceConfig.allowCrossBorderTransfer) {
    return countryCode === 'CH';
  }
  return swissComplianceConfig.approvedCountries.includes(countryCode);
}

export function getComplianceStatus(): {
  compliant: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check encryption
  if (!swissComplianceConfig.encryptionAtRest) {
    issues.push('Encryption at rest is not enabled');
  }
  if (!swissComplianceConfig.encryptionInTransit) {
    issues.push('Encryption in transit is not enabled');
  }
  
  // Check audit logging
  if (!swissComplianceConfig.auditLogging) {
    issues.push('Audit logging is not enabled');
  }
  
  // Check data subject rights
  if (!swissComplianceConfig.enableDataExport) {
    issues.push('Data export capability is not enabled');
  }
  if (!swissComplianceConfig.enableDataDeletion) {
    issues.push('Data deletion capability is not enabled');
  }
  
  // Recommendations
  if (swissComplianceConfig.dataRegion !== 'CH') {
    recommendations.push('Consider hosting in Switzerland for full Swiss data residency');
  }
  if (swissComplianceConfig.allowCrossBorderTransfer) {
    recommendations.push('Ensure Standard Contractual Clauses are in place for cross-border transfers');
  }
  
  return {
    compliant: issues.length === 0,
    issues,
    recommendations,
  };
}

// Required environment variables for Swiss compliance
export const requiredEnvVars = {
  // Data Region
  DATA_REGION: 'CH',
  ENABLE_DATA_RESIDENCY_CHECK: 'true',
  
  // Database (must be in approved region)
  DATABASE_URL: 'postgresql://...',
  DATABASE_SSL: 'require',
  
  // Storage (must be in approved region)
  S3_REGION: 'eu-central-1', // or Swiss equivalent
  S3_ENCRYPTION: 'AES256',
  
  // Audit & Compliance
  AUDIT_LOGGING_ENABLED: 'true',
  LOG_RETENTION_DAYS: '365',
  SENSITIVE_DATA_MASKING: 'true',
  
  // Security
  ENCRYPTION_KEY_ROTATION_DAYS: '90',
  SESSION_TIMEOUT_MINUTES: '30',
  MFA_REQUIRED: 'true',
};

// Export types for use in application
export type CloudProvider = 'azure' | 'gcp' | 'aws';
export type DataRegion = 'CH' | 'EU';

export default swissComplianceConfig;
