/**
 * Performance Monitoring API
 * Provides performance metrics and optimization insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { performanceOptimizationService } from 'data-orchestration/services';
import { queryOptimizerService } from 'data-orchestration/services';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perfService = new performanceOptimizationService(prisma);
    const queryOptimizer = new queryOptimizerService(prisma);

    // Get cache statistics
    const cacheStats = perfService.getCacheStats();

    // Get index usage statistics
    const indexStats = await queryOptimizer.getIndexUsageStats();

    // Get connection pool metrics
    const poolMetrics = await perfService.optimizeConnectionPool();

    // Get query performance recommendations
    const indexSuggestions = await queryOptimizer.suggestMissingIndexes(session.user.tenantId);

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

    return NextResponse.json({
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const perfService = new performanceOptimizationService(prisma);

    switch (action) {
      case 'invalidate_cache':
        const pattern = body.pattern || 'rate-card:*';
        const invalidated = await perfService.invalidateCache(pattern);
        return NextResponse.json({ 
          success: true, 
          invalidated,
          message: `Invalidated ${invalidated} cache entries` 
        });

      case 'preload_data':
        await perfService.preloadCommonData(session.user.tenantId);
        return NextResponse.json({ 
          success: true,
          message: 'Common data preloaded into cache' 
        });

      case 'refresh_materialized_views':
        await prisma.$executeRaw`SELECT refresh_market_intelligence_summary()`;
        return NextResponse.json({ 
          success: true,
          message: 'Materialized views refreshed' 
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to execute performance action' },
      { status: 500 }
    );
  }
}
