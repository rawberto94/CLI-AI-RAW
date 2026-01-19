/**
 * Contract Source Connector Types
 * 
 * Defines the interfaces and types for all contract source connectors
 * supporting the Pull Model for syncing contracts from external systems.
 */

import { ContractSourceProvider, SyncMode } from '@prisma/client';

// ============================================
// Core Connector Interfaces
// ============================================

/**
 * Remote file information returned by connectors
 */
export interface RemoteFile {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  createdAt?: Date;
  modifiedAt?: Date;
  hash?: string; // ETag, checksum, or version for change detection
  isFolder: boolean;
  parentId?: string;
  webUrl?: string;
  downloadUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Folder listing result with pagination
 */
export interface ListFilesResult {
  files: RemoteFile[];
  folders?: RemoteFile[];
  nextPageToken?: string;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Downloaded file content
 */
export interface DownloadedFile {
  content: Buffer;
  mimeType: string;
  name?: string;
  filename?: string;
  size?: number;
  hash?: string;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success?: boolean;
  connected?: boolean;
  message?: string;
  accountInfo?: {
    email?: string;
    name?: string;
    id?: string;
    quota?: {
      used: number;
      total: number;
    };
  };
  capabilities?: {
    deltaSync?: boolean;
    folderListing?: boolean;
    fileDownload?: boolean;
    fileMetadata?: boolean;
  };
  error?: string;
  errorCode?: string;
}

/**
 * Delta/incremental sync result
 */
export interface DeltaSyncResult {
  changes?: Array<{
    type: 'created' | 'modified' | 'deleted';
    file: RemoteFile;
  }>;
  newOrModifiedFiles?: RemoteFile[];
  deletedFileIds?: string[];
  deltaToken?: string;
  newDeltaToken?: string;
  hasMore: boolean;
}

/**
 * OAuth token response
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string;
  tokenType?: string;
}

/**
 * OAuth token response (alternative structure used by some connectors)
 */
export interface OAuthTokensAlt {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

/**
 * Connector credentials - varies by provider
 */
export type ConnectorCredentials = 
  | SharePointCredentials
  | AzureBlobCredentials
  | S3Credentials
  | SFTPCredentials
  | GoogleDriveCredentials
  | DropboxCredentials
  | BoxCredentials
  | CustomAPICredentials;

export interface SharePointCredentials {
  type: 'sharepoint' | 'onedrive';
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteUrl?: string;
  driveId?: string;
}

export interface AzureBlobCredentials {
  type: 'azure-blob';
  accountName: string;
  accountKey?: string;
  sasToken?: string;
  connectionString?: string;
  containerName: string;
}

export interface S3Credentials {
  type: 's3';
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string; // For S3-compatible services
}

export interface SFTPCredentials {
  type: 'sftp';
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface GoogleDriveCredentials {
  type: 'google-drive';
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string | Date;
}

export interface DropboxCredentials {
  type: 'dropbox';
  accessToken: string;
  refreshToken?: string;
}

export interface BoxCredentials {
  type: 'box';
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface CustomAPICredentials {
  type: 'custom-api';
  apiKey?: string;
  apiSecret?: string;
  baseUrl: string;
  headers?: Record<string, string>;
}

// ============================================
// Connector Configuration
// ============================================

export interface ConnectorConfig {
  provider: ContractSourceProvider;
  credentials: ConnectorCredentials;
  syncFolder: string;
  filePatterns: string[];
  maxFileSizeMb: number;
  syncMode: SyncMode;
}

// ============================================
// Base Connector Interface
// ============================================

/**
 * Base interface that all connectors must implement
 */
export interface IContractSourceConnector {
  /** Provider type */
  readonly provider?: ContractSourceProvider;
  
  /** Test connection and return account info */
  testConnection(): Promise<ConnectionTestResult>;
  
  /** List files in a folder */
  listFiles(
    folderId?: string,
    options?: {
      pageToken?: string;
      pageSize?: number;
      filePatterns?: string[];
      recursive?: boolean;
    }
  ): Promise<ListFilesResult>;
  
  /** Download a file by ID */
  downloadFile(fileId: string): Promise<DownloadedFile>;
  
  /** Get file metadata without downloading */
  getFileMetadata?(fileId: string): Promise<RemoteFile>;
  
  /** Check if connector supports delta sync */
  supportsDeltaSync?(): boolean;
  
  /** Get changes since last sync (for incremental sync) */
  getDeltaChanges?(deltaToken?: string): Promise<DeltaSyncResult>;
  
  /** Disconnect and cleanup */
  disconnect?(): Promise<void>;
}

/**
 * OAuth-enabled connector interface
 */
export interface IOAuthConnector extends IContractSourceConnector {
  /** Generate OAuth authorization URL */
  getAuthUrl?(state?: string): string;
  
  /** Generate OAuth authorization URL (alternative method name) */
  getAuthorizationUrl?(state?: string): string;
  
  /** Exchange authorization code for tokens */
  exchangeCodeForTokens(code: string): Promise<OAuthTokens>;
  
  /** Refresh access token */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
  
  /** Check if token needs refresh */
  isTokenExpired?(): boolean;
}

// ============================================
// Sync Job Types
// ============================================

export interface SyncJobConfig {
  sourceId: string;
  tenantId: string;
  syncMode: SyncMode;
  deltaToken?: string;
  maxFiles?: number;
  autoProcess: boolean;
}

export interface SyncJobProgress {
  filesFound: number;
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  bytesTransferred: number;
  currentFile?: string;
  errors: Array<{
    fileId: string;
    fileName: string;
    error: string;
  }>;
}

export interface SyncJobResult {
  success: boolean;
  syncId: string;
  progress: SyncJobProgress;
  nextDeltaToken?: string;
  duration: number;
  error?: string;
}

// ============================================
// Supported MIME Types
// ============================================

export const SUPPORTED_CONTRACT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/tiff',
] as const;

export type SupportedMimeType = typeof SUPPORTED_CONTRACT_MIME_TYPES[number];

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_CONTRACT_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

/**
 * Get file extension from MIME type
 */
export function getExtensionForMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/tiff': '.tiff',
  };
  return map[mimeType] || '';
}

/**
 * Check if filename matches any of the patterns
 */
export function matchesFilePattern(fileName: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return true; // No patterns means match all
  }
  
  const lowerName = fileName.toLowerCase();
  
  return patterns.some(pattern => {
    const lowerPattern = pattern.toLowerCase();
    
    // Simple glob-like matching
    if (lowerPattern === '*') return true;
    if (lowerPattern.startsWith('*.')) {
      const ext = lowerPattern.slice(1);
      return lowerName.endsWith(ext);
    }
    if (lowerPattern.endsWith('*')) {
      const prefix = lowerPattern.slice(0, -1);
      return lowerName.startsWith(prefix);
    }
    if (lowerPattern.includes('*')) {
      const regex = new RegExp('^' + lowerPattern.replace(/\*/g, '.*') + '$');
      return regex.test(lowerName);
    }
    return lowerName === lowerPattern;
  });
}
