/**
 * Orphaned Chunk Cleanup Worker
 *
 * Periodically scans for and removes orphaned upload chunks that were never
 * finalized. This handles cases where:
 * - Client disconnected mid-upload
 * - Finalize request failed after all chunks were uploaded
 * - Session expired but chunks remain in storage
 *
 * Runs as a repeatable BullMQ job (every 30 minutes by default).
 */

import { Worker as BullWorker, Queue as BullQueue } from 'bullmq';
import { getQueueService } from '@repo/utils/queue/queue-service';
import pino from 'pino';

const isBuildTime = process.env.NEXT_BUILD === 'true';

const logger = pino({
  name: 'cleanup-worker',
  level: isBuildTime ? 'silent' : (process.env.LOG_LEVEL || 'info'),
});

// ============================================================================
// Configuration
// ============================================================================

const CLEANUP_CONFIG = {
  /** Queue name for cleanup jobs */
  queueName: 'chunk-cleanup',
  /** How often to run cleanup (ms) — default 30 min */
  repeatEveryMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '1800000', 10),
  /** Age threshold (ms) — chunks older than this are considered orphaned — default 6 hours */
  orphanThresholdMs: parseInt(process.env.CHUNK_ORPHAN_THRESHOLD_MS || '21600000', 10),
  /** Maximum chunks to delete per run to avoid long operations */
  batchSize: parseInt(process.env.CLEANUP_BATCH_SIZE || '100', 10),
  /** S3 bucket for temp chunks */
  tempBucket: process.env.S3_TEMP_BUCKET || process.env.MINIO_BUCKET || 'temp-chunks',
  /** Local temp directory fallback */
  localTempDir: process.env.CHUNK_TEMP_DIR || '/tmp/uploads',
};

// ============================================================================
// S3 Client (lazy init)
// ============================================================================

let s3Client: any = null;

async function getS3Client() {
  if (s3Client) return s3Client;

  const endpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT;
  if (!endpoint) return null;

  try {
    const { S3Client: S3 } = await import('@aws-sdk/client-s3');
    s3Client = new S3({
      endpoint,
      region: process.env.S3_REGION || process.env.MINIO_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || '',
      },
      forcePathStyle: true,
    });
    return s3Client;
  } catch {
    logger.warn('S3 client not available for cleanup');
    return null;
  }
}

// ============================================================================
// Redis Client (lazy init — for session store cleanup)
// ============================================================================

let redisClient: any = null;

async function getRedisClient() {
  if (redisClient) return redisClient;
  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });
    return redisClient;
  } catch {
    return null;
  }
}

// ============================================================================
// Cleanup Logic
// ============================================================================

interface CleanupResult {
  s3ChunksDeleted: number;
  s3SessionsCleaned: number;
  localChunksDeleted: number;
  localSessionsCleaned: number;
  redisSessionsCleaned: number;
  errors: string[];
  durationMs: number;
}

/**
 * Clean up orphaned S3 chunks by listing objects with the temp-chunks/ prefix
 * and deleting those older than the threshold.
 */
async function cleanupS3Chunks(): Promise<{ deleted: number; sessions: number; errors: string[] }> {
  const client = await getS3Client();
  if (!client) return { deleted: 0, sessions: 0, errors: [] };

  const errors: string[] = [];
  let deleted = 0;
  const sessionsToClean = new Set<string>();

  try {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

    const cutoff = new Date(Date.now() - CLEANUP_CONFIG.orphanThresholdMs);
    let continuationToken: string | undefined;

    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: CLEANUP_CONFIG.tempBucket,
        Prefix: 'temp-chunks/',
        MaxKeys: CLEANUP_CONFIG.batchSize,
        ContinuationToken: continuationToken,
      });

      const listing = await client.send(listCmd);
      const toDelete: { Key: string }[] = [];

      for (const obj of listing.Contents || []) {
        if (obj.LastModified && obj.LastModified < cutoff && obj.Key) {
          toDelete.push({ Key: obj.Key });
          // Extract session ID from key pattern: temp-chunks/{sessionId}/chunk-{index}
          const match = obj.Key.match(/^temp-chunks\/([^/]+)\//);
          if (match) sessionsToClean.add(match[1]);
        }
      }

      if (toDelete.length > 0) {
        const deleteCmd = new DeleteObjectsCommand({
          Bucket: CLEANUP_CONFIG.tempBucket,
          Delete: { Objects: toDelete },
        });
        await client.send(deleteCmd);
        deleted += toDelete.length;
        logger.info({ count: toDelete.length }, 'Deleted orphaned S3 chunks');
      }

      continuationToken = listing.IsTruncated ? listing.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err: any) {
    errors.push(`S3 cleanup error: ${err.message}`);
    logger.error({ error: err }, 'S3 chunk cleanup failed');
  }

  return { deleted, sessions: sessionsToClean.size, errors };
}

/**
 * Clean up orphaned local filesystem chunks.
 */
async function cleanupLocalChunks(): Promise<{ deleted: number; sessions: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;
  let sessions = 0;

  try {
    const fs = await import('fs');
    const path = await import('path');

    const tempDir = CLEANUP_CONFIG.localTempDir;
    if (!fs.existsSync(tempDir)) return { deleted: 0, sessions: 0, errors: [] };

    const cutoff = Date.now() - CLEANUP_CONFIG.orphanThresholdMs;
    const sessionDirs = fs.readdirSync(tempDir, { withFileTypes: true });

    for (const dir of sessionDirs) {
      if (!dir.isDirectory()) continue;

      const sessionPath = path.join(tempDir, dir.name);
      const stat = fs.statSync(sessionPath);

      if (stat.mtimeMs < cutoff) {
        // This session directory is older than threshold — remove it
        const files = fs.readdirSync(sessionPath);
        for (const file of files) {
          fs.unlinkSync(path.join(sessionPath, file));
          deleted++;
        }
        fs.rmdirSync(sessionPath);
        sessions++;
        logger.info({ sessionId: dir.name, files: files.length }, 'Cleaned orphaned local session');
      }
    }
  } catch (err: any) {
    errors.push(`Local cleanup error: ${err.message}`);
    logger.error({ error: err }, 'Local chunk cleanup failed');
  }

  return { deleted, sessions, errors };
}

/**
 * Clean up expired Redis upload sessions.
 * Sessions use the key pattern: upload-session:{sessionId}
 * Redis TTL should handle most expirations, but this catches stragglers.
 */
async function cleanupRedisSessions(): Promise<{ cleaned: number; errors: string[] }> {
  const redis = await getRedisClient();
  if (!redis) return { cleaned: 0, errors: [] };

  const errors: string[] = [];
  let cleaned = 0;

  try {
    // Scan for all upload session keys
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'upload-session:*', 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        // Check TTL — if no TTL is set, it's a straggler
        const ttl = await redis.ttl(key);
        if (ttl === -1) {
          // No expiry set — check creation time from session data
          const session = await redis.get(key);
          if (session) {
            try {
              const parsed = JSON.parse(session);
              const createdAt = parsed.createdAt ? new Date(parsed.createdAt).getTime() : 0;
              if (Date.now() - createdAt > CLEANUP_CONFIG.orphanThresholdMs) {
                await redis.del(key);
                cleaned++;
              }
            } catch {
              // Malformed session — delete it
              await redis.del(key);
              cleaned++;
            }
          }
        }
      }
    } while (cursor !== '0');

    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned expired Redis upload sessions');
    }
  } catch (err: any) {
    errors.push(`Redis cleanup error: ${err.message}`);
    logger.error({ error: err }, 'Redis session cleanup failed');
  }

  return { cleaned, errors };
}

/**
 * Main cleanup job handler — orchestrates all cleanup tasks.
 */
async function runCleanup(): Promise<CleanupResult> {
  const start = Date.now();
  logger.info('🧹 Starting orphaned chunk cleanup');

  // Run S3, local, and Redis cleanup concurrently
  const [s3Result, localResult, redisResult] = await Promise.all([
    cleanupS3Chunks(),
    cleanupLocalChunks(),
    cleanupRedisSessions(),
  ]);

  const result: CleanupResult = {
    s3ChunksDeleted: s3Result.deleted,
    s3SessionsCleaned: s3Result.sessions,
    localChunksDeleted: localResult.deleted,
    localSessionsCleaned: localResult.sessions,
    redisSessionsCleaned: redisResult.cleaned,
    errors: [...s3Result.errors, ...localResult.errors, ...redisResult.errors],
    durationMs: Date.now() - start,
  };

  logger.info(result, '🧹 Cleanup completed');
  return result;
}

// ============================================================================
// Worker Registration
// ============================================================================

let cleanupWorker: BullWorker | null = null;
let cleanupQueue: BullQueue | null = null;

export function registerCleanupWorker() {
  if (isBuildTime) return null;

  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };

  // Create the queue and add a repeatable job
  cleanupQueue = new BullQueue(CLEANUP_CONFIG.queueName, {
    connection: redisConfig,
  });

  // Add the repeatable cleanup job
  cleanupQueue.add(
    'orphaned-chunk-cleanup',
    {},
    {
      repeat: { every: CLEANUP_CONFIG.repeatEveryMs },
      removeOnComplete: { count: 10 }, // Keep last 10 results
      removeOnFail: { count: 20 },
    }
  ).catch(err => logger.error({ error: err }, 'Failed to schedule cleanup job'));

  // Create the worker
  cleanupWorker = new BullWorker(
    CLEANUP_CONFIG.queueName,
    async (_job) => {
      return await runCleanup();
    },
    {
      connection: redisConfig,
      concurrency: 1, // Only one cleanup at a time
      limiter: {
        max: 1,
        duration: 60000, // At most 1 job per minute
      },
    }
  );

  cleanupWorker.on('completed', (job, result: CleanupResult) => {
    logger.info({
      jobId: job?.id,
      s3: result.s3ChunksDeleted,
      local: result.localChunksDeleted,
      redis: result.redisSessionsCleaned,
      durationMs: result.durationMs,
    }, '✅ Cleanup job completed');
  });

  cleanupWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, '❌ Cleanup job failed');
  });

  logger.info({
    intervalMs: CLEANUP_CONFIG.repeatEveryMs,
    thresholdMs: CLEANUP_CONFIG.orphanThresholdMs,
  }, '🧹 Cleanup worker registered');

  return cleanupWorker;
}

export function getCleanupWorker() {
  return cleanupWorker;
}

export { runCleanup, CLEANUP_CONFIG };
