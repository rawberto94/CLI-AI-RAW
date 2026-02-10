/**
 * Contract Source Sync API
 * 
 * Endpoints for triggering and monitoring syncs.
 * 
 * POST /api/contract-sources/sync - Trigger a sync
 * GET /api/contract-sources/sync?sourceId=xxx - Get sync status/history
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId, getTenantContext } from '@/lib/tenant-server';
import { SyncMode } from '@prisma/client';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
const triggerSyncSchema = z.object({
  sourceId: z.string(),
  syncMode: z.nativeEnum(SyncMode).optional(),
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const { tenantId, userId } = await getTenantContext();

  if (!tenantId || !userId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const parsed = triggerSyncSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid request', 400);
  }

  const { sourceId, syncMode } = parsed.data;

  // Verify source exists and belongs to tenant
  const source = await prisma.contractSource.findFirst({
    where: { id: sourceId, tenantId },
  });

  if (!source) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Source not found', 404);
  }

  // Check if already syncing
  if (source.status === 'SYNCING') {
    return createErrorResponse(ctx, 'CONFLICT', 'Sync already in progress', 409);
  }

  // Import sync service and queue
  const { contractSourceSyncService } = await import('@/lib/integrations/sync-service');

  // Start sync (this will also queue for background processing if needed)
  const result = await contractSourceSyncService.startSync(sourceId, tenantId, {
    triggeredBy: `USER:${userId}`,
    syncMode: syncMode,
  });

  return createSuccessResponse(ctx, {
    syncId: result.syncId,
    progress: result.progress,
    duration: result.duration,
    error: result.error,
  });
});

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await ctx.tenantId;
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Sync not found', 404);
    }

    return createSuccessResponse(ctx, {
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

    return createSuccessResponse(ctx, {
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

  return createSuccessResponse(ctx, {
    success: true,
    data: { syncs },
  });
});
