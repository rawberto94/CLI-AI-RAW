/**
 * Redis-based Event Bus
 * 
 * Provides cross-process event communication via Redis Pub/Sub.
 * Workers can publish events that SSE connections receive in real-time.
 */

import Redis from 'ioredis';

// Event types matching the data-orchestration event-bus
export enum RedisEvents {
  // Contract Events
  CONTRACT_CREATED = 'contract:created',
  CONTRACT_UPDATED = 'contract:updated',
  CONTRACT_DELETED = 'contract:deleted',
  CONTRACT_METADATA_UPDATED = 'contract:metadata:updated',
  
  // Artifact Events
  ARTIFACT_CREATED = 'artifact:created',
  ARTIFACT_UPDATED = 'artifact:updated',
  ARTIFACT_GENERATED = 'artifact:generated',
  
  // Processing Events
  PROCESSING_STARTED = 'processing:started',
  PROCESSING_PROGRESS = 'processing:progress',
  PROCESSING_COMPLETED = 'processing:completed',
  PROCESSING_FAILED = 'processing:failed',
  
  // Job Events
  JOB_CREATED = 'job:created',
  JOB_PROGRESS = 'job:progress',
  JOB_STATUS_CHANGED = 'job:status:changed',
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
  
  // RAG Events
  RAG_INDEXING_STARTED = 'rag:indexing:started',
  RAG_INDEXING_COMPLETED = 'rag:indexing:completed',
  RAG_INDEXING_FAILED = 'rag:indexing:failed',
  
  // Rate Card Events
  RATE_CARD_CREATED = 'ratecard:created',
  RATE_CARD_UPDATED = 'ratecard:updated',
  
  // Benchmark Events
  BENCHMARK_CALCULATED = 'benchmark:calculated',
}

export interface EventPayload {
  event: RedisEvents | string;
  data: {
    contractId?: string;
    tenantId?: string;
    userId?: string;
    jobId?: string;
    progress?: number;
    status?: string;
    message?: string;
    artifacts?: string[];
    [key: string]: unknown;
  };
  timestamp: string;
  source?: string;
}

const CHANNEL_PREFIX = 'cli-ai:events';

class RedisEventBus {
  private static instance: RedisEventBus;
  private publisher: InstanceType<typeof Redis> | null = null;
  private subscriber: InstanceType<typeof Redis> | null = null;
  private listeners: Map<string, Set<(payload: EventPayload) => void>> = new Map();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): RedisEventBus {
    if (!RedisEventBus.instance) {
      RedisEventBus.instance = new RedisEventBus();
    }
    return RedisEventBus.instance;
  }

  private getRedisUrl(): string {
    return process.env.REDIS_URL || 
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
  }

  /**
   * Initialize Redis connections for pub/sub
   */
  public async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = (async () => {
      try {
        const redisUrl = this.getRedisUrl();
        
        // Create separate connections for pub and sub (required by Redis)
        this.publisher = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          lazyConnect: true,
        });

        this.subscriber = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          lazyConnect: true,
        });

        await Promise.all([
          this.publisher.connect(),
          this.subscriber.connect(),
        ]);

        // Setup message handler
        this.subscriber.on('message', (channel: string, message: string) => {
          try {
            const payload = JSON.parse(message) as EventPayload;
            const eventListeners = this.listeners.get(payload.event);
            const wildcardListeners = this.listeners.get('*');
            
            eventListeners?.forEach(listener => {
              try {
                listener(payload);
              } catch (err) {
                console.error('[RedisEventBus] Listener error:', err);
              }
            });
            
            wildcardListeners?.forEach(listener => {
              try {
                listener(payload);
              } catch (err) {
                console.error('[RedisEventBus] Wildcard listener error:', err);
              }
            });
          } catch (err) {
            console.error('[RedisEventBus] Failed to parse message:', err);
          }
        });

        // Subscribe to main channel
        await this.subscriber.subscribe(CHANNEL_PREFIX);
        
        this.isConnected = true;
        console.log('[RedisEventBus] Connected to Redis');
      } catch (err) {
        console.error('[RedisEventBus] Failed to connect:', err);
        this.isConnected = false;
        throw err;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Publish an event to all subscribers
   */
  public async publish(event: RedisEvents | string, data: EventPayload['data'], source?: string): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      // Try to connect if not connected
      try {
        await this.connect();
      } catch {
        console.warn('[RedisEventBus] Not connected, event not published:', event);
        return;
      }
    }

    const payload: EventPayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      source: source || 'unknown',
    };

    try {
      await this.publisher!.publish(CHANNEL_PREFIX, JSON.stringify(payload));
    } catch (err) {
      console.error('[RedisEventBus] Failed to publish:', err);
    }
  }

  /**
   * Subscribe to events
   */
  public on(event: RedisEvents | string | '*', listener: (payload: EventPayload) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Remove a specific listener
   */
  public off(event: RedisEvents | string, listener: (payload: EventPayload) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe(CHANNEL_PREFIX);
      await this.subscriber.quit();
      this.subscriber = null;
    }
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    this.isConnected = false;
    this.connectionPromise = null;
    console.log('[RedisEventBus] Disconnected');
  }

  /**
   * Check if connected
   */
  public get connected(): boolean {
    return this.isConnected;
  }
}

export const redisEventBus = RedisEventBus.getInstance();

/**
 * Helper to publish processing events from workers
 */
export async function publishProcessingEvent(
  event: RedisEvents,
  contractId: string,
  tenantId: string,
  data: Record<string, unknown> = {},
  source = 'worker'
): Promise<void> {
  await redisEventBus.publish(event, {
    contractId,
    tenantId,
    ...data,
  }, source);
}

/**
 * Helper to publish job progress
 */
export async function publishJobProgress(
  jobId: string,
  contractId: string,
  tenantId: string,
  progress: number,
  status: string,
  message?: string
): Promise<void> {
  await redisEventBus.publish(RedisEvents.JOB_PROGRESS, {
    jobId,
    contractId,
    tenantId,
    progress,
    status,
    message,
  }, 'worker');
}
