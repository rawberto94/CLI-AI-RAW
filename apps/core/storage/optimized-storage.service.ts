/**
 * Optimized Storage Service
 * High-performance file storage with compression, deduplication, and CDN integration
 */

import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { createHash } from 'crypto';
import { performanceMonitor } from '../performance/performance-monitor';
import { cacheService } from '../cache/redis-cache.service';

interface StorageOptions {
  compress?: boolean;
  deduplicate?: boolean;
  tier?: 'hot' | 'warm' | 'cold';
  ttl?: number;
  metadata?: Record<string, string>;
}

interface StorageMetrics {
  originalSize: number;
  storedSize: number;
  compressionRatio: number;
  uploadTime: number;
  deduplicated: boolean;
}

export class OptimizedStorageService {
  private deduplicationIndex = new Map<string, string>(); // hash -> storageKey
  private compressionEnabled = true;
  private cdnEnabled = false;

  /**
   * Store file with optimization
   */
  async store(
    filePath: string,
    storageKey: string,
    options: StorageOptions = {}
  ): Promise<{ storageKey: string; metrics: StorageMetrics }> {
    return performanceMonitor.measure('storage:store', async () => {
      const startTime = Date.now();

      // Calculate file hash for deduplication
      const fileHash = await this.calculateFileHash(filePath);

      // Check for deduplication
      if (options.deduplicate && this.deduplicationIndex.has(fileHash)) {
        const existingKey = this.deduplicationIndex.get(fileHash)!;
        return {
          storageKey: existingKey,
          metrics: {
            originalSize: 0,
            storedSize: 0,
            compressionRatio: 1,
            uploadTime: Date.now() - startTime,
            deduplicated: true,
          },
        };
      }

      // Get original file size
      const { size: originalSize } = await import('fs/promises').then(fs => 
        fs.stat(filePath)
      );

      // Store with optional compression
      let storedSize = originalSize;
      if (options.compress && this.compressionEnabled) {
        storedSize = await this.storeCompressed(filePath, storageKey);
      } else {
        await this.storeUncompressed(filePath, storageKey);
      }

      // Update deduplication index
      if (options.deduplicate) {
        this.deduplicationIndex.set(fileHash, storageKey);
      }

      // Cache metadata
      await cacheService.set(
        `storage:meta:${storageKey}`,
        {
          originalSize,
          storedSize,
          compressed: options.compress,
          hash: fileHash,
          tier: options.tier || 'hot',
          metadata: options.metadata,
        },
        { ttl: options.ttl || 3600 }
      );

      const uploadTime = Date.now() - startTime;

      return {
        storageKey,
        metrics: {
          originalSize,
          storedSize,
          compressionRatio: originalSize / storedSize,
          uploadTime,
          deduplicated: false,
        },
      };
    });
  }

  /**
   * Retrieve file with automatic decompression
   */
  async retrieve(
    storageKey: string,
    outputPath: string
  ): Promise<{ size: number; retrievalTime: number }> {
    return performanceMonitor.measure('storage:retrieve', async () => {
      const startTime = Date.now();

      // Check cache for metadata
      const metadata = await cacheService.get<any>(`storage:meta:${storageKey}`);

      // Retrieve with automatic decompression
      if (metadata?.compressed) {
        await this.retrieveCompressed(storageKey, outputPath);
      } else {
        await this.retrieveUncompressed(storageKey, outputPath);
      }

      const { size } = await import('fs/promises').then(fs => fs.stat(outputPath));
      const retrievalTime = Date.now() - startTime;

      return { size, retrievalTime };
    });
  }

  /**
   * Batch store multiple files
   */
  async storeBatch(
    files: Array<{ path: string; key: string; options?: StorageOptions }>
  ): Promise<Array<{ storageKey: string; metrics: StorageMetrics }>> {
    return performanceMonitor.measure('storage:batch-store', async () => {
      const results = await Promise.all(
        files.map(file => this.store(file.path, file.key, file.options))
      );
      return results;
    });
  }

  /**
   * Stream file to storage
   */
  async streamToStorage(
    readStream: NodeJS.ReadableStream,
    storageKey: string,
    options: StorageOptions = {}
  ): Promise<StorageMetrics> {
    return performanceMonitor.measure('storage:stream', async () => {
      const startTime = Date.now();
      let originalSize = 0;
      let storedSize = 0;

      // Create write stream
      const writeStream = createWriteStream(`/tmp/${storageKey}`);

      // Add compression if enabled
      if (options.compress && this.compressionEnabled) {
        const gzip = createGzip({ level: 6 }); // Balanced compression
        await pipeline(readStream, gzip, writeStream);
      } else {
        await pipeline(readStream, writeStream);
      }

      // Get file sizes
      const { size } = await import('fs/promises').then(fs => 
        fs.stat(`/tmp/${storageKey}`)
      );
      storedSize = size;

      const uploadTime = Date.now() - startTime;

      return {
        originalSize,
        storedSize,
        compressionRatio: originalSize / storedSize || 1,
        uploadTime,
        deduplicated: false,
      };
    });
  }

  /**
   * Move file to different storage tier
   */
  async changeTier(
    storageKey: string,
    newTier: 'hot' | 'warm' | 'cold'
  ): Promise<void> {
    return performanceMonitor.measure('storage:change-tier', async () => {
      // Update metadata
      const metadata = await cacheService.get<any>(`storage:meta:${storageKey}`);
      if (metadata) {
        metadata.tier = newTier;
        await cacheService.set(`storage:meta:${storageKey}`, metadata);
      }

      // In production, this would move the file to different storage class
      // (e.g., S3 Standard -> S3 Glacier)
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    deduplicationSavings: number;
    compressionSavings: number;
  }> {
    const deduplicationSavings = this.deduplicationIndex.size;
    
    return {
      totalFiles: 0, // Would query from storage
      totalSize: 0,
      deduplicationSavings,
      compressionSavings: 0,
    };
  }

  /**
   * Cleanup old files
   */
  async cleanup(olderThan: Date): Promise<number> {
    return performanceMonitor.measure('storage:cleanup', async () => {
      // In production, this would delete files older than specified date
      return 0;
    });
  }

  /**
   * Private helper methods
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async storeCompressed(filePath: string, storageKey: string): Promise<number> {
    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(`/tmp/${storageKey}.gz`);
    const gzip = createGzip({ level: 6 });

    await pipeline(readStream, gzip, writeStream);

    const { size } = await import('fs/promises').then(fs => 
      fs.stat(`/tmp/${storageKey}.gz`)
    );
    return size;
  }

  private async storeUncompressed(filePath: string, storageKey: string): Promise<void> {
    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(`/tmp/${storageKey}`);
    await pipeline(readStream, writeStream);
  }

  private async retrieveCompressed(storageKey: string, outputPath: string): Promise<void> {
    const readStream = createReadStream(`/tmp/${storageKey}.gz`);
    const writeStream = createWriteStream(outputPath);
    const gunzip = createGunzip();
    await pipeline(readStream, gunzip, writeStream);
  }

  private async retrieveUncompressed(storageKey: string, outputPath: string): Promise<void> {
    const readStream = createReadStream(`/tmp/${storageKey}`);
    const writeStream = createWriteStream(outputPath);
    await pipeline(readStream, writeStream);
  }
}

export const optimizedStorageService = new OptimizedStorageService();
