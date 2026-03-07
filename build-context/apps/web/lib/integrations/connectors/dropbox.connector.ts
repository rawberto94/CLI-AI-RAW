/**
 * Dropbox Connector
 * 
 * Implements Dropbox integration using their HTTP API.
 * Supports OAuth 2.0 for authentication.
 */

import {
  IContractSourceConnector,
  IOAuthConnector,
  RemoteFile,
  ListFilesResult,
  DownloadedFile,
  ConnectionTestResult,
  DeltaSyncResult,
  isSupportedMimeType,
} from './types';

export interface DropboxCredentials {
  type: 'dropbox';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string | Date;
  appKey?: string;
  appSecret?: string;
}

const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2';
const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

export class DropboxConnector implements IContractSourceConnector, IOAuthConnector {
  private credentials: DropboxCredentials;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(credentials: DropboxCredentials) {
    this.credentials = credentials;
    this.accessToken = credentials.accessToken;
    this.tokenExpiresAt = credentials.tokenExpiresAt 
      ? new Date(credentials.tokenExpiresAt) 
      : undefined;
  }

  // ==================== IOAuthConnector Methods ====================

  getAuthorizationUrl(state?: string): string {
    const appKey = this.credentials.appKey || process.env.DROPBOX_APP_KEY;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/dropbox`;

    if (!appKey) {
      throw new Error('DROPBOX_APP_KEY is not configured');
    }

    const params = new URLSearchParams({
      client_id: appKey,
      redirect_uri: redirectUri,
      response_type: 'code',
      token_access_type: 'offline', // Get refresh token
    });

    if (state) {
      params.set('state', state);
    }

    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const appKey = this.credentials.appKey || process.env.DROPBOX_APP_KEY;
    const appSecret = this.credentials.appSecret || process.env.DROPBOX_APP_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/dropbox`;

    if (!appKey || !appSecret) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: appKey,
        client_secret: appSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    const appKey = this.credentials.appKey || process.env.DROPBOX_APP_KEY;
    const appSecret = this.credentials.appSecret || process.env.DROPBOX_APP_SECRET;

    if (!appKey || !appSecret) {
      throw new Error('Dropbox OAuth credentials not configured');
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: appKey,
        client_secret: appSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  // ==================== IContractSourceConnector Methods ====================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureValidToken();

      if (!this.accessToken) {
        return {
          connected: false,
          error: 'No access token available. Please authorize with Dropbox.',
        };
      }

      // Get current account info
      const response = await fetch(`${DROPBOX_API_URL}/users/get_current_account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get account info');
      }

      const account = await response.json();

      return {
        connected: true,
        accountInfo: {
          email: account.email,
          name: account.name?.display_name || account.email,
          id: account.account_id,
        },
        capabilities: {
          deltaSync: true, // Dropbox has cursor-based delta
          folderListing: true,
          fileDownload: true,
          fileMetadata: true,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  async listFiles(
    path: string = '',
    options: {
      recursive?: boolean;
      pageToken?: string;
      pageSize?: number;
    } = {}
  ): Promise<ListFilesResult> {
    await this.ensureValidToken();

    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    const { recursive = false, pageToken } = options;
    const files: RemoteFile[] = [];

    // Normalize path - Dropbox uses empty string for root
    const dropboxPath = path === '/' ? '' : path;

    let endpoint: string;
    let body: Record<string, unknown>;

    if (pageToken) {
      // Continue from cursor
      endpoint = `${DROPBOX_API_URL}/files/list_folder/continue`;
      body = { cursor: pageToken };
    } else {
      // Initial listing
      endpoint = `${DROPBOX_API_URL}/files/list_folder`;
      body = {
        path: dropboxPath,
        recursive,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: true,
        limit: 500,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_summary || 'Failed to list files');
    }

    const data = await response.json();

    for (const entry of data.entries) {
      const isFolder = entry['.tag'] === 'folder';

      const remoteFile: RemoteFile = {
        id: entry.id,
        name: entry.name,
        path: entry.path_display || entry.path_lower,
        isFolder,
        size: entry.size,
        mimeType: this.getMimeType(entry.name),
        modifiedAt: entry.server_modified ? new Date(entry.server_modified) : undefined,
        hash: entry.content_hash,
        metadata: {
          rev: entry.rev,
          isDownloadable: entry.is_downloadable !== false,
        },
      };

      // Only include supported file types or folders
      if (isFolder || isSupportedMimeType(remoteFile.mimeType)) {
        files.push(remoteFile);
      }
    }

    return {
      files,
      nextPageToken: data.has_more ? data.cursor : undefined,
      hasMore: data.has_more,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    await this.ensureValidToken();

    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    // Dropbox uses path for download, not ID
    // The fileId here is actually the path
    const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    // Get metadata from header
    const metadataHeader = response.headers.get('Dropbox-API-Result');
    const metadata = metadataHeader ? JSON.parse(metadataHeader) : {};

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      content: buffer,
      mimeType: this.getMimeType(metadata.name || fileId),
      filename: metadata.name || fileId.split('/').pop() || 'unknown',
    };
  }

  async getDeltaChanges(deltaToken?: string): Promise<DeltaSyncResult> {
    await this.ensureValidToken();

    if (!this.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    // If no delta token, get latest cursor first
    if (!deltaToken) {
      const cursorResponse = await fetch(`${DROPBOX_API_URL}/files/list_folder/get_latest_cursor`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '',
          recursive: true,
          include_deleted: true,
        }),
      });

      if (!cursorResponse.ok) {
        throw new Error('Failed to get cursor');
      }

      const cursorData = await cursorResponse.json();
      
      // Return empty result with the new cursor
      return {
        newOrModifiedFiles: [],
        deletedFileIds: [],
        newDeltaToken: cursorData.cursor,
        hasMore: false,
      };
    }

    // Get changes since cursor
    const response = await fetch(`${DROPBOX_API_URL}/files/list_folder/continue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor: deltaToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      
      // If cursor is expired, return null token to force full sync
      if (error.error?.['.tag'] === 'reset') {
        return {
          newOrModifiedFiles: [],
          deletedFileIds: [],
          newDeltaToken: undefined,
          hasMore: false,
        };
      }
      
      throw new Error(error.error_summary || 'Failed to get delta changes');
    }

    const data = await response.json();
    const newOrModifiedFiles: RemoteFile[] = [];
    const deletedFileIds: string[] = [];

    for (const entry of data.entries) {
      if (entry['.tag'] === 'deleted') {
        deletedFileIds.push(entry.path_lower);
      } else if (entry['.tag'] === 'file') {
        const remoteFile: RemoteFile = {
          id: entry.id,
          name: entry.name,
          path: entry.path_display || entry.path_lower,
          isFolder: false,
          size: entry.size,
          mimeType: this.getMimeType(entry.name),
          modifiedAt: entry.server_modified ? new Date(entry.server_modified) : undefined,
          hash: entry.content_hash,
        };

        if (isSupportedMimeType(remoteFile.mimeType)) {
          newOrModifiedFiles.push(remoteFile);
        }
      }
    }

    return {
      newOrModifiedFiles,
      deletedFileIds,
      newDeltaToken: data.cursor,
      hasMore: data.has_more,
    };
  }

  // ==================== Private Methods ====================

  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferMs = 5 * 60 * 1000; // 5 minute buffer

      if (this.tokenExpiresAt.getTime() - bufferMs > now.getTime()) {
        return;
      }
    }

    if (this.credentials.refreshToken) {
      try {
        const newTokens = await this.refreshAccessToken(this.credentials.refreshToken);
        this.accessToken = newTokens.accessToken;
        this.tokenExpiresAt = newTokens.expiresAt;
      } catch (error) {
        console.error('Failed to refresh Dropbox token:', error);
        throw new Error('Dropbox authentication expired. Please reconnect.');
      }
    } else if (!this.accessToken) {
      throw new Error('No Dropbox credentials available. Please authorize.');
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      csv: 'text/csv',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      tiff: 'image/tiff',
      tif: 'image/tiff',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

export function createDropboxConnector(credentials: DropboxCredentials): DropboxConnector {
  return new DropboxConnector(credentials);
}
