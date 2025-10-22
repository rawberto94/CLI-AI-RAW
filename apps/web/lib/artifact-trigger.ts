/**
 * Artifact Trigger
 * Triggers artifact generation and processing
 */

import { PrismaClient } from "@prisma/client";
import { generateRealArtifacts } from "./real-artifact-generator";

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
  
  try {
    // Call the real artifact generator
    await generateRealArtifacts(contractId, tenantId, filePath, mimeType, prisma);
    
    console.log(`✅ Artifact generation completed for contract: ${contractId}`);
    return { success: true, contractId };
  } catch (error) {
    console.error(`❌ Artifact generation failed for contract ${contractId}:`, error);
    throw error;
  }
}

export async function triggerProcessing(contractId: string, options?: any) {
  // Trigger processing workflow
  console.log(`Triggering processing for contract: ${contractId}`, options);
  return { success: true, jobId: 'job-' + Date.now() };
}
