/**
 * Memory Monitoring API
 * Provides endpoints for monitoring memory usage and cache statistics
 */

import { NextRequest } from 'next/server';
import { memoryManager } from 'data-orchestration/services';
import { withApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type ApiContext, getApiContext} from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/monitoring/memory
 * Get memory statistics
 */
export const GET = withApiHandler(async (request: NextRequest, ctx) => {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  switch (action) {
    case 'stats':
      return getMemoryStats(ctx);

    case 'system':
      return getSystemMemory(ctx);

    case 'cache':
      return getCacheStats(ctx);

    default:
      return getMemoryStats(ctx);
  }
});

/**
 * POST /api/monitoring/memory
 * Perform memory management actions
 */
export const POST = withApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'cleanup':
      return performCleanup(ctx);

    case 'clear':
      return clearCache(ctx);

    case 'gc':
      return triggerGarbageCollection(ctx);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action specified', 400);
  }
});

/**
 * Get memory statistics
 */
function getMemoryStats(ctx: ApiContext) {
  const stats = memoryManager.getStats();
  
  return createSuccessResponse(ctx, stats);
}

/**
 * Get system memory information
 */
function getSystemMemory(ctx: ApiContext) {
  const memUsage = process.memoryUsage();
  
  return createSuccessResponse(ctx, {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      heapUtilization: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      formatted: {
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        external: formatBytes(memUsage.external),
        rss: formatBytes(memUsage.rss),
      },
  });
}

/**
 * Get cache statistics
 */
function getCacheStats(ctx: ApiContext) {
  const stats = memoryManager.getStats();
  
  return createSuccessResponse(ctx, {
      totalCacheSize: stats.totalCacheSize,
      totalCacheEntries: stats.totalCacheEntries,
      maxCacheSize: stats.maxCacheSize,
      maxCacheEntries: stats.maxCacheEntries,
      cacheUtilization: stats.cacheUtilization,
      oldestEntry: stats.oldestEntry,
      mostAccessedKey: stats.mostAccessedKey,
      leastAccessedKey: stats.leastAccessedKey,
      formatted: {
        totalCacheSize: formatBytes(stats.totalCacheSize),
        maxCacheSize: formatBytes(stats.maxCacheSize),
      },
  });
}

/**
 * Perform cleanup of expired entries
 */
function performCleanup(ctx: ApiContext) {
  const result = memoryManager.cleanupExpired();
  
  return createSuccessResponse(ctx, {
      entriesRemoved: result.entriesRemoved,
      bytesFreed: result.bytesFreed,
      duration: result.duration,
      formatted: {
        bytesFreed: formatBytes(result.bytesFreed),
      },
      message: `Cleaned up ${result.entriesRemoved} expired entries, freed ${formatBytes(result.bytesFreed)}`,
  });
}

/**
 * Clear all cache
 */
function clearCache(ctx: ApiContext) {
  memoryManager.clear();
  
  return createSuccessResponse(ctx, {
      message: 'Cache cleared successfully',
  });
}

/**
 * Trigger garbage collection (if exposed)
 */
function triggerGarbageCollection(ctx: ApiContext) {
  if (global.gc) {
    const before = process.memoryUsage();
    global.gc();
    const after = process.memoryUsage();
    
    const freed = before.heapUsed - after.heapUsed;
    
    return createSuccessResponse(ctx, {
        before: {
          heapUsed: before.heapUsed,
          formatted: formatBytes(before.heapUsed),
        },
        after: {
          heapUsed: after.heapUsed,
          formatted: formatBytes(after.heapUsed),
        },
        freed: {
          bytes: freed,
          formatted: formatBytes(freed),
        },
        message: `Garbage collection completed, freed ${formatBytes(freed)}`,
    });
  } else {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Garbage collection is not exposed. Run with --expose-gc flag.', 400);
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
