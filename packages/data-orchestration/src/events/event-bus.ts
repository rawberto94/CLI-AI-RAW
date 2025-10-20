import { Redis } from "ioredis";
import pino from "pino";

const logger = pino({ name: "event-bus" });

export interface EventPayload {
  eventId: string;
  eventType: string;
  tenantId: string;
  timestamp: Date;
  source: string;
  data: any;
  metadata?: {
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    version?: string;
  };
}

export interface EventHandler {
  (payload: EventPayload): Promise<void> | void;
}

export class EventBus {
  private redis: Redis;
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private static instance: EventBus;

  private constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });

    this.redis.on("connect", () => {
      logger.info("Event bus connected to Redis");
    });

    // Set up message handler
    this.redis.on("message", (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });
  }

  static getInstance(redisUrl?: string): EventBus {
    if (!EventBus.instance) {
      const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
      EventBus.instance = new EventBus(url);
    }
    return EventBus.instance;
  }

  /**
   * Publish an event to the event bus
   */
  async publish(
    eventType: string,
    data: any,
    metadata?: EventPayload["metadata"]
  ): Promise<void> {
    try {
      const payload: EventPayload = {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        eventType,
        tenantId: metadata?.userId || "system", // TODO: Get from context
        timestamp: new Date(),
        source: "data-orchestration",
        data,
        metadata,
      };

      const serialized = JSON.stringify(payload);

      // Publish to specific event type channel
      await this.redis.publish(`events:${eventType}`, serialized);

      // Also publish to general events channel for monitoring
      await this.redis.publish("events:all", serialized);

      logger.debug({ eventType, eventId: payload.eventId }, "Event published");
    } catch (error) {
      logger.error({ error, eventType }, "Failed to publish event");
      throw error;
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    try {
      if (!this.subscribers.has(eventType)) {
        this.subscribers.set(eventType, new Set());

        // Subscribe to Redis channel
        await this.redis.subscribe(`events:${eventType}`);
        logger.info({ eventType }, "Subscribed to event type");
      }

      this.subscribers.get(eventType)!.add(handler);
      logger.debug({ eventType }, "Event handler added");
    } catch (error) {
      logger.error({ error, eventType }, "Failed to subscribe to event");
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(eventType: string, handler: EventHandler): Promise<void> {
    try {
      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        handlers.delete(handler);

        if (handlers.size === 0) {
          await this.redis.unsubscribe(`events:${eventType}`);
          this.subscribers.delete(eventType);
          logger.info({ eventType }, "Unsubscribed from event type");
        }
      }
    } catch (error) {
      logger.error({ error, eventType }, "Failed to unsubscribe from event");
    }
  }

  /**
   * Subscribe to all events (for monitoring/debugging)
   */
  async subscribeToAll(handler: EventHandler): Promise<void> {
    await this.subscribe("all", handler);
  }

  /**
   * Handle incoming Redis messages
   */
  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const payload: EventPayload = JSON.parse(message);
      const eventType = channel.replace("events:", "");

      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        // Execute all handlers concurrently
        await Promise.allSettled(
          Array.from(handlers).map(async (handler) => {
            try {
              await handler(payload);
            } catch (error) {
              logger.error(
                { error, eventType, eventId: payload.eventId },
                "Event handler failed"
              );
            }
          })
        );
      }
    } catch (error) {
      logger.error({ error, channel }, "Failed to handle message");
    }
  }

  /**
   * Get event bus statistics
   */
  getStats(): {
    subscribedEvents: string[];
    totalHandlers: number;
    connectionStatus: string;
  } {
    return {
      subscribedEvents: Array.from(this.subscribers.keys()),
      totalHandlers: Array.from(this.subscribers.values()).reduce(
        (sum, handlers) => sum + handlers.size,
        0
      ),
      connectionStatus: this.redis.status,
    };
  }

  /**
   * Alias for subscribe - for compatibility with EventEmitter-style APIs
   */
  on(eventType: string, handler: EventHandler): void {
    this.subscribe(eventType, handler).catch((err) => {
      logger.error({ error: err, eventType }, "Failed to subscribe via on()");
    });
  }

  /**
   * Alias for publish - for compatibility with EventEmitter-style APIs
   */
  emit(eventType: string, data: any): void {
    this.publish(eventType, data).catch((err) => {
      logger.error({ error: err, eventType }, "Failed to publish via emit()");
    });
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    logger.info("Event bus disconnected");
  }
} // Event type constants
export const Events = {
  // Contract lifecycle
  CONTRACT_CREATED: "contract.created",
  CONTRACT_UPDATED: "contract.updated",
  CONTRACT_DELETED: "contract.deleted",
  CONTRACT_VIEWED: "contract.viewed",

  // Processing lifecycle
  PROCESSING_STARTED: "processing.started",
  PROCESSING_STAGE_COMPLETED: "processing.stage.completed",
  PROCESSING_COMPLETED: "processing.completed",
  PROCESSING_FAILED: "processing.failed",
  
  // Job lifecycle
  JOB_CREATED: "job.created",
  JOB_PROGRESS: "job.progress",
  JOB_STATUS_CHANGED: "job.status.changed",
  JOB_ERROR: "job.error",
  JOB_STALLED: "job.stalled",

  // Artifact lifecycle
  ARTIFACT_CREATED: "artifact.created",
  ARTIFACT_UPDATED: "artifact.updated",
  ARTIFACT_DELETED: "artifact.deleted",
  ARTIFACTS_GENERATED: "artifacts.generated",
  
  // Artifact editing events
  ARTIFACT_EDIT_STARTED: "artifact.edit.started",
  ARTIFACT_FIELD_UPDATED: "artifact.field.updated",
  ARTIFACT_BULK_UPDATED: "artifact.bulk.updated",
  ARTIFACT_VALIDATED: "artifact.validated",
  ARTIFACT_VALIDATION_FAILED: "artifact.validation.failed",
  ARTIFACT_PROPAGATION_STARTED: "artifact.propagation.started",
  ARTIFACT_PROPAGATION_COMPLETED: "artifact.propagation.completed",
  ARTIFACT_PROPAGATION_FAILED: "artifact.propagation.failed",
  
  // Rate card specific events
  RATE_CARD_ENTRY_ADDED: "ratecard.entry.added",
  RATE_CARD_ENTRY_UPDATED: "ratecard.entry.updated",
  RATE_CARD_ENTRY_DELETED: "ratecard.entry.deleted",
  RATE_CARD_BULK_EDITED: "ratecard.bulk.edited",

  // RAG events
  RAG_INDEXED: "rag.indexed",
  RAG_INDEXING_FAILED: "rag.indexing.failed",
  RAG_REINDEXED: "rag.reindexed",
  RAG_REMOVED: "rag.removed",

  // Intelligence events
  PATTERN_DETECTED: "intelligence.pattern.detected",
  ANOMALY_DETECTED: "intelligence.anomaly.detected",
  INSIGHT_GENERATED: "intelligence.insight.generated",
  RECOMMENDATION_CREATED: "intelligence.recommendation.created",

  // Rate card events
  RATE_CARD_IMPORTED: "ratecard.imported",
  RATE_CARD_ANALYZED: "ratecard.analyzed",
  BENCHMARK_COMPLETED: "benchmark.completed",
  CONTRACT_INDEXED: "contract.indexed",

  // Taxonomy events
  TAXONOMY_UPDATED: "taxonomy.updated",
  TAG_UPDATED: "taxonomy.tag.updated",
  METADATA_FIELD_UPDATED: "taxonomy.field.updated",
  CONTRACT_METADATA_UPDATED: "contract.metadata.updated",

  // Performance events
  PERFORMANCE_METRICS_UPDATED: "performance.metrics.updated",

  // User activity
  USER_LOGIN: "user.login",
  USER_ACTION: "user.action",

  // System events
  SYSTEM_HEALTH_CHECK: "system.health.check",
  CACHE_INVALIDATED: "system.cache.invalidated",
  ERROR_OCCURRED: "system.error.occurred",
} as const;

export type EventType = (typeof Events)[keyof typeof Events];

// Singleton instance
export const eventBus = EventBus.getInstance();
