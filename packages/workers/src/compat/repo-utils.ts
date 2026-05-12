import { getQueueService } from '@repo/utils/queue/queue-service';
import { JOB_NAMES, QUEUE_NAMES, QUEUE_PRIORITY } from '@repo/utils/queue/contract-queue';
import { CircuitBreaker, CircuitBreakerError, CircuitState } from '@repo/utils/patterns/circuit-breaker';
import { retry, retryOpenAI, retryStorage } from '@repo/utils/patterns/retry';
import { publishJobProgress, RedisEvents, redisEventBus } from '@repo/utils/events/redis-event-bus';
import { semanticChunk } from '@repo/utils/rag/semantic-chunker';
import { adaptiveChunk } from '@repo/utils/rag/adaptive-chunker';
import { ocrCache } from '@repo/utils/cache/distributed-cache';

export {
  adaptiveChunk,
  CircuitBreaker,
  CircuitBreakerError,
  CircuitState,
  getQueueService,
  JOB_NAMES,
  ocrCache,
  publishJobProgress,
  QUEUE_NAMES,
  QUEUE_PRIORITY,
  redisEventBus,
  RedisEvents,
  retry,
  retryOpenAI,
  retryStorage,
  semanticChunk,
};

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