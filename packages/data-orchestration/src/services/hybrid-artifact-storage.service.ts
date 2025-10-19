/**
 * Hybrid Artifact Storage Service
 * 
 * Implements intelligent storage routing:
 * - Small artifacts (<100KB) -> Database (JSON)
 * - Large artifacts (>100KB) -> Blob storage (S3/Azure)
 * - Automatic compression for large artifacts
 * - Transparent retrieval regardless of storage location
 */

import { dbAdaptor } from '../dal/database.adaptor';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import pino from 'pino';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const logger = pino({ name: 'hybrid-artifact-storage' });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export type StorageProvider = 'database' | 's3' | 'azure' | 'local';

export interface StorageConfig {
  provider: StorageProvider;
  threshold: number; // Size threshold in bytes
  compression: boolean;
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  azure?: {
    connectionString: string;
    containerName: string;
  };
}

export interface StoredArtifact {
  id: string;
  contractId: string;
  type: string;
  storageProvider: StorageProvider;
  storageLocation?: string;
  data?: any;
  compressed: boolean;
  originalSize: number;
  storedSize: number;
  checksum: string;
}

// =========================================================================
// HYBRID ARTIFACT STORAGE SERVICE
// =========================================================================

export class HybridArtifactStorageService {
  private static instance: HybridArtifactStorageService;
  
  private config: StorageConfig = {
    provider: 'database',
    threshold: 100 * 1024, // 100KB
    compression: true,
  };

  private constructor() {
    this.loadConfig();
    logger.info({ config: this.config }, 'Hybrid Artifact Storage Service initialized');
  }

  static getInstance(): HybridArtifactStorageService {
    if (!HybridArtifactStorageService.instance) {
      HybridArtifactStorageService.instance = new HybridArtifactStorageService();
    }
    return HybridArtifactStorageService.instance;
  }

  /**
   * Load storage configuration from environment
   */
  private loadConfig(): void {
    // Load from environment variables
    if (process.env.ARTIFACT_STORAGE_THRESHOLD) {
      this.config.threshold = parseInt(process.env.ARTIFACT_STORAGE_THRESHOLD);
    }

    if (process.env.ARTIFACT_COMPRESSION === 'false') {
      this.config.compression = false;
    }

    // S3 configuration
    if (process.env.AWS_S3_BUCKET) {
      this.config.provider = 's3';
      this.config.s3 = {
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      };
    }

    // Azure configuration
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      this.config.provider = 'azure';
      this.config.azure = {
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
        containerName: process.env.AZURE_CONTAINER_NAME || 'artifacts',
      };
    }
  }

  // =========================================================================
  // STORAGE OPERATIONS
  // =========================================================================

  /**
   * Store artifact with intelligent routing
   */
  async storeArtifact(
    contractId: string,
    tenantId: string,
    type: string,
    data: any
  ): Promise<StoredArtifact> {
    try {
      const startTime = Date.now();
      
      // Serialize data
      const serialized = JSON.stringify(data);
      const originalSize = Buffer.byteLength(serialized, 'utf8');

      logger.info(
        { contractId, type, originalSize },
        'Storing artifact'
      );

      // Determine storage strategy
      const useDatabase = originalSize < this.config.threshold;
      
      if (useDatabase) {
        // Store in database
        return await this.storeInDatabase(
          contractId,
          tenantId,
          type,
          data,
          originalSize
        );
      } else {
        // Store in blob storage
        return await this.storeInBlobStorage(
          contractId,
          tenantId,
          type,
          serialized,
          originalSize
        );
      }
    } catch (error) {
      logger.error({ error, contractId, type }, 'Failed to store artifact');
      throw error;
    }
  }

  /**
   * Store artifact in database
   */
  private async storeInDatabase(
    contractId: string,
    tenantId: string,
    type: string,
    data: any,
    originalSize: number
  ): Promise<StoredArtifact> {
    const artifact = await dbAdaptor.getClient().artifact.create({
      data: {
        contractId,
        tenantId,
        type: type as any,
        data,
        schemaVersion: 'v1',
        storageProvider: 'database',
        size: originalSize,
      },
    });

    logger.info(
      { artifactId: artifact.id, storage: 'database' },
      'Artifact stored in database'
    );

    return {
      id: artifact.id,
      contractId,
      type,
      storageProvider: 'database',
      data,
      compressed: false,
      originalSize,
      storedSize: originalSize,
      checksum: this.calculateChecksum(JSON.stringify(data)),
    };
  }

  /**
   * Store artifact in blob storage (S3/Azure)
   */
  private async storeInBlobStorage(
    contractId: string,
    tenantId: string,
    type: string,
    serialized: string,
    originalSize: number
  ): Promise<StoredArtifact> {
    // Compress if enabled
    let dataToStore = Buffer.from(serialized, 'utf8');
    let compressed = false;
    
    if (this.config.compression) {
      dataToStore = await gzipAsync(dataToStore);
      compressed = true;
      logger.debug(
        {
          originalSize,
          compressedSize: dataToStore.length,
          ratio: ((1 - dataToStore.length / originalSize) * 100).toFixed(2) + '%',
        },
        'Artifact compressed'
      );
    }

    // Generate storage location
    const storageLocation = this.generateStorageLocation(
      tenantId,
      contractId,
      type
    );

    // Upload to blob storage
    await this.uploadToBlob(storageLocation, dataToStore);

    // Create database record (without data)
    const artifact = await dbAdaptor.getClient().artifact.create({
      data: {
        contractId,
        tenantId,
        type: type as any,
        data: null, // No data in database
        schemaVersion: 'v1',
        storageProvider: this.config.provider,
        location: storageLocation,
        size: dataToStore.length,
      },
    });

    logger.info(
      {
        artifactId: artifact.id,
        storage: this.config.provider,
        location: storageLocation,
        compressed,
      },
      'Artifact stored in blob storage'
    );

    return {
      id: artifact.id,
      contractId,
      type,
      storageProvider: this.config.provider,
      storageLocation,
      compressed,
      originalSize,
      storedSize: dataToStore.length,
      checksum: this.calculateChecksum(serialized),
    };
  }

  /**
   * Retrieve artifact from any storage location
   */
  async retrieveArtifact(artifactId: string): Promise<any> {
    try {
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        throw new Error(`Artifact ${artifactId} not found`);
      }

      // If data is in database, return it
      if (artifact.data) {
        logger.debug({ artifactId, storage: 'database' }, 'Retrieved from database');
        return artifact.data;
      }

      // Otherwise, retrieve from blob storage
      if (!artifact.location) {
        throw new Error(`Artifact ${artifactId} has no storage location`);
      }

      const data = await this.downloadFromBlob(artifact.location);
      
      // Decompress if needed
      let decompressed = data;
      if (artifact.storageProvider !== 'database') {
        try {
          decompressed = await gunzipAsync(data);
        } catch (error) {
          // Not compressed, use as-is
          decompressed = data;
        }
      }

      const parsed = JSON.parse(decompressed.toString('utf8'));
      
      logger.debug(
        { artifactId, storage: artifact.storageProvider },
        'Retrieved from blob storage'
      );

      return parsed;
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to retrieve artifact');
      throw error;
    }
  }

  // =========================================================================
  // BLOB STORAGE OPERATIONS
  // =========================================================================

  /**
   * Upload data to blob storage
   */
  private async uploadToBlob(location: string, data: Buffer): Promise<void> {
    switch (this.config.provider) {
      case 's3':
        await this.uploadToS3(location, data);
        break;
      case 'azure':
        await this.uploadToAzure(location, data);
        break;
      case 'local':
        await this.uploadToLocal(location, data);
        break;
      default:
        throw new Error(`Unsupported storage provider: ${this.config.provider}`);
    }
  }

  /**
   * Download data from blob storage
   */
  private async downloadFromBlob(location: string): Promise<Buffer> {
    switch (this.config.provider) {
      case 's3':
        return await this.downloadFromS3(location);
      case 'azure':
        return await this.downloadFromAzure(location);
      case 'local':
        return await this.downloadFromLocal(location);
      default:
        throw new Error(`Unsupported storage provider: ${this.config.provider}`);
    }
  }

  /**
   * Upload to S3
   */
  private async uploadToS3(location: string, data: Buffer): Promise<void> {
    // Placeholder - implement with AWS SDK
    logger.warn('S3 upload not implemented, using local storage');
    await this.uploadToLocal(location, data);
  }

  /**
   * Download from S3
   */
  private async downloadFromS3(location: string): Promise<Buffer> {
    // Placeholder - implement with AWS SDK
    logger.warn('S3 download not implemented, using local storage');
    return await this.downloadFromLocal(location);
  }

  /**
   * Upload to Azure Blob Storage
   */
  private async uploadToAzure(location: string, data: Buffer): Promise<void> {
    // Placeholder - implement with Azure SDK
    logger.warn('Azure upload not implemented, using local storage');
    await this.uploadToLocal(location, data);
  }

  /**
   * Download from Azure Blob Storage
   */
  private async downloadFromAzure(location: string): Promise<Buffer> {
    // Placeholder - implement with Azure SDK
    logger.warn('Azure download not implemented, using local storage');
    return await this.downloadFromLocal(location);
  }

  /**
   * Upload to local filesystem (fallback)
   */
  private async uploadToLocal(location: string, data: Buffer): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const uploadDir = process.env.UPLOAD_DIR || './uploads/artifacts';
    const fullPath = path.join(uploadDir, location);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, data);
    
    logger.debug({ location: fullPath }, 'Uploaded to local storage');
  }

  /**
   * Download from local filesystem (fallback)
   */
  private async downloadFromLocal(location: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const uploadDir = process.env.UPLOAD_DIR || './uploads/artifacts';
    const fullPath = path.join(uploadDir, location);
    
    const data = await fs.readFile(fullPath);
    
    logger.debug({ location: fullPath }, 'Downloaded from local storage');
    
    return data;
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Generate storage location path
   */
  private generateStorageLocation(
    tenantId: string,
    contractId: string,
    type: string
  ): string {
    const timestamp = Date.now();
    return `${tenantId}/${contractId}/${type}_${timestamp}.json.gz`;
  }

  /**
   * Calculate checksum for data
   */
  private calculateChecksum(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(tenantId: string): Promise<{
    totalArtifacts: number;
    databaseArtifacts: number;
    blobArtifacts: number;
    totalSize: number;
    databaseSize: number;
    blobSize: number;
  }> {
    const stats = await dbAdaptor.getClient().artifact.groupBy({
      by: ['storageProvider'],
      where: { tenantId },
      _count: true,
      _sum: {
        size: true,
      },
    });

    const result = {
      totalArtifacts: 0,
      databaseArtifacts: 0,
      blobArtifacts: 0,
      totalSize: 0,
      databaseSize: 0,
      blobSize: 0,
    };

    for (const stat of stats) {
      const count = stat._count;
      const size = Number(stat._sum.size || 0);

      result.totalArtifacts += count;
      result.totalSize += size;

      if (stat.storageProvider === 'database') {
        result.databaseArtifacts = count;
        result.databaseSize = size;
      } else {
        result.blobArtifacts += count;
        result.blobSize += size;
      }
    }

    return result;
  }
}

export const hybridArtifactStorageService = HybridArtifactStorageService.getInstance();
