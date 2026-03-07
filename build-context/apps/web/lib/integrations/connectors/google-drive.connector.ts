/**
 * Google Drive Connector
 * 
 * Wraps the existing Google Drive integration to conform to the
 * IContractSourceConnector interface for unified sync operations.
 */

import {
  IContractSourceConnector,
  IOAuthConnector,
  RemoteFile,
  ListFilesResult,
  DownloadedFile,
  ConnectionTestResult,
  DeltaSyncResult,
  GoogleDriveCredentials,
  isSupportedMimeType,
} from './types';
import {
  getGoogleDriveAuthUrl,
  exchangeCodeForTokens,
  refreshGoogleDriveToken,
  getGoogleUserInfo,
  listDriveFiles,
  downloadDriveFile,
  GoogleDriveFile,
} from '../google-drive';

export class GoogleDriveConnector implements IContractSourceConnector, IOAuthConnector {
  private credentials: GoogleDriveCredentials;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(credentials: GoogleDriveCredentials) {
    this.credentials = credentials;
    this.accessToken = credentials.accessToken;
    this.tokenExpiresAt = credentials.tokenExpiresAt ? new Date(credentials.tokenExpiresAt) : undefined;
  }

  // ==================== IOAuthConnector Methods ====================

  getAuthorizationUrl(state?: string): string {
    return getGoogleDriveAuthUrl(state);
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const tokens = await exchangeCodeForTokens(code);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    const tokens = await refreshGoogleDriveToken(refreshToken);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
  }

  // ==================== IContractSourceConnector Methods ====================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureValidToken();
      
      if (!this.accessToken) {
        return {
          connected: false,
          error: 'No access token available. Please authorize with Google.',
        };
      }

      // Get user info to verify connection
      const userInfo = await getGoogleUserInfo(this.accessToken);

      return {
        connected: true,
        accountInfo: {
          email: userInfo.email,
          name: userInfo.name,
          id: userInfo.id,
        },
        capabilities: {
          deltaSync: false, // Google Drive API has changes API but we use incremental for simplicity
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
    path: string = 'root',
    options: {
      recursive?: boolean;
      pageToken?: string;
      pageSize?: number;
    } = {}
  ): Promise<ListFilesResult> {
    await this.ensureValidToken();
    
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    const { recursive = false, pageToken, pageSize = 100 } = options;
    const files: RemoteFile[] = [];

    // The path in Google Drive is actually a folder ID
    // 'root' is a special ID for the root folder
    const folderId = path === '/' ? 'root' : path;

    const result = await listDriveFiles(this.accessToken, folderId, {
      pageToken,
      pageSize,
      includeSubfolders: true,
    });

    for (const file of result.files) {
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      
      const remoteFile: RemoteFile = {
        id: file.id,
        name: file.name,
        path: `/${file.name}`,
        isFolder,
        size: file.size ? parseInt(file.size.toString(), 10) : undefined,
        mimeType: file.mimeType,
        modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
        createdAt: file.createdTime ? new Date(file.createdTime) : undefined,
        hash: file.modifiedTime, // Use modified time as pseudo-hash for change detection
        metadata: {
          webViewLink: file.webViewLink,
          iconLink: file.iconLink,
          thumbnailLink: file.thumbnailLink,
          parents: file.parents,
        },
      };

      // Only include supported file types or folders
      if (isFolder || isSupportedMimeType(file.mimeType)) {
        files.push(remoteFile);
      }
    }

    // If recursive, fetch subfolders
    if (recursive) {
      const folders = files.filter(f => f.isFolder);
      for (const folder of folders) {
        const subFiles = await this.listFiles(folder.id, { recursive: true });
        // Prepend parent path
        for (const subFile of subFiles.files) {
          subFile.path = `${folder.path}${subFile.path}`;
          files.push(subFile);
        }
      }
    }

    return {
      files,
      nextPageToken: result.nextPageToken,
      hasMore: !!result.nextPageToken,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    await this.ensureValidToken();
    
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    const result = await downloadDriveFile(this.accessToken, fileId);

    return {
      content: result.content,
      mimeType: result.mimeType,
      filename: result.name,
    };
  }

  async getDeltaChanges(deltaToken?: string): Promise<DeltaSyncResult> {
    // Google Drive has a changes API, but for simplicity we use incremental sync
    // based on modified times. A full delta implementation would use:
    // https://developers.google.com/drive/api/v3/reference/changes/list
    
    await this.ensureValidToken();
    
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    // For now, return all files and let the sync service handle comparison
    const result = await this.listFiles('root', { recursive: true });
    
    return {
      newOrModifiedFiles: result.files.filter(f => !f.isFolder),
      deletedFileIds: [], // Would need to track previous state
      newDeltaToken: new Date().toISOString(),
      hasMore: result.hasMore,
    };
  }

  // ==================== Private Methods ====================

  private async ensureValidToken(): Promise<void> {
    // Check if we need to refresh the token
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferMs = 5 * 60 * 1000; // 5 minute buffer
      
      if (this.tokenExpiresAt.getTime() - bufferMs > now.getTime()) {
        // Token is still valid
        return;
      }
    }

    // Need to refresh token
    if (this.credentials.refreshToken) {
      try {
        const newTokens = await this.refreshAccessToken(this.credentials.refreshToken);
        this.accessToken = newTokens.accessToken;
        this.tokenExpiresAt = newTokens.expiresAt;
        
        // Note: In production, you'd want to persist these new tokens
        // back to the database via the sync service
      } catch (error) {
        console.error('Failed to refresh Google Drive token:', error);
        throw new Error('Google Drive authentication expired. Please reconnect.');
      }
    } else if (!this.accessToken) {
      throw new Error('No Google Drive credentials available. Please authorize.');
    }
  }
}
