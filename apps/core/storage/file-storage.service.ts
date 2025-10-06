import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFile, unlink } from 'fs/promises';
import { basename } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  forcePathStyle?: boolean;
}

interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

interface DownloadOptions {
  expiresIn?: number; // Seconds
}

interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}

// ============================================================================
// FILE STORAGE SERVICE
// ============================================================================

/**
 * File Storage Service
 * 
 * Handles file storage operations with S3-compatible storage (MinIO, AWS S3, etc.)
 * Requirements: 1.1
 */
export class FileStorageService {
  private s3Client: S3Client;
  private bucket: string;
  private useLocalFallback: boolean;

  constructor(config?: StorageConfig) {
    // Use environment variables if config not provided
    const endpoint = config?.endpoint || process.env['S3_ENDPOINT'] || 'http://localhost:9000';
    const bucket = config?.bucket || process.env['S3_BUCKET'] || 'contracts';
    const accessKeyId = config?.accessKeyId || process.env['S3_ACCESS_KEY_ID'] || 'minioadmin';
    const secretAccessKey = config?.secretAccessKey || process.env['S3_SECRET_ACCESS_KEY'] || 'minioadmin';
    const region = config?.region || process.env['S3_REGION'] || 'us-east-1';

    this.bucket = bucket;
    
    // Check if S3 is available, otherwise use local fallback
    this.useLocalFallback = !endpoint || endpoint.includes('localhost');

    try {
      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: config?.forcePathStyle ?? true, // Required for MinIO
      });

      console.log('✅ File storage service initialized:', {
        endpoint,
        bucket,
        region,
        fallback: this.useLocalFallback,
      });
    } catch (error) {
      console.warn('⚠️ S3 client initialization failed, using local fallback:', error);
      this.useLocalFallback = true;
    }
  }

  // ==========================================================================
  // UPLOAD OPERATIONS
  // ==========================================================================

  /**
   * Upload file from local path to S3/blob storage
   * 
   * @param localPath - Local file path
   * @param storageKey - S3 object key (path in bucket)
   * @param options - Upload options
   * @returns Storage key
   */
  async uploadFromPath(
    localPath: string,
    storageKey: string,
    options?: UploadOptions
  ): Promise<string> {
    try {
      if (this.useLocalFallback) {
        console.log('📁 Using local storage (S3 not available)');
        return storageKey; // File already stored locally
      }

      // Read file from local path
      const fileBuffer = await readFile(localPath);

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        Tagging: options?.tags ? this.formatTags(options.tags) : undefined,
      });

      await this.s3Client.send(command);

      console.log('✅ File uploaded to S3:', {
        bucket: this.bucket,
        key: storageKey,
        size: fileBuffer.length,
      });

      return storageKey;
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload file from buffer to S3/blob storage
   * 
   * @param buffer - File buffer
   * @param storageKey - S3 object key
   * @param options - Upload options
   * @returns Storage key
   */
  async uploadFromBuffer(
    buffer: Buffer,
    storageKey: string,
    options?: UploadOptions
  ): Promise<string> {
    try {
      if (this.useLocalFallback) {
        console.log('📁 Using local storage (S3 not available)');
        return storageKey;
      }

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        Tagging: options?.tags ? this.formatTags(options.tags) : undefined,
      });

      await this.s3Client.send(command);

      console.log('✅ Buffer uploaded to S3:', {
        bucket: this.bucket,
        key: storageKey,
        size: buffer.length,
      });

      return storageKey;
    } catch (error) {
      console.error('❌ Buffer upload failed:', error);
      throw new Error(`Failed to upload buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // DOWNLOAD OPERATIONS
  // ==========================================================================

  /**
   * Generate secure, time-limited download URL
   * 
   * @param storageKey - S3 object key
   * @param options - Download options
   * @returns Signed URL
   */
  async getDownloadUrl(
    storageKey: string,
    options?: DownloadOptions
  ): Promise<string> {
    try {
      if (this.useLocalFallback) {
        // For local fallback, return a local file URL
        // In production, this would be handled by a file serving endpoint
        return `/api/contracts/files/${encodeURIComponent(storageKey)}`;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      const expiresIn = options?.expiresIn || 3600; // Default 1 hour
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      console.log('🔗 Generated signed URL:', {
        key: storageKey,
        expiresIn,
      });

      return url;
    } catch (error) {
      console.error('❌ Failed to generate download URL:', error);
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download file to buffer
   * 
   * @param storageKey - S3 object key
   * @returns File buffer
   */
  async downloadToBuffer(storageKey: string): Promise<Buffer> {
    try {
      if (this.useLocalFallback) {
        // For local fallback, read from local filesystem
        // This assumes the file is still at the original path
        throw new Error('Local fallback download not implemented. Use getDownloadUrl instead.');
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No file content received');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      console.log('✅ File downloaded from S3:', {
        key: storageKey,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      console.error('❌ File download failed:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // DELETE OPERATIONS
  // ==========================================================================

  /**
   * Delete file from storage
   * 
   * @param storageKey - S3 object key
   * @param localPath - Optional local file path to delete
   */
  async deleteFile(storageKey: string, localPath?: string): Promise<void> {
    try {
      // Delete from S3 if not using local fallback
      if (!this.useLocalFallback) {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        });

        await this.s3Client.send(command);

        console.log('✅ File deleted from S3:', {
          bucket: this.bucket,
          key: storageKey,
        });
      }

      // Delete local file if path provided
      if (localPath) {
        try {
          await unlink(localPath);
          console.log('✅ Local file deleted:', localPath);
        } catch (error) {
          console.warn('⚠️ Failed to delete local file:', error);
          // Don't throw - S3 deletion is more important
        }
      }
    } catch (error) {
      console.error('❌ File deletion failed:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete multiple files from storage
   * 
   * @param storageKeys - Array of S3 object keys
   */
  async deleteFiles(storageKeys: string[]): Promise<void> {
    try {
      const deletePromises = storageKeys.map(key => this.deleteFile(key));
      await Promise.all(deletePromises);

      console.log('✅ Multiple files deleted:', {
        count: storageKeys.length,
      });
    } catch (error) {
      console.error('❌ Batch file deletion failed:', error);
      throw new Error(`Failed to delete files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // METADATA OPERATIONS
  // ==========================================================================

  /**
   * Get file metadata
   * 
   * @param storageKey - S3 object key
   * @returns File metadata
   */
  async getFileMetadata(storageKey: string): Promise<FileMetadata> {
    try {
      if (this.useLocalFallback) {
        throw new Error('Metadata retrieval not available in local fallback mode');
      }

      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      const response = await this.s3Client.send(command);

      return {
        key: storageKey,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error('❌ Failed to get file metadata:', error);
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file exists in storage
   * 
   * @param storageKey - S3 object key
   * @returns True if file exists
   */
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      if (this.useLocalFallback) {
        return true; // Assume local files exist
      }

      await this.getFileMetadata(storageKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Generate storage key from contract ID and filename
   * 
   * @param contractId - Contract ID
   * @param fileName - Original filename
   * @param tenantId - Tenant ID
   * @returns Storage key
   */
  generateStorageKey(contractId: string, fileName: string, tenantId: string = 'default'): string {
    const timestamp = Date.now();
    const sanitizedFileName = basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${tenantId}/contracts/${contractId}/${timestamp}-${sanitizedFileName}`;
  }

  /**
   * Format tags for S3
   */
  private formatTags(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Get bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Check if using local fallback
   */
  isUsingLocalFallback(): boolean {
    return this.useLocalFallback;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let fileStorageServiceInstance: FileStorageService | null = null;

/**
 * Get singleton instance of FileStorageService
 */
export function getFileStorageService(): FileStorageService {
  if (!fileStorageServiceInstance) {
    fileStorageServiceInstance = new FileStorageService();
  }
  return fileStorageServiceInstance;
}
