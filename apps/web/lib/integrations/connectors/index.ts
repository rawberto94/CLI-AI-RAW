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
export { GoogleDriveConnector } from './google-drive.connector';
export { DropboxConnector, createDropboxConnector } from './dropbox.connector';
export { BoxConnector, createBoxConnector } from './box.connector';
export { PostgresConnector, createPostgresConnector } from './postgres.connector';
export { MysqlConnector, createMysqlConnector } from './mysql.connector';
export { MssqlConnector, createMssqlConnector } from './mssql.connector';
export { MongoConnector, createMongoConnector } from './mongodb.connector';

// Credential encryption
export {
  encryptCredentials,
  decryptCredentials,
  isEncrypted,
  ensureEncrypted,
  ensureDecrypted,
  generateEncryptionKey,
  maskSensitiveFields,
} from './encryption';
