/**
 * SFTP Connector
 * 
 * Connects to SFTP servers for syncing contract files.
 * Supports password and private key authentication.
 * 
 * Setup Required:
 * 1. SFTP server host and port
 * 2. Username and password OR private key
 */

import {
  IContractSourceConnector,
  ConnectionTestResult,
  ListFilesResult,
  RemoteFile,
  DownloadedFile,
  DeltaSyncResult,
  SFTPCredentials,
  isSupportedMimeType,
  matchesFilePattern,
} from './types';
import { ContractSourceProvider } from '@prisma/client';
import SFTPClient from 'ssh2-sftp-client';

// MIME type detection based on file extension
const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

interface SFTPFileInfo {
  type: string;
  name: string;
  size: number;
  modifyTime: number;
  accessTime: number;
  rights: {
    user: string;
    group: string;
    other: string;
  };
  owner: number;
  group: number;
}

export class SFTPConnector implements IContractSourceConnector {
  readonly provider = ContractSourceProvider.SFTP;
  
  private credentials: SFTPCredentials;
  private client: SFTPClient;
  private isConnected = false;

  constructor(credentials: SFTPCredentials) {
    this.credentials = credentials;
    this.client = new SFTPClient();
  }

  // ============================================
  // Connection Methods
  // ============================================

  private async connect(): Promise<void> {
    if (this.isConnected) return;

    const config: SFTPClient.ConnectOptions = {
      host: this.credentials.host,
      port: this.credentials.port || 22,
      username: this.credentials.username,
    };

    if (this.credentials.privateKey) {
      config.privateKey = this.credentials.privateKey;
      if (this.credentials.passphrase) {
        config.passphrase = this.credentials.passphrase;
      }
    } else if (this.credentials.password) {
      config.password = this.credentials.password;
    }

    await this.client.connect(config);
    this.isConnected = true;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.connect();

      // Get current working directory
      const cwd = await this.client.cwd();

      // List root to verify access
      const files = await this.client.list('/');
      const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

      return {
        success: true,
        message: 'Successfully connected to SFTP server',
        accountInfo: {
          name: `${this.credentials.username}@${this.credentials.host}:${this.credentials.port}`,
          quota: {
            used: totalSize,
            total: -1,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to SFTP server',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
    }
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
    await this.connect();

    const { pageSize = 100, filePatterns } = options || {};
    const path = folderId && folderId !== 'root' ? folderId : '/';

    const items = await this.client.list(path);
    
    const files: RemoteFile[] = [];
    const folders: RemoteFile[] = [];

    for (const item of items) {
      const fullPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
      
      if (item.type === 'd') {
        // Directory
        folders.push({
          id: fullPath,
          name: item.name,
          path: fullPath,
          mimeType: 'application/x-directory',
          size: 0,
          modifiedAt: new Date(item.modifyTime),
          isFolder: true,
        });
      } else if (item.type === '-') {
        // File
        const mimeType = this.getMimeType(item.name);

        // Apply filters
        if (filePatterns && !matchesFilePattern(item.name, filePatterns)) {
          continue;
        }
        if (!isSupportedMimeType(mimeType)) {
          continue;
        }

        files.push({
          id: fullPath,
          name: item.name,
          path: fullPath,
          mimeType,
          size: item.size,
          modifiedAt: new Date(item.modifyTime),
          isFolder: false,
        });
      }
    }

    // SFTP doesn't support pagination natively, so we slice manually
    const paginatedFiles = files.slice(0, pageSize);
    
    return {
      files: paginatedFiles,
      folders,
      hasMore: files.length > pageSize,
      totalCount: files.length,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    await this.connect();

    const content = await this.client.get(fileId) as Buffer;
    const fileName = fileId.split('/').pop() || fileId;
    const stat = await this.client.stat(fileId);

    return {
      content,
      mimeType: this.getMimeType(fileName),
      name: fileName,
      size: stat.size,
    };
  }

  async getFileMetadata(fileId: string): Promise<RemoteFile> {
    await this.connect();

    const stat = await this.client.stat(fileId);
    const fileName = fileId.split('/').pop() || fileId;

    return {
      id: fileId,
      name: fileName,
      path: fileId,
      mimeType: this.getMimeType(fileName),
      size: stat.size,
      modifiedAt: new Date(stat.modifyTime),
      isFolder: stat.isDirectory,
    };
  }

  // ============================================
  // Delta Sync Support
  // ============================================

  supportsDeltaSync(): boolean {
    return false;
  }

  async getDeltaChanges(deltaToken?: string): Promise<DeltaSyncResult> {
    await this.connect();

    const lastSyncTime = deltaToken ? new Date(deltaToken) : new Date(0);
    const changes: DeltaSyncResult['changes'] = [];

    // Recursively scan directories
    const scanDirectory = async (path: string): Promise<void> => {
      const items = await this.client.list(path);

      for (const item of items) {
        const fullPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;

        if (item.type === 'd') {
          // Recurse into directories
          await scanDirectory(fullPath);
        } else if (item.type === '-') {
          const mimeType = this.getMimeType(item.name);
          if (!isSupportedMimeType(mimeType)) {
            continue;
          }

          const modifiedAt = new Date(item.modifyTime);
          if (modifiedAt > lastSyncTime) {
            changes.push({
              type: 'modified',
              file: {
                id: fullPath,
                name: item.name,
                path: fullPath,
                mimeType,
                size: item.size,
                modifiedAt,
                isFolder: false,
              },
            });
          }
        }
      }
    };

    await scanDirectory('/');

    return {
      changes,
      deltaToken: new Date().toISOString(),
      hasMore: false,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
    return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
  }
}

/**
 * Factory function to create SFTP connector
 */
export function createSFTPConnector(credentials: SFTPCredentials): SFTPConnector {
  return new SFTPConnector(credentials);
}
