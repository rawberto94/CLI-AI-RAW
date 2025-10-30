/**
 * Event Integration Helper
 * Simplifies adding event emissions to existing services
 */

import { eventBus, Events } from '../events/event-bus';
import { cacheInvalidationService } from './cache-invalidation.service';
import { dataLineageTracker } from '../lineage/data-lineage';

export interface EventEmissionConfig {
  event: Events | string;
  data: any;
  cacheTagsToInvalidate?: string[];
  lineage?: {
    sourceType: string;
    sourceId: string;
    targetType?: string;
    targetId?: string;
    operation?: string;
  };
}

/**
 * Emit event with automatic cache invalidation and lineage tracking
 */
export async function emitWithSideEffects(config: EventEmissionConfig): Promise<void> {
  const { event, data, cacheTagsToInvalidate, lineage } = config;

  try {
    // Emit the event
    eventBus.emit(event, data);

    // Invalidate cache if specified
    if (cacheTagsToInvalidate && cacheTagsToInvalidate.length > 0) {
      await cacheInvalidationService.invalidateTags(cacheTagsToInvalidate);
    }

    // Record lineage if specified
    if (lineage && lineage.targetType && lineage.targetId) {
      dataLineageTracker.recordLineage({
        sourceType: lineage.sourceType,
        sourceId: lineage.sourceId,
        targetType: lineage.targetType,
        targetId: lineage.targetId,
        operation: lineage.operation || 'transform',
        metadata: data
      });
    }
  } catch (error) {
    console.error('[EventIntegration] Error emitting event with side effects:', error);
    // Don't throw - we don't want to break the main operation
  }
}

/**
 * Decorator for automatic event emission on method completion
 */
export function EmitEvent(eventConfig: Omit<EventEmissionConfig, 'data'>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Emit event after successful completion
      await emitWithSideEffects({
        ...eventConfig,
        data: { result, args }
      });

      return result;
    };

    return descriptor;
  };
}

/**
 * Helper to emit contract events
 */
export const contractEvents = {
  created: (contractId: string, tenantId: string, contract: any) =>
    emitWithSideEffects({
      event: Events.CONTRACT_CREATED,
      data: { contractId, tenantId, contract },
      cacheTagsToInvalidate: ['contracts', `contract:${contractId}`]
    }),

  updated: (contractId: string, tenantId: string, changes: any) =>
    emitWithSideEffects({
      event: Events.CONTRACT_UPDATED,
      data: { contractId, tenantId, changes },
      cacheTagsToInvalidate: ['contracts', `contract:${contractId}`, 'analytics']
    }),

  metadataUpdated: (contractId: string, tenantId: string, changes: any) =>
    emitWithSideEffects({
      event: Events.CONTRACT_METADATA_UPDATED,
      data: { contractId, tenantId, changes },
      cacheTagsToInvalidate: [`contract:${contractId}`, 'analytics']
    }),

  processingCompleted: (contractId: string, tenantId: string) =>
    emitWithSideEffects({
      event: Events.PROCESSING_COMPLETED,
      data: { contractId, tenantId },
      cacheTagsToInvalidate: [`contract:${contractId}`, 'contracts', 'analytics']
    })
};

/**
 * Helper to emit artifact events
 */
export const artifactEvents = {
  generated: (artifactId: string, contractId: string, type: string, tenantId: string) =>
    emitWithSideEffects({
      event: Events.ARTIFACT_GENERATED,
      data: { artifactId, contractId, type, tenantId },
      cacheTagsToInvalidate: [`contract:${contractId}`, `artifact:${artifactId}`, 'artifacts'],
      lineage: {
        sourceType: 'contract',
        sourceId: contractId,
        targetType: 'artifact',
        targetId: artifactId,
        operation: 'generate'
      }
    }),

  updated: (artifactId: string, contractId: string, changes: any, tenantId: string) =>
    emitWithSideEffects({
      event: Events.ARTIFACT_UPDATED,
      data: { artifactId, contractId, changes, tenantId },
      cacheTagsToInvalidate: [`artifact:${artifactId}`, `contract:${contractId}`, 'artifacts', 'analytics']
    })
};

/**
 * Helper to emit rate card events
 */
export const rateCardEvents = {
  created: (id: string, data: any, tenantId: string) =>
    emitWithSideEffects({
      event: Events.RATE_CARD_CREATED,
      data: { id, ...data, tenantId },
      cacheTagsToInvalidate: [
        'rate-cards',
        'benchmarks',
        `supplier:${data.supplierName}`,
        `role:${data.roleStandardized}`,
        'opportunities'
      ]
    }),

  updated: (id: string, data: any, tenantId: string) =>
    emitWithSideEffects({
      event: Events.RATE_CARD_UPDATED,
      data: { id, ...data, tenantId },
      cacheTagsToInvalidate: [
        'rate-cards',
        `rate-card:${id}`,
        'benchmarks',
        `supplier:${data.supplierName}`,
        `role:${data.roleStandardized}`,
        'opportunities',
        'analytics'
      ]
    }),

  imported: (count: number, tenantId: string, source: string) =>
    emitWithSideEffects({
      event: Events.RATE_CARD_IMPORTED,
      data: { count, tenantId, source },
      cacheTagsToInvalidate: ['rate-cards', 'benchmarks', 'opportunities', 'analytics']
    }),

  extracted: (rateCardId: string, artifactId: string, contractId: string, tenantId: string) =>
    emitWithSideEffects({
      event: 'ratecard:extracted',
      data: { rateCardId, artifactId, contractId, tenantId },
      cacheTagsToInvalidate: ['rate-cards', 'benchmarks'],
      lineage: {
        sourceType: 'artifact',
        sourceId: artifactId,
        targetType: 'rate-card',
        targetId: rateCardId,
        operation: 'extract'
      }
    })
};

/**
 * Helper to emit benchmark events
 */
export const benchmarkEvents = {
  calculated: (benchmarkId: string, type: string, sourceRateCards: string[], tenantId: string) =>
    emitWithSideEffects({
      event: Events.BENCHMARK_CALCULATED,
      data: { benchmarkId, type, sourceRateCards, tenantId },
      cacheTagsToInvalidate: ['benchmarks', `benchmark:${type}`, 'analytics']
    }),

  invalidated: (tenantId: string, reason: string) =>
    emitWithSideEffects({
      event: Events.BENCHMARK_INVALIDATED,
      data: { tenantId, reason },
      cacheTagsToInvalidate: ['benchmarks', 'opportunities', 'analytics']
    })
};

/**
 * Batch emit multiple events
 */
export async function emitBatch(configs: EventEmissionConfig[]): Promise<void> {
  await Promise.all(configs.map(config => emitWithSideEffects(config)));
}
