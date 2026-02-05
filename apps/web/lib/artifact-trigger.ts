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
      const delay = isReprocess ? 500 : 2000;
      
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
 * Legacy processing method (for backwards compatibility)
 */
async function triggerLegacyProcessing(options: TriggerOptions): Promise<QueueResult> {
  const { contractId, tenantId, filePath, mimeType } = options;
  
  // Spawn a separate Node process to avoid blocking/crashing the main server
  const { spawn } = await import('child_process');
  const { join } = await import('path');
  const { existsSync } = await import('fs');
  
  // Get the workspace root directory - try multiple paths since Next.js can run from different locations
  const possibleRoots = [
    join(process.cwd(), '..', '..'), // If running from apps/web
    join(process.cwd(), '..'),       // If running from apps level
    process.cwd(),                    // If running from workspace root
  ];
  
  let workspaceRoot = process.cwd();
  let workerScript = '';
  
  for (const root of possibleRoots) {
    const testPath = join(root, 'scripts', 'generate-artifacts-worker.mjs');
    if (existsSync(testPath)) {
      workspaceRoot = root;
      workerScript = testPath;
      break;
    }
  }
  
  // Fallback: assume standard monorepo structure
  if (!workerScript) {
    workspaceRoot = join(process.cwd(), '..', '..');
    workerScript = join(workspaceRoot, 'scripts', 'generate-artifacts-worker.mjs');
  }
  
  console.log(`[Legacy Processing] Spawning worker for contract: ${contractId}`);
  console.log(`[Legacy Processing] Worker script: ${workerScript}`);
  console.log(`[Legacy Processing] Workspace root: ${workspaceRoot}`);
  
  const worker = spawn('npx', ['tsx', workerScript, contractId, tenantId, filePath, mimeType || 'application/octet-stream'], {
    detached: true,
    stdio: 'pipe', // Use pipe to avoid blocking but capture errors
    cwd: workspaceRoot,
    env: {
      ...process.env,
      // Ensure the worker can find node_modules
      PATH: process.env.PATH,
    },
  });
  
  // Log any errors from the worker
  worker.stderr?.on('data', (data) => {
    console.error(`[Legacy Worker Error] ${data}`);
  });
  
  worker.on('error', (err) => {
    console.error(`[Legacy Worker] Failed to start worker:`, err);
  });
  
  worker.unref(); // Allow parent to exit independently
  
  return { success: true, contractId, status: 'processing' };
}

export async function triggerProcessing(_contractId: string, _options?: Record<string, unknown>) {
  // Trigger processing workflow
  return { success: true, jobId: 'job-' + Date.now() };
}
