/**
 * AWS S3 Connector
 * 
 * Connects to Amazon S3 or S3-compatible storage (MinIO, etc.) for syncing contract files.
 * 
 * Setup Required:
 * 1. Create an S3 bucket
 * 2. Create an IAM user with S3 read access
 * 3. Get access key ID and secret access key
 */

import {
  IContractSourceConnector,
  ConnectionTestResult,
  ListFilesResult,
  RemoteFile,
  DownloadedFile,
  DeltaSyncResult,
  S3Credentials,
  isSupportedMimeType,
  matchesFilePattern,
} from './types';
import { ContractSourceProvider } from '@prisma/client';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  ListObjectsV2CommandOutput,
  _Object,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

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

export class S3Connector implements IContractSourceConnector {
  readonly provider = ContractSourceProvider.AWS_S3;
  
  private credentials: S3Credentials;
  private s3Client: S3Client;

  constructor(credentials: S3Credentials) {
    this.credentials = credentials;
    
    this.s3Client = new S3Client({
      region: credentials.region,
      endpoint: credentials.endpoint,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      forcePathStyle: !!credentials.endpoint, // Required for S3-compatible services
    });
  }

  // ============================================
  // Connection Methods
  // ============================================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Check bucket exists and we have access
      const command = new HeadBucketCommand({
        Bucket: this.credentials.bucket,
      });

      await this.s3Client.send(command);

      // Get some stats
      const listCommand = new ListObjectsV2Command({
        Bucket: this.credentials.bucket,
        MaxKeys: 1000,
      });

      const listResult = await this.s3Client.send(listCommand);
      const objectCount = listResult.KeyCount || 0;
      const totalSize = (listResult.Contents || []).reduce(
        (sum, obj) => sum + (obj.Size || 0),
        0
      );

      return {
        success: true,
        message: 'Successfully connected to S3',
        accountInfo: {
          name: `s3://${this.credentials.bucket}`,
          quota: {
            used: totalSize,
            total: -1, // S3 doesn't have quotas
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to S3',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as { Code?: string }).Code,
      };
    }
  }

  async disconnect(): Promise<void> {
    this.s3Client.destroy();
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
    const { pageToken, pageSize = 100, filePatterns } = options || {};
    const prefix = folderId && folderId !== 'root' ? `${folderId}/` : '';

    const command = new ListObjectsV2Command({
      Bucket: this.credentials.bucket,
      Prefix: prefix || undefined,
      Delimiter: '/',
      MaxKeys: pageSize,
      ContinuationToken: pageToken,
    });

    const response: ListObjectsV2CommandOutput = await this.s3Client.send(command);

    const files: RemoteFile[] = [];
    const folders: RemoteFile[] = [];

    // Process folders (common prefixes)
    for (const commonPrefix of response.CommonPrefixes || []) {
      if (commonPrefix.Prefix) {
        const folderName = commonPrefix.Prefix.replace(/\/$/, '').split('/').pop() || '';
        folders.push({
          id: commonPrefix.Prefix,
          name: folderName,
          path: `/${commonPrefix.Prefix}`,
          mimeType: 'application/x-directory',
          size: 0,
          isFolder: true,
        });
      }
    }

    // Process files
    for (const object of response.Contents || []) {
      if (!object.Key) continue;
      
      // Skip the prefix itself (if listing a folder)
      if (object.Key === prefix) continue;

      const fileName = object.Key.split('/').pop() || object.Key;
      const mimeType = this.getMimeType(fileName);

      // Apply filters
      if (filePatterns && !matchesFilePattern(fileName, filePatterns)) {
        continue;
      }
      if (!isSupportedMimeType(mimeType)) {
        continue;
      }

      files.push(this.mapS3ObjectToRemoteFile(object));
    }

    return {
      files,
      folders,
      nextPageToken: response.NextContinuationToken,
      hasMore: !!response.IsTruncated,
      totalCount: response.KeyCount,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    const command = new GetObjectCommand({
      Bucket: this.credentials.bucket,
      Key: fileId,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('Failed to get file content');
    }

    // Convert stream to buffer
    const content = await this.streamToBuffer(response.Body as Readable);
    const fileName = fileId.split('/').pop() || fileId;

    return {
      content,
      mimeType: response.ContentType || this.getMimeType(fileName),
      name: fileName,
      size: response.ContentLength || content.length,
      hash: response.ETag?.replace(/"/g, ''),
    };
  }

  async getFileMetadata(fileId: string): Promise<RemoteFile> {
    const command = new HeadObjectCommand({
      Bucket: this.credentials.bucket,
      Key: fileId,
    });

    const response = await this.s3Client.send(command);
    const fileName = fileId.split('/').pop() || fileId;

    return {
      id: fileId,
      name: fileName,
      path: `/${fileId}`,
      mimeType: response.ContentType || this.getMimeType(fileName),
      size: response.ContentLength || 0,
      modifiedAt: response.LastModified,
      hash: response.ETag?.replace(/"/g, ''),
      isFolder: false,
      webUrl: `https://${this.credentials.bucket}.s3.${this.credentials.region}.amazonaws.com/${fileId}`,
    };
  }

  // ============================================
  // Delta Sync Support
  // ============================================

  supportsDeltaSync(): boolean {
    // S3 doesn't have native delta sync, but we can use LastModified
    return false;
  }

  async getDeltaChanges(deltaToken?: string): Promise<DeltaSyncResult> {
    // For S3, we do a full scan and compare modified dates
    const lastSyncTime = deltaToken ? new Date(deltaToken) : new Date(0);
    const changes: DeltaSyncResult['changes'] = [];

    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.credentials.bucket,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const response = await this.s3Client.send(command);

      for (const object of response.Contents || []) {
        if (!object.Key) continue;

        const fileName = object.Key.split('/').pop() || '';
        const mimeType = this.getMimeType(fileName);
        
        if (!isSupportedMimeType(mimeType)) {
          continue;
        }

        const remoteFile = this.mapS3ObjectToRemoteFile(object);

        if (object.LastModified && object.LastModified > lastSyncTime) {
          changes.push({ type: 'modified', file: remoteFile });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

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

  private mapS3ObjectToRemoteFile(object: _Object): RemoteFile {
    const fileName = object.Key?.split('/').pop() || object.Key || '';
    return {
      id: object.Key || '',
      name: fileName,
      path: `/${object.Key}`,
      mimeType: this.getMimeType(fileName),
      size: object.Size || 0,
      modifiedAt: object.LastModified,
      hash: object.ETag?.replace(/"/g, ''),
      isFolder: false,
    };
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

/**
 * Factory function to create S3 connector
 */
export function createS3Connector(credentials: S3Credentials): S3Connector {
  return new S3Connector(credentials);
}
