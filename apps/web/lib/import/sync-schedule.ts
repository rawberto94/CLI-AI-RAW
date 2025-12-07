/**
 * Database Sync Configuration
 * Stores sync schedules and connection configs for periodic imports
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface SyncSchedule {
  id: string;
  name: string;
  tenantId: string;
  config: {
    type: 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'mongodb' | 'snowflake' | 'bigquery';
    host: string;
    port: number;
    database: string;
    username: string;
    // Password is encrypted and stored separately
    ssl?: boolean;
    schema?: string;
  };
  tableName: string;
  mapping: Record<string, string>;
  options: {
    triggerProcessing: boolean;
    batchSize: number;
    incrementalField?: string; // Field to use for incremental sync (e.g., updated_at)
    lastSyncValue?: string; // Last value of incremental field
  };
  schedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
    hour?: number; // 0-23 for daily/weekly/monthly
    dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
    dayOfMonth?: number; // 1-31 for monthly
  };
  stats: {
    lastRunAt?: Date;
    lastRunStatus?: 'success' | 'partial' | 'failed';
    lastRunImported?: number;
    lastRunFailed?: number;
    totalImported?: number;
    totalRuns?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncRun {
  id: string;
  scheduleId: string;
  tenantId: string;
  status: 'running' | 'success' | 'partial' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  recordsProcessed: number;
  recordsImported: number;
  recordsFailed: number;
  errors: Array<{ row: number; error: string }>;
  incrementalValue?: string; // Value to use for next sync
}

/**
 * Create or update a sync schedule
 */
export async function upsertSyncSchedule(
  tenantId: string,
  schedule: Omit<SyncSchedule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'stats'>
): Promise<SyncSchedule> {
  // Store in database (using JSON field for now)
  const existing = await prisma.tenantConfig.findUnique({
    where: { tenantId },
  });

  const syncSchedules = (existing?.integrations as Record<string, unknown>)?.syncSchedules || [];
  const scheduleId = `sync_${Date.now()}`;
  
  const newSchedule: SyncSchedule = {
    id: scheduleId,
    tenantId,
    ...schedule,
    stats: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await prisma.tenantConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      integrations: JSON.parse(JSON.stringify({ syncSchedules: [newSchedule] })) as Prisma.InputJsonValue,
    },
    update: {
      integrations: JSON.parse(JSON.stringify({
        ...((existing?.integrations as Record<string, unknown>) || {}),
        syncSchedules: [...(syncSchedules as SyncSchedule[]), newSchedule],
      })) as Prisma.InputJsonValue,
    },
  });

  return newSchedule;
}

/**
 * Get all sync schedules for a tenant
 */
export async function getSyncSchedules(tenantId: string): Promise<SyncSchedule[]> {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
  });

  return ((config?.integrations as Record<string, unknown>)?.syncSchedules || []) as SyncSchedule[];
}

/**
 * Get a specific sync schedule
 */
export async function getSyncSchedule(tenantId: string, scheduleId: string): Promise<SyncSchedule | null> {
  const schedules = await getSyncSchedules(tenantId);
  return schedules.find(s => s.id === scheduleId) || null;
}

/**
 * Delete a sync schedule
 */
export async function deleteSyncSchedule(tenantId: string, scheduleId: string): Promise<boolean> {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
  });

  if (!config) return false;

  const schedules = ((config.integrations as Record<string, unknown>)?.syncSchedules || []) as SyncSchedule[];
  const filtered = schedules.filter(s => s.id !== scheduleId);

  await prisma.tenantConfig.update({
    where: { tenantId },
    data: {
      integrations: JSON.parse(JSON.stringify({
        ...((config.integrations as Record<string, unknown>) || {}),
        syncSchedules: filtered,
      })) as Prisma.InputJsonValue,
    },
  });

  return true;
}

/**
 * Update sync schedule stats after a run
 */
export async function updateSyncStats(
  tenantId: string,
  scheduleId: string,
  run: SyncRun
): Promise<void> {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
  });

  if (!config) return;

  const schedules = ((config.integrations as Record<string, unknown>)?.syncSchedules || []) as SyncSchedule[];
  const updated = schedules.map(s => {
    if (s.id !== scheduleId) return s;
    
    return {
      ...s,
      options: {
        ...s.options,
        lastSyncValue: run.incrementalValue || s.options.lastSyncValue,
      },
      stats: {
        lastRunAt: run.completedAt || run.startedAt,
        lastRunStatus: run.status === 'running' ? 'success' : run.status,
        lastRunImported: run.recordsImported,
        lastRunFailed: run.recordsFailed,
        totalImported: (s.stats.totalImported || 0) + run.recordsImported,
        totalRuns: (s.stats.totalRuns || 0) + 1,
      },
      updatedAt: new Date(),
    };
  });

  await prisma.tenantConfig.update({
    where: { tenantId },
    data: {
      integrations: JSON.parse(JSON.stringify({
        ...((config.integrations as Record<string, unknown>) || {}),
        syncSchedules: updated,
      })) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get schedules that are due to run
 */
export async function getDueSchedules(): Promise<SyncSchedule[]> {
  const now = new Date();
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  const dayOfMonth = now.getUTCDate();

  // Get all tenant configs
  const configs = await prisma.tenantConfig.findMany({
    where: {
      integrations: {
        not: undefined,
      },
    },
  });

  const dueSchedules: SyncSchedule[] = [];

  for (const config of configs) {
    const schedules = ((config.integrations as Record<string, unknown>)?.syncSchedules || []) as SyncSchedule[];
    
    for (const schedule of schedules) {
      if (!schedule.schedule.enabled) continue;

      const lastRun = schedule.stats.lastRunAt ? new Date(schedule.stats.lastRunAt) : null;
      let isDue = false;

      switch (schedule.schedule.frequency) {
        case 'hourly':
          // Run if not run in the last hour
          isDue = !lastRun || (now.getTime() - lastRun.getTime()) > 60 * 60 * 1000;
          break;
        
        case 'daily':
          // Run at specified hour if not run today
          if (schedule.schedule.hour === hour) {
            isDue = !lastRun || lastRun.getUTCDate() !== now.getUTCDate();
          }
          break;
        
        case 'weekly':
          // Run at specified day/hour if not run this week
          if (schedule.schedule.dayOfWeek === dayOfWeek && schedule.schedule.hour === hour) {
            isDue = !lastRun || (now.getTime() - lastRun.getTime()) > 6 * 24 * 60 * 60 * 1000;
          }
          break;
        
        case 'monthly':
          // Run at specified day/hour if not run this month
          if (schedule.schedule.dayOfMonth === dayOfMonth && schedule.schedule.hour === hour) {
            isDue = !lastRun || lastRun.getUTCMonth() !== now.getUTCMonth();
          }
          break;
      }

      if (isDue) {
        dueSchedules.push(schedule);
      }
    }
  }

  return dueSchedules;
}
