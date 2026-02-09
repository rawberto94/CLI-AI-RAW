/**
 * Storage Cleanup Cron Job
 * 
 * POST /api/cron/storage-cleanup
 * 
 * Cleans up:
 * - Incomplete chunked uploads (>24 hours old)
 * - Orphan files (files without DB records)
 * - Old artifact versions (>90 days, keeping latest)
 * 
 * Should be called by a cron scheduler (e.g., Vercel Cron, GitHub Actions)
 * Protected by CRON_SECRET
 */

import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse } from '@/lib/api-middleware';
import { runScheduledCleanup } from '@/lib/storage/cleanup-service';
import { goalPersistenceService } from '@repo/workers/agents/goal-persistence-service';

export const maxDuration = 300; // 5 minutes max

export const POST = withCronHandler(async (request, ctx) => {
    // Parse options from request body
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Run storage cleanup
    const storageResult = await runScheduledCleanup(dryRun);

    // Run agent goal cleanup (90 day retention)
    let goalsDeleted = 0;
    try {
      goalsDeleted = await goalPersistenceService.cleanupOldGoals(90);
    } catch {
      // Goal cleanup is optional, continue if it fails
    }

    return createSuccessResponse(ctx, {
      dryRun,
      storage: {
        orphanFilesDeleted: storageResult.orphanFilesDeleted,
        incompleteUploadsDeleted: storageResult.incompleteUploadsDeleted,
        oldVersionsDeleted: storageResult.oldVersionsDeleted,
        bytesFreedMB: (storageResult.bytesFreed / (1024 * 1024)).toFixed(2),
        errors: storageResult.errors,
      },
      goals: {
        oldGoalsDeleted: goalsDeleted,
      },
      timestamp: new Date().toISOString(),
    });
});

// Also allow GET for health checks
export const GET = withCronHandler(async (request, ctx) => {
  return createSuccessResponse(ctx, {
    status: 'ok',
    job: 'storage-cleanup',
    schedule: 'daily',
    lastRun: null, // Could track this in KV/Redis
  });
});
