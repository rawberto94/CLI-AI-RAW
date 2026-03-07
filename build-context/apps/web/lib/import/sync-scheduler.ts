/**
 * Scheduled Sync Worker
 * 
 * Runs database sync schedules on a cron basis.
 * Should be started with the main worker process or as a separate service.
 */

import { getDueSchedules, updateSyncStats, type SyncRun } from '@/lib/import/sync-schedule';
import { importFromExternalDatabase, type ExternalDatabaseConfig, type ContractMapping } from '@/lib/import/external-database-connector';
import pino from 'pino';

const logger = pino({ name: 'sync-scheduler' });

let isRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;

/**
 * Check and run due sync schedules
 */
async function checkAndRunDueSchedules(): Promise<void> {
  if (isRunning) {
    logger.debug('Sync check already in progress, skipping');
    return;
  }

  isRunning = true;

  try {
    const dueSchedules = await getDueSchedules();
    
    if (dueSchedules.length === 0) {
      logger.debug('No sync schedules due');
      return;
    }

    logger.info({ count: dueSchedules.length }, 'Found due sync schedules');

    for (const schedule of dueSchedules) {
      logger.info({ 
        scheduleId: schedule.id, 
        name: schedule.name,
        frequency: schedule.schedule.frequency,
      }, 'Running scheduled sync');

      const run: SyncRun = {
        id: `run_${Date.now()}`,
        scheduleId: schedule.id,
        tenantId: schedule.tenantId,
        status: 'running',
        startedAt: new Date(),
        recordsProcessed: 0,
        recordsImported: 0,
        recordsFailed: 0,
        errors: [],
      };

      try {
        const result = await importFromExternalDatabase(
          schedule.config as ExternalDatabaseConfig,
          schedule.tableName,
          schedule.mapping as ContractMapping,
          {
            tenantId: schedule.tenantId,
            batchSize: schedule.options.batchSize,
            triggerProcessing: schedule.options.triggerProcessing,
          }
        );

        run.status = result.failed === 0 ? 'success' : 'partial';
        run.completedAt = new Date();
        run.recordsProcessed = result.totalRecords;
        run.recordsImported = result.imported;
        run.recordsFailed = result.failed;
        run.errors = result.errors.slice(0, 100);

        logger.info({
          scheduleId: schedule.id,
          imported: result.imported,
          failed: result.failed,
        }, 'Scheduled sync completed');

      } catch (error) {
        run.status = 'failed';
        run.completedAt = new Date();
        run.errors = [{ 
          row: 0, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }];

        logger.error({ 
          scheduleId: schedule.id, 
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Scheduled sync failed');
      }

      // Update stats
      await updateSyncStats(schedule.tenantId, schedule.id, run);
    }
  } catch (error) {
    logger.error({ error }, 'Error checking sync schedules');
  } finally {
    isRunning = false;
  }
}

/**
 * Start the sync scheduler
 * @param intervalMs Check interval in milliseconds (default: 5 minutes)
 */
export function startSyncScheduler(intervalMs: number = 5 * 60 * 1000): void {
  if (intervalHandle) {
    logger.warn('Sync scheduler already running');
    return;
  }

  logger.info({ intervalMs }, 'Starting sync scheduler');

  // Run immediately on start
  checkAndRunDueSchedules().catch(err => {
    logger.error({ error: err }, 'Initial sync check failed');
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    checkAndRunDueSchedules().catch(err => {
      logger.error({ error: err }, 'Scheduled sync check failed');
    });
  }, intervalMs);
}

/**
 * Stop the sync scheduler
 */
export function stopSyncScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Sync scheduler stopped');
  }
}

/**
 * Manually trigger a sync run
 */
export async function triggerSync(
  scheduleId: string,
  tenantId: string
): Promise<SyncRun | null> {
  const { getSyncSchedule } = await import('@/lib/import/sync-schedule');
  
  const schedule = await getSyncSchedule(tenantId, scheduleId);
  if (!schedule) {
    logger.warn({ scheduleId }, 'Schedule not found');
    return null;
  }

  const run: SyncRun = {
    id: `run_${Date.now()}`,
    scheduleId: schedule.id,
    tenantId: schedule.tenantId,
    status: 'running',
    startedAt: new Date(),
    recordsProcessed: 0,
    recordsImported: 0,
    recordsFailed: 0,
    errors: [],
  };

  try {
    const result = await importFromExternalDatabase(
      schedule.config as ExternalDatabaseConfig,
      schedule.tableName,
      schedule.mapping as ContractMapping,
      {
        tenantId: schedule.tenantId,
        batchSize: schedule.options.batchSize,
        triggerProcessing: schedule.options.triggerProcessing,
      }
    );

    run.status = result.failed === 0 ? 'success' : 'partial';
    run.completedAt = new Date();
    run.recordsProcessed = result.totalRecords;
    run.recordsImported = result.imported;
    run.recordsFailed = result.failed;
    run.errors = result.errors.slice(0, 100);

  } catch (error) {
    run.status = 'failed';
    run.completedAt = new Date();
    run.errors = [{ 
      row: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }];
  }

  await updateSyncStats(tenantId, scheduleId, run);
  return run;
}

// Export for use in worker process
export { checkAndRunDueSchedules };
