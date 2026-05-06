/**
 * Scheduled Forecast Refresh Worker
 *
 * Runs on a recurring schedule (hourly by default) to refresh
 * predictive analytics forecasts for contracts across all tenants.
 *
 * Uses BullMQ repeatable jobs when Redis is available,
 * otherwise falls back to a simple setInterval scheduler.
 *
 * @version 1.0.0
 */

import dotenv from 'dotenv';
dotenv.config();

type Job<T = unknown> = { id?: string; name: string; data: T; attemptsMade: number };

import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;

import pino from 'pino';

const logger = pino({ name: 'forecast-refresh-worker' });

const REFRESH_INTERVAL_MS = parseInt(process.env.FORECAST_REFRESH_INTERVAL_MS || '3600000', 10); // 1 hour default

interface ForecastRefreshJob {
  tenantId?: string; // If undefined, refresh all tenants
  batchSize?: number;
}

function getRedisConnectionFromUrl(redisUrl: string) {
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

/**
 * Core refresh logic — queries contracts nearing expiration or with stale forecasts,
 * then re-runs predictive analytics and persists results.
 */
async function refreshForecasts(data: ForecastRefreshJob): Promise<{ processed: number; errors: number }> {
  const prisma = getClient();
  let processed = 0;
  let errors = 0;
  const batchSize = data.batchSize || 50;

  try {
    // Find contracts where forecast might be stale
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - REFRESH_INTERVAL_MS);

    const whereClause: Record<string, unknown> = {
      status: { in: ['ACTIVE', 'PENDING', 'PROCESSING', 'COMPLETED'] },
    };
    if (data.tenantId) {
      whereClause.tenantId = data.tenantId;
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        tenantId: true,
        contractType: true,
        totalValue: true,
        expirationDate: true,
        metadata: true,
      },
      take: batchSize,
      orderBy: { updatedAt: 'asc' }, // Oldest-updated first
    });

    logger.info({ count: contracts.length }, 'Refreshing forecasts for contracts');

    for (const contract of contracts) {
      try {
        const meta = (contract.metadata || {}) as Record<string, unknown>;
        const daysToExpiry = contract.expirationDate
          ? Math.ceil((new Date(contract.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 365;

        // Compute basic forecast data
        const renewalProbability = daysToExpiry > 90 ? 0.8 : daysToExpiry > 30 ? 0.5 : 0.2;
        const riskScore = daysToExpiry < 30 ? 80 : daysToExpiry < 90 ? 50 : 20;

        // Note: RateForecast table is for rate-card financial forecasting, not contract renewal forecasting.
        // Contract renewal forecasts are stored directly in contract.metadata for now.

        // Update contract metadata with latest forecast
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            metadata: {
              ...meta,
              lastForecastAt: now.toISOString(),
              renewalProbability,
              predictedRiskScore: riskScore,
            },
          },
        });

        processed++;
      } catch (err) {
        errors++;
        logger.error({ contractId: contract.id, error: err }, 'Failed to refresh forecast');
      }
    }
  } catch (err) {
    logger.error({ error: err }, 'Forecast refresh batch failed');
  }

  logger.info({ processed, errors }, 'Forecast refresh completed');
  return { processed, errors };
}

/**
 * BullMQ worker handler
 */
async function processJob(job: Job<ForecastRefreshJob>): Promise<{ processed: number; errors: number }> {
  logger.info({ jobId: job.id, data: job.data }, 'Starting forecast refresh job');
  return refreshForecasts(job.data);
}

/**
 * Start the worker — attempts BullMQ first, falls back to setInterval
 */
async function start(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const { Worker, Queue } = await import('bullmq');
      const connection = getRedisConnectionFromUrl(redisUrl);

      const queue = new Queue('forecast-refresh', { connection });
      const worker = new Worker('forecast-refresh', processJob as any, {
        connection,
        concurrency: 1,
      });

      // Add repeatable job
      await queue.add(
        'refresh-all',
        { batchSize: 50 },
        {
          repeat: { every: REFRESH_INTERVAL_MS },
          removeOnComplete: { count: 10 },
          removeOnFail: { count: 50 },
        },
      );

      worker.on('completed', (job: any) => {
        logger.info({ jobId: job?.id }, 'Forecast refresh job completed');
      });

      worker.on('failed', (job: any, err: Error) => {
        logger.error({ jobId: job?.id, error: err.message }, 'Forecast refresh job failed');
      });

      logger.info({ interval: REFRESH_INTERVAL_MS }, 'Forecast refresh worker started (BullMQ)');
    } catch (err) {
      logger.warn({ error: err }, 'BullMQ unavailable, falling back to setInterval');
      startInterval();
    }
  } else {
    startInterval();
  }
}

function startInterval(): void {
  logger.info({ interval: REFRESH_INTERVAL_MS }, 'Forecast refresh worker started (setInterval)');
  // Initial run
  refreshForecasts({ batchSize: 50 });
  // Schedule recurring
  setInterval(() => refreshForecasts({ batchSize: 50 }), REFRESH_INTERVAL_MS);
}

// Auto-start when loaded as a standalone worker (ESM compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  start().catch(err => {
    logger.error({ error: err }, 'Failed to start forecast refresh worker');
    process.exit(1);
  });
}

export { refreshForecasts, processJob, start };
