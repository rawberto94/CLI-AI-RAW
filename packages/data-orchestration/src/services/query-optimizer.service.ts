/**
 * Query Optimizer Service
 * Optimizes database queries for rate card operations
 */

import { PrismaClient, Prisma } from 'clients-db';

export interface QueryPlan {
  query: string;
  estimatedCost: number;
  indexes: string[];
  recommendations: string[];
}

export class QueryOptimizerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Optimize rate card filtering query
   */
  buildOptimizedFilterQuery(filters: {
    supplierName?: string;
    roleStandardized?: string;
    seniority?: string;
    lineOfService?: string;
    country?: string;
    region?: string;
    minRate?: number;
    maxRate?: number;
    startDate?: Date;
    endDate?: Date;
    tenantId: string;
  }): Prisma.RateCardEntryFindManyArgs {
    const where: Prisma.RateCardEntryWhereInput = {
      tenantId: filters.tenantId,
    };

    // Add filters only if provided (avoid unnecessary conditions)
    if (filters.supplierName) {
      where.supplierName = { contains: filters.supplierName, mode: 'insensitive' };
    }

    if (filters.roleStandardized) {
      where.roleStandardized = filters.roleStandardized;
    }

    if (filters.seniority) {
      where.seniority = filters.seniority;
    }

    if (filters.lineOfService) {
      where.lineOfService = filters.lineOfService;
    }

    if (filters.country) {
      where.country = filters.country;
    }

    if (filters.region) {
      where.region = filters.region;
    }

    if (filters.minRate !== undefined || filters.maxRate !== undefined) {
      where.dailyRateUSD = {};
      if (filters.minRate !== undefined) {
        where.dailyRateUSD.gte = filters.minRate;
      }
      if (filters.maxRate !== undefined) {
        where.dailyRateUSD.lte = filters.maxRate;
      }
    }

    if (filters.startDate || filters.endDate) {
      where.effectiveDate = {};
      if (filters.startDate) {
        where.effectiveDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.effectiveDate.lte = filters.endDate;
      }
    }

    return {
      where,
      select: {
        id: true,
        supplierName: true,
        roleStandardized: true,
        roleOriginal: true,
        seniority: true,
        lineOfService: true,
        country: true,
        region: true,
        dailyRate: true,
        dailyRateUSD: true,
        currency: true,
        effectiveDate: true,
        isNegotiated: true,
        createdAt: true,
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    };
  }

  /**
   * Optimize benchmark cohort query
   */
  buildOptimizedCohortQuery(criteria: {
    roleStandardized: string;
    seniority: string;
    country: string;
    tenantId: string;
    excludeId?: string;
  }): Prisma.RateCardEntryFindManyArgs {
    const where: Prisma.RateCardEntryWhereInput = {
      tenantId: criteria.tenantId,
      roleStandardized: criteria.roleStandardized,
      seniority: criteria.seniority,
      country: criteria.country,
    };

    if (criteria.excludeId) {
      where.id = { not: criteria.excludeId };
    }

    return {
      where,
      select: {
        id: true,
        dailyRateUSD: true,
        effectiveDate: true,
        supplierName: true,
        isNegotiated: true,
      },
      orderBy: {
        dailyRateUSD: 'asc',
      },
    };
  }

  /**
   * Optimize supplier aggregation query
   */
  async getSupplierAggregations(tenantId: string) {
    // Use raw SQL for better performance on aggregations
    const result = await this.prisma.$queryRaw<Array<{
      supplier_name: string;
      avg_rate: number;
      min_rate: number;
      max_rate: number;
      rate_count: bigint;
      country_count: bigint;
      role_count: bigint;
    }>>`
      SELECT 
        supplier_name,
        AVG(daily_rate_usd) as avg_rate,
        MIN(daily_rate_usd) as min_rate,
        MAX(daily_rate_usd) as max_rate,
        COUNT(*) as rate_count,
        COUNT(DISTINCT country) as country_count,
        COUNT(DISTINCT role_standardized) as role_count
      FROM rate_card_entries
      WHERE tenant_id = ${tenantId}
      GROUP BY supplier_name
      ORDER BY avg_rate ASC
    `;

    return result.map(row => ({
      supplierName: row.supplier_name,
      averageRate: Number(row.avg_rate),
      minRate: Number(row.min_rate),
      maxRate: Number(row.max_rate),
      rateCount: Number(row.rate_count),
      countryCount: Number(row.country_count),
      roleCount: Number(row.role_count),
    }));
  }

  /**
   * Optimize best rate query
   */
  async findBestRates(criteria: {
    roleStandardized: string;
    seniority: string;
    tenantId: string;
  }) {
    // Use raw SQL with window functions for efficiency
    const result = await this.prisma.$queryRaw<Array<{
      country: string;
      best_rate: number;
      supplier_name: string;
      entry_id: string;
      effective_date: Date;
    }>>`
      WITH ranked_rates AS (
        SELECT 
          country,
          daily_rate_usd,
          supplier_name,
          id as entry_id,
          effective_date,
          ROW_NUMBER() OVER (PARTITION BY country ORDER BY daily_rate_usd ASC) as rn
        FROM rate_card_entries
        WHERE tenant_id = ${criteria.tenantId}
          AND role_standardized = ${criteria.roleStandardized}
          AND seniority = ${criteria.seniority}
      )
      SELECT 
        country,
        daily_rate_usd as best_rate,
        supplier_name,
        entry_id,
        effective_date
      FROM ranked_rates
      WHERE rn = 1
      ORDER BY best_rate ASC
    `;

    return result.map(row => ({
      country: row.country,
      bestRate: Number(row.best_rate),
      supplierName: row.supplier_name,
      entryId: row.entry_id,
      effectiveDate: row.effective_date,
    }));
  }

  /**
   * Optimize savings opportunity detection query
   */
  async findSavingsOpportunities(tenantId: string, minSavingsPercent: number = 15) {
    // Use CTE for complex calculation
    const result = await this.prisma.$queryRaw<Array<{
      entry_id: string;
      current_rate: number;
      market_median: number;
      savings_percent: number;
      potential_savings: number;
    }>>`
      WITH market_stats AS (
        SELECT 
          role_standardized,
          seniority,
          country,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_rate_usd) as median_rate,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_rate_usd) as p25_rate
        FROM rate_card_entries
        WHERE tenant_id = ${tenantId}
        GROUP BY role_standardized, seniority, country
        HAVING COUNT(*) >= 5
      )
      SELECT 
        e.id as entry_id,
        e.daily_rate_usd as current_rate,
        m.median_rate as market_median,
        ((e.daily_rate_usd - m.median_rate) / m.median_rate * 100) as savings_percent,
        (e.daily_rate_usd - m.median_rate) as potential_savings
      FROM rate_card_entries e
      INNER JOIN market_stats m 
        ON e.role_standardized = m.role_standardized
        AND e.seniority = m.seniority
        AND e.country = m.country
      WHERE e.tenant_id = ${tenantId}
        AND e.daily_rate_usd > m.median_rate * (1 + ${minSavingsPercent / 100})
      ORDER BY potential_savings DESC
    `;

    return result.map(row => ({
      entryId: row.entry_id,
      currentRate: Number(row.current_rate),
      marketMedian: Number(row.market_median),
      savingsPercent: Number(row.savings_percent),
      potentialSavings: Number(row.potential_savings),
    }));
  }

  /**
   * Analyze query performance
   */
  async analyzeQuery(query: string): Promise<QueryPlan> {
    try {
      // Use EXPLAIN to analyze query
      const plan = await this.prisma.$queryRawUnsafe<any[]>(`EXPLAIN (FORMAT JSON) ${query}`);
      
      const planData = plan[0]['QUERY PLAN'][0];
      
      return {
        query,
        estimatedCost: planData.Plan['Total Cost'],
        indexes: this.extractIndexes(planData),
        recommendations: this.generateRecommendations(planData),
      };
    } catch (error) {
      console.error('Query analysis error:', error);
      return {
        query,
        estimatedCost: 0,
        indexes: [],
        recommendations: ['Unable to analyze query'],
      };
    }
  }

  private extractIndexes(planData: any): string[] {
    const indexes: string[] = [];
    
    const extractFromNode = (node: any) => {
      if (node['Index Name']) {
        indexes.push(node['Index Name']);
      }
      if (node.Plans) {
        node.Plans.forEach(extractFromNode);
      }
    };

    extractFromNode(planData.Plan);
    return indexes;
  }

  private generateRecommendations(planData: any): string[] {
    const recommendations: string[] = [];
    
    const checkNode = (node: any) => {
      // Check for sequential scans
      if (node['Node Type'] === 'Seq Scan') {
        recommendations.push(`Consider adding index on ${node['Relation Name']}`);
      }

      // Check for high cost operations
      if (node['Total Cost'] > 1000) {
        recommendations.push('High cost operation detected, consider query optimization');
      }

      if (node.Plans) {
        node.Plans.forEach(checkNode);
      }
    };

    checkNode(planData.Plan);
    return recommendations;
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsageStats() {
    const stats = await this.prisma.$queryRaw<Array<{
      schemaname: string;
      tablename: string;
      indexname: string;
      idx_scan: bigint;
      idx_tup_read: bigint;
      idx_tup_fetch: bigint;
    }>>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('rate_card_entries', 'rate_card_suppliers', 'benchmark_snapshots')
      ORDER BY idx_scan DESC
    `;

    return stats.map(stat => ({
      schema: stat.schemaname,
      table: stat.tablename,
      index: stat.indexname,
      scans: Number(stat.idx_scan),
      tuplesRead: Number(stat.idx_tup_read),
      tuplesFetched: Number(stat.idx_tup_fetch),
    }));
  }

  /**
   * Suggest missing indexes
   */
  async suggestMissingIndexes(tenantId: string) {
    // Analyze common query patterns
    const suggestions: string[] = [];

    // Check if composite indexes exist
    const commonFilters = [
      ['tenant_id', 'role_standardized', 'seniority', 'country'],
      ['tenant_id', 'supplier_name'],
      ['tenant_id', 'effective_date'],
      ['tenant_id', 'daily_rate_usd'],
    ];

    for (const columns of commonFilters) {
      const indexName = `idx_rate_card_entries_${columns.join('_')}`;
      suggestions.push(`CREATE INDEX IF NOT EXISTS ${indexName} ON rate_card_entries(${columns.join(', ')});`);
    }

    return suggestions;
  }
}
