/**
 * Performance Monitoring API
 * Provides performance metrics and optimization insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { performanceOptimizationService } from 'data-orchestration/services';
import { queryOptimizerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const perfService = new performanceOptimizationService(prisma);
    const queryOptimizer = new queryOptimizerService(prisma);

    // Get cache statistics
    const cacheStats = perfService.getCacheStats();

    // Get index usage statistics
    const indexStats = await queryOptimizer.getIndexUsageStats();

    // Get connection pool metrics
    const poolMetrics = await perfService.optimizeConnectionPool();

    // Get query performance recommendations
    const indexSuggestions = await queryOptimizer.suggestMissingIndexes(ctx.tenantId);

    // Get database statistics
    const dbStats = await prisma.$queryRaw<Array<{
      table_name: string;
      row_count: bigint;
      total_size: string;
      index_size: string;
    }>>`
      SELECT 
        schemaname || '.' || tablename as table_name,
        n_live_tup as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND tablename IN ('rate_card_entries', 'rate_card_suppliers', 'benchmark_snapshots', 'rate_savings_opportunities')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;

    return createSuccessResponse(ctx, {
      cache: cacheStats,
      indexes: indexStats,
      connectionPool: poolMetrics,
      indexSuggestions,
      database: dbStats.map(stat => ({
        table: stat.table_name,
        rowCount: Number(stat.row_count),
        totalSize: stat.total_size,
        indexSize: stat.index_size,
      })),
    });
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
    if (!ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await request.json();
    const { action } = body;

    const perfService = new performanceOptimizationService(prisma);

    switch (action) {
      case 'invalidate_cache':
        const pattern = body.pattern || 'rate-card:*';
        const invalidated = await perfService.invalidateCache(pattern);
        return createSuccessResponse(ctx, { 
          success: true, 
          invalidated,
          message: `Invalidated ${invalidated} cache entries` 
        });

      case 'preload_data':
        await perfService.preloadCommonData(ctx.tenantId);
        return createSuccessResponse(ctx, { message: 'Common data preloaded into cache' });

      case 'refresh_materialized_views':
        await prisma.$executeRaw`SELECT refresh_market_intelligence_summary()`;
        return createSuccessResponse(ctx, { message: 'Materialized views refreshed' });

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action', 400);
    }
  });
