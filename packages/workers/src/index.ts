// CRITICAL: Load environment FIRST - this import must be at the very top
// because other modules read DATABASE_URL at module load time
import './env';

import { getQueueService } from '../../utils/src/queue/queue-service';
import { registerOCRArtifactWorker } from './ocr-artifact-worker';
import { registerArtifactGeneratorWorker } from './artifact-generator';
import { registerWebhookWorker } from './webhook-worker';
import { registerRAGIndexingWorker } from './rag-indexing-worker';
import { registerMetadataExtractionWorker } from './metadata-extraction-worker';
import { registerCategorizationWorker } from './categorization-worker';
import pino from 'pino';

const logger = pino({
  name: 'workers',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
});

/**
 * Initialize queue service and start workers
 */
async function startWorkers() {
  logger.info('🚀 Starting background workers...');

  try {
    // Initialize queue service
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
    };

    logger.info({ redis: redisConfig.host }, 'Connecting to Redis...');

    // Initialize queue service
    getQueueService({ connection: redisConfig });

    // Register workers
    logger.info('Registering workers...');
    
    const ocrArtifactWorker = registerOCRArtifactWorker();
    const artifactWorker = registerArtifactGeneratorWorker();
    const webhookWorker = registerWebhookWorker();
    const ragWorker = registerRAGIndexingWorker();
    const metadataWorker = registerMetadataExtractionWorker();
    const categorizationWorker = registerCategorizationWorker();

    logger.info('✅ All workers registered successfully');
    logger.info({
      workers: [
        'ocr-artifact-processing (contract-processing queue)',
        'artifact-generation',
        'webhook-delivery',
        'rag-indexing (auto-embeddings)',
        'metadata-extraction (AI metadata)',
        'categorization (AI classification)',
      ],
    }, 'Active workers');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal, closing workers...');

      await Promise.all([
        ocrArtifactWorker.close(),
        artifactWorker.close(),
        webhookWorker.close(),
        ragWorker.close(),
        metadataWorker.close(),
        categorizationWorker.close(),
      ]);

      const queueService = getQueueService();
      await queueService.close();

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
