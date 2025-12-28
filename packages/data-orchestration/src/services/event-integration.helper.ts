/**
 * Event Integration Helper
 * Simplifies adding event emissions to existing services
 */

import { eventBus, Events } from '../events/event-bus';
import Redis from 'ioredis';
import { cacheInvalidationService } from './cache-invalidation.service';
import { dataLineageTracker } from '../lineage/data-lineage';

const REDIS_EVENTS_CHANNEL = 'cli-ai:events';

let redisPublisher: InstanceType<typeof Redis> | null = null;
let redisPublisherReady = false;
let redisPublisherConnectPromise: Promise<void> | null = null;

function getRedisUrl(): string {
  return (
    process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
  );
}

async function ensureRedisPublisher(): Promise<InstanceType<typeof Redis>> {
  if (redisPublisher && redisPublisherReady) return redisPublisher;
  if (redisPublisherConnectPromise) {
    await redisPublisherConnectPromise;
    if (redisPublisher && redisPublisherReady) return redisPublisher;
  }

  redisPublisherConnectPromise = (async () => {
    try {
      redisPublisher = new Redis(getRedisUrl(), {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
        lazyConnect: true,
      });

      redisPublisher.on('error', () => {
        redisPublisherReady = false;
      });

      redisPublisher.on('close', () => {
        redisPublisherReady = false;
      });

      await redisPublisher.connect();
      redisPublisherReady = true;
    } catch {
      redisPublisherReady = false;
    }
  })();

  await redisPublisherConnectPromise;
  if (!redisPublisher || !redisPublisherReady) {
    throw new Error('Redis publisher not available');
  }
  return redisPublisher;
}

async function publishRealtimeEventToRedis(event: string, data: Record<string, unknown>): Promise<void> {
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
    source: 'data-orchestration',
  };

  try {
    const publisher = await ensureRedisPublisher();
    await publisher.publish(REDIS_EVENTS_CHANNEL, JSON.stringify(payload));
  } catch {
    // Best-effort only
  }
}

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

    // Publish to Redis for cross-process / cross-client real-time updates.
    // Only publish when tenantId is present to avoid cross-tenant leakage.
    const tenantId =
      data &&
      typeof data === 'object' &&
      'tenantId' in (data as Record<string, unknown>) &&
      typeof (data as Record<string, unknown>).tenantId === 'string'
        ? ((data as Record<string, unknown>).tenantId as string)
        : undefined;

    if (tenantId) {
      await publishRealtimeEventToRedis(event, data as Record<string, unknown>);
    }

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
