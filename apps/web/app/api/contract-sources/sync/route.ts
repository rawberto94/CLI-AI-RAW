/**
 * Contract Source Sync API
 * 
 * Endpoints for triggering and monitoring syncs.
 * 
 * POST /api/contract-sources/sync - Trigger a sync
 * GET /api/contract-sources/sync?sourceId=xxx - Get sync status/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId, getTenantContext } from '@/lib/tenant-server';
import { SyncMode } from '@prisma/client';
import { z } from 'zod';

const triggerSyncSchema = z.object({
  sourceId: z.string(),
  syncMode: z.nativeEnum(SyncMode).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { tenantId, userId } = await getTenantContext();

    if (!tenantId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = triggerSyncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { sourceId, syncMode } = parsed.data;

    // Verify source exists and belongs to tenant
    const source = await prisma.contractSource.findFirst({
      where: { id: sourceId, tenantId },
    });

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      );
    }

    // Check if already syncing
    if (source.status === 'SYNCING') {
      return NextResponse.json(
        { success: false, error: 'Sync already in progress' },
        { status: 409 }
      );
    }

    // Import sync service and queue
    const { contractSourceSyncService } = await import('@/lib/integrations/sync-service');
    
    // Start sync (this will also queue for background processing if needed)
    const result = await contractSourceSyncService.startSync(sourceId, tenantId, {
      triggeredBy: `USER:${userId}`,
      syncMode: syncMode,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        syncId: result.syncId,
        progress: result.progress,
        duration: result.duration,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to trigger sync' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const syncId = searchParams.get('syncId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (syncId) {
      // Get specific sync
      const sync = await prisma.sourceSync.findFirst({
        where: { id: syncId, tenantId },
      });

      if (!sync) {
        return NextResponse.json(
          { success: false, error: 'Sync not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: sync,
      });
    }

    if (sourceId) {
      // Get sync history for a source
      const syncs = await prisma.sourceSync.findMany({
        where: { sourceId, tenantId },
        orderBy: { startedAt: 'desc' },
        take: Math.min(limit, 100),
      });

      // Get current progress if syncing
      const { contractSourceSyncService } = await import('@/lib/integrations/sync-service');
      const progress = contractSourceSyncService.getSyncProgress(sourceId);

      return NextResponse.json({
        success: true,
        data: {
          syncs,
          currentProgress: progress,
        },
      });
    }

    // Get recent syncs across all sources
    const syncs = await prisma.sourceSync.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        source: {
          select: {
            id: true,
            name: true,
            provider: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { syncs },
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
