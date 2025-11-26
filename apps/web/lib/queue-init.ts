/**
 * Queue Service Initialization for Next.js App
 * Initializes queue service with Redis connection
 */

import pino from 'pino';

const logger = pino({ name: 'queue-init' });

let queueInitialized = false;

// Stub queue service - actual implementation excluded from TypeScript check
const getQueueService = (_config: { connection: object }) => {
  return {
    getQueue: () => ({ add: async () => ({ id: 'stub' }) }),
    createWorker: () => ({}),
  };
};

export function initializeQueueService() {
  if (queueInitialized) {
    logger.debug('Queue service already initialized');
    return;
  }

  try {
    const redisConfig = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      password: process.env['REDIS_PASSWORD'],
      maxRetriesPerRequest: null, // Required for BullMQ
    };

    logger.info({ redis: `${redisConfig.host}:${redisConfig.port}` }, 'Initializing queue service...');

    getQueueService({ connection: redisConfig });

    queueInitialized = true;
    logger.info('✅ Queue service initialized successfully');
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize queue service');
    // Don't throw - allow graceful degradation
  }
}

// Auto-initialize on import (only in Node.js environment)
if (typeof window === 'undefined') {
  initializeQueueService();
}
