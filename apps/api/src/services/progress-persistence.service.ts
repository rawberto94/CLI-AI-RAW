/**
 * Progress Persistence Service
 * Handles persistence of progress tracking data to survive server restarts
 */

import { promises as fs } from 'fs';
import path from 'path';
import pino from 'pino';
import { ProgressUpdate, ProcessingStage } from './progress-tracking.service';

const logger = pino({ name: 'progress-persistence' });

export interface PersistedProgress {
  contractId: string;
  tenantId: string;
  stage: ProcessingStage;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
  startedAt: string; // ISO string
  updatedAt: string; // ISO string
  completedStages: ProcessingStage[];
  errors?: Array<{
    stage: ProcessingStage;
    error: string;
    timestamp: string;
    recoverable: boolean;
    retryCount?: number;
  }>;
  metadata?: Record<string, any>;
}

export class ProgressPersistenceService {
  private persistenceDir: string;
  private saveInterval: NodeJS.Timeout | null = null;
  private pendingSaves = new Set<string>();

  constructor(persistenceDir: string = './data/progress') {
    this.persistenceDir = persistenceDir;
    this.ensureDirectoryExists();
    this.startPeriodicSave();
  }

  /**
   * Ensure persistence directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.persistenceDir, { recursive: true });
    } catch (error) {
      logger.error({ error, dir: this.persistenceDir }, 'Failed to create persistence directory');
    }
  }

  /**
   * Save progress to disk
   */
  async saveProgress(progress: ProgressUpdate): Promise<void> {
    try {
      const persistedProgress: PersistedProgress = {
        contractId: progress.contractId,
        tenantId: progress.tenantId,
        stage: progress.stage,
        progress: progress.progress,
        message: progress.message,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        startedAt: progress.startedAt.toISOString(),
        updatedAt: progress.updatedAt.toISOString(),
        completedStages: progress.completedStages,
        errors: progress.errors?.map(error => ({
          stage: error.stage,
          error: error.error,
          timestamp: error.timestamp.toISOString(),
          recoverable: error.recoverable,
          retryCount: error.retryCount
        })),
        metadata: progress.metadata
      };

      const filePath = this.getProgressFilePath(progress.contractId);
      const data = JSON.stringify(persistedProgress, null, 2);
      
      await fs.writeFile(filePath, data, 'utf8');
      
      logger.debug({ 
        contractId: progress.contractId, 
        stage: progress.stage 
      }, 'Progress saved to disk');
      
    } catch (error) {
      logger.error({ 
        error, 
        contractId: progress.contractId 
      }, 'Failed to save progress to disk');
    }
  }

  /**
   * Load progress from disk
   */
  async loadProgress(contractId: string): Promise<ProgressUpdate | null> {
    try {
      const filePath = this.getProgressFilePath(contractId);
      const data = await fs.readFile(filePath, 'utf8');
      const persistedProgress: PersistedProgress = JSON.parse(data);
      
      const progress: ProgressUpdate = {
        contractId: persistedProgress.contractId,
        tenantId: persistedProgress.tenantId,
        stage: persistedProgress.stage,
        progress: persistedProgress.progress,
        message: persistedProgress.message,
        estimatedTimeRemaining: persistedProgress.estimatedTimeRemaining,
        startedAt: new Date(persistedProgress.startedAt),
        updatedAt: new Date(persistedProgress.updatedAt),
        completedStages: persistedProgress.completedStages,
        errors: persistedProgress.errors?.map(error => ({
          stage: error.stage,
          error: error.error,
          timestamp: new Date(error.timestamp),
          recoverable: error.recoverable,
          retryCount: error.retryCount
        })),
        metadata: persistedProgress.metadata
      };
      
      logger.debug({ contractId }, 'Progress loaded from disk');
      return progress;
      
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error({ 
          error, 
          contractId 
        }, 'Failed to load progress from disk');
      }
      return null;
    }
  }

  /**
   * Load all persisted progress
   */
  async loadAllProgress(): Promise<ProgressUpdate[]> {
    try {
      const files = await fs.readdir(this.persistenceDir);
      const progressFiles = files.filter(file => file.endsWith('.json'));
      
      const progressList: ProgressUpdate[] = [];
      
      for (const file of progressFiles) {
        const contractId = path.basename(file, '.json');
        const progress = await this.loadProgress(contractId);
        if (progress) {
          progressList.push(progress);
        }
      }
      
      logger.info({ 
        count: progressList.length 
      }, 'Loaded all persisted progress');
      
      return progressList;
      
    } catch (error) {
      logger.error({ error }, 'Failed to load all progress from disk');
      return [];
    }
  }

  /**
   * Delete progress file
   */
  async deleteProgress(contractId: string): Promise<void> {
    try {
      const filePath = this.getProgressFilePath(contractId);
      await fs.unlink(filePath);
      
      logger.debug({ contractId }, 'Progress file deleted');
      
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error({ 
          error, 
          contractId 
        }, 'Failed to delete progress file');
      }
    }
  }

  /**
   * Clean up old progress files
   */
  async cleanup(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.persistenceDir);
      const progressFiles = files.filter(file => file.endsWith('.json'));
      const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      let cleaned = 0;
      
      for (const file of progressFiles) {
        const filePath = path.join(this.persistenceDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoff) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.info({ 
          cleaned, 
          maxAgeHours 
        }, 'Cleaned up old progress files');
      }
      
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup old progress files');
    }
  }

  /**
   * Queue progress for saving (batched)
   */
  queueSave(contractId: string): void {
    this.pendingSaves.add(contractId);
  }

  /**
   * Start periodic save process
   */
  private startPeriodicSave(): void {
    this.saveInterval = setInterval(async () => {
      if (this.pendingSaves.size > 0) {
        const contractIds = Array.from(this.pendingSaves);
        this.pendingSaves.clear();
        
        logger.debug({ 
          count: contractIds.length 
        }, 'Processing batched progress saves');
        
        // Note: This would need access to the progress tracking service
        // In practice, this would be injected or accessed via a shared instance
      }
    }, 5000); // Save every 5 seconds
  }

  /**
   * Get file path for contract progress
   */
  private getProgressFilePath(contractId: string): string {
    return path.join(this.persistenceDir, `${contractId}.json`);
  }

  /**
   * Get persistence statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: Date;
    newestFile?: Date;
  }> {
    try {
      const files = await fs.readdir(this.persistenceDir);
      const progressFiles = files.filter(file => file.endsWith('.json'));
      
      let totalSize = 0;
      let oldestFile: Date | undefined;
      let newestFile: Date | undefined;
      
      for (const file of progressFiles) {
        const filePath = path.join(this.persistenceDir, file);
        const stats = await fs.stat(filePath);
        
        totalSize += stats.size;
        
        if (!oldestFile || stats.mtime < oldestFile) {
          oldestFile = stats.mtime;
        }
        
        if (!newestFile || stats.mtime > newestFile) {
          newestFile = stats.mtime;
        }
      }
      
      return {
        totalFiles: progressFiles.length,
        totalSize,
        oldestFile,
        newestFile
      };
      
    } catch (error) {
      logger.error({ error }, 'Failed to get persistence stats');
      return {
        totalFiles: 0,
        totalSize: 0
      };
    }
  }

  /**
   * Shutdown the persistence service
   */
  shutdown(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    
    logger.info('Progress persistence service shut down');
  }
}

export const progressPersistenceService = new ProgressPersistenceService();