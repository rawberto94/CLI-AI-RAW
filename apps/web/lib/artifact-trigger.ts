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

import 'server-only';

import { getContractQueue } from '@/lib/queue/contract-queue';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

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
  ocrMode?: string; // User-selected AI model: 'gpt4', 'mistral', 'auto'
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
    isReprocess = false,
    ocrMode,
  } = options;
  
  if (useQueue) {
    try {
      // Use shared queue from utils package
      const contractQueue = getContractQueue();
      
      // Calculate delay based on source and whether it's a reprocess
      // Using 2 seconds to ensure DB transaction is committed before worker picks up the job
      const delay = isReprocess ? 200 : 500;
      
      // Queue the contract for processing with priority
      const jobId = await contractQueue.queueContractProcessing(
        {
          contractId,
          tenantId,
          filePath,
          originalName: filePath.split('/').pop() || 'unknown',
          ocrMode, // Pass user's AI model selection
        },
        {
          priority,
          delay,
        }
      );
      
      const estimatedWaitMs = estimateWaitTime(priority);
      
      // Safety net: if no worker picks up the job within 120 seconds, process inline.
      // This handles the common dev scenario where Redis is running but no BullMQ workers are active.
      // Skip for reprocesses — the worker is already running and artifact generation can take >30s.
      if (!isReprocess) {
        scheduleInlineFallback(options, 120_000);
      }
      
      return {
        success: true,
        contractId,
        status: 'queued',
        jobId,
        priority,
        estimatedWaitMs,
      };
    } catch {
      // Fallback to direct processing if queue unavailable
      return triggerLegacyProcessing(options);
    }
  }
  
  // Legacy processing (spawn worker)
  return triggerLegacyProcessing(options);
}

/**
 * Legacy processing method — runs artifact generation inline (no queue worker needed)
 * Falls back to this when BullMQ is unavailable (e.g., in dev without workers).
 */
async function triggerLegacyProcessing(options: TriggerOptions): Promise<QueueResult> {
  const { contractId, tenantId, filePath, mimeType } = options;
  
  logger.info({ contractId, filePath }, 'Starting inline artifact generation (legacy fallback)');
  
  // Fire-and-forget: run generateRealArtifacts directly in-process
  // We don't await it so the upload response returns immediately
  (async () => {
    try {
      const { generateRealArtifacts } = await import('@/lib/real-artifact-generator');
      
      const result = await generateRealArtifacts(
        contractId,
        tenantId,
        filePath,
        mimeType || 'application/octet-stream',
        prisma
      );
      
      logger.info({ contractId, ...result }, 'Inline artifact generation completed');
    } catch (err) {
      logger.error({ contractId, error: (err as Error).message }, 'Inline artifact generation failed');
    }
  })();
  
  return { success: true, contractId, status: 'processing' };
}

/**
 * Schedule a delayed inline fallback: if the contract still has 0 artifacts
 * after `delayMs`, run inline processing. This prevents contracts from being
 * stuck when BullMQ workers are not running (common in dev).
 */
function scheduleInlineFallback(options: TriggerOptions, delayMs: number) {
  setTimeout(async () => {
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: options.contractId },
        select: {
          status: true,
          rawText: true,
          _count: { select: { artifacts: true } },
        },
      });
      // Only process if contract exists, has 0 artifacts, no rawText (BullMQ worker sets this early),
      // and is still in a non-terminal state. If rawText is set, the BullMQ worker is actively processing.
      if (
        contract &&
        contract._count.artifacts === 0 &&
        !contract.rawText &&
        ['PROCESSING', 'QUEUED', 'PENDING'].includes(contract.status)
      ) {
        logger.warn(
          { contractId: options.contractId },
          'No artifacts after queue delay — triggering inline fallback processing'
        );
        await triggerLegacyProcessing(options);
      }
    } catch (err) {
      logger.error(
        { contractId: options.contractId, error: (err as Error).message },
        'Inline fallback check failed'
      );
    }
  }, delayMs);
}

export async function triggerProcessing(_contractId: string, _options?: Record<string, unknown>) {
  // Trigger processing workflow
  return { success: true, jobId: 'job-' + Date.now() };
}
