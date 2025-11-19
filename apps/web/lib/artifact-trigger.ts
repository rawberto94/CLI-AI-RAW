/**
 * Artifact Trigger
 * Triggers artifact generation and processing using job queue
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TriggerOptions {
  contractId: string;
  tenantId: string;
  filePath: string;
  mimeType: string;
  useQueue?: boolean;
}

interface QueueResult {
  success: boolean;
  contractId: string;
  status: string;
  jobId?: string | null;
}

export async function triggerArtifactGeneration(options: TriggerOptions): Promise<QueueResult> {
  const { contractId, tenantId, filePath, useQueue = true } = options;
  
  console.log(`🚀 Triggering artifact generation for contract: ${contractId}`);
  console.log(`   File: ${filePath}`);
  console.log(`   Queue enabled: ${useQueue}`);
  
  if (useQueue) {
    try {
      // Dynamically import queue service (avoids build-time dependencies)
      const { getContractQueue } = await import('@repo/utils/queue/contract-queue');
      
      const contractQueue = getContractQueue();
      
      // Queue the contract for processing
      const jobId = await contractQueue.queueContractProcessing(
        {
          contractId,
          tenantId,
          filePath,
          originalName: filePath.split('/').pop() || 'unknown',
        },
        {
          priority: 10, // Normal priority
        }
      );
      
      console.log(`✅ Contract queued for processing: ${contractId}, jobId: ${jobId}`);
      
      return {
        success: true,
        contractId,
        status: 'queued',
        jobId,
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

export async function triggerProcessing(contractId: string, options?: any) {
  // Trigger processing workflow
  console.log(`Triggering processing for contract: ${contractId}`, options);
  return { success: true, jobId: 'job-' + Date.now() };
}
