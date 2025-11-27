/**
 * Object Storage Service
 * Unified interface for S3-compatible storage (AWS S3, MinIO, etc.)
 */

import * as Minio from 'minio';
import { Readable } from 'stream';
import pino from 'pino';

const logger = pino({ name: 'storage-service' });

export interface StorageConfig {
  endPoint: string;
  port?: number;
  useSSL?: boolean;
  accessKey: string;
  secretKey: string;
  region?: string;
  bucket: string;
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
  bucket: string;
  url?: string;
  etag?: string;
  versionId?: string;
  error?: string;
}

export class StorageService {
  private client: Minio.Client;
  private bucket: string;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.bucket = config.bucket;

    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL ?? false,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });

    logger.info(
      {
        endPoint: config.endPoint,
        bucket: config.bucket,
        useSSL: config.useSSL,
      },
      'Storage service initialized'
    );

    // Ensure bucket exists
    this.ensureBucket().catch((error) => {
      logger.error({ error }, 'Failed to ensure bucket exists');
    });
  }

  /**
   * Ensure bucket exists, create if not
   */
  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      
      if (!exists) {
        await this.client.makeBucket(this.bucket, this.config.region || 'us-east-1');
        logger.info({ bucket: this.bucket }, 'Bucket created');
      } else {
        logger.debug({ bucket: this.bucket }, 'Bucket already exists');
      }
    } catch (error) {
      logger.error({ error, bucket: this.bucket }, 'Error ensuring bucket exists');
      throw error;
    }
  }

  /**
   * Upload a file to storage
   */
  public async upload(options: UploadOptions): Promise<UploadResult> {
    const { fileName, buffer, contentType, metadata } = options;

    try {
      logger.info({ fileName, size: buffer.length }, 'Uploading file to storage');

      const metaData: Record<string, string> = {
        'Content-Type': contentType || 'application/octet-stream',
        ...metadata,
      };

      const result = await this.client.putObject(
        this.bucket,
        fileName,
        buffer,
        buffer.length,
        metaData
      );

      const url = await this.getFileUrl(fileName);

      logger.info(
        {
          fileName,
          bucket: this.bucket,
          etag: result.etag,
        },
        'File uploaded successfully'
      );

      return {
        success: true,
        key: fileName,
        bucket: this.bucket,
        url,
        etag: result.etag,
        versionId: result.versionId ?? undefined,
      };
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to upload file');
      
      return {
        success: false,
        key: fileName,
        bucket: this.bucket,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload a stream to storage
   */
  public async uploadStream(
    fileName: string,
    stream: Readable,
    size: number,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      logger.info({ fileName, size }, 'Uploading stream to storage');

      const metaData: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        ...metadata,
      };

      const result = await this.client.putObject(
        this.bucket,
        fileName,
        stream,
        size,
        metaData
      );

      const url = await this.getFileUrl(fileName);

      logger.info({ fileName, bucket: this.bucket }, 'Stream uploaded successfully');

      return {
        success: true,
        key: fileName,
        bucket: this.bucket,
        url,
        etag: result.etag,
      };
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to upload stream');
      
      return {
        success: false,
        key: fileName,
        bucket: this.bucket,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Download a file from storage
   */
  public async download(fileName: string): Promise<Buffer | null> {
    try {
      logger.debug({ fileName }, 'Downloading file from storage');

      const stream = await this.client.getObject(this.bucket, fileName);
      
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      
      logger.info({ fileName, size: buffer.length }, 'File downloaded successfully');
      
      return buffer;
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to download file');
      return null;
    }
  }

  /**
   * Get a signed URL for a file (temporary access)
   */
  public async getSignedUrl(
    fileName: string,
    expirySeconds: number = 3600
  ): Promise<string | null> {
    try {
      const url = await this.client.presignedGetObject(
        this.bucket,
        fileName,
        expirySeconds
      );
      
      logger.debug({ fileName, expirySeconds }, 'Generated signed URL');
      
      return url;
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to generate signed URL');
      return null;
    }
  }

  /**
   * Get file URL (public if bucket is public)
   */
  public async getFileUrl(fileName: string): Promise<string> {
    const protocol = this.config.useSSL ? 'https' : 'http';
    const port = this.config.port ? `:${this.config.port}` : '';
    
    return `${protocol}://${this.config.endPoint}${port}/${this.bucket}/${fileName}`;
  }

  /**
   * Delete a file from storage
   */
  public async delete(fileName: string): Promise<boolean> {
    try {
      await this.client.removeObject(this.bucket, fileName);
      logger.info({ fileName }, 'File deleted successfully');
      return true;
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to delete file');
      return false;
    }
  }

  /**
   * Check if file exists
   */
  public async exists(fileName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, fileName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  public async getMetadata(fileName: string): Promise<Record<string, any> | null> {
    try {
      const stat = await this.client.statObject(this.bucket, fileName);
      return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified,
        metaData: stat.metaData,
      };
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to get file metadata');
      return null;
    }
  }

  /**
   * List files with prefix
   */
  public async list(prefix: string = '', maxKeys: number = 1000): Promise<string[]> {
    try {
      const stream = this.client.listObjects(this.bucket, prefix, true);
      
      const files: string[] = [];
      
      for await (const obj of stream) {
        if (obj.name) {
          files.push(obj.name);
        }
        
        if (files.length >= maxKeys) {
          break;
        }
      }
      
      return files;
    } catch (error) {
      logger.error({ error, prefix }, 'Failed to list files');
      return [];
    }
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export function getStorageService(config?: StorageConfig): StorageService {
  if (!storageServiceInstance && config) {
    storageServiceInstance = new StorageService(config);
  }

  if (!storageServiceInstance) {
    throw new Error('StorageService not initialized. Call getStorageService(config) first.');
  }

  return storageServiceInstance;
}

export function initializeStorage(): StorageService | null {
  try {
    const config: StorageConfig = {
      endPoint: process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.S3_PORT || process.env.MINIO_PORT || '9000'),
      useSSL: process.env.S3_USE_SSL === 'true',
      accessKey: process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || 'minioadmin',
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || 'contracts',
    };

    return getStorageService(config);
  } catch (error) {
    logger.error({ error }, 'Failed to initialize storage service');
    return null;
  }
}
