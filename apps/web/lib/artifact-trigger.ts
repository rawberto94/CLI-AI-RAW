/**
 * Artifact Trigger
 * Triggers artifact generation and processing
 */

import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";
import { join } from "path";

const prisma = new PrismaClient();

interface TriggerOptions {
  contractId: string;
  tenantId: string;
  filePath: string;
  mimeType: string;
  useQueue?: boolean;
}

export async function triggerArtifactGeneration(options: TriggerOptions) {
  const { contractId, tenantId, filePath, mimeType } = options;
  
  console.log(`🚀 Triggering artifact generation for contract: ${contractId}`);
  console.log(`   File: ${filePath}`);
  console.log(`   Type: ${mimeType}`);
  
  // Spawn a separate Node process to avoid blocking/crashing the main server
  const workerScript = join(process.cwd(), '../../scripts/generate-artifacts-worker.mjs');
  const worker = spawn('npx', ['tsx', workerScript, contractId, tenantId, filePath, mimeType], {
    detached: true,
    stdio: 'inherit'
  });
  
  worker.unref(); // Allow parent to exit independently
  
  console.log(`✅ Artifact generation worker spawned for contract: ${contractId}`);
  
  // Return immediately so upload response is not blocked
  return { success: true, contractId, status: 'processing' };
}

export async function triggerProcessing(contractId: string, options?: any) {
  // Trigger processing workflow
  console.log(`Triggering processing for contract: ${contractId}`, options);
  return { success: true, jobId: 'job-' + Date.now() };
}
