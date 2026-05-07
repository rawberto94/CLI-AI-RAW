/**
 * Contract Source Connector Factory
 * 
 * Creates the appropriate connector based on provider type.
 */

import { ContractSourceProvider } from '@prisma/client';
import {
  IContractSourceConnector,
  ConnectorCredentials,
  SharePointCredentials,
  AzureBlobCredentials,
  S3Credentials,
  SFTPCredentials,
  GoogleDriveCredentials,
  SalesforceCredentials,
  SlackCredentials,
  PostgresCredentials,
} from './types';
import { SharePointConnector, OneDriveConnector } from './sharepoint.connector';
import { AzureBlobConnector } from './azure-blob.connector';
import { S3Connector } from './s3.connector';
import { SFTPConnector } from './sftp.connector';
import { GoogleDriveConnector } from './google-drive.connector';
import { DropboxConnector, DropboxCredentials } from './dropbox.connector';
import { BoxConnector, BoxCredentials } from './box.connector';
import { SalesforceConnector } from './salesforce.connector';
import { SlackConnector } from './slack.connector';
import { PostgresConnector } from './postgres.connector';
import { MysqlConnector, MysqlCredentials } from './mysql.connector';

/**
 * Create a connector instance for the given provider
 */
export function createConnector(
  provider: ContractSourceProvider,
  credentials: ConnectorCredentials
): IContractSourceConnector {
  switch (provider) {
    case ContractSourceProvider.SHAREPOINT:
      return new SharePointConnector(credentials as SharePointCredentials);
    
    case ContractSourceProvider.ONEDRIVE:
      return new OneDriveConnector(credentials as SharePointCredentials);
    
    case ContractSourceProvider.AZURE_BLOB:
      return new AzureBlobConnector(credentials as AzureBlobCredentials);
    
    case ContractSourceProvider.AWS_S3:
      return new S3Connector(credentials as S3Credentials);
    
    case ContractSourceProvider.SFTP:
    case ContractSourceProvider.FTP:
      return new SFTPConnector(credentials as SFTPCredentials);
    
    case ContractSourceProvider.GOOGLE_DRIVE:
      return new GoogleDriveConnector(credentials as GoogleDriveCredentials);
    
    case ContractSourceProvider.DROPBOX:
      return new DropboxConnector(credentials as DropboxCredentials);
    
    case ContractSourceProvider.BOX:
      return new BoxConnector(credentials as BoxCredentials);
    
    case ContractSourceProvider.SALESFORCE:
      return new SalesforceConnector(credentials as SalesforceCredentials);
    
    case ContractSourceProvider.SLACK:
      return new SlackConnector(credentials as SlackCredentials);
    
    case ContractSourceProvider.POSTGRES:
      return new PostgresConnector(credentials as PostgresCredentials);
    
    case ContractSourceProvider.MYSQL:
      return new MysqlConnector(credentials as unknown as MysqlCredentials);
    
    case ContractSourceProvider.MSSQL:
    case ContractSourceProvider.MONGODB:
      throw new Error(`Provider ${provider} is not yet implemented`);
    
    case ContractSourceProvider.CUSTOM_API:
      throw new Error(`Provider ${provider} is not yet implemented`);
    
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get the OAuth callback URL for a provider
 */
export function getOAuthCallbackUrl(provider: ContractSourceProvider): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  
  switch (provider) {
    case ContractSourceProvider.SHAREPOINT:
    case ContractSourceProvider.ONEDRIVE:
      return `${baseUrl}/api/auth/callback/sharepoint`;
    
    case ContractSourceProvider.GOOGLE_DRIVE:
      return `${baseUrl}/api/auth/callback/google-drive`;
    
    case ContractSourceProvider.DROPBOX:
      return `${baseUrl}/api/auth/callback/dropbox`;
    
    case ContractSourceProvider.BOX:
      return `${baseUrl}/api/auth/callback/box`;
    
    case ContractSourceProvider.SALESFORCE:
      return `${baseUrl}/api/auth/callback/salesforce`;
    
    case ContractSourceProvider.SLACK:
      return `${baseUrl}/api/auth/callback/slack`;
    
    default:
      return '';
  }
}

/**
 * Check if a provider requires OAuth
 */
export function requiresOAuth(provider: ContractSourceProvider): boolean {
  const oauthProviders: ContractSourceProvider[] = [
    ContractSourceProvider.SHAREPOINT,
    ContractSourceProvider.ONEDRIVE,
    ContractSourceProvider.GOOGLE_DRIVE,
    ContractSourceProvider.DROPBOX,
    ContractSourceProvider.BOX,
    ContractSourceProvider.SALESFORCE,
    ContractSourceProvider.SLACK,
  ];
  return oauthProviders.includes(provider);
}

/**
 * Get required credential fields for a provider
 */
export function getRequiredCredentialFields(
  provider: ContractSourceProvider
): string[] {
  switch (provider) {
    case ContractSourceProvider.SHAREPOINT:
    case ContractSourceProvider.ONEDRIVE:
      return ['tenantId', 'clientId', 'clientSecret'];
    
    case ContractSourceProvider.AZURE_BLOB:
      return ['accountName', 'containerName'];
    
    case ContractSourceProvider.AWS_S3:
      return ['accessKeyId', 'secretAccessKey', 'region', 'bucket'];
    
    case ContractSourceProvider.SFTP:
    case ContractSourceProvider.FTP:
      return ['host', 'username'];
    
    case ContractSourceProvider.GOOGLE_DRIVE:
      return ['clientId', 'clientSecret'];
    
    case ContractSourceProvider.SALESFORCE:
      return ['clientId', 'clientSecret'];
    
    case ContractSourceProvider.SLACK:
      return ['clientId', 'clientSecret'];
    
    case ContractSourceProvider.POSTGRES:
      // For Postgres we accept either a connectionString OR (host + database).
      // The factory checks `table` and the column-mapping shape; deeper
      // validation happens in the connector constructor.
      return ['table'];
    
    case ContractSourceProvider.MYSQL:
      return ['table'];
    
    default:
      return [];
  }
}

/**
 * Validate credentials for a provider
 */
export function validateCredentials(
  provider: ContractSourceProvider,
  credentials: Record<string, unknown>
): { valid: boolean; missingFields: string[] } {
  const requiredFields = getRequiredCredentialFields(provider);
  const missingFields = requiredFields.filter(
    field => !credentials[field]
  );
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Get display name for a provider
 */
export function getProviderDisplayName(provider: ContractSourceProvider): string {
  const names: Record<ContractSourceProvider, string> = {
    [ContractSourceProvider.SHAREPOINT]: 'SharePoint',
    [ContractSourceProvider.ONEDRIVE]: 'OneDrive',
    [ContractSourceProvider.GOOGLE_DRIVE]: 'Google Drive',
    [ContractSourceProvider.AZURE_BLOB]: 'Azure Blob Storage',
    [ContractSourceProvider.AWS_S3]: 'Amazon S3',
    [ContractSourceProvider.SFTP]: 'SFTP',
    [ContractSourceProvider.FTP]: 'FTP',
    [ContractSourceProvider.DROPBOX]: 'Dropbox',
    [ContractSourceProvider.BOX]: 'Box',
    [ContractSourceProvider.SALESFORCE]: 'Salesforce',
    [ContractSourceProvider.SLACK]: 'Slack',
    [ContractSourceProvider.POSTGRES]: 'PostgreSQL',
    [ContractSourceProvider.MYSQL]: 'MySQL',
    [ContractSourceProvider.MSSQL]: 'SQL Server',
    [ContractSourceProvider.MONGODB]: 'MongoDB',
    [ContractSourceProvider.CUSTOM_API]: 'Custom API',
  };
  
  return names[provider] || provider;
}

/**
 * Get icon name for a provider (for UI)
 */
export function getProviderIcon(provider: ContractSourceProvider): string {
  const icons: Record<ContractSourceProvider, string> = {
    [ContractSourceProvider.SHAREPOINT]: 'microsoft',
    [ContractSourceProvider.ONEDRIVE]: 'microsoft',
    [ContractSourceProvider.GOOGLE_DRIVE]: 'google',
    [ContractSourceProvider.AZURE_BLOB]: 'azure',
    [ContractSourceProvider.AWS_S3]: 'aws',
    [ContractSourceProvider.SFTP]: 'server',
    [ContractSourceProvider.FTP]: 'server',
    [ContractSourceProvider.DROPBOX]: 'dropbox',
    [ContractSourceProvider.BOX]: 'box',
    [ContractSourceProvider.SALESFORCE]: 'salesforce',
    [ContractSourceProvider.SLACK]: 'slack',
    [ContractSourceProvider.POSTGRES]: 'database',
    [ContractSourceProvider.MYSQL]: 'database',
    [ContractSourceProvider.MSSQL]: 'database',
    [ContractSourceProvider.MONGODB]: 'database',
    [ContractSourceProvider.CUSTOM_API]: 'code',
  };
  
  return icons[provider] || 'folder';
}
