/**
 * Box Connector
 * 
 * Implements Box integration using their Content API.
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

export interface BoxCredentials {
  type: 'box';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string | Date;
  clientId?: string;
  clientSecret?: string;
}

const BOX_API_URL = 'https://api.box.com/2.0';
const BOX_AUTH_URL = 'https://account.box.com/api/oauth2/authorize';
const BOX_TOKEN_URL = 'https://api.box.com/oauth2/token';

export class BoxConnector implements IContractSourceConnector, IOAuthConnector {
  private credentials: BoxCredentials;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(credentials: BoxCredentials) {
    this.credentials = credentials;
    this.accessToken = credentials.accessToken;
    this.tokenExpiresAt = credentials.tokenExpiresAt 
      ? new Date(credentials.tokenExpiresAt) 
      : undefined;
  }

  // ==================== IOAuthConnector Methods ====================

  getAuthorizationUrl(state?: string): string {
    const clientId = this.credentials.clientId || process.env.BOX_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/box`;

    if (!clientId) {
      throw new Error('BOX_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
    });

    if (state) {
      params.set('state', state);
    }

    return `${BOX_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const clientId = this.credentials.clientId || process.env.BOX_CLIENT_ID;
    const clientSecret = this.credentials.clientSecret || process.env.BOX_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/box`;

    if (!clientId || !clientSecret) {
      throw new Error('Box OAuth credentials not configured');
    }

    const response = await fetch(BOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
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
    const clientId = this.credentials.clientId || process.env.BOX_CLIENT_ID;
    const clientSecret = this.credentials.clientSecret || process.env.BOX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Box OAuth credentials not configured');
    }

    const response = await fetch(BOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
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
          error: 'No access token available. Please authorize with Box.',
        };
      }

      // Get current user info
      const response = await fetch(`${BOX_API_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      const user = await response.json();

      return {
        connected: true,
        accountInfo: {
          email: user.login,
          name: user.name,
          id: user.id,
        },
        capabilities: {
          deltaSync: true, // Box has events API for changes
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
    path: string = '0',
    options: {
      recursive?: boolean;
      pageToken?: string;
      pageSize?: number;
    } = {}
  ): Promise<ListFilesResult> {
    await this.ensureValidToken();

    if (!this.accessToken) {
      throw new Error('Not authenticated with Box');
    }

    const { recursive = false, pageToken, pageSize = 100 } = options;
    const files: RemoteFile[] = [];

    // Box uses folder IDs - '0' is root
    const folderId = path === '/' ? '0' : path;

    const params = new URLSearchParams({
      fields: 'id,name,type,size,modified_at,created_at,sha1,path_collection',
      limit: String(pageSize),
    });

    if (pageToken) {
      params.set('offset', pageToken);
    }

    const response = await fetch(
      `${BOX_API_URL}/folders/${folderId}/items?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list files');
    }

    const data = await response.json();

    for (const entry of data.entries) {
      const isFolder = entry.type === 'folder';

      // Build path from path_collection
      const pathParts = entry.path_collection?.entries?.map((e: any) => e.name) || [];
      pathParts.push(entry.name);
      const fullPath = '/' + pathParts.slice(1).join('/'); // Skip "All Files" root

      const remoteFile: RemoteFile = {
        id: entry.id,
        name: entry.name,
        path: fullPath,
        isFolder,
        size: entry.size,
        mimeType: this.getMimeType(entry.name),
        modifiedAt: entry.modified_at ? new Date(entry.modified_at) : undefined,
        createdAt: entry.created_at ? new Date(entry.created_at) : undefined,
        hash: entry.sha1,
      };

      // Only include supported file types or folders
      if (isFolder || isSupportedMimeType(remoteFile.mimeType)) {
        files.push(remoteFile);
      }
    }

    // Handle recursive listing
    if (recursive) {
      const folders = files.filter(f => f.isFolder);
      for (const folder of folders) {
        const subFiles = await this.listFiles(folder.id, { recursive: true });
        files.push(...subFiles.files);
      }
    }

    // Calculate pagination
    const offset = parseInt(pageToken || '0', 10);
    const hasMore = offset + data.entries.length < data.total_count;
    const nextOffset = hasMore ? String(offset + data.entries.length) : undefined;

    return {
      files,
      nextPageToken: nextOffset,
      hasMore,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    await this.ensureValidToken();

    if (!this.accessToken) {
      throw new Error('Not authenticated with Box');
    }

    // First get file info for metadata
    const infoResponse = await fetch(`${BOX_API_URL}/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!infoResponse.ok) {
      throw new Error('Failed to get file info');
    }

    const fileInfo = await infoResponse.json();

    // Download file content
    const response = await fetch(`${BOX_API_URL}/files/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      content: buffer,
      mimeType: this.getMimeType(fileInfo.name),
      filename: fileInfo.name,
    };
  }

  async getDeltaChanges(deltaToken?: string): Promise<DeltaSyncResult> {
    await this.ensureValidToken();

    if (!this.accessToken) {
      throw new Error('Not authenticated with Box');
    }

    // Get events stream
    const params = new URLSearchParams({
      stream_type: 'changes',
      limit: '500',
    });

    if (deltaToken) {
      params.set('stream_position', deltaToken);
    } else {
      params.set('stream_position', 'now');
      
      // If no token, get current position and return empty
      const response = await fetch(`${BOX_API_URL}/events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get events');
      }

      const data = await response.json();
      return {
        newOrModifiedFiles: [],
        deletedFileIds: [],
        newDeltaToken: data.next_stream_position,
        hasMore: false,
      };
    }

    const response = await fetch(`${BOX_API_URL}/events?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get events');
    }

    const data = await response.json();
    const newOrModifiedFiles: RemoteFile[] = [];
    const deletedFileIds: string[] = [];
    const seenIds = new Set<string>();

    for (const event of data.entries) {
      const source = event.source;
      if (!source || source.type !== 'file') continue;
      if (seenIds.has(source.id)) continue;
      seenIds.add(source.id);

      if (['ITEM_TRASH', 'ITEM_UNDELETE_VIA_TRASH'].includes(event.event_type)) {
        deletedFileIds.push(source.id);
      } else if (['ITEM_CREATE', 'ITEM_UPLOAD', 'ITEM_COPY', 'ITEM_MOVE'].includes(event.event_type)) {
        const remoteFile: RemoteFile = {
          id: source.id,
          name: source.name,
          path: source.path_collection?.entries?.map((e: any) => e.name).join('/') || source.name,
          isFolder: false,
          size: source.size,
          mimeType: this.getMimeType(source.name),
          modifiedAt: source.modified_at ? new Date(source.modified_at) : undefined,
          hash: source.sha1,
        };

        if (isSupportedMimeType(remoteFile.mimeType)) {
          newOrModifiedFiles.push(remoteFile);
        }
      }
    }

    return {
      newOrModifiedFiles,
      deletedFileIds,
      newDeltaToken: data.next_stream_position,
      hasMore: data.chunk_size === 500,
    };
  }

  // ==================== Private Methods ====================

  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferMs = 5 * 60 * 1000;

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
        console.error('Failed to refresh Box token:', error);
        throw new Error('Box authentication expired. Please reconnect.');
      }
    } else if (!this.accessToken) {
      throw new Error('No Box credentials available. Please authorize.');
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

export function createBoxConnector(credentials: BoxCredentials): BoxConnector {
  return new BoxConnector(credentials);
}
