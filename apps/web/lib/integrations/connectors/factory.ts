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
} from './types';
import { SharePointConnector, OneDriveConnector } from './sharepoint.connector';
import { AzureBlobConnector } from './azure-blob.connector';
import { S3Connector } from './s3.connector';
import { SFTPConnector } from './sftp.connector';

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
      // Google Drive uses the existing implementation
      throw new Error('Use the existing Google Drive integration at lib/integrations/google-drive.ts');
    
    case ContractSourceProvider.DROPBOX:
    case ContractSourceProvider.BOX:
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
    
    default:
      return '';
  }
}

/**
 * Check if a provider requires OAuth
 */
export function requiresOAuth(provider: ContractSourceProvider): boolean {
  return [
    ContractSourceProvider.SHAREPOINT,
    ContractSourceProvider.ONEDRIVE,
    ContractSourceProvider.GOOGLE_DRIVE,
    ContractSourceProvider.DROPBOX,
    ContractSourceProvider.BOX,
  ].includes(provider);
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
    [ContractSourceProvider.CUSTOM_API]: 'code',
  };
  
  return icons[provider] || 'folder';
}
