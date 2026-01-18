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

import { NextRequest, NextResponse } from 'next/server';
import { runScheduledCleanup } from '@/lib/storage/cleanup-service';
import { goalPersistenceService } from '@repo/workers/agents/goal-persistence-service';

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    return NextResponse.json({
      success: true,
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

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Storage cleanup cron failed:', message);
    
    return NextResponse.json(
      { 
        error: 'Cleanup failed', 
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also allow GET for health checks
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'ok',
    job: 'storage-cleanup',
    schedule: 'daily',
    lastRun: null, // Could track this in KV/Redis
  });
}
