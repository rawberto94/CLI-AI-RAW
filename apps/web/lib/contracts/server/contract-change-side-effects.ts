/**
 * Contract change side-effects helper
 *
 * Centralizes every cross-cutting action that must happen after a contract
 * (or its metadata/artifacts) is mutated:
 *   - cache invalidation
 *   - real-time event publication
 *   - audit logging
 *   - integration event + webhook emission
 *   - RAG re-index queuing
 *
 * All operations are best-effort and never throw, so a failing cache or
 * webhook cannot break the originating request.
 */

import { auditLog, AuditAction } from '@/lib/security/audit';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { recordIntegrationEvent } from '@/lib/events/integration-events';
import { triggerContractUpdated } from '@/lib/webhook-triggers';
import { semanticCache } from '@/lib/ai/semantic-cache.service';
import { getSemanticCache } from '@/lib/rag/semantic-cache.service';
import { apiCache, contractCache } from '@/lib/cache/etag-cache';
import { deleteCachedByPattern } from '@/lib/cache';
import { getContractQueue } from '@repo/utils/queue/contract-queue';
import {
  queueRAGReindex,
  shouldTriggerRAGReindex,
  type RagTriggerField,
} from '@/lib/rag/reindex-helper';
import { logger } from '@/lib/logger';

export interface ApplyContractChangeSideEffectsOptions {
  tenantId: string;
  contractId: string;
  userId?: string | null;
  /** Human-readable source of the change (e.g. 'api:contracts/[id]/metadata') */
  source: string;
  /** Field keys that changed. Used to decide whether RAG re-indexing is needed. */
  changedFields: string[];
  /** Optional artifact IDs to pass through to the RAG indexing job. */
  artifactIds?: string[];
  /** If provided, an audit log entry is written. */
  audit?: {
    action: AuditAction;
    changes?: Record<string, unknown>;
  };
}

export interface SideEffectsResult {
  ragReindexQueued: boolean;
  realtimePublished: boolean;
}

/**
 * Apply the full side-effect pipeline for a contract change.
 * Never throws.
 */
export async function applyContractChangeSideEffects(
  options: ApplyContractChangeSideEffectsOptions
): Promise<SideEffectsResult> {
  const { tenantId, contractId, userId, source, changedFields, artifactIds, audit } = options;
  const result: SideEffectsResult = {
    ragReindexQueued: false,
    realtimePublished: false,
  };

  // 1. Invalidate caches
  try {
    contractCache.invalidate(`contract:${tenantId}:${contractId}`);
    contractCache.invalidate('contracts:', true);
    apiCache.invalidate('contracts:', true);
    await deleteCachedByPattern('contracts:list:*').catch(() => {});
  } catch (error) {
    logger.warn('Contract cache invalidation failed', { error: (error as Error).message, contractId, source });
  }

  try {
    await semanticCache.invalidate(tenantId, contractId);
  } catch (error) {
    logger.warn('AI semantic cache invalidation failed', { error: (error as Error).message, contractId, source });
  }

  try {
    getSemanticCache().invalidateContract(contractId);
  } catch (error) {
    logger.warn('RAG semantic cache invalidation failed', { error: (error as Error).message, contractId, source });
  }

  // 2. Audit log
  if (audit) {
    try {
      await auditLog({
        action: audit.action,
        resourceType: 'contract',
        resourceId: contractId,
        userId: userId ?? undefined,
        tenantId,
        metadata: audit.changes ? { changes: audit.changes } : undefined,
      });
    } catch (error) {
      logger.warn('Audit log write failed', { error: (error as Error).message, contractId, source });
    }
  }

  // 3. Real-time event
  try {
    await publishRealtimeEvent({
      event: 'contract:updated',
      data: { tenantId, contractId, changedFields, updatedBy: userId },
      source,
    });
    result.realtimePublished = true;
  } catch (error) {
    logger.warn('Realtime event publish failed', { error: (error as Error).message, contractId, source });
  }

  // 4. Integration event + webhook (fire-and-forget)
  try {
    const payload = {
      contractId,
      changedFields,
      updatedBy: userId ?? null,
      source,
    };
    recordIntegrationEvent({
      tenantId,
      eventType: 'contract.updated',
      resourceId: contractId,
      payload,
    }).catch(() => {});
    triggerContractUpdated(tenantId, contractId, payload).catch(() => {});
  } catch (error) {
    logger.warn('Integration/webhook trigger failed', { error: (error as Error).message, contractId, source });
  }

  // 5. RAG re-indexing
  if (shouldTriggerRAGReindex(changedFields)) {
    try {
      const contractQueue = getContractQueue();
      await contractQueue.queueRAGIndexing(
        {
          contractId,
          tenantId,
          artifactIds: artifactIds ?? [],
          metadataOnly: true,
          reason: `${source} updated fields: ${changedFields.filter((f) =>
            ['contractTitle', 'document_title', 'fileName', 'description', 'contract_short_description', 'supplierName', 'clientName', 'external_parties', 'totalValue', 'tcv_amount', 'currency', 'effectiveDate', 'expirationDate', 'startDate', 'endDate', 'start_date', 'end_date', 'contractType', 'status', 'contractCategoryId', 'category', 'tags', 'jurisdiction', 'rawText'].includes(f)
          ).join(', ')}`,
        },
        { priority: 15, delay: 2000 }
      );
      result.ragReindexQueued = true;
    } catch (error) {
      logger.warn('RAG re-index queue failed', { error: (error as Error).message, contractId, source });
    }
  } else if (artifactIds && artifactIds.length > 0) {
    // Artifact-only changes that do not hit metadata trigger fields still need re-indexing.
    try {
      await queueRAGReindex({
        contractId,
        tenantId,
        artifactIds,
        reason: `${source} artifact update`,
      });
      result.ragReindexQueued = true;
    } catch (error) {
      logger.warn('RAG re-index queue failed', { error: (error as Error).message, contractId, source });
    }
  }

  return result;
}
