/**
 * Memory Monitoring API
 * Provides endpoints for monitoring memory usage and cache statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { memoryManager } from 'data-orchestration/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/monitoring/memory
 * Get memory statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        return getMemoryStats();
      
      case 'system':
        return getSystemMemory();
      
      case 'cache':
        return getCacheStats();
      
      default:
        return getMemoryStats();
    }
  } catch (error) {
    console.error('[Memory API] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get memory data',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/memory
 * Perform memory management actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'cleanup':
        return performCleanup();
      
      case 'clear':
        return clearCache();
      
      case 'gc':
        return triggerGarbageCollection();
      
      default:
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_ACTION',
              message: 'Invalid action specified',
            },
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Memory API] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to perform action',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Get memory statistics
 */
function getMemoryStats() {
  const stats = memoryManager.getStats();
  
  return NextResponse.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get system memory information
 */
function getSystemMemory() {
  const memUsage = process.memoryUsage();
  
  return NextResponse.json({
    success: true,
    data: {
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
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const stats = memoryManager.getStats();
  
  return NextResponse.json({
    success: true,
    data: {
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
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Perform cleanup of expired entries
 */
function performCleanup() {
  const result = memoryManager.cleanupExpired();
  
  return NextResponse.json({
    success: true,
    data: {
      entriesRemoved: result.entriesRemoved,
      bytesFreed: result.bytesFreed,
      duration: result.duration,
      formatted: {
        bytesFreed: formatBytes(result.bytesFreed),
      },
      message: `Cleaned up ${result.entriesRemoved} expired entries, freed ${formatBytes(result.bytesFreed)}`,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Clear all cache
 */
function clearCache() {
  memoryManager.clear();
  
  return NextResponse.json({
    success: true,
    data: {
      message: 'Cache cleared successfully',
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trigger garbage collection (if exposed)
 */
function triggerGarbageCollection() {
  if (global.gc) {
    const before = process.memoryUsage();
    global.gc();
    const after = process.memoryUsage();
    
    const freed = before.heapUsed - after.heapUsed;
    
    return NextResponse.json({
      success: true,
      data: {
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
      },
      timestamp: new Date().toISOString(),
    });
  } else {
    return NextResponse.json(
      {
        error: {
          code: 'GC_NOT_AVAILABLE',
          message: 'Garbage collection is not exposed. Run with --expose-gc flag.',
        },
      },
      { status: 400 }
    );
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
