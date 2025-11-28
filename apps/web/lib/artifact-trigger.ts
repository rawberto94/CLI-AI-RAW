/**
 * Artifact Trigger
 * Triggers artifact generation and processing using job queue
 * 
 * Priority Levels:
 * - URGENT (1): VIP customers, critical contracts
 * - HIGH (5): Standard interactive processing
 * - NORMAL (10): Default processing
 * - LOW (20): Bulk/batch operations
 * - BACKGROUND (50): Non-urgent background tasks
 */

import { getContractQueue } from '../../../packages/utils/dist/queue/contract-queue';

/**
 * Priority levels matching queue configuration
 */
export const PROCESSING_PRIORITY = {
  URGENT: 1,
  HIGH: 5,
  NORMAL: 10,
  LOW: 20,
  BACKGROUND: 50,
} as const;

export type ProcessingPriority = typeof PROCESSING_PRIORITY[keyof typeof PROCESSING_PRIORITY];

interface TriggerOptions {
  contractId: string;
  tenantId: string;
  filePath: string;
  mimeType: string;
  useQueue?: boolean;
  priority?: ProcessingPriority;
  isReprocess?: boolean;
  source?: 'upload' | 'bulk' | 'api' | 'webhook' | 'reprocess';
}

interface QueueResult {
  success: boolean;
  contractId: string;
  status: string;
  jobId?: string | null;
  priority?: number;
  estimatedWaitMs?: number;
}

/**
 * Estimate wait time based on priority level
 */
function estimateWaitTime(priority: number): number {
  // Base wait times by priority
  const waitTimes: Record<number, number> = {
    1: 1000,    // URGENT: ~1s
    5: 3000,    // HIGH: ~3s
    10: 5000,   // NORMAL: ~5s
    20: 15000,  // LOW: ~15s
    50: 60000,  // BACKGROUND: ~1min
  };
  return waitTimes[priority] || 5000;
}

export async function triggerArtifactGeneration(options: TriggerOptions): Promise<QueueResult> {
  const { 
    contractId, 
    tenantId, 
    filePath, 
    useQueue = true,
    priority = PROCESSING_PRIORITY.NORMAL,
    source = 'upload',
    isReprocess = false,
  } = options;
  
  console.log(`🚀 Triggering artifact generation for contract: ${contractId}`);
  console.log(`   File: ${filePath}`);
  console.log(`   Priority: ${priority} (source: ${source})`);
  console.log(`   Queue enabled: ${useQueue}`);
  
  if (useQueue) {
    try {
      // Use shared queue from utils package
      const contractQueue = getContractQueue();
      
      // Calculate delay based on source and whether it's a reprocess
      // Using 2 seconds to ensure DB transaction is committed before worker picks up the job
      const delay = isReprocess ? 500 : 2000;
      
      // Queue the contract for processing with priority
      const jobId = await contractQueue.queueContractProcessing(
        {
          contractId,
          tenantId,
          filePath,
          originalName: filePath.split('/').pop() || 'unknown',
        },
        {
          priority,
          delay,
        }
      );
      
      const estimatedWaitMs = estimateWaitTime(priority);
      
      console.log(`✅ Contract queued for processing: ${contractId}, jobId: ${jobId}, priority: ${priority}`);
      
      return {
        success: true,
        contractId,
        status: 'queued',
        jobId,
        priority,
        estimatedWaitMs,
      };
    } catch (error) {
      console.error('❌ Failed to queue contract:', error);
      
      // Fallback to direct processing if queue unavailable
      console.log('⚠️  Falling back to legacy processing');
      return triggerLegacyProcessing(options);
    }
  }
  
  // Legacy processing (spawn worker)
  return triggerLegacyProcessing(options);
}

/**
 * Legacy processing method (for backwards compatibility)
 */
async function triggerLegacyProcessing(options: TriggerOptions): Promise<QueueResult> {
  const { contractId, tenantId, filePath, mimeType } = options;
  
  // Spawn a separate Node process to avoid blocking/crashing the main server
  const { spawn } = await import('child_process');
  const { join } = await import('path');
  
  const workerScript = join(process.cwd(), '../../scripts/generate-artifacts-worker.mjs');
  const worker = spawn('npx', ['tsx', workerScript, contractId, tenantId, filePath, mimeType], {
    detached: true,
    stdio: 'inherit'
  });
  
  worker.unref(); // Allow parent to exit independently
  
  console.log(`✅ Artifact generation worker spawned for contract: ${contractId}`);
  
  return { success: true, contractId, status: 'processing' };
}

export async function triggerProcessing(contractId: string, options?: Record<string, unknown>) {
  // Trigger processing workflow
  console.log(`Triggering processing for contract: ${contractId}`, options);
  return { success: true, jobId: 'job-' + Date.now() };
}
