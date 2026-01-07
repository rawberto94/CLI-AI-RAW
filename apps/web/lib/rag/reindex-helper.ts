/**
 * RAG Re-indexing Helper
 * 
 * Centralized helper for triggering RAG re-indexing across the application.
 * This ensures consistent behavior when contract data is updated.
 */

import { getContractQueue } from '@repo/utils/queue/contract-queue';

/**
 * Fields that should trigger RAG re-indexing when updated
 */
export const RAG_TRIGGER_FIELDS = [
  // Core identification
  'contractTitle',
  'document_title',
  'fileName',
  
  // Description
  'description',
  'contract_short_description',
  
  // Parties
  'supplierName',
  'clientName',
  'external_parties',
  
  // Values
  'totalValue',
  'tcv_amount',
  'currency',
  
  // Dates
  'effectiveDate',
  'expirationDate',
  'startDate',
  'endDate',
  'start_date',
  'end_date',
  
  // Classification
  'contractType',
  'status',
  'contractCategoryId',
  'category',
  
  // Tags and metadata
  'tags',
  'jurisdiction',
  
  // Content
  'rawText',
] as const;

/**
 * Artifact types that should trigger RAG re-indexing when updated
 */
export const RAG_TRIGGER_ARTIFACT_TYPES = [
  'OVERVIEW',
  'CLAUSES',
  'RATES',
  'FINANCIAL',
  'RISK',
  'COMPLIANCE',
] as const;

export type RagTriggerField = typeof RAG_TRIGGER_FIELDS[number];
export type RagTriggerArtifactType = typeof RAG_TRIGGER_ARTIFACT_TYPES[number];

interface QueueRAGReindexOptions {
  contractId: string;
  tenantId: string;
  artifactIds?: string[];
  priority?: number;
  delay?: number;
  reason?: string;
}

/**
 * Queue RAG re-indexing for a contract
 * 
 * This is a non-blocking helper that queues the re-indexing job.
 * Failures are logged but don't throw to avoid breaking the main request.
 */
export async function queueRAGReindex(options: QueueRAGReindexOptions): Promise<boolean> {
  const {
    contractId,
    tenantId,
    artifactIds = [],
    priority = 15,
    delay = 2000, // 2 second delay by default
    reason = 'data update',
  } = options;

  try {
    const contractQueue = getContractQueue();
    await contractQueue.queueRAGIndexing(
      {
        contractId,
        tenantId,
        artifactIds,
      },
      {
        priority,
        delay,
      }
    );
    console.log(`📚 RAG re-indexing queued for contract ${contractId} (${reason})`);
    return true;
  } catch (error) {
    console.error(`Failed to queue RAG re-indexing for ${contractId}:`, error);
    return false;
  }
}

/**
 * Check if any of the updated fields should trigger RAG re-indexing
 */
export function shouldTriggerRAGReindex(updatedFields: string[]): boolean {
  return updatedFields.some(field => 
    RAG_TRIGGER_FIELDS.includes(field as RagTriggerField)
  );
}

/**
 * Check if an artifact type should trigger RAG re-indexing
 */
export function shouldTriggerRAGReindexForArtifact(artifactType: string): boolean {
  return RAG_TRIGGER_ARTIFACT_TYPES.includes(artifactType as RagTriggerArtifactType);
}

/**
 * Queue RAG re-indexing if any trigger fields were updated
 * Returns whether re-indexing was queued
 */
export async function maybeQueueRAGReindex(
  contractId: string,
  tenantId: string,
  updatedFields: string[],
  reason?: string
): Promise<boolean> {
  if (!shouldTriggerRAGReindex(updatedFields)) {
    return false;
  }
  
  return queueRAGReindex({
    contractId,
    tenantId,
    reason: reason || `fields updated: ${updatedFields.filter(f => 
      RAG_TRIGGER_FIELDS.includes(f as RagTriggerField)
    ).join(', ')}`,
  });
}

/**
 * Queue RAG re-indexing for multiple contracts
 */
export async function queueBatchRAGReindex(
  contracts: Array<{ contractId: string; tenantId: string }>,
  reason?: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const contract of contracts) {
    const result = await queueRAGReindex({
      ...contract,
      reason: reason || 'batch update',
      delay: 1000 + (success * 500), // Stagger jobs to avoid overwhelming the queue
    });
    
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}
