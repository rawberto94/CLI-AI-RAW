// CRITICAL: Load environment FIRST - this import must be at the very top
// because other modules read DATABASE_URL at module load time
import './env';

// Check if we're in build mode - skip worker initialization
const isBuildTime = process.env.NEXT_BUILD === 'true';

import { getQueueService } from '@repo/utils/queue/queue-service';
import { registerOCRArtifactWorker } from './ocr-artifact-worker';
import { registerArtifactGeneratorWorker } from './artifact-generator';
import { registerWebhookWorker } from './webhook-worker';
import { registerRAGIndexingWorker } from './rag-indexing-worker';
import { registerMetadataExtractionWorker } from './metadata-extraction-worker';
import { registerCategorizationWorker } from './categorization-worker';
import { registerRenewalAlertWorker } from './renewal-alert-worker';
import { registerObligationTrackerWorker } from './obligation-tracker-worker';
import { registerAgentOrchestratorWorker } from './agent-orchestrator-worker';
import { registerAutonomousTriggers, processScheduledTrigger } from './autonomous-scheduler';
import { getMetricsCollector } from './metrics';
import { startHealthServer } from './health-server';
import { getDeadLetterQueueManager } from './dead-letter-queue';
import { getBackpressureHandler, getAllCircuitStats } from './resilience';
import { getRecentSpans } from './observability/opentelemetry';
import pino from 'pino';

// Re-export contract type profiles for use in web app
export * from './contract-type-profiles';

// Re-export Azure Document Intelligence v4.0 service and types
export {
  analyzeLayout,
  analyzeContract,
  analyzeInvoice,
  analyzeRead,
  analyzeWithQueries,
  checkDIHealth,
  isDIConfigured,
  isDIEnabled,
  diMetrics,
  diCostTracker,
} from './azure-document-intelligence';
export type {
  DIAnalyzeResult,
  DIPage,
  DITable,
  DIKeyValuePair,
  DIParagraph,
  DIDocument,
  DIField,
  DIMetadata,
  DIModel,
  ContractExtractionResult,
  ContractParty,
  InvoiceExtractionResult,
  InvoiceLineItem,
} from './azure-document-intelligence';

// Re-export agentic AI agents for use in API routes (excluding ContractType to avoid duplicate export)
export { 
  agentRegistry,
  proactiveValidationAgent,
  smartGapFillingAgent,
  adaptiveRetryAgent,
  workflowSuggestionEngine,
  autonomousDeadlineManager,
  contractHealthMonitor,
  continuousLearningAgent,
  opportunityDiscoveryEngine,
  intelligentSearchAgent,
} from './agents';
export type { BaseAgent } from './agents';

const logger = pino({
  name: 'workers',
  level: isBuildTime ? 'silent' : 'info',
  ...(isBuildTime ? {} : {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
});

/**
 * Initialize queue service and start workers
 */
async function startWorkers() {
  // Skip worker startup during build
  if (isBuildTime) {
    return;
  }
  logger.info('🚀 Starting background workers...');

  try {
    // Initialize queue service
    const redisConfig = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
    };

    logger.info({ redis: redisConfig.host }, 'Connecting to Redis...');

    // Initialize queue service
    getQueueService({ connection: redisConfig });

    // Initialize Dead Letter Queue
    const dlqManager = getDeadLetterQueueManager(redisConfig);
    logger.info('📮 Dead Letter Queue initialized');

    // Initialize backpressure handler for queue management
    const backpressure = getBackpressureHandler({
      highWaterMark: 1000,
      lowWaterMark: 100,
      checkInterval: 5000,
    });
    logger.info('🔄 Backpressure handler initialized');

    // Initialize metrics collector
    const metricsCollector = getMetricsCollector();

    // Start health check server for Kubernetes probes
    const healthPort = parseInt(process.env.HEALTH_PORT || '9090');
    const healthServer = startHealthServer(healthPort);

    // Register workers
    logger.info('Registering workers...');
    
    const ocrArtifactWorker = registerOCRArtifactWorker();
    const artifactWorker = registerArtifactGeneratorWorker();
    const webhookWorker = registerWebhookWorker();
    const ragWorker = registerRAGIndexingWorker();
    const metadataWorker = registerMetadataExtractionWorker();
    const categorizationWorker = registerCategorizationWorker();
    const renewalAlertWorker = registerRenewalAlertWorker();
    const obligationTrackerWorker = registerObligationTrackerWorker();
    const agentOrchestratorWorker = registerAgentOrchestratorWorker();

    // Register workers with metrics collector
    metricsCollector.registerWorker('ocr-artifact', ocrArtifactWorker);
    metricsCollector.registerWorker('artifact-generator', artifactWorker);
    metricsCollector.registerWorker('webhook', webhookWorker);
    metricsCollector.registerWorker('rag-indexing', ragWorker);
    metricsCollector.registerWorker('metadata-extraction', metadataWorker);
    metricsCollector.registerWorker('categorization', categorizationWorker);
    metricsCollector.registerWorker('renewal-alert', renewalAlertWorker);
    metricsCollector.registerWorker('obligation-tracker', obligationTrackerWorker);
    metricsCollector.registerWorker('agent-orchestrator', agentOrchestratorWorker);

    // Register autonomous agent triggers (cron-based)
    try {
      await registerAutonomousTriggers();
      logger.info('🤖 Autonomous agent triggers registered');
    } catch (triggerError) {
      logger.warn({ error: triggerError }, '⚠️ Autonomous triggers failed to register (non-fatal)');
    }

    // Start backpressure monitoring
    backpressure.start();
    logger.info('📊 Backpressure monitoring started');

    logger.info('✅ All workers registered successfully');
    logger.info('📊 Metrics collection enabled');
    logger.info('🛡️ Resilience patterns active: circuit breaker, retry, backpressure');

    // Wire DLQ: move jobs to dead-letter queue when all retries are exhausted
    const workerQueueMap = [
      { worker: ocrArtifactWorker, queue: 'contract-processing' },
      { worker: artifactWorker, queue: 'artifact-generation' },
      { worker: webhookWorker, queue: 'webhook-delivery' },
      { worker: ragWorker, queue: 'rag-indexing' },
      { worker: metadataWorker, queue: 'metadata-extraction' },
      { worker: categorizationWorker, queue: 'contract-categorization' },
      { worker: agentOrchestratorWorker, queue: 'agent-orchestration' },
    ];

    for (const { worker, queue } of workerQueueMap) {
      (worker as any).on('failed', async (job: any, error: Error) => {
        const maxAttempts = job?.opts?.attempts || 3;
        if (job && job.attemptsMade >= maxAttempts) {
          try {
            await dlqManager.moveToDeadLetter(job, error?.message || 'Unknown error', queue);
            logger.warn({ jobId: job.id, queue, attemptsMade: job.attemptsMade, error: error?.message }, '📮 Job moved to Dead Letter Queue after exhausting retries');
          } catch (dlqError) {
            logger.error({ dlqError, jobId: job.id, queue }, 'Failed to move job to DLQ');
          }
        }
      });
    }
    logger.info('📮 DLQ auto-move wired for all workers');
    logger.info({
      workers: [
        'ocr-artifact-processing (contract-processing queue)',
        'artifact-generation',
        'webhook-delivery',
        'rag-indexing (auto-embeddings)',
        'metadata-extraction (AI metadata)',
        'categorization (AI classification)',
        'renewal-alerts (deadline monitoring)',
        'obligation-tracker (SLA & milestone monitoring)',
        'agent-orchestrator (manager agent loop)',
        'autonomous-triggers (cron-based AI agents)',
      ],
      resilience: {
        circuitBreaker: 'enabled',
        retryWithBackoff: 'enabled',
        backpressure: 'enabled',
        distributedTracing: 'enabled',
      },
    }, 'Active workers');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal, closing workers...');

      // Close health server first
      healthServer.close();
      logger.info('Health server closed');

      await Promise.all([
        (ocrArtifactWorker as any).close(),
        (artifactWorker as any).close(),
        (webhookWorker as any).close(),
        (ragWorker as any).close(),
        (metadataWorker as any).close(),
        (categorizationWorker as any).close(),
        (renewalAlertWorker as any).close(),
        (obligationTrackerWorker as any).close(),
        (agentOrchestratorWorker as any).close(),
      ]);

      // Close DLQ
      await dlqManager.close();
      logger.info('Dead Letter Queue closed');

      const queueService = getQueueService();
      await queueService.close();

      // Close Prisma connection
      try {
        const { prisma } = await import('./lib/prisma');
        await prisma.$disconnect();
        logger.info('Database connection closed');
      } catch {
        // Prisma may not be initialized in all configurations
        logger.debug('No Prisma connection to close');
      }

      logger.info('✅ Workers shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.info('✅ Workers started successfully and ready to process jobs');
  } catch (error) {
    logger.error({ 
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined 
    }, '❌ Failed to start workers');
    process.exit(1);
  }
}

// Start workers
startWorkers().catch((error) => {
  logger.error({ 
    error,
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined 
  }, 'Fatal error starting workers');
  process.exit(1);
});
