// @ts-nocheck
/**
 * Performance Optimization Service
 * Provides caching, query optimization, and performance monitoring
 */

import { PrismaClient } from 'clients-db';
import Redis from 'ioredis';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix: string;
}

export interface QueryOptimizationResult {
  optimized: boolean;
  originalQuery: string;
  optimizedQuery: string;
  estimatedImprovement: number;
}

export class PerformanceOptimizationService {
  private redis: Redis | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private prisma: PrismaClient) {
    // Initialize Redis if available
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }
  }

  /**
   * Cache wrapper for expensive operations
   */
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    config: CacheConfig = { ttl: 3600, prefix: 'rate-card' }
  ): Promise<T> {
    if (!this.redis) {
      return fn();
    }

    const cacheKey = `${config.prefix}:${key}`;

    try {
      // Try to get from cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.cacheHits++;
        return JSON.parse(cached);
      }

      this.cacheMisses++;

      // Execute function and cache result
      const result = await fn();
      await this.redis.setex(cacheKey, config.ttl, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('Cache error:', error);
      return fn();
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateCache(pattern: string): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? (this.cacheHits / total) * 100 : 0,
    };
  }

  /**
   * Optimize benchmark calculation queries
   */
  async optimizeBenchmarkQuery(criteria: {
    roleStandardized: string;
    seniority: string;
    country: string;
    tenantId: string;
  }) {
    // Use optimized query with proper indexes
    return this.prisma.rateCardEntry.findMany({
      where: {
        tenantId: criteria.tenantId,
        roleStandardized: criteria.roleStandardized,
        seniority: criteria.seniority,
        country: criteria.country,
      },
      select: {
        id: true,
        dailyRateUSD: true,
        effectiveDate: true,
        supplierName: true,
      },
      orderBy: {
        dailyRateUSD: 'asc',
      },
    });
  }

  /**
   * Batch load rate cards with optimized query
   */
  async batchLoadRateCards(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    // Use single query instead of multiple
    return this.prisma.rateCardEntry.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        supplier: true,
        benchmarkSnapshots: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Optimize market intelligence aggregation
   */
  async optimizeMarketIntelligenceQuery(criteria: {
    roleStandardized: string;
    seniority: string;
    tenantId: string;
    startDate: Date;
  }) {
    // Use raw SQL for complex aggregations
    const result = await this.prisma.$queryRaw<Array<{
      country: string;
      avg_rate: number;
      median_rate: number;
      min_rate: number;
      max_rate: number;
      count: bigint;
    }>>`
      SELECT 
        country,
        AVG(daily_rate_usd) as avg_rate,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_rate_usd) as median_rate,
        MIN(daily_rate_usd) as min_rate,
        MAX(daily_rate_usd) as max_rate,
        COUNT(*) as count
      FROM rate_card_entries
      WHERE tenant_id = ${criteria.tenantId}
        AND role_standardized = ${criteria.roleStandardized}
        AND seniority = ${criteria.seniority}
        AND effective_date >= ${criteria.startDate}
      GROUP BY country
      HAVING COUNT(*) >= 3
      ORDER BY avg_rate DESC
    `;

    return result.map(row => ({
      country: row.country,
      averageRate: Number(row.avg_rate),
      medianRate: Number(row.median_rate),
      minRate: Number(row.min_rate),
      maxRate: Number(row.max_rate),
      sampleSize: Number(row.count),
    }));
  }

  /**
   * Preload frequently accessed data
   */
  async preloadCommonData(tenantId: string) {
    const cachePromises = [
      // Preload supplier list
      this.withCache(
        `suppliers:${tenantId}`,
        () => this.prisma.rateCardSupplier.findMany({
          where: { tenantId },
          select: { id: true, name: true, tier: true },
        }),
        { ttl: 3600, prefix: 'rate-card' }
      ),

      // Preload role taxonomy
      this.withCache(
        `roles:${tenantId}`,
        () => this.prisma.rateCardEntry.findMany({
          where: { tenantId },
          distinct: ['roleStandardized'],
          select: { roleStandardized: true },
        }),
        { ttl: 3600, prefix: 'rate-card' }
      ),

      // Preload countries
      this.withCache(
        `countries:${tenantId}`,
        () => this.prisma.rateCardEntry.findMany({
          where: { tenantId },
          distinct: ['country'],
          select: { country: true },
        }),
        { ttl: 3600, prefix: 'rate-card' }
      ),
    ];

    await Promise.all(cachePromises);
  }

  /**
   * Monitor query performance
   */
  async monitorQueryPerformance<T>(
    queryName: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }

    return { result, duration };
  }

  /**
   * Optimize database connection pool
   */
  async optimizeConnectionPool() {
    // Check current connection pool status
    const metrics = await this.prisma.$metrics.json();
    
    return {
      poolSize: metrics.counters.find(c => c.key === 'prisma_pool_connections_open')?.value || 0,
      activeConnections: metrics.counters.find(c => c.key === 'prisma_client_queries_active')?.value || 0,
      recommendations: this.getPoolRecommendations(metrics),
    };
  }

  private getPoolRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    const poolSize = metrics.counters.find((c: any) => c.key === 'prisma_pool_connections_open')?.value || 0;
    const activeQueries = metrics.counters.find((c: any) => c.key === 'prisma_client_queries_active')?.value || 0;

    if (poolSize < 5) {
      recommendations.push('Consider increasing connection pool size for better concurrency');
    }

    if (activeQueries > poolSize * 0.8) {
      recommendations.push('Connection pool is near capacity, consider scaling');
    }

    return recommendations;
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
