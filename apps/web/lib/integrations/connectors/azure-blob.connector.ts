/**
 * Azure Blob Storage Connector
 * 
 * Connects to Azure Blob Storage for syncing contract files.
 * Supports both account key and SAS token authentication.
 * 
 * Setup Required:
 * 1. Create an Azure Storage account
 * 2. Create a container for contracts
 * 3. Get access key or generate SAS token
 */

import {
  IContractSourceConnector,
  ConnectionTestResult,
  ListFilesResult,
  RemoteFile,
  DownloadedFile,
  DeltaSyncResult,
  AzureBlobCredentials,
  isSupportedMimeType,
  matchesFilePattern,
} from './types';
import { ContractSourceProvider } from '@prisma/client';
import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  BlobItem,
} from '@azure/storage-blob';

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

export class AzureBlobConnector implements IContractSourceConnector {
  readonly provider = ContractSourceProvider.AZURE_BLOB;
  
  private credentials: AzureBlobCredentials;
  private blobServiceClient?: BlobServiceClient;
  private containerClient?: ContainerClient;

  constructor(credentials: AzureBlobCredentials) {
    this.credentials = credentials;
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      if (this.credentials.connectionString) {
        // Use connection string
        this.blobServiceClient = BlobServiceClient.fromConnectionString(
          this.credentials.connectionString
        );
      } else if (this.credentials.sasToken) {
        // Use SAS token
        const url = `https://${this.credentials.accountName}.blob.core.windows.net${this.credentials.sasToken}`;
        this.blobServiceClient = new BlobServiceClient(url);
      } else if (this.credentials.accountKey) {
        // Use account key
        const sharedKeyCredential = new StorageSharedKeyCredential(
          this.credentials.accountName,
          this.credentials.accountKey
        );
        const url = `https://${this.credentials.accountName}.blob.core.windows.net`;
        this.blobServiceClient = new BlobServiceClient(url, sharedKeyCredential);
      } else {
        throw new Error('No valid credentials provided');
      }

      this.containerClient = this.blobServiceClient.getContainerClient(
        this.credentials.containerName
      );
    } catch (error) {
      console.error('Failed to initialize Azure Blob client:', error);
    }
  }

  // ============================================
  // Connection Methods
  // ============================================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (!this.containerClient) {
        throw new Error('Client not initialized');
      }

      // Check if container exists and we have access
      const exists = await this.containerClient.exists();
      if (!exists) {
        return {
          success: false,
          message: `Container '${this.credentials.containerName}' does not exist`,
          error: 'Container not found',
        };
      }

      // Get container properties
      const properties = await this.containerClient.getProperties();

      // Count blobs for stats
      let blobCount = 0;
      let totalSize = 0;
      const blobs = this.containerClient.listBlobsFlat({ maxPageSize: 1000 });
      for await (const blob of blobs) {
        blobCount++;
        totalSize += blob.properties.contentLength || 0;
        if (blobCount >= 1000) break; // Limit for performance
      }

      return {
        success: true,
        message: 'Successfully connected to Azure Blob Storage',
        accountInfo: {
          name: `${this.credentials.accountName}/${this.credentials.containerName}`,
          quota: {
            used: totalSize,
            total: -1, // Azure doesn't have per-container quotas by default
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to Azure Blob Storage',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async disconnect(): Promise<void> {
    this.blobServiceClient = undefined;
    this.containerClient = undefined;
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
    if (!this.containerClient) {
      throw new Error('Client not initialized');
    }

    const { pageToken, pageSize = 100, filePatterns } = options || {};
    const prefix = folderId && folderId !== 'root' ? folderId : '';

    const files: RemoteFile[] = [];
    const folders: RemoteFile[] = [];
    const seenFolders = new Set<string>();

    // List blobs with hierarchy
    const iterator = this.containerClient.listBlobsByHierarchy('/', {
      prefix: prefix ? `${prefix}/` : undefined,
    });

    let count = 0;
    let continuationToken: string | undefined;

    for await (const item of iterator) {
      if (count >= pageSize) {
        // We'd need to track the continuation token
        // Azure SDK handles this internally, but for simplicity we'll just limit
        break;
      }

      if (item.kind === 'prefix') {
        // This is a virtual folder
        const folderName = item.name.replace(/\/$/, '').split('/').pop() || item.name;
        if (!seenFolders.has(item.name)) {
          seenFolders.add(item.name);
          folders.push({
            id: item.name,
            name: folderName,
            path: `/${item.name}`,
            mimeType: 'application/x-directory',
            size: 0,
            isFolder: true,
          });
        }
      } else {
        // This is a blob
        const blob = item as BlobItem;
        const fileName = blob.name.split('/').pop() || blob.name;
        const mimeType = this.getMimeType(fileName);

        // Apply filters
        if (filePatterns && !matchesFilePattern(fileName, filePatterns)) {
          continue;
        }
        if (!isSupportedMimeType(mimeType)) {
          continue;
        }

        files.push(this.mapBlobToRemoteFile(blob));
        count++;
      }
    }

    return {
      files,
      folders,
      nextPageToken: continuationToken,
      hasMore: !!continuationToken,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    if (!this.containerClient) {
      throw new Error('Client not initialized');
    }

    const blobClient = this.containerClient.getBlobClient(fileId);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error(`Blob not found: ${fileId}`);
    }

    // Download blob content
    const downloadResponse = await blobClient.download();
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to get download stream');
    }

    // Read stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks);

    const properties = await blobClient.getProperties();
    const fileName = fileId.split('/').pop() || fileId;

    return {
      content,
      mimeType: properties.contentType || this.getMimeType(fileName),
      name: fileName,
      size: properties.contentLength || content.length,
      hash: properties.etag,
    };
  }

  async getFileMetadata(fileId: string): Promise<RemoteFile> {
    if (!this.containerClient) {
      throw new Error('Client not initialized');
    }

    const blobClient = this.containerClient.getBlobClient(fileId);
    const properties = await blobClient.getProperties();
    const fileName = fileId.split('/').pop() || fileId;

    return {
      id: fileId,
      name: fileName,
      path: `/${fileId}`,
      mimeType: properties.contentType || this.getMimeType(fileName),
      size: properties.contentLength || 0,
      createdAt: properties.createdOn,
      modifiedAt: properties.lastModified,
      hash: properties.etag,
      isFolder: false,
      webUrl: blobClient.url,
    };
  }

  // ============================================
  // Delta Sync Support
  // ============================================

  supportsDeltaSync(): boolean {
    // Azure Blob doesn't have native delta sync
    // We use modified date comparison instead
    return false;
  }

  async getDeltaChanges(deltaToken?: string): Promise<DeltaSyncResult> {
    // For Azure Blob, we do a full scan and compare modified dates
    // The deltaToken here represents the last sync timestamp
    
    if (!this.containerClient) {
      throw new Error('Client not initialized');
    }

    const lastSyncTime = deltaToken ? new Date(deltaToken) : new Date(0);
    const changes: DeltaSyncResult['changes'] = [];

    for await (const blob of this.containerClient.listBlobsFlat({ includeDeleted: true })) {
      const mimeType = this.getMimeType(blob.name);
      if (!isSupportedMimeType(mimeType)) {
        continue;
      }

      const remoteFile = this.mapBlobToRemoteFile(blob);

      if (blob.deleted) {
        changes.push({ type: 'deleted', file: remoteFile });
      } else if (blob.properties.lastModified && blob.properties.lastModified > lastSyncTime) {
        // Check if it's truly new or modified
        if (blob.properties.createdOn && blob.properties.createdOn > lastSyncTime) {
          changes.push({ type: 'created', file: remoteFile });
        } else {
          changes.push({ type: 'modified', file: remoteFile });
        }
      }
    }

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

  private mapBlobToRemoteFile(blob: BlobItem): RemoteFile {
    const fileName = blob.name.split('/').pop() || blob.name;
    return {
      id: blob.name,
      name: fileName,
      path: `/${blob.name}`,
      mimeType: blob.properties.contentType || this.getMimeType(fileName),
      size: blob.properties.contentLength || 0,
      createdAt: blob.properties.createdOn,
      modifiedAt: blob.properties.lastModified,
      hash: blob.properties.etag,
      isFolder: false,
    };
  }
}

/**
 * Factory function to create Azure Blob connector
 */
export function createAzureBlobConnector(
  credentials: AzureBlobCredentials
): AzureBlobConnector {
  return new AzureBlobConnector(credentials);
}
