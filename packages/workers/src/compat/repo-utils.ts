import queueServiceModule from '@repo/utils/queue/queue-service';
import contractQueueModule from '@repo/utils/queue/contract-queue';
import circuitBreakerModule from '@repo/utils/patterns/circuit-breaker';
import retryModule from '@repo/utils/patterns/retry';
import redisEventBusModule from '@repo/utils/events/redis-event-bus';
import semanticChunkerModule from '@repo/utils/rag/semantic-chunker';
import adaptiveChunkerModule from '@repo/utils/rag/adaptive-chunker';
import distributedCacheModule from '@repo/utils/cache/distributed-cache';

const queueService = queueServiceModule as typeof import('@repo/utils/queue/queue-service');
const contractQueue = contractQueueModule as typeof import('@repo/utils/queue/contract-queue');
const circuitBreaker = circuitBreakerModule as typeof import('@repo/utils/patterns/circuit-breaker');
const retryHelpers = retryModule as typeof import('@repo/utils/patterns/retry');
const redisEventBusExports = redisEventBusModule as typeof import('@repo/utils/events/redis-event-bus');
const semanticChunker = semanticChunkerModule as typeof import('@repo/utils/rag/semantic-chunker');
const adaptiveChunker = adaptiveChunkerModule as typeof import('@repo/utils/rag/adaptive-chunker');
const distributedCache = distributedCacheModule as typeof import('@repo/utils/cache/distributed-cache');

export const getQueueService = queueService.getQueueService;
export const QUEUE_NAMES = contractQueue.QUEUE_NAMES;
export const JOB_NAMES = contractQueue.JOB_NAMES;
export const QUEUE_PRIORITY = contractQueue.QUEUE_PRIORITY;

export const CircuitBreaker = circuitBreaker.CircuitBreaker;
export const CircuitState = circuitBreaker.CircuitState;
export const CircuitBreakerError = circuitBreaker.CircuitBreakerError;

export const retry = retryHelpers.retry;
export const retryOpenAI = retryHelpers.retryOpenAI;
export const retryStorage = retryHelpers.retryStorage;

export const redisEventBus = redisEventBusExports.redisEventBus;
export const RedisEvents = redisEventBusExports.RedisEvents;
export const publishJobProgress = redisEventBusExports.publishJobProgress;

export const semanticChunk = semanticChunker.semanticChunk;
export const adaptiveChunk = adaptiveChunker.adaptiveChunk;

export const ocrCache = distributedCache.ocrCache;

export type { JobType } from '@repo/utils/queue/queue-service';
export type {
  AgentOrchestrationJobData,
  GenerateArtifactsJobData,
  IndexContractJobData,
  ProcessContractJobData,
  SendWebhookJobData,
} from '@repo/utils/queue/contract-queue';
export type { SemanticChunk } from '@repo/utils/rag/semantic-chunker';
export type { EmbedFn } from '@repo/utils/rag/adaptive-chunker';