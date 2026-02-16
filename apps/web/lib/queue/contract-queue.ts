/**
 * Contract Queue Module
 * Re-exports the contract queue from packages/utils for local use
 */

import 'server-only';

import { initializeQueueService } from '@/lib/queue-init';
import { getContractQueue as getContractQueueFromUtils } from '../../../../packages/utils/src/queue/contract-queue';

// Type definitions for the queue
export interface MetadataExtractionJobData {
  contractId: string;
  tenantId: string;
  autoApply?: boolean;
  autoApplyThreshold?: number;
  source?: 'upload' | 'manual' | 'reprocess' | 'bulk';
  priority?: 'high' | 'normal' | 'low';
  customSchemaId?: string;
}

export interface CategorizationJobData {
  contractId: string;
  tenantId: string;
  forceRecategorize?: boolean;
  autoApply?: boolean;
  autoApplyThreshold?: number;
  priority?: 'high' | 'normal' | 'low';
  source?: 'upload' | 'manual' | 'bulk' | 'scheduled';
}

export interface ProcessContractJobData {
  contractId: string;
  tenantId: string;
  filePath: string;
  originalName: string;
  userId?: string;
  ocrMode?: 'openai' | 'mistral' | 'azure-ch' | 'azure-di-layout' | 'azure-di-contract' | 'azure-di-invoice' | 'auto' | (string & {});
}

export interface ContractQueueManager {
  queueMetadataExtraction(
    data: MetadataExtractionJobData,
    options?: { priority?: number; delay?: number }
  ): Promise<string | null>;
  
  queueContractProcessing(
    data: ProcessContractJobData,
    options?: { priority?: number; delay?: number }
  ): Promise<string | null>;
  
  queueCategorization(
    data: CategorizationJobData,
    options?: { priority?: number; delay?: number }
  ): Promise<string | null>;
  
  queueArtifactGeneration(
    data: any,
    options?: { priority?: number; delay?: number }
  ): Promise<string | null>;
  
  queueAgentOrchestration(
    data: any,
    options?: { priority?: number; delay?: number }
  ): Promise<string | null>;
  
  getJobStatus(queueName: string, jobId: string): Promise<{
    state?: string;
    progress?: number;
    data?: unknown;
    returnvalue?: unknown;
    failedReason?: string;
    attemptsMade?: number;
  } | null>;
}

// Singleton instance
let queueInstance: ContractQueueManager | null = null;
let queueInitFailed = false;

/**
 * Get the contract queue manager instance
 * Lazy loads the actual implementation from packages/utils
 */
export function getContractQueue(): ContractQueueManager {
  // If initialization has already failed, throw immediately to trigger fallback
  if (queueInitFailed) {
    throw new Error('Queue service not available - Redis not connected');
  }
  
  if (!queueInstance) {
    try {
      // Ensure the QueueService singleton is initialized before constructing queue managers
      const queueService = initializeQueueService();
      
      if (!queueService) {
        console.log('[ContractQueue] Queue service initialization returned null, falling back to legacy processing');
        queueInitFailed = true;
        throw new Error('Queue service not available - initialization failed');
      }
      
      queueInstance = getContractQueueFromUtils();
      console.log('[ContractQueue] Queue manager initialized successfully');
    } catch (error) {
      console.error('[ContractQueue] Failed to initialize queue:', error);
      queueInitFailed = true;
      throw error; // Re-throw to trigger fallback
    }
  }
  return queueInstance!;
}
