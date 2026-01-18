/**
 * Contract Source Connectors
 * 
 * Unified interface for connecting to external contract sources.
 */

// Types
export * from './types';

// Factory
export {
  createConnector,
  getOAuthCallbackUrl,
  requiresOAuth,
  getRequiredCredentialFields,
  validateCredentials,
  getProviderDisplayName,
  getProviderIcon,
} from './factory';

// Individual connectors (for direct use if needed)
export { SharePointConnector, OneDriveConnector, createMicrosoftConnector } from './sharepoint.connector';
export { AzureBlobConnector, createAzureBlobConnector } from './azure-blob.connector';
export { S3Connector, createS3Connector } from './s3.connector';
export { SFTPConnector, createSFTPConnector } from './sftp.connector';
