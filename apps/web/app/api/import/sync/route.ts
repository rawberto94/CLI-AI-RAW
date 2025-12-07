/**
 * Database Sync API
 * Manages sync schedules for periodic database imports
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';
import {
  getSyncSchedules,
  getSyncSchedule,
  upsertSyncSchedule,
  deleteSyncSchedule,
  updateSyncStats,
  type SyncSchedule,
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
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const scheduleId = request.nextUrl.searchParams.get('id');

    if (scheduleId) {
      const schedule = await getSyncSchedule(tenantId, scheduleId);
      if (!schedule) {
        return NextResponse.json(
          { error: 'Schedule not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(schedule);
    }

    const schedules = await getSyncSchedules(tenantId);
    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Get sync schedules error:', error);
    return NextResponse.json(
      { error: 'Failed to get schedules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/import/sync - Create schedule or run sync
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json();
    const action = body.action || 'create';

    switch (action) {
      case 'create': {
        const scheduleData = body as CreateScheduleRequest;
        
        if (!scheduleData.name || !scheduleData.config || !scheduleData.tableName) {
          return NextResponse.json(
            { error: 'Missing required fields: name, config, tableName' },
            { status: 400 }
          );
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

        return NextResponse.json({ success: true, schedule });
      }

      case 'run': {
        const { scheduleId } = body;
        
        if (!scheduleId) {
          return NextResponse.json(
            { error: 'scheduleId required' },
            { status: 400 }
          );
        }

        const schedule = await getSyncSchedule(tenantId, scheduleId);
        if (!schedule) {
          return NextResponse.json(
            { error: 'Schedule not found' },
            { status: 404 }
          );
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
          // Build query with incremental filter if configured
          let whereClause = '';
          if (schedule.options.incrementalField && schedule.options.lastSyncValue) {
            whereClause = ` WHERE "${schedule.options.incrementalField}" > '${schedule.options.lastSyncValue}'`;
          }

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

          return NextResponse.json({
            success: true,
            run,
            result,
          });
        } catch (error) {
          run.status = 'failed';
          run.completedAt = new Date();
          run.errors = [{ row: 0, error: error instanceof Error ? error.message : 'Unknown error' }];

          await updateSyncStats(tenantId, scheduleId, run);

          return NextResponse.json(
            {
              success: false,
              run,
              error: error instanceof Error ? error.message : 'Sync failed',
            },
            { status: 500 }
          );
        }
      }

      case 'toggle': {
        const { scheduleId, enabled } = body;
        
        if (!scheduleId) {
          return NextResponse.json(
            { error: 'scheduleId required' },
            { status: 400 }
          );
        }

        const schedule = await getSyncSchedule(tenantId, scheduleId);
        if (!schedule) {
          return NextResponse.json(
            { error: 'Schedule not found' },
            { status: 404 }
          );
        }

        // Update the schedule's enabled status
        await upsertSyncSchedule(tenantId, {
          ...schedule,
          schedule: {
            ...schedule.schedule,
            enabled: enabled ?? !schedule.schedule.enabled,
          },
        });

        return NextResponse.json({ success: true, enabled: enabled ?? !schedule.schedule.enabled });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, run, or toggle' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      {
        error: 'Operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/import/sync - Delete a sync schedule
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const scheduleId = request.nextUrl.searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID required' },
        { status: 400 }
      );
    }

    const deleted = await deleteSyncSchedule(tenantId, scheduleId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sync schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
