/**
 * Queue Service Initialization for Next.js App
 * Initializes queue service with Redis connection
 */

import { getQueueService } from '../../../packages/utils/dist/queue/queue-service';
import pino from 'pino';

const logger = pino({ name: 'queue-init' });

let queueInitialized = false;

export function initializeQueueService() {
  if (queueInitialized) {
    logger.debug('Queue service already initialized');
    return getQueueService();
  }

  try {
    const redisConfig = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      password: process.env['REDIS_PASSWORD'],
      maxRetriesPerRequest: null,
    };

    logger.info({ redis: `${redisConfig.host}:${redisConfig.port}` }, 'Initializing queue service...');

    const queueService = getQueueService({ connection: redisConfig });

    queueInitialized = true;
    logger.info('✅ Queue service initialized successfully');
    
    return queueService;
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize queue service');
    // Don't throw - allow graceful degradation
    return null;
  }
}

export function getInitializedQueueService() {
  if (!queueInitialized) {
    return initializeQueueService();
  }
  return getQueueService();
}

// Auto-initialize on import (only in Node.js environment)
if (typeof window === 'undefined') {
  initializeQueueService();
}
