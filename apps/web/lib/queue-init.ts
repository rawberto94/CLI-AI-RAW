/**
 * Queue Service Initialization for Next.js App
 * Initializes queue service with Redis connection
 */

import 'server-only';

import { getQueueService } from '../../../packages/utils/src/queue/queue-service';
import pino from 'pino';

const logger = pino({
  name: 'queue-init',
  ...(process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : {}),
});

let queueInitialized = false;

function getRedisConfig() {
  const redisUrl = process.env['REDIS_URL'];

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: process.env['REDIS_HOST'] || parsed.hostname || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] || parsed.port || '6379'),
        password: process.env['REDIS_PASSWORD'] || (parsed.password ? decodeURIComponent(parsed.password) : undefined),
        maxRetriesPerRequest: null,
      };
    } catch (error) {
      logger.warn({ error, redisUrl }, 'Invalid REDIS_URL, falling back to REDIS_HOST/REDIS_PORT');
    }
  }

  return {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379'),
    password: process.env['REDIS_PASSWORD'],
    maxRetriesPerRequest: null,
  };
}

export function initializeQueueService() {
  if (queueInitialized) {
    logger.debug('Queue service already initialized');
    return getQueueService();
  }

  // In production, require explicit REDIS_HOST to avoid silently connecting to
  // localhost:6379 which doesn't exist in Azure Container Apps.
  // Without Redis, the system falls back to inline artifact processing.
  if (process.env.NODE_ENV === 'production' && !process.env['REDIS_HOST'] && !process.env['REDIS_URL']) {
    logger.warn('REDIS_HOST not configured in production — queue service disabled, using inline processing');
    return null;
  }

  try {
    const redisConfig = getRedisConfig();

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

