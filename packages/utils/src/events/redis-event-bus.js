"use strict";
/**
 * Redis-based Event Bus
 *
 * Provides cross-process event communication via Redis Pub/Sub.
 * Workers can publish events that SSE connections receive in real-time.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisEventBus = exports.RedisEvents = void 0;
exports.publishProcessingEvent = publishProcessingEvent;
exports.publishJobProgress = publishJobProgress;
const ioredis_1 = __importDefault(require("ioredis"));
// Event types matching the data-orchestration event-bus
var RedisEvents;
(function (RedisEvents) {
    // Contract Events
    RedisEvents["CONTRACT_CREATED"] = "contract:created";
    RedisEvents["CONTRACT_UPDATED"] = "contract:updated";
    RedisEvents["CONTRACT_DELETED"] = "contract:deleted";
    RedisEvents["CONTRACT_METADATA_UPDATED"] = "contract:metadata:updated";
    // Artifact Events
    RedisEvents["ARTIFACT_CREATED"] = "artifact:created";
    RedisEvents["ARTIFACT_UPDATED"] = "artifact:updated";
    RedisEvents["ARTIFACT_GENERATED"] = "artifact:generated";
    // Processing Events
    RedisEvents["PROCESSING_STARTED"] = "processing:started";
    RedisEvents["PROCESSING_PROGRESS"] = "processing:progress";
    RedisEvents["PROCESSING_COMPLETED"] = "processing:completed";
    RedisEvents["PROCESSING_FAILED"] = "processing:failed";
    // Job Events
    RedisEvents["JOB_CREATED"] = "job:created";
    RedisEvents["JOB_PROGRESS"] = "job:progress";
    RedisEvents["JOB_STATUS_CHANGED"] = "job:status:changed";
    RedisEvents["JOB_COMPLETED"] = "job:completed";
    RedisEvents["JOB_FAILED"] = "job:failed";
    // RAG Events
    RedisEvents["RAG_INDEXING_STARTED"] = "rag:indexing:started";
    RedisEvents["RAG_INDEXING_COMPLETED"] = "rag:indexing:completed";
    RedisEvents["RAG_INDEXING_FAILED"] = "rag:indexing:failed";
    // Rate Card Events
    RedisEvents["RATE_CARD_CREATED"] = "ratecard:created";
    RedisEvents["RATE_CARD_UPDATED"] = "ratecard:updated";
    // Benchmark Events
    RedisEvents["BENCHMARK_CALCULATED"] = "benchmark:calculated";
})(RedisEvents || (exports.RedisEvents = RedisEvents = {}));
const CHANNEL_PREFIX = 'cli-ai:events';
class RedisEventBus {
    static instance;
    publisher = null;
    subscriber = null;
    listeners = new Map();
    isConnected = false;
    connectionPromise = null;
    constructor() { }
    static getInstance() {
        if (!RedisEventBus.instance) {
            RedisEventBus.instance = new RedisEventBus();
        }
        return RedisEventBus.instance;
    }
    getRedisUrl() {
        return process.env.REDIS_URL ||
            `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    }
    /**
     * Initialize Redis connections for pub/sub
     */
    async connect() {
        if (this.isConnected)
            return;
        if (this.connectionPromise)
            return this.connectionPromise;
        this.connectionPromise = (async () => {
            try {
                const redisUrl = this.getRedisUrl();
                // Create separate connections for pub and sub (required by Redis)
                this.publisher = new ioredis_1.default(redisUrl, {
                    maxRetriesPerRequest: 3,
                    retryStrategy: (times) => Math.min(times * 100, 3000),
                    lazyConnect: true,
                });
                this.subscriber = new ioredis_1.default(redisUrl, {
                    maxRetriesPerRequest: 3,
                    retryStrategy: (times) => Math.min(times * 100, 3000),
                    lazyConnect: true,
                });
                await Promise.all([
                    this.publisher.connect(),
                    this.subscriber.connect(),
                ]);
                // Setup message handler
                this.subscriber.on('message', (channel, message) => {
                    try {
                        const payload = JSON.parse(message);
                        const eventListeners = this.listeners.get(payload.event);
                        const wildcardListeners = this.listeners.get('*');
                        eventListeners?.forEach(listener => {
                            try {
                                listener(payload);
                            }
                            catch (err) {
                                console.error('[RedisEventBus] Listener error:', err);
                            }
                        });
                        wildcardListeners?.forEach(listener => {
                            try {
                                listener(payload);
                            }
                            catch (err) {
                                console.error('[RedisEventBus] Wildcard listener error:', err);
                            }
                        });
                    }
                    catch (err) {
                        console.error('[RedisEventBus] Failed to parse message:', err);
                    }
                });
                // Subscribe to main channel
                await this.subscriber.subscribe(CHANNEL_PREFIX);
                this.isConnected = true;
                console.log('[RedisEventBus] Connected to Redis');
            }
            catch (err) {
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
    async publish(event, data, source) {
        if (!this.isConnected || !this.publisher) {
            // Try to connect if not connected
            try {
                await this.connect();
            }
            catch {
                console.warn('[RedisEventBus] Not connected, event not published:', event);
                return;
            }
        }
        const payload = {
            event,
            data,
            timestamp: new Date().toISOString(),
            source: source || 'unknown',
        };
        try {
            await this.publisher.publish(CHANNEL_PREFIX, JSON.stringify(payload));
        }
        catch (err) {
            console.error('[RedisEventBus] Failed to publish:', err);
        }
    }
    /**
     * Subscribe to events
     */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(listener);
        };
    }
    /**
     * Remove a specific listener
     */
    off(event, listener) {
        this.listeners.get(event)?.delete(listener);
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
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
    get connected() {
        return this.isConnected;
    }
}
exports.redisEventBus = RedisEventBus.getInstance();
/**
 * Helper to publish processing events from workers
 */
async function publishProcessingEvent(event, contractId, tenantId, data = {}, source = 'worker') {
    await exports.redisEventBus.publish(event, {
        contractId,
        tenantId,
        ...data,
    }, source);
}
/**
 * Helper to publish job progress
 */
async function publishJobProgress(jobId, contractId, tenantId, progress, status, message) {
    await exports.redisEventBus.publish(RedisEvents.JOB_PROGRESS, {
        jobId,
        contractId,
        tenantId,
        progress,
        status,
        message,
    }, 'worker');
}
