/**
 * SharePoint / OneDrive Connector
 * 
 * Connects to SharePoint Online and OneDrive for Business using Microsoft Graph API.
 * Supports OAuth 2.0 authentication, file listing, download, and delta sync.
 * 
 * Setup Required:
 * 1. Register an application in Azure AD (portal.azure.com)
 * 2. Add Microsoft Graph permissions: Files.Read.All, Sites.Read.All
 * 3. Create a client secret
 * 4. Configure redirect URI
 */

import {
  IContractSourceConnector,
  IOAuthConnector,
  ConnectionTestResult,
  ListFilesResult,
  RemoteFile,
  DownloadedFile,
  DeltaSyncResult,
  OAuthTokens,
  SharePointCredentials,
  isSupportedMimeType,
  matchesFilePattern,
} from './types';
import { ContractSourceProvider } from '@prisma/client';

// Microsoft Graph API endpoints
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const OAUTH_AUTHORIZE_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize';
const OAUTH_TOKEN_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';

// Required scopes for SharePoint/OneDrive access
const SCOPES = [
  'https://graph.microsoft.com/Files.Read.All',
  'https://graph.microsoft.com/Sites.Read.All',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
];

interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    id: string;
    path: string;
    driveId: string;
  };
  webUrl?: string;
  '@microsoft.graph.downloadUrl'?: string;
  eTag?: string;
}

interface GraphDeltaResponse {
  value: GraphDriveItem[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

export class SharePointConnector implements IOAuthConnector {
  readonly provider = ContractSourceProvider.SHAREPOINT;
  
  private credentials: SharePointCredentials;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: Date;
  private driveId?: string;
  private siteId?: string;

  constructor(credentials: SharePointCredentials) {
    this.credentials = credentials;
    this.driveId = credentials.driveId;
  }

  // ============================================
  // OAuth Methods
  // ============================================

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: SCOPES.join(' '),
      response_mode: 'query',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    const authUrl = OAUTH_AUTHORIZE_URL.replace('{tenant}', this.credentials.tenantId);
    return `${authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const tokenUrl = OAUTH_TOKEN_URL.replace('{tenant}', this.credentials.tenantId);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        code,
        redirect_uri: this.getRedirectUri(),
        grant_type: 'authorization_code',
        scope: SCOPES.join(' '),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = await response.json();
    
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: this.tokenExpiresAt,
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const tokenUrl = OAUTH_TOKEN_URL.replace('{tenant}', this.credentials.tenantId);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES.join(' '),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || refreshToken;
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: this.refreshToken,
      expiresAt: this.tokenExpiresAt,
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    // Consider expired if within 5 minutes of expiration
    return new Date() >= new Date(this.tokenExpiresAt.getTime() - 5 * 60 * 1000);
  }

  setTokens(accessToken: string, refreshToken?: string, expiresAt?: Date): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = expiresAt;
  }

  // ============================================
  // Connection Methods
  // ============================================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureValidToken();

      // Get user info
      const userResponse = await this.graphRequest('/me');
      
      // Get drive info
      const driveResponse = await this.graphRequest(this.getDriveEndpoint());

      return {
        success: true,
        message: 'Successfully connected to SharePoint/OneDrive',
        accountInfo: {
          email: userResponse.mail || userResponse.userPrincipalName,
          name: userResponse.displayName,
          quota: driveResponse.quota ? {
            used: driveResponse.quota.used,
            total: driveResponse.quota.total,
          } : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.tokenExpiresAt = undefined;
  }

  // ============================================
  // File Operations
  // ============================================

  async listFiles(
    folderId?: string,
    options?: {
      pageToken?: string;
      pageSize?: number;
      filePatterns?: string[];
    }
  ): Promise<ListFilesResult> {
    await this.ensureValidToken();

    const { pageToken, pageSize = 100, filePatterns } = options || {};
    
    let endpoint: string;
    if (pageToken) {
      // Use the next page URL directly
      endpoint = pageToken;
    } else if (folderId && folderId !== 'root') {
      endpoint = `${this.getDriveEndpoint()}/items/${folderId}/children`;
    } else {
      endpoint = `${this.getDriveEndpoint()}/root/children`;
    }

    const params = new URLSearchParams({
      $top: String(pageSize),
      $select: 'id,name,size,createdDateTime,lastModifiedDateTime,file,folder,parentReference,webUrl,eTag',
    });

    // Only add params if not using a continuation URL
    const url = pageToken ? endpoint : `${endpoint}?${params.toString()}`;
    const response = await this.graphRequest(url, true);

    const files: RemoteFile[] = [];
    const folders: RemoteFile[] = [];

    for (const item of response.value || []) {
      const remoteFile = this.mapDriveItemToRemoteFile(item);
      
      if (item.folder) {
        folders.push(remoteFile);
      } else if (item.file) {
        // Apply file pattern filter
        if (!filePatterns || matchesFilePattern(item.name, filePatterns)) {
          // Only include supported MIME types
          if (isSupportedMimeType(item.file.mimeType)) {
            files.push(remoteFile);
          }
        }
      }
    }

    return {
      files,
      folders,
      nextPageToken: response['@odata.nextLink'],
      hasMore: !!response['@odata.nextLink'],
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    await this.ensureValidToken();

    // Get file metadata first
    const metadata = await this.graphRequest(`${this.getDriveEndpoint()}/items/${fileId}`);
    
    if (!metadata.file) {
      throw new Error('Item is not a file');
    }

    // Download content
    const downloadUrl = metadata['@microsoft.graph.downloadUrl'];
    if (!downloadUrl) {
      throw new Error('Download URL not available');
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      content: Buffer.from(arrayBuffer),
      mimeType: metadata.file.mimeType,
      name: metadata.name,
      size: metadata.size || arrayBuffer.byteLength,
      hash: metadata.eTag || metadata.file.hashes?.sha256Hash,
    };
  }

  async getFileMetadata(fileId: string): Promise<RemoteFile> {
    await this.ensureValidToken();

    const item = await this.graphRequest(`${this.getDriveEndpoint()}/items/${fileId}`);
    return this.mapDriveItemToRemoteFile(item);
  }

  // ============================================
  // Delta Sync Support
  // ============================================

  supportsDeltaSync(): boolean {
    return true; // Microsoft Graph supports delta queries
  }

  async getDeltaChanges(deltaToken?: string): Promise<DeltaSyncResult> {
    await this.ensureValidToken();

    let endpoint: string;
    if (deltaToken) {
      endpoint = deltaToken; // Delta token is actually the full URL
    } else {
      endpoint = `${this.getDriveEndpoint()}/root/delta`;
    }

    const changes: DeltaSyncResult['changes'] = [];
    let nextLink = endpoint;
    let newDeltaToken: string | undefined;

    // Handle pagination
    while (nextLink) {
      const response: GraphDeltaResponse = await this.graphRequest(nextLink, true);

      for (const item of response.value) {
        // Deleted items have a 'deleted' facet
        const isDeleted = 'deleted' in item;
        const remoteFile = this.mapDriveItemToRemoteFile(item);

        if (isDeleted) {
          changes.push({ type: 'deleted', file: remoteFile });
        } else if (item.file) {
          // Check if it's a new file or modified
          // For simplicity, we treat all as 'modified' - the sync service will handle deduplication
          changes.push({ type: 'modified', file: remoteFile });
        }
      }

      nextLink = response['@odata.nextLink'] || '';
      if (response['@odata.deltaLink']) {
        newDeltaToken = response['@odata.deltaLink'];
      }
    }

    return {
      changes,
      deltaToken: newDeltaToken,
      hasMore: false, // We've fetched all pages
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getRedirectUri(): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/sharepoint`;
  }

  private getDriveEndpoint(): string {
    if (this.driveId) {
      return `/drives/${this.driveId}`;
    }
    if (this.siteId) {
      return `/sites/${this.siteId}/drive`;
    }
    if (this.credentials.siteUrl) {
      // Site URL format: https://tenant.sharepoint.com/sites/sitename
      const url = new URL(this.credentials.siteUrl);
      const hostname = url.hostname;
      const sitePath = url.pathname;
      return `/sites/${hostname}:${sitePath}:/drive`;
    }
    // Default to user's OneDrive
    return '/me/drive';
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please connect first.');
    }

    if (this.isTokenExpired() && this.refreshToken) {
      await this.refreshAccessToken(this.refreshToken);
    }
  }

  private async graphRequest(endpoint: string, isFullUrl = false): Promise<GraphDriveItem & { value?: GraphDriveItem[], quota?: { used: number, total: number } } & Record<string, unknown>> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const url = isFullUrl ? endpoint : `${GRAPH_API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Graph API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  private mapDriveItemToRemoteFile(item: GraphDriveItem): RemoteFile {
    return {
      id: item.id,
      name: item.name,
      path: item.parentReference?.path 
        ? `${item.parentReference.path}/${item.name}`.replace(/^\/drive\/root:/, '')
        : `/${item.name}`,
      mimeType: item.file?.mimeType || 'application/octet-stream',
      size: item.size || 0,
      createdAt: item.createdDateTime ? new Date(item.createdDateTime) : undefined,
      modifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
      hash: item.eTag || item.file?.hashes?.sha256Hash,
      isFolder: !!item.folder,
      parentId: item.parentReference?.id,
      webUrl: item.webUrl,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
    };
  }
}

/**
 * OneDrive connector - same as SharePoint but defaults to user's personal drive
 */
export class OneDriveConnector extends SharePointConnector {
  override readonly provider = ContractSourceProvider.ONEDRIVE;
}

/**
 * Factory function to create SharePoint/OneDrive connector
 */
export function createMicrosoftConnector(
  credentials: SharePointCredentials
): SharePointConnector | OneDriveConnector {
  if (credentials.type === 'onedrive') {
    return new OneDriveConnector(credentials);
  }
  return new SharePointConnector(credentials);
}
