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
  ocrMode?: string;
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

/**
 * Get the contract queue manager instance
 * Lazy loads the actual implementation from packages/utils
 */
export function getContractQueue(): ContractQueueManager {
  if (!queueInstance) {
    try {
      // Ensure the QueueService singleton is initialized before constructing queue managers
      initializeQueueService();
      queueInstance = getContractQueueFromUtils();
    } catch (error) {
      console.warn('Contract queue not available, using stub implementation:', error);
      // Return a stub implementation that logs operations
      queueInstance = {
        async queueMetadataExtraction(data, options) {
          console.log('[Queue Stub] Would queue metadata extraction:', { data, options });
          return `stub-job-${Date.now()}`;
        },
        async queueContractProcessing(data, options) {
          console.log('[Queue Stub] Would queue contract processing:', { data, options });
          return `stub-job-${Date.now()}`;
        },
        async queueCategorization(data, options) {
          console.log('[Queue Stub] Would queue categorization:', { data, options });
          return `stub-job-${Date.now()}`;
        },
        async queueArtifactGeneration(data, options) {
          console.log('[Queue Stub] Would queue artifact generation:', { data, options });
          return `stub-job-${Date.now()}`;
        },
        async queueAgentOrchestration(data, options) {
          console.log('[Queue Stub] Would queue agent orchestration:', { data, options });
          return `stub-job-${Date.now()}`;
        },
        async getJobStatus(queueName, jobId) {
          console.log('[Queue Stub] Would get job status:', { queueName, jobId });
          return { state: 'pending' };
        },
      };
    }
  }
  return queueInstance!;
}
