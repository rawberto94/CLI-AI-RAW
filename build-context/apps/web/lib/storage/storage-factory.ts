/**
 * Unified Storage Factory
 * Provides a common interface for all storage providers (MinIO/S3, Azure Blob, Local)
 */

import pino from 'pino';
import { Readable } from 'stream';
import { StorageService, getStorageService, StorageConfig } from '../storage-service';
import { AzureBlobStorageAdapter, initializeAzureBlobStorage, AzureBlobConfig } from './azure-blob-adapter';

const logger = pino({ name: 'storage-factory' });

// Storage provider types
export type StorageProviderType = 'minio' | 's3' | 'azure' | 'local';

// Common interface for all storage providers
export interface IStorageProvider {
  upload(options: {
    fileName: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<{
    success: boolean;
    key: string;
    url?: string;
    etag?: string;
    error?: string;
  }>;

  uploadStream(
    fileName: string,
    stream: Readable,
    size: number,
    metadata?: Record<string, string>
  ): Promise<{
    success: boolean;
    key: string;
    url?: string;
    etag?: string;
    error?: string;
  }>;

  download(fileName: string): Promise<Buffer | null>;
  
  getSignedUrl(fileName: string, expirySeconds?: number): Promise<string | null>;
  
  getFileUrl(fileName: string): Promise<string>;
  
  delete(fileName: string): Promise<boolean>;
  
  exists(fileName: string): Promise<boolean>;
  
  getMetadata(fileName: string): Promise<{
    size: number;
    contentType?: string;
    lastModified: Date;
    etag?: string;
    metadata: Record<string, string>;
  } | null>;
  
  list(prefix?: string, maxResults?: number): Promise<string[]>;
}

// Wrapper to adapt MinIO/S3 StorageService to IStorageProvider
class S3StorageWrapper implements IStorageProvider {
  constructor(private service: StorageService) {}

  async upload(options: {
    fileName: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }) {
    const result = await this.service.upload(options);
    return {
      success: result.success,
      key: result.key,
      url: result.url,
      etag: result.etag,
      error: result.error,
    };
  }

  async uploadStream(
    fileName: string,
    stream: Readable,
    size: number,
    metadata?: Record<string, string>
  ) {
    const result = await this.service.uploadStream(fileName, stream, size, metadata);
    return {
      success: result.success,
      key: result.key,
      url: result.url,
      etag: result.etag,
      error: result.error,
    };
  }

  download = (fileName: string) => this.service.download(fileName);
  getSignedUrl = (fileName: string, expirySeconds?: number) => 
    this.service.getSignedUrl(fileName, expirySeconds);
  getFileUrl = (fileName: string) => this.service.getFileUrl(fileName);
  delete = (fileName: string) => this.service.delete(fileName);
  exists = (fileName: string) => this.service.exists(fileName);
  getMetadata = async (fileName: string) => {
    const meta = await this.service.getMetadata(fileName);
    if (!meta) return null;
    return {
      size: meta.size,
      contentType: meta.metaData?.['Content-Type'],
      lastModified: meta.lastModified,
      etag: meta.etag,
      metadata: meta.metaData || {},
    };
  };
  list = (prefix?: string, maxResults?: number) => 
    this.service.list(prefix || '', maxResults || 1000);
}

// Wrapper to adapt Azure Blob Storage to IStorageProvider
class AzureStorageWrapper implements IStorageProvider {
  constructor(private adapter: AzureBlobStorageAdapter) {}

  async upload(options: {
    fileName: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }) {
    const result = await this.adapter.upload(options);
    return {
      success: result.success,
      key: result.key,
      url: result.url,
      etag: result.etag,
      error: result.error,
    };
  }

  async uploadStream(
    fileName: string,
    stream: Readable,
    size: number,
    metadata?: Record<string, string>
  ) {
    const result = await this.adapter.uploadStream(fileName, stream, size, metadata);
    return {
      success: result.success,
      key: result.key,
      url: result.url,
      etag: result.etag,
      error: result.error,
    };
  }

  download = (fileName: string) => this.adapter.download(fileName);
  getSignedUrl = (fileName: string, expirySeconds?: number) => 
    this.adapter.getSignedUrl(fileName, expirySeconds);
  getFileUrl = (fileName: string) => this.adapter.getFileUrl(fileName);
  delete = (fileName: string) => this.adapter.delete(fileName);
  exists = (fileName: string) => this.adapter.exists(fileName);
  getMetadata = (fileName: string) => this.adapter.getMetadata(fileName);
  list = (prefix?: string, maxResults?: number) => 
    this.adapter.list(prefix || '', maxResults || 1000);
}

// Local filesystem storage adapter
import { promises as fs, existsSync, createReadStream } from 'fs';
import path from 'path';

class LocalStorageAdapter implements IStorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'uploads');
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error({ error }, 'Failed to create uploads directory');
    }
  }

  private getFullPath(fileName: string): string {
    // Prevent path traversal
    const sanitized = fileName.replace(/\.\./g, '').replace(/^\//, '');
    return path.join(this.basePath, sanitized);
  }

  async upload(options: {
    fileName: string;
    buffer: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const fullPath = this.getFullPath(options.fileName);
      const dir = path.dirname(fullPath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, options.buffer);

      // Store metadata in sidecar file
      if (options.metadata || options.contentType) {
        const metaPath = `${fullPath}.meta.json`;
        await fs.writeFile(metaPath, JSON.stringify({
          contentType: options.contentType,
          ...options.metadata,
          uploadedAt: new Date().toISOString(),
        }));
      }

      return {
        success: true,
        key: options.fileName,
        url: `file://${fullPath}`,
      };
    } catch (error) {
      logger.error({ error, fileName: options.fileName }, 'Local upload failed');
      return {
        success: false,
        key: options.fileName,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async uploadStream(
    fileName: string,
    stream: Readable,
    _size: number,
    metadata?: Record<string, string>
  ) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return this.upload({ fileName, buffer: Buffer.concat(chunks), metadata });
  }

  async download(fileName: string): Promise<Buffer | null> {
    try {
      const fullPath = this.getFullPath(fileName);
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  async getSignedUrl(fileName: string): Promise<string | null> {
    // Local storage doesn't support signed URLs
    const fullPath = this.getFullPath(fileName);
    if (existsSync(fullPath)) {
      return `file://${fullPath}`;
    }
    return null;
  }

  async getFileUrl(fileName: string): Promise<string> {
    return `file://${this.getFullPath(fileName)}`;
  }

  async delete(fileName: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(fileName);
      await fs.unlink(fullPath);
      
      // Also delete metadata file if exists
      const metaPath = `${fullPath}.meta.json`;
      if (existsSync(metaPath)) {
        await fs.unlink(metaPath);
      }
      
      return true;
    } catch {
      return false;
    }
  }

  async exists(fileName: string): Promise<boolean> {
    return existsSync(this.getFullPath(fileName));
  }

  async getMetadata(fileName: string): Promise<{
    size: number;
    contentType?: string;
    lastModified: Date;
    etag?: string;
    metadata: Record<string, string>;
  } | null> {
    try {
      const fullPath = this.getFullPath(fileName);
      const stats = await fs.stat(fullPath);
      
      let metadata: Record<string, string> = {};
      let contentType: string | undefined;
      
      const metaPath = `${fullPath}.meta.json`;
      if (existsSync(metaPath)) {
        const metaContent = await fs.readFile(metaPath, 'utf-8');
        const parsed = JSON.parse(metaContent);
        contentType = parsed.contentType;
        delete parsed.contentType;
        metadata = parsed;
      }

      return {
        size: stats.size,
        contentType,
        lastModified: stats.mtime,
        metadata,
      };
    } catch {
      return null;
    }
  }

  async list(prefix?: string, maxResults: number = 1000): Promise<string[]> {
    try {
      const searchPath = prefix 
        ? path.join(this.basePath, prefix)
        : this.basePath;

      const files: string[] = [];
      
      async function walk(dir: string, basePath: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= maxResults) break;
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(basePath, fullPath);
          
          if (entry.isDirectory()) {
            await walk(fullPath, basePath);
          } else if (!entry.name.endsWith('.meta.json')) {
            files.push(relativePath);
          }
        }
      }

      if (existsSync(searchPath)) {
        await walk(searchPath, this.basePath);
      }

      return files;
    } catch {
      return [];
    }
  }
}

// Storage factory
interface StorageFactoryConfig {
  provider?: StorageProviderType;
  s3Config?: StorageConfig;
  azureConfig?: AzureBlobConfig;
  localPath?: string;
}

let cachedProvider: IStorageProvider | null = null;
let cachedProviderType: StorageProviderType | null = null;

/**
 * Get or create a storage provider
 */
export function getStorageProvider(config?: StorageFactoryConfig): IStorageProvider {
  // Determine provider type
  const providerType = config?.provider || 
    (process.env.STORAGE_PROVIDER as StorageProviderType) || 
    determineDefaultProvider();

  // Return cached if same type
  if (cachedProvider && cachedProviderType === providerType) {
    return cachedProvider;
  }

  logger.info({ provider: providerType }, 'Initializing storage provider');

  switch (providerType) {
    case 'azure':
      const azureAdapter = config?.azureConfig 
        ? new AzureBlobStorageAdapter(config.azureConfig)
        : initializeAzureBlobStorage();
      
      if (!azureAdapter) {
        logger.warn('Azure Blob Storage not configured, falling back to local');
        cachedProvider = new LocalStorageAdapter(config?.localPath);
        cachedProviderType = 'local';
      } else {
        cachedProvider = new AzureStorageWrapper(azureAdapter);
        cachedProviderType = 'azure';
      }
      break;

    case 's3':
    case 'minio':
      try {
        const isProduction = process.env.NODE_ENV === 'production';
        const accessKey = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY;
        const secretKey = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY;
        
        // In production, require explicit credentials
        if (isProduction && (!accessKey || !secretKey)) {
          throw new Error('S3/MinIO credentials required in production');
        }
        
        const s3Config = config?.s3Config || {
          endPoint: process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost',
          port: parseInt(process.env.S3_PORT || process.env.MINIO_PORT || '9000'),
          useSSL: process.env.S3_USE_SSL === 'true',
          accessKey: accessKey || (isProduction ? '' : 'minioadmin'),
          secretKey: secretKey || (isProduction ? '' : 'minioadmin'),
          region: process.env.S3_REGION || 'us-east-1',
          bucket: process.env.S3_BUCKET || 'contracts',
        };
        
        const s3Service = getStorageService(s3Config);
        cachedProvider = new S3StorageWrapper(s3Service);
        cachedProviderType = providerType;
      } catch (error) {
        logger.warn({ error }, 'S3/MinIO not configured, falling back to local');
        cachedProvider = new LocalStorageAdapter(config?.localPath);
        cachedProviderType = 'local';
      }
      break;

    case 'local':
    default:
      cachedProvider = new LocalStorageAdapter(config?.localPath);
      cachedProviderType = 'local';
      break;
  }

  return cachedProvider;
}

/**
 * Determine the default provider based on available configuration
 */
function determineDefaultProvider(): StorageProviderType {
  // Check for Azure first (GDPR preference)
  if (process.env.AZURE_STORAGE_ACCOUNT_NAME && process.env.AZURE_STORAGE_ACCOUNT_KEY) {
    return 'azure';
  }

  // Check for S3/MinIO
  if ((process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT) &&
      (process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY)) {
    return process.env.S3_ENDPOINT ? 's3' : 'minio';
  }

  // Default to local
  return 'local';
}

/**
 * Get storage provider info
 */
export function getStorageProviderInfo(): {
  provider: StorageProviderType;
  isCloud: boolean;
  isEUCompliant: boolean;
  endpoint?: string;
} {
  const provider = cachedProviderType || determineDefaultProvider();
  
  return {
    provider,
    isCloud: provider !== 'local',
    isEUCompliant: provider === 'azure' && 
      !!process.env.AZURE_STORAGE_REGION?.match(/^(westeurope|northeurope|germanywestcentral|switzerlandnorth|francecentral|swedencentral)$/),
    endpoint: provider === 'azure' 
      ? `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`
      : provider === 's3' || provider === 'minio'
        ? process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT
        : undefined,
  };
}

/**
 * Reset cached provider (useful for testing)
 */
export function resetStorageProvider(): void {
  cachedProvider = null;
  cachedProviderType = null;
}
