import * as queueService from '@repo/utils/queue/queue-service';
import * as contractQueue from '@repo/utils/queue/contract-queue';
import * as circuitBreaker from '@repo/utils/patterns/circuit-breaker';
import * as retryHelpers from '@repo/utils/patterns/retry';
import * as redisEventBusExports from '@repo/utils/events/redis-event-bus';
import * as semanticChunker from '@repo/utils/rag/semantic-chunker';
import * as adaptiveChunker from '@repo/utils/rag/adaptive-chunker';
import * as distributedCache from '@repo/utils/cache/distributed-cache';

// Preserve the source-module types when picking either the namespace export
// or the runtime CJS-style `default` shape. Casting to the namespace type
// keeps TypeScript happy with strongly-typed function/class re-exports below.
const queueServiceModule = ((queueService as any).default ?? queueService) as typeof queueService;
const contractQueueModule = ((contractQueue as any).default ?? contractQueue) as typeof contractQueue;
const circuitBreakerModule = ((circuitBreaker as any).default ?? circuitBreaker) as typeof circuitBreaker;
const retryModule = ((retryHelpers as any).default ?? retryHelpers) as typeof retryHelpers;
const redisEventBusModule = ((redisEventBusExports as any).default ?? redisEventBusExports) as typeof redisEventBusExports;
const semanticChunkerModule = ((semanticChunker as any).default ?? semanticChunker) as typeof semanticChunker;
const adaptiveChunkerModule = ((adaptiveChunker as any).default ?? adaptiveChunker) as typeof adaptiveChunker;
const distributedCacheModule = ((distributedCache as any).default ?? distributedCache) as typeof distributedCache;

export const getQueueService = queueServiceModule.getQueueService;
export const QUEUE_NAMES = contractQueueModule.QUEUE_NAMES;
export const JOB_NAMES = contractQueueModule.JOB_NAMES;
export const QUEUE_PRIORITY = contractQueueModule.QUEUE_PRIORITY;

export const CircuitBreaker = circuitBreakerModule.CircuitBreaker;
export const CircuitState = circuitBreakerModule.CircuitState;
export const CircuitBreakerError = circuitBreakerModule.CircuitBreakerError;

export const retry = retryModule.retry;
export const retryOpenAI = retryModule.retryOpenAI;
export const retryStorage = retryModule.retryStorage;

export const redisEventBus = redisEventBusModule.redisEventBus;
export const RedisEvents = redisEventBusModule.RedisEvents;
export const publishJobProgress = redisEventBusModule.publishJobProgress;

export const semanticChunk = semanticChunkerModule.semanticChunk;
export const adaptiveChunk = adaptiveChunkerModule.adaptiveChunk;

export const ocrCache = distributedCacheModule.ocrCache;

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