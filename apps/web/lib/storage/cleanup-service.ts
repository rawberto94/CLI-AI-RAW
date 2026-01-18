/**
 * Storage Cleanup Service
 * Handles cleanup of orphan files, incomplete uploads, and old artifacts
 */

import { prisma } from '@/lib/prisma';
import { storageService } from '@/lib/storage/storage-service';
import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';

const logger = pino({ name: 'storage-cleanup-service' });

export interface CleanupResult {
  orphanFilesDeleted: number;
  incompleteUploadsDeleted: number;
  oldVersionsDeleted: number;
  bytesFreed: number;
  errors: string[];
}

export interface CleanupConfig {
  // Age thresholds in hours
  incompleteUploadMaxAge: number;  // Default: 24 hours
  orphanFileCheckEnabled: boolean;
  oldVersionRetentionDays: number; // Default: 90 days
  dryRun: boolean;
}

const DEFAULT_CONFIG: CleanupConfig = {
  incompleteUploadMaxAge: 24,
  orphanFileCheckEnabled: true,
  oldVersionRetentionDays: 90,
  dryRun: false,
};

/**
 * Storage Cleanup Service
 */
export class StorageCleanupService {
  private config: CleanupConfig;

  constructor(config?: Partial<CleanupConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run full cleanup
   */
  async runCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      orphanFilesDeleted: 0,
      incompleteUploadsDeleted: 0,
      oldVersionsDeleted: 0,
      bytesFreed: 0,
      errors: [],
    };

    logger.info({ config: this.config }, 'Starting storage cleanup');

    try {
      // 1. Clean up incomplete chunked uploads
      const incompleteResult = await this.cleanupIncompleteUploads();
      result.incompleteUploadsDeleted = incompleteResult.count;
      result.bytesFreed += incompleteResult.bytes;
      result.errors.push(...incompleteResult.errors);

      // 2. Clean up orphan files (files without DB records)
      if (this.config.orphanFileCheckEnabled) {
        const orphanResult = await this.cleanupOrphanFiles();
        result.orphanFilesDeleted = orphanResult.count;
        result.bytesFreed += orphanResult.bytes;
        result.errors.push(...orphanResult.errors);
      }

      // 3. Clean up old artifact versions
      const versionResult = await this.cleanupOldVersions();
      result.oldVersionsDeleted = versionResult.count;
      result.errors.push(...versionResult.errors);

      logger.info({
        ...result,
        bytesFreedMB: (result.bytesFreed / (1024 * 1024)).toFixed(2),
      }, 'Storage cleanup completed');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMsg }, 'Storage cleanup failed');
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Clean up incomplete chunked uploads older than threshold
   */
  private async cleanupIncompleteUploads(): Promise<{ count: number; bytes: number; errors: string[] }> {
    const result = { count: 0, bytes: 0, errors: [] as string[] };
    const uploadsDir = path.join(process.cwd(), 'uploads', 'chunks');
    
    try {
      // Check if chunks directory exists
      try {
        await fs.access(uploadsDir);
      } catch {
        logger.debug('No chunks directory found, skipping incomplete upload cleanup');
        return result;
      }

      const cutoffTime = Date.now() - (this.config.incompleteUploadMaxAge * 60 * 60 * 1000);
      const entries = await fs.readdir(uploadsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const chunkDir = path.join(uploadsDir, entry.name);
        
        try {
          const stats = await fs.stat(chunkDir);
          
          if (stats.mtimeMs < cutoffTime) {
            // Get size before deletion
            const dirSize = await this.getDirectorySize(chunkDir);
            
            if (!this.config.dryRun) {
              await fs.rm(chunkDir, { recursive: true, force: true });
              logger.debug({ dir: entry.name, age: 'expired' }, 'Deleted incomplete upload');
            }
            
            result.count++;
            result.bytes += dirSize;
          }
        } catch (error) {
          const msg = `Failed to process chunk dir ${entry.name}: ${error instanceof Error ? error.message : 'Unknown'}`;
          result.errors.push(msg);
          logger.warn({ error: msg });
        }
      }

      logger.info({ 
        deleted: result.count, 
        bytesMB: (result.bytes / (1024 * 1024)).toFixed(2),
        dryRun: this.config.dryRun,
      }, 'Incomplete uploads cleanup completed');

    } catch (error) {
      const msg = `Incomplete uploads cleanup error: ${error instanceof Error ? error.message : 'Unknown'}`;
      result.errors.push(msg);
      logger.error({ error: msg });
    }

    return result;
  }

  /**
   * Clean up orphan files (files in storage without matching DB records)
   */
  private async cleanupOrphanFiles(): Promise<{ count: number; bytes: number; errors: string[] }> {
    const result = { count: 0, bytes: 0, errors: [] as string[] };
    
    try {
      // Get all file paths from storage
      const storageFiles = await this.listStorageFiles();
      
      if (storageFiles.length === 0) {
        logger.debug('No storage files found');
        return result;
      }

      // Get all file paths from database
      const dbFilePaths = await this.getDbFilePaths();
      const dbFileSet = new Set(dbFilePaths);

      // Find orphan files
      const orphanFiles = storageFiles.filter(file => !dbFileSet.has(file.path));
      
      logger.info({
        totalStorage: storageFiles.length,
        totalDb: dbFilePaths.length,
        orphans: orphanFiles.length,
      }, 'Orphan file analysis');

      // Delete orphan files
      for (const file of orphanFiles) {
        try {
          if (!this.config.dryRun) {
            await storageService.delete(file.path);
            logger.debug({ path: file.path }, 'Deleted orphan file');
          }
          
          result.count++;
          result.bytes += file.size;
        } catch (error) {
          const msg = `Failed to delete orphan ${file.path}: ${error instanceof Error ? error.message : 'Unknown'}`;
          result.errors.push(msg);
        }
      }

      logger.info({
        deleted: result.count,
        bytesMB: (result.bytes / (1024 * 1024)).toFixed(2),
        dryRun: this.config.dryRun,
      }, 'Orphan files cleanup completed');

    } catch (error) {
      const msg = `Orphan files cleanup error: ${error instanceof Error ? error.message : 'Unknown'}`;
      result.errors.push(msg);
      logger.error({ error: msg });
    }

    return result;
  }

  /**
   * Clean up old artifact versions beyond retention period
   */
  private async cleanupOldVersions(): Promise<{ count: number; errors: string[] }> {
    const result = { count: 0, errors: [] as string[] };
    
    try {
      const cutoffDate = new Date(
        Date.now() - this.config.oldVersionRetentionDays * 24 * 60 * 60 * 1000
      );

      // Find old versions to delete (keep at least the latest version per artifact)
      const oldVersions = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH ranked_versions AS (
          SELECT 
            id,
            "artifactId",
            "createdAt",
            ROW_NUMBER() OVER (
              PARTITION BY "artifactId" 
              ORDER BY "createdAt" DESC
            ) as rn
          FROM "ArtifactVersion"
        )
        SELECT id 
        FROM ranked_versions 
        WHERE rn > 1 
          AND "createdAt" < ${cutoffDate}
      `;

      if (oldVersions.length === 0) {
        logger.debug('No old artifact versions to cleanup');
        return result;
      }

      if (!this.config.dryRun) {
        const deleteResult = await prisma.artifactVersion.deleteMany({
          where: {
            id: { in: oldVersions.map(v => v.id) },
          },
        });
        result.count = deleteResult.count;
      } else {
        result.count = oldVersions.length;
      }

      logger.info({
        deleted: result.count,
        retentionDays: this.config.oldVersionRetentionDays,
        dryRun: this.config.dryRun,
      }, 'Old versions cleanup completed');

    } catch (error) {
      const msg = `Old versions cleanup error: ${error instanceof Error ? error.message : 'Unknown'}`;
      result.errors.push(msg);
      logger.error({ error: msg });
    }

    return result;
  }

  /**
   * List all files in storage
   */
  private async listStorageFiles(): Promise<Array<{ path: string; size: number }>> {
    const files: Array<{ path: string; size: number }> = [];
    
    try {
      // List files from storage service
      const storageList = await storageService.list('contracts/');
      
      for (const item of storageList) {
        if (item.name && !item.name.endsWith('/')) {
          const metadata = await storageService.getMetadata(item.name).catch(() => null);
          files.push({
            path: item.name,
            size: metadata?.size ?? 0,
          });
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to list storage files');
    }

    return files;
  }

  /**
   * Get all file paths referenced in the database
   */
  private async getDbFilePaths(): Promise<string[]> {
    const paths: string[] = [];

    try {
      // Get contract file paths
      const contracts = await prisma.contract.findMany({
        select: { filePath: true },
        where: { filePath: { not: null } },
      });
      paths.push(...contracts.map(c => c.filePath!).filter(Boolean));

      // Get contract version file paths
      const versions = await prisma.contractVersion.findMany({
        select: { filePath: true },
        where: { filePath: { not: null } },
      });
      paths.push(...versions.map(v => v.filePath!).filter(Boolean));

    } catch (error) {
      logger.warn({ error }, 'Failed to get DB file paths');
    }

    return paths;
  }

  /**
   * Get directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        }
      }
    } catch {
      // Ignore errors
    }
    
    return size;
  }
}

// Export singleton with default config
export const storageCleanupService = new StorageCleanupService();

/**
 * Run cleanup as a scheduled job
 * Call this from a cron job or scheduler
 */
export async function runScheduledCleanup(dryRun = false): Promise<CleanupResult> {
  const service = new StorageCleanupService({ dryRun });
  return service.runCleanup();
}
