/**
 * Azure Blob Storage Adapter
 * Provides Azure Blob Storage support for GDPR-compliant EU data residency
 */

import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
} from '@azure/storage-blob';
import { Readable } from 'stream';
import pino from 'pino';

const logger = pino({ name: 'azure-blob-storage' });

// Azure regions for GDPR compliance
export const AZURE_EU_REGIONS = {
  'westeurope': 'West Europe (Netherlands)',
  'northeurope': 'North Europe (Ireland)',
  'germanywestcentral': 'Germany West Central',
  'switzerlandnorth': 'Switzerland North',
  'francecentral': 'France Central',
  'swedencentral': 'Sweden Central',
} as const;

export type AzureEURegion = keyof typeof AZURE_EU_REGIONS;

export interface AzureBlobConfig {
  accountName: string;
  accountKey: string;
  containerName: string;
  region?: AzureEURegion;
  // Optional custom endpoint for government cloud or private endpoints
  customEndpoint?: string;
}

export interface UploadOptions {
  fileName: string;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  success: boolean;
  key: string;
  container: string;
  url?: string;
  etag?: string;
  versionId?: string;
  error?: string;
}

export interface BlobMetadata {
  size: number;
  contentType?: string;
  lastModified: Date;
  etag?: string;
  metadata: Record<string, string>;
}

/**
 * Azure Blob Storage Adapter
 * 
 * Implements the same interface as StorageService for seamless switching
 * between MinIO/S3 and Azure Blob Storage
 */
export class AzureBlobStorageAdapter {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private config: AzureBlobConfig;
  private credential: StorageSharedKeyCredential;

  constructor(config: AzureBlobConfig) {
    this.config = config;

    // Create credentials
    this.credential = new StorageSharedKeyCredential(
      config.accountName,
      config.accountKey
    );

    // Create the blob service client
    const endpoint = config.customEndpoint || 
      `https://${config.accountName}.blob.core.windows.net`;

    this.blobServiceClient = new BlobServiceClient(endpoint, this.credential);
    this.containerClient = this.blobServiceClient.getContainerClient(config.containerName);

    logger.info(
      {
        accountName: config.accountName,
        container: config.containerName,
        region: config.region,
      },
      'Azure Blob Storage adapter initialized'
    );

    // Ensure container exists
    this.ensureContainer().catch((error) => {
      logger.error({ error }, 'Failed to ensure container exists');
    });
  }

  /**
   * Ensure container exists, create if not
   */
  private async ensureContainer(): Promise<void> {
    try {
      const exists = await this.containerClient.exists();
      
      if (!exists) {
        await this.containerClient.create();
        logger.info({ container: this.config.containerName }, 'Container created');
      } else {
        logger.debug({ container: this.config.containerName }, 'Container already exists');
      }
    } catch (error) {
      logger.error({ error, container: this.config.containerName }, 'Error ensuring container exists');
      throw error;
    }
  }

  /**
   * Upload a file to Azure Blob Storage
   */
  public async upload(options: UploadOptions): Promise<UploadResult> {
    const { fileName, buffer, contentType, metadata } = options;

    try {
      logger.info({ fileName, size: buffer.length }, 'Uploading file to Azure Blob Storage');

      const blobClient = this.containerClient.getBlockBlobClient(fileName);
      
      const uploadResponse = await blobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: contentType || 'application/octet-stream',
        },
        metadata: this.sanitizeMetadata(metadata),
      });

      const url = blobClient.url;

      logger.info(
        {
          fileName,
          container: this.config.containerName,
          etag: uploadResponse.etag,
        },
        'File uploaded successfully to Azure'
      );

      return {
        success: true,
        key: fileName,
        container: this.config.containerName,
        url,
        etag: uploadResponse.etag,
        versionId: uploadResponse.versionId,
      };
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to upload file to Azure');
      
      return {
        success: false,
        key: fileName,
        container: this.config.containerName,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload a stream to Azure Blob Storage
   */
  public async uploadStream(
    fileName: string,
    stream: Readable,
    size: number,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      logger.info({ fileName, size }, 'Uploading stream to Azure Blob Storage');

      const blobClient = this.containerClient.getBlockBlobClient(fileName);
      
      // Convert stream to buffer for upload
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const uploadResponse = await blobClient.upload(buffer, buffer.length, {
        metadata: this.sanitizeMetadata(metadata),
      });

      const url = blobClient.url;

      logger.info({ fileName, container: this.config.containerName }, 'Stream uploaded successfully to Azure');

      return {
        success: true,
        key: fileName,
        container: this.config.containerName,
        url,
        etag: uploadResponse.etag,
      };
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to upload stream to Azure');
      
      return {
        success: false,
        key: fileName,
        container: this.config.containerName,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Download a file from Azure Blob Storage
   */
  public async download(fileName: string): Promise<Buffer | null> {
    try {
      logger.debug({ fileName }, 'Downloading file from Azure Blob Storage');

      const blobClient = this.containerClient.getBlobClient(fileName);
      const downloadResponse = await blobClient.download();

      if (!downloadResponse.readableStreamBody) {
        throw new Error('No readable stream body');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);
      
      logger.info({ fileName, size: buffer.length }, 'File downloaded successfully from Azure');
      
      return buffer;
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to download file from Azure');
      return null;
    }
  }

  /**
   * Get a signed URL (SAS URL) for a file
   */
  public async getSignedUrl(
    fileName: string,
    expirySeconds: number = 3600
  ): Promise<string | null> {
    try {
      const blobClient = this.containerClient.getBlobClient(fileName);
      
      const expiresOn = new Date(Date.now() + expirySeconds * 1000);

      const sasToken = generateBlobSASQueryParameters({
        containerName: this.config.containerName,
        blobName: fileName,
        permissions: BlobSASPermissions.parse('r'), // Read only
        startsOn: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (clock skew)
        expiresOn,
        protocol: SASProtocol.HttpsAndHttp,
      }, this.credential).toString();

      const sasUrl = `${blobClient.url}?${sasToken}`;
      
      logger.debug({ fileName, expirySeconds }, 'Generated SAS URL');
      
      return sasUrl;
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to generate SAS URL');
      return null;
    }
  }

  /**
   * Get file URL (requires public access or SAS)
   */
  public async getFileUrl(fileName: string): Promise<string> {
    const blobClient = this.containerClient.getBlobClient(fileName);
    return blobClient.url;
  }

  /**
   * Delete a file from Azure Blob Storage
   */
  public async delete(fileName: string): Promise<boolean> {
    try {
      const blobClient = this.containerClient.getBlobClient(fileName);
      await blobClient.delete();
      logger.info({ fileName }, 'File deleted successfully from Azure');
      return true;
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to delete file from Azure');
      return false;
    }
  }

  /**
   * Check if file exists
   */
  public async exists(fileName: string): Promise<boolean> {
    try {
      const blobClient = this.containerClient.getBlobClient(fileName);
      return await blobClient.exists();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  public async getMetadata(fileName: string): Promise<BlobMetadata | null> {
    try {
      const blobClient = this.containerClient.getBlobClient(fileName);
      const properties = await blobClient.getProperties();
      
      return {
        size: properties.contentLength || 0,
        contentType: properties.contentType,
        lastModified: properties.lastModified || new Date(),
        etag: properties.etag,
        metadata: properties.metadata || {},
      };
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to get file metadata from Azure');
      return null;
    }
  }

  /**
   * List files with prefix
   */
  public async list(prefix: string = '', maxResults: number = 1000): Promise<string[]> {
    try {
      const files: string[] = [];
      
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        files.push(blob.name);
        
        if (files.length >= maxResults) {
          break;
        }
      }
      
      return files;
    } catch (error) {
      logger.error({ error, prefix }, 'Failed to list files from Azure');
      return [];
    }
  }

  /**
   * Copy a blob within Azure
   */
  public async copy(sourceFileName: string, destFileName: string): Promise<boolean> {
    try {
      const sourceBlobClient = this.containerClient.getBlobClient(sourceFileName);
      const destBlobClient = this.containerClient.getBlobClient(destFileName);

      const copyPoller = await destBlobClient.beginCopyFromURL(sourceBlobClient.url);
      await copyPoller.pollUntilDone();

      logger.info({ sourceFileName, destFileName }, 'File copied successfully');
      return true;
    } catch (error) {
      logger.error({ error, sourceFileName, destFileName }, 'Failed to copy file');
      return false;
    }
  }

  /**
   * Get container properties
   */
  public async getContainerInfo(): Promise<{
    name: string;
    lastModified: Date;
    etag: string;
    leaseState: string;
  } | null> {
    try {
      const properties = await this.containerClient.getProperties();
      
      return {
        name: this.config.containerName,
        lastModified: properties.lastModified || new Date(),
        etag: properties.etag || '',
        leaseState: properties.leaseState || 'available',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get container info');
      return null;
    }
  }

  /**
   * Sanitize metadata keys for Azure (must be valid HTTP headers)
   */
  private sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      // Azure metadata keys must be valid C# identifiers
      const sanitizedKey = key
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^[0-9]/, '_$&');
      
      sanitized[sanitizedKey] = value;
    }

    return sanitized;
  }
}

// Factory function
export function createAzureBlobAdapter(config: AzureBlobConfig): AzureBlobStorageAdapter {
  return new AzureBlobStorageAdapter(config);
}

// Initialize from environment variables
export function initializeAzureBlobStorage(): AzureBlobStorageAdapter | null {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const containerName = process.env.AZURE_STORAGE_CONTAINER || 'contracts';
  const region = process.env.AZURE_STORAGE_REGION as AzureEURegion | undefined;

  if (!accountName || !accountKey) {
    logger.warn('Azure Blob Storage not configured (missing AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_ACCOUNT_KEY)');
    return null;
  }

  return createAzureBlobAdapter({
    accountName,
    accountKey,
    containerName,
    region,
  });
}
