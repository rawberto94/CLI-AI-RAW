/**
 * Batch Operations Service
 * Handles batch upload, processing, and deletion of contracts
 */

import { ContractCreationService } from './contract-creation.service';
import { WorkerOrchestrator } from '../workers/worker-orchestrator';
import { ProcessingJobService } from './processing-job.service';
import { processingStatusBroadcaster } from './processing-status-broadcaster';
import { ContractRepository } from 'clients-db';

export interface BatchUploadFile {
  file: File;
  metadata?: {
    contractType?: string;
    clientId?: string;
    supplierId?: string;
  };
}

export interface BatchUploadResult {
  batchId: string;
  totalFiles: number;
  successful: number;
  failed: number;
  processing: number;
  results: Array<{
    fileName: string;
    contractId?: string;
    jobId?: string;
    status: 'success' | 'failed' | 'processing';
    error?: string;
  }>;
  startTime: Date;
  endTime?: Date;
}

export interface BatchDeleteResult {
  totalRequested: number;
  successful: number;
  failed: number;
  results: Array<{
    contractId: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

export class BatchOperationsService {
  private activeBatches = new Map<string, BatchUploadResult>();

  constructor(
    private creationService: ContractCreationService,
    private workerOrchestrator: WorkerOrchestrator,
    private jobService: ProcessingJobService,
    private contractRepository: ContractRepository
  ) {}

  /**
   * Upload and process multiple contracts
   */
  async batchUpload(
    files: BatchUploadFile[],
    options?: {
      concurrency?: number;
      userId?: string;
    }
  ): Promise<BatchUploadResult> {
    const batchId = this.generateBatchId();
    const concurrency = options?.concurrency || 5;
    const startTime = new Date();

    const result: BatchUploadResult = {
      batchId,
      totalFiles: files.length,
      successful: 0,
      failed: 0,
      processing: 0,
      results: [],
      startTime,
    };

    this.activeBatches.set(batchId, result);

    // Process files in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map((fileData) => this.uploadSingleFile(fileData, options?.userId))
      );

      batchResults.forEach((promiseResult, index) => {
        const fileData = batch[index];
        
        if (promiseResult.status === 'fulfilled') {
          const { contractId, jobId } = promiseResult.value;
          result.results.push({
            fileName: fileData.file.name,
            contractId,
            jobId,
            status: 'processing',
          });
          result.processing++;
        } else {
          result.results.push({
            fileName: fileData.file.name,
            status: 'failed',
            error: promiseResult.reason?.message || 'Upload failed',
          });
          result.failed++;
        }
      });

      // Broadcast batch progress
      processingStatusBroadcaster.broadcastBatchUpdate(
        batchId,
        result.totalFiles,
        result.successful,
        result.failed,
        result.processing
      );
    }

    result.endTime = new Date();
    this.activeBatches.set(batchId, result);

    return result;
  }

  /**
   * Upload a single file
   */
  private async uploadSingleFile(
    fileData: BatchUploadFile,
    userId?: string
  ): Promise<{ contractId: string; jobId: string }> {
    // Create contract
    const contract = await this.creationService.createContract(
      fileData.file,
      fileData.metadata
    );

    // Create processing job
    const job = await this.jobService.createJob({
      contractId: contract.id,
      userId,
    });

    // Start processing in background
    this.workerOrchestrator
      .executePipeline(contract.id, job.id)
      .then(async () => {
        await this.jobService.completeJob(job.id);
        processingStatusBroadcaster.broadcastCompleted(contract.id, job.id);
        
        // Update batch result
        const batch = this.activeBatches.get(contract.id.split('_')[0]);
        if (batch) {
          batch.processing--;
          batch.successful++;
        }
      })
      .catch(async (error) => {
        await this.jobService.failJob(job.id, error.message);
        processingStatusBroadcaster.broadcastFailed(contract.id, job.id, error.message);
        
        // Update batch result
        const batch = this.activeBatches.get(contract.id.split('_')[0]);
        if (batch) {
          batch.processing--;
          batch.failed++;
        }
      });

    return { contractId: contract.id, jobId: job.id };
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<BatchUploadResult | null> {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Delete multiple contracts
   */
  async batchDelete(
    contractIds: string[],
    options?: {
      userId?: string;
    }
  ): Promise<BatchDeleteResult> {
    const result: BatchDeleteResult = {
      totalRequested: contractIds.length,
      successful: 0,
      failed: 0,
      results: [],
    };

    // Use transaction for atomicity
    try {
      await this.contractRepository.transaction(async (tx) => {
        for (const contractId of contractIds) {
          try {
            await tx.contract.delete({
              where: { id: contractId },
            });

            result.results.push({
              contractId,
              status: 'success',
            });
            result.successful++;
          } catch (error) {
            result.results.push({
              contractId,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Delete failed',
            });
            result.failed++;
          }
        }
      });
    } catch (error) {
      // Transaction failed - mark all as failed
      contractIds.forEach((contractId) => {
        if (!result.results.find((r) => r.contractId === contractId)) {
          result.results.push({
            contractId,
            status: 'failed',
            error: 'Transaction failed',
          });
          result.failed++;
        }
      });
    }

    return result;
  }

  /**
   * Batch update contract metadata
   */
  async batchUpdate(
    updates: Array<{
      contractId: string;
      data: {
        contractType?: string;
        clientId?: string;
        supplierId?: string;
        status?: string;
      };
    }>
  ): Promise<{
    successful: number;
    failed: number;
    results: Array<{
      contractId: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> {
    const results = await Promise.allSettled(
      updates.map((update) =>
        this.contractRepository.update(update.contractId, update.data)
      )
    );

    const response = {
      successful: 0,
      failed: 0,
      results: [] as Array<{
        contractId: string;
        status: 'success' | 'failed';
        error?: string;
      }>,
    };

    results.forEach((result, index) => {
      const contractId = updates[index].contractId;
      
      if (result.status === 'fulfilled') {
        response.results.push({
          contractId,
          status: 'success',
        });
        response.successful++;
      } else {
        response.results.push({
          contractId,
          status: 'failed',
          error: result.reason?.message || 'Update failed',
        });
        response.failed++;
      }
    });

    return response;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old batch records
   */
  async cleanupOldBatches(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

    let cleaned = 0;
    for (const [batchId, batch] of this.activeBatches.entries()) {
      if (batch.startTime < cutoffTime) {
        this.activeBatches.delete(batchId);
        cleaned++;
      }
    }

    return cleaned;
  }
}
