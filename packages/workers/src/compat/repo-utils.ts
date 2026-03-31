import * as queueService from '@repo/utils/queue/queue-service';
import * as contractQueue from '@repo/utils/queue/contract-queue';
import * as circuitBreaker from '@repo/utils/patterns/circuit-breaker';
import * as retryHelpers from '@repo/utils/patterns/retry';
import * as redisEventBusExports from '@repo/utils/events/redis-event-bus';
import * as semanticChunker from '@repo/utils/rag/semantic-chunker';
import * as adaptiveChunker from '@repo/utils/rag/adaptive-chunker';
import * as distributedCache from '@repo/utils/cache/distributed-cache';

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