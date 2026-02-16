/**
 * Database Sync API
 * Manages sync schedules for periodic database imports
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import {
  getSyncSchedules,
  getSyncSchedule,
  upsertSyncSchedule,
  deleteSyncSchedule,
  updateSyncStats,
  type SyncSchedule as _SyncSchedule,
  type SyncRun,
} from '@/lib/import/sync-schedule';
import {
  importFromExternalDatabase,
  type ExternalDatabaseConfig,
  type ContractMapping,
} from '@/lib/import/external-database-connector';

interface CreateScheduleRequest {
  name: string;
  config: ExternalDatabaseConfig;
  tableName: string;
  mapping: ContractMapping;
  options: {
    triggerProcessing: boolean;
    batchSize: number;
    incrementalField?: string;
  };
  schedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
    hour?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
}

/**
 * GET /api/import/sync - List all sync schedules
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const scheduleId = request.nextUrl.searchParams.get('id');

  if (scheduleId) {
    const schedule = await getSyncSchedule(tenantId, scheduleId);
    if (!schedule) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
    }
    return createSuccessResponse(ctx, schedule);
  }

  const schedules = await getSyncSchedules(tenantId);
  return createSuccessResponse(ctx, { schedules });
});

/**
 * POST /api/import/sync - Create schedule or run sync
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const body = await request.json();
  const action = body.action || 'create';

    switch (action) {
      case 'create': {
        const scheduleData = body as CreateScheduleRequest;
        
        if (!scheduleData.name || !scheduleData.config || !scheduleData.tableName) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Missing required fields: name, config, tableName', 400);
        }

        const schedule = await upsertSyncSchedule(tenantId, {
          name: scheduleData.name,
          config: {
            type: scheduleData.config.type,
            host: scheduleData.config.host,
            port: scheduleData.config.port,
            database: scheduleData.config.database,
            username: scheduleData.config.username,
            ssl: scheduleData.config.ssl,
            schema: scheduleData.config.schema,
          },
          tableName: scheduleData.tableName,
          mapping: scheduleData.mapping as Record<string, string> || {},
          options: {
            triggerProcessing: scheduleData.options?.triggerProcessing ?? true,
            batchSize: scheduleData.options?.batchSize || 100,
            incrementalField: scheduleData.options?.incrementalField,
          },
          schedule: {
            enabled: scheduleData.schedule?.enabled ?? false,
            frequency: scheduleData.schedule?.frequency || 'manual',
            hour: scheduleData.schedule?.hour,
            dayOfWeek: scheduleData.schedule?.dayOfWeek,
            dayOfMonth: scheduleData.schedule?.dayOfMonth,
          },
        });

        return createSuccessResponse(ctx, { success: true, schedule });
      }

      case 'run': {
        const { scheduleId } = body;
        
        if (!scheduleId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'scheduleId required', 400);
        }

        const schedule = await getSyncSchedule(tenantId, scheduleId);
        if (!schedule) {
          return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
        }

        // Create sync run record
        const run: SyncRun = {
          id: `run_${Date.now()}`,
          scheduleId,
          tenantId,
          status: 'running',
          startedAt: new Date(),
          recordsProcessed: 0,
          recordsImported: 0,
          recordsFailed: 0,
          errors: [],
        };

        try {
          // Note: incremental filtering is handled within importFromExternalDatabase

          // Run the import
          const result = await importFromExternalDatabase(
            schedule.config as ExternalDatabaseConfig,
            schedule.tableName,
            schedule.mapping as ContractMapping,
            {
              tenantId,
              batchSize: schedule.options.batchSize,
              triggerProcessing: schedule.options.triggerProcessing,
            }
          );

          run.status = result.failed === 0 ? 'success' : 'partial';
          run.completedAt = new Date();
          run.recordsProcessed = result.totalRecords;
          run.recordsImported = result.imported;
          run.recordsFailed = result.failed;
          run.errors = result.errors;

          // Update stats
          await updateSyncStats(tenantId, scheduleId, run);

          return createSuccessResponse(ctx, {
            success: true,
            run,
            result,
          });
        } catch (error) {
          run.status = 'failed';
          run.completedAt = new Date();
          run.errors = [{ row: 0, error: 'Unknown error' }];

          await updateSyncStats(tenantId, scheduleId, run);

          return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Sync failed', 500);
        }
      }

      case 'toggle': {
        const { scheduleId, enabled } = body;
        
        if (!scheduleId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'scheduleId required', 400);
        }

        const schedule = await getSyncSchedule(tenantId, scheduleId);
        if (!schedule) {
          return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
        }

        // Update the schedule's enabled status
        await upsertSyncSchedule(tenantId, {
          ...schedule,
          schedule: {
            ...schedule.schedule,
            enabled: enabled ?? !schedule.schedule.enabled,
          },
        });

        return createSuccessResponse(ctx, { success: true, enabled: enabled ?? !schedule.schedule.enabled });
      }

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action. Use: create, run, or toggle', 400);
    }
});

/**
 * DELETE /api/import/sync - Delete a sync schedule
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const scheduleId = request.nextUrl.searchParams.get('id');

  if (!scheduleId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Schedule ID required', 400);
  }

  const deleted = await deleteSyncSchedule(tenantId, scheduleId);
  
  if (!deleted) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
  }

  return createSuccessResponse(ctx, { success: true });
});
