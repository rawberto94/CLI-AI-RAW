/**
 * Market Intelligence Service
 * 
 * Provides aggregated market intelligence, trend analysis, and insights
 * for rate cards across different market segments.
 * 
 * @module MarketIntelligenceService
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { subMonths, subYears, format } from 'date-fns';
import { 
  RateCardBenchmarkingEngine, 
  BenchmarkCohortCriteria,
  BenchmarkStatistics,
  TrendAnalysis,
  MarketIntelligence
} from './rate-card-benchmarking.service';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MarketSegmentCriteria {
  roleStandardized?: string;
  seniority?: string;
  country?: string;
  region?: string;
  lineOfService?: string;
  roleCategory?: string;
  periodMonths?: number;
  tenantId: string;
}

export interface TrendingRole {
  role: string;
  seniority: string;
  country: string;
  lineOfService: string;
  currentAverage: number;
  previousAverage: number;
  changeAmount: number;
  changePercent: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  sampleSize: number;
  confidence: number;
}

export interface GeographicComparison {
  role: string;
  seniority: string;
  lineOfService: string;
  byCountry: Array<{
    country: string;
    region: string;
    averageRate: number;
    medianRate: number;
    sampleSize: number;
    percentDifference: number;
    competitorCount: number;
  }>;
  lowestCostCountry: string;
  highestCostCountry: string;
  costSpread: number;
  insights: string[];
}

export interface SupplierRanking {
  supplierId: string;
  supplierName: string;
  supplierTier: string;
  competitivenessScore: number;
  averageRate: number;
  medianRate: number;
  marketPosition: number;
  rateCount: number;
  rolesCovered: number;
  countriesCovered: number;
  linesOfServiceCovered: number;
  rateStability: number;
  recentRateChanges: number;
  rank: number;
}

export interface EmergingTrend {
  type: 'RATE_SPIKE' | 'RATE_DROP' | 'NEW_MARKET' | 'HOT_ROLE' | 'SUPPLIER_ENTRY' | 'SUPPLIER_EXIT';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedRoles?: string[];
  affectedCountries?: string[];
  affectedSuppliers?: string[];
  changePercent?: number;
  detectedAt: Date;
  recommendation: string;
}

export interface MarketSegmentIntelligence {
  segment: {
    role?: string;
    seniority?: string;
    country?: string;
    lineOfService?: string;
  };
  periodStart: Date;
  periodEnd: Date;
  statistics: BenchmarkStatistics;
  trend: TrendAnalysis;
  supplierDistribution: Record<string, number>;
  topSuppliers: Array<{
    name: string;
    averageRate: number;
    sampleSize: number;
  }>;
  bottomSuppliers: Array<{
    name: string;
    averageRate: number;
    sampleSize: number;
  }>;
  insights: string[];
  recommendations: string[];
}

// ============================================================================
// Market Intelligence Service
// ============================================================================

export class MarketIntelligenceService {
  private prisma: PrismaClient;
  private benchmarkingEngine: RateCardBenchmarkingEngine;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);
  }

  // ==========================================================================
  // Market Intelligence Calculation
  // ==========================================================================

  /**
   * Calculate comprehensive market intelligence for a segment
   */
  async calculateMarketIntelligence(
    criteria: MarketSegmentCriteria
  ): Promise<MarketSegmentIntelligence> {
    const periodEnd = new Date();
    const periodStart = subMonths(periodEnd, criteria.periodMonths || 12);

    // Build cohort criteria for benchmarking engine
    const cohortCriteria: BenchmarkCohortCriteria = {
      roleStandardized: criteria.roleStandardized || '',
      seniority: criteria.seniority || '',
      country: criteria.country,
      region: criteria.region,
      lineOfService: criteria.lineOfService,
      periodMonths: criteria.periodMonths || 12,
    };

    // Get market intelligence from benchmarking engine
    const marketIntel = await this.benchmarkingEngine.calculateMarketIntelligence(cohortCriteria);

    // Get bottom suppliers (highest rates)
    const bottomSuppliers = await this.getBottomSuppliers(criteria);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      marketIntel.statistics,
      marketIntel.trend,
      marketIntel.supplierDistribution
    );

    return {
      segment: {
        role: criteria.roleStandardized,
        seniority: criteria.seniority,
        country: criteria.country,
        lineOfService: criteria.lineOfService,
      },
      periodStart,
      periodEnd,
      statistics: marketIntel.statistics,
      trend: marketIntel.trend,
      supplierDistribution: marketIntel.supplierDistribution,
      topSuppliers: marketIntel.topSuppliers,
      bottomSuppliers,
      insights: marketIntel.insights,
      recommendations,
    };
  }

  /**
   * Get bottom suppliers (highest rates) for a segment
   */
  private async getBottomSuppliers(
    criteria: MarketSegmentCriteria
  ): Promise<Array<{ name: string; averageRate: number; sampleSize: number }>> {
    const periodStart = subMonths(new Date(), criteria.periodMonths || 12);

    const where: Prisma.RateCardEntryWhereInput = {
      tenantId: criteria.tenantId,
      effectiveDate: { gte: periodStart },
    };

    if (criteria.roleStandardized) where.roleStandardized = criteria.roleStandardized;
    if (criteria.seniority) where.seniority = criteria.seniority as any;
    if (criteria.country) where.country = criteria.country;
    if (criteria.lineOfService) where.lineOfService = criteria.lineOfService;

    const entries = await this.prisma.rateCardEntry.findMany({
      where,
      select: {
        supplierId: true,
        supplierName: true,
        dailyRateUSD: true,
      },
    });

    // Group by supplier
    const supplierMap = new Map<string, { name: string; rates: number[] }>();
    
    entries.forEach(entry => {
      if (!supplierMap.has(entry.supplierId)) {
        supplierMap.set(entry.supplierId, {
          name: entry.supplierName,
          rates: [],
        });
      }
      supplierMap.get(entry.supplierId)!.rates.push(Number(entry.dailyRateUSD));
    });

    // Calculate averages and return top 5 highest
    return Array.from(supplierMap.values())
      .map(supplier => ({
        name: supplier.name,
        averageRate: supplier.rates.reduce((sum, rate) => sum + rate, 0) / supplier.rates.length,
        sampleSize: supplier.rates.length,
      }))
      .sort((a, b) => b.averageRate - a.averageRate)
      .slice(0, 5);
  }

  /**
   * Generate actionable recommendations based on market data
   */
  private generateRecommendations(
    stats: BenchmarkStatistics,
    trend: TrendAnalysis,
    supplierDistribution: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    // Trend-based recommendations
    if (trend.direction === 'INCREASING' && trend.yearOverYear && trend.yearOverYear > 10) {
      recommendations.push('Consider locking in multi-year contracts to avoid further rate increases');
      recommendations.push('Explore alternative geographies with more stable pricing');
    } else if (trend.direction === 'DECREASING') {
      recommendations.push('Delay new contracts to benefit from declining rates');
      recommendations.push('Renegotiate existing contracts to align with market trends');
    }

    // Supplier diversity recommendations
    const big4Percent = supplierDistribution['BIG_4'] || 0;
    const tier2Percent = supplierDistribution['TIER_2'] || 0;
    
    if (big4Percent > 70) {
      recommendations.push('Diversify supplier base to reduce dependency on Big 4 firms');
      recommendations.push('Evaluate Tier 2 suppliers for potential 20-30% cost savings');
    } else if (tier2Percent > 60) {
      recommendations.push('Current supplier mix is cost-optimized');
    }

    // Rate variability recommendations
    const coefficientOfVariation = stats.standardDeviation / stats.mean;
    if (coefficientOfVariation > 0.25) {
      recommendations.push('High rate variability indicates strong negotiation leverage');
      recommendations.push('Conduct competitive bidding to capture best market rates');
    }

    // Sample size recommendations
    if (stats.sampleSize < 10) {
      recommendations.push('Limited market data - consider expanding supplier panel for better benchmarking');
    }

    return recommendations;
  }

  // ==========================================================================
  // Trending Roles Analysis
  // ==========================================================================

  /**
   * Get trending roles with significant rate changes
   */
  async getTrendingRoles(
    tenantId: string,
    periodMonths: number = 12
  ): Promise<TrendingRole[]> {
    const currentPeriodEnd = new Date();
    const currentPeriodStart = subMonths(currentPeriodEnd, periodMonths);
    const previousPeriodEnd = currentPeriodStart;
    const previousPeriodStart = subMonths(previousPeriodEnd, periodMonths);

    // Get all unique role combinations
    const uniqueCombinations = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      distinct: ['roleStandardized', 'seniority', 'country', 'lineOfService'],
      select: {
        roleStandardized: true,
        seniority: true,
        country: true,
        lineOfService: true,
      },
    });

    const trendingRoles: TrendingRole[] = [];

    for (const combo of uniqueCombinations) {
      // Get current period rates
      const currentRates = await this.prisma.rateCardEntry.findMany({
        where: {
          tenantId,
          roleStandardized: combo.roleStandardized,
          seniority: combo.seniority as any,
          country: combo.country,
          lineOfService: combo.lineOfService,
          effectiveDate: {
            gte: currentPeriodStart,
            lte: currentPeriodEnd,
          },
        },
        select: { dailyRateUSD: true },
      });

      // Get previous period rates
      const previousRates = await this.prisma.rateCardEntry.findMany({
        where: {
          tenantId,
          roleStandardized: combo.roleStandardized,
          seniority: combo.seniority as any,
          country: combo.country,
          lineOfService: combo.lineOfService,
          effectiveDate: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd,
          },
        },
        select: { dailyRateUSD: true },
      });

      if (currentRates.length >= 3 && previousRates.length >= 3) {
        const currentAvg = currentRates.reduce((sum, r) => sum + Number(r.dailyRateUSD), 0) / currentRates.length;
        const previousAvg = previousRates.reduce((sum, r) => sum + Number(r.dailyRateUSD), 0) / previousRates.length;
        
        const changeAmount = currentAvg - previousAvg;
        const changePercent = (changeAmount / previousAvg) * 100;

        // Only include if change is significant (>5%)
        if (Math.abs(changePercent) > 5) {
          let trend: 'UP' | 'DOWN' | 'STABLE';
          if (changePercent > 2) {
            trend = 'UP';
          } else if (changePercent < -2) {
            trend = 'DOWN';
          } else {
            trend = 'STABLE';
          }

          const confidence = Math.min(currentRates.length / 10, 1);

          trendingRoles.push({
            role: combo.roleStandardized,
            seniority: combo.seniority,
            country: combo.country,
            lineOfService: combo.lineOfService,
            currentAverage: currentAvg,
            previousAverage: previousAvg,
            changeAmount,
            changePercent,
            trend,
            sampleSize: currentRates.length,
            confidence,
          });
        }
      }
    }

    // Sort by absolute change percent (most significant changes first)
    return trendingRoles.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  }

  // ==========================================================================
  // Geographic Comparison
  // ==========================================================================

  /**
   * Compare rates across different countries for the same role
   */
  async getGeographicComparison(
    tenantId: string,
    role: string,
    seniority: string,
    lineOfService?: string
  ): Promise<GeographicComparison> {
    const periodStart = subMonths(new Date(), 12);

    // Get all countries with data for this role
    const countries = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized: role,
        seniority: seniority as any,
        lineOfService: lineOfService,
        effectiveDate: { gte: periodStart },
      },
      distinct: ['country'],
      select: { country: true, region: true },
    });

    const byCountry: GeographicComparison['byCountry'] = [];

    for (const { country, region } of countries) {
      const rates = await this.prisma.rateCardEntry.findMany({
        where: {
          tenantId,
          roleStandardized: role,
          seniority: seniority as any,
          country,
          lineOfService: lineOfService,
          effectiveDate: { gte: periodStart },
        },
        select: {
          dailyRateUSD: true,
          supplierId: true,
        },
      });

      if (rates.length >= 3) {
        const rateValues = rates.map(r => Number(r.dailyRateUSD));
        const averageRate = rateValues.reduce((sum, val) => sum + val, 0) / rateValues.length;
        const sortedRates = [...rateValues].sort((a, b) => a - b);
        const medianRate = sortedRates[Math.floor(sortedRates.length / 2)];
        const competitorCount = new Set(rates.map(r => r.supplierId)).size;

        byCountry.push({
          country,
          region,
          averageRate,
          medianRate,
          sampleSize: rates.length,
          percentDifference: 0, // Will calculate after we have all data
          competitorCount,
        });
      }
    }

    // Calculate percent difference from lowest cost country
    if (byCountry.length > 0) {
      const lowestRate = Math.min(...byCountry.map(c => c.averageRate));
      byCountry.forEach(c => {
        c.percentDifference = ((c.averageRate - lowestRate) / lowestRate) * 100;
      });

      // Sort by average rate
      byCountry.sort((a, b) => a.averageRate - b.averageRate);
    }

    const lowestCostCountry = byCountry[0]?.country || '';
    const highestCostCountry = byCountry[byCountry.length - 1]?.country || '';
    const costSpread = byCountry.length > 0 
      ? byCountry[byCountry.length - 1].averageRate - byCountry[0].averageRate 
      : 0;

    // Generate insights
    const insights = this.generateGeographicInsights(byCountry, costSpread);

    return {
      role,
      seniority,
      lineOfService: lineOfService || 'All',
      byCountry,
      lowestCostCountry,
      highestCostCountry,
      costSpread,
      insights,
    };
  }

  /**
   * Generate insights from geographic comparison
   */
  private generateGeographicInsights(
    byCountry: GeographicComparison['byCountry'],
    costSpread: number
  ): string[] {
    const insights: string[] = [];

    if (byCountry.length < 2) {
      insights.push('Insufficient geographic data for comparison');
      return insights;
    }

    const lowestCost = byCountry[0];
    const highestCost = byCountry[byCountry.length - 1];
    const spreadPercent = (costSpread / lowestCost.averageRate) * 100;

    if (spreadPercent > 50) {
      insights.push(`Significant geographic arbitrage opportunity: ${spreadPercent.toFixed(0)}% cost difference between ${lowestCost.country} and ${highestCost.country}`);
      insights.push(`Consider shifting work to ${lowestCost.country} for potential savings of ${costSpread.toFixed(0)}/day`);
    } else if (spreadPercent > 25) {
      insights.push(`Moderate geographic cost variation: ${lowestCost.country} offers ${spreadPercent.toFixed(0)}% lower rates than ${highestCost.country}`);
    } else {
      insights.push(`Relatively consistent pricing across geographies (${spreadPercent.toFixed(0)}% spread)`);
    }

    // Identify markets with high competition
    const highCompetitionMarkets = byCountry.filter(c => c.competitorCount >= 5);
    if (highCompetitionMarkets.length > 0) {
      insights.push(`Strong supplier competition in: ${highCompetitionMarkets.map(c => c.country).join(', ')}`);
    }

    return insights;
  }

  // ==========================================================================
  // Supplier Competitiveness Ranking
  // ==========================================================================

  /**
   * Get supplier competitiveness rankings
   */
  async getSupplierRanking(
    tenantId: string,
    options?: {
      roleCategory?: string;
      country?: string;
      lineOfService?: string;
      periodMonths?: number;
    }
  ): Promise<SupplierRanking[]> {
    const periodStart = subMonths(new Date(), options?.periodMonths || 12);

    const where: Prisma.RateCardEntryWhereInput = {
      tenantId,
      effectiveDate: { gte: periodStart },
    };

    if (options?.country) where.country = options.country;
    if (options?.lineOfService) where.lineOfService = options.lineOfService;
    if (options?.roleCategory) where.roleCategory = options.roleCategory;

    // Get all rate card entries
    const entries = await this.prisma.rateCardEntry.findMany({
      where,
      select: {
        supplierId: true,
        supplierName: true,
        supplierTier: true,
        dailyRateUSD: true,
        roleStandardized: true,
        country: true,
        lineOfService: true,
        effectiveDate: true,
      },
    });

    // Group by supplier
    const supplierMap = new Map<string, {
      name: string;
      tier: string;
      rates: number[];
      roles: Set<string>;
      countries: Set<string>;
      linesOfService: Set<string>;
      recentRates: Array<{ rate: number; date: Date }>;
    }>();

    entries.forEach(entry => {
      if (!supplierMap.has(entry.supplierId)) {
        supplierMap.set(entry.supplierId, {
          name: entry.supplierName,
          tier: entry.supplierTier,
          rates: [],
          roles: new Set(),
          countries: new Set(),
          linesOfService: new Set(),
          recentRates: [],
        });
      }

      const supplier = supplierMap.get(entry.supplierId)!;
      supplier.rates.push(Number(entry.dailyRateUSD));
      supplier.roles.add(entry.roleStandardized);
      supplier.countries.add(entry.country);
      supplier.linesOfService.add(entry.lineOfService);
      supplier.recentRates.push({
        rate: Number(entry.dailyRateUSD),
        date: entry.effectiveDate,
      });
    });

    // Calculate market average for competitiveness scoring
    const allRates = entries.map(e => Number(e.dailyRateUSD));
    const marketAverage = allRates.reduce((sum, val) => sum + val, 0) / allRates.length;

    // Build rankings
    const rankings: SupplierRanking[] = [];

    for (const [supplierId, data] of supplierMap.entries()) {
      const averageRate = data.rates.reduce((sum, val) => sum + val, 0) / data.rates.length;
      const sortedRates = [...data.rates].sort((a, b) => a - b);
      const medianRate = sortedRates[Math.floor(sortedRates.length / 2)];

      // Calculate competitiveness score (lower rates = higher score)
      const competitivenessScore = Math.max(0, 100 - ((averageRate / marketAverage - 1) * 100));

      // Calculate market position (percentile)
      const lowerRates = allRates.filter(r => r < averageRate).length;
      const marketPosition = (lowerRates / allRates.length) * 100;

      // Calculate rate stability (lower std dev = more stable)
      const mean = averageRate;
      const variance = data.rates.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.rates.length;
      const stdDev = Math.sqrt(variance);
      const rateStability = Math.max(0, 100 - (stdDev / mean * 100));

      // Count recent rate changes (last 3 months)
      const threeMonthsAgo = subMonths(new Date(), 3);
      const recentRateChanges = data.recentRates.filter(r => r.date >= threeMonthsAgo).length;

      rankings.push({
        supplierId,
        supplierName: data.name,
        supplierTier: data.tier,
        competitivenessScore,
        averageRate,
        medianRate,
        marketPosition,
        rateCount: data.rates.length,
        rolesCovered: data.roles.size,
        countriesCovered: data.countries.size,
        linesOfServiceCovered: data.linesOfService.size,
        rateStability,
        recentRateChanges,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by competitiveness score and assign ranks
    rankings.sort((a, b) => b.competitivenessScore - a.competitivenessScore);
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return rankings;
  }

  // ==========================================================================
  // Emerging Trends Detection
  // ==========================================================================

  /**
   * Detect emerging trends in the market
   */
  async detectEmergingTrends(tenantId: string): Promise<EmergingTrend[]> {
    const trends: EmergingTrend[] = [];

    // Detect rate spikes
    const rateSpikes = await this.detectRateSpikes(tenantId);
    trends.push(...rateSpikes);

    // Detect new markets
    const newMarkets = await this.detectNewMarkets(tenantId);
    trends.push(...newMarkets);

    // Detect hot roles
    const hotRoles = await this.detectHotRoles(tenantId);
    trends.push(...hotRoles);

    // Sort by severity and date
    return trends.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Detect sudden rate spikes
   */
  private async detectRateSpikes(tenantId: string): Promise<EmergingTrend[]> {
    const trends: EmergingTrend[] = [];
    const trendingRoles = await this.getTrendingRoles(tenantId, 3); // Last 3 months

    for (const role of trendingRoles) {
      if (role.trend === 'UP' && role.changePercent > 20) {
        trends.push({
          type: 'RATE_SPIKE',
          title: `Significant rate increase for ${role.role}`,
          description: `Rates for ${role.role} (${role.seniority}) in ${role.country} increased by ${role.changePercent.toFixed(1)}% in the last 3 months`,
          severity: role.changePercent > 30 ? 'HIGH' : 'MEDIUM',
          affectedRoles: [role.role],
          affectedCountries: [role.country],
          changePercent: role.changePercent,
          detectedAt: new Date(),
          recommendation: 'Consider locking in rates with existing suppliers or exploring alternative markets',
        });
      }
    }

    return trends;
  }

  /**
   * Detect new geographic markets
   */
  private async detectNewMarkets(tenantId: string): Promise<EmergingTrend[]> {
    const trends: EmergingTrend[] = [];
    const threeMonthsAgo = subMonths(new Date(), 3);

    // Find countries with recent entries but no historical data
    const recentCountries = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        effectiveDate: { gte: threeMonthsAgo },
      },
      distinct: ['country'],
      select: { country: true },
    });

    for (const { country } of recentCountries) {
      const historicalCount = await this.prisma.rateCardEntry.count({
        where: {
          tenantId,
          country,
          effectiveDate: { lt: threeMonthsAgo },
        },
      });

      if (historicalCount === 0) {
        const recentCount = await this.prisma.rateCardEntry.count({
          where: {
            tenantId,
            country,
            effectiveDate: { gte: threeMonthsAgo },
          },
        });

        if (recentCount >= 3) {
          trends.push({
            type: 'NEW_MARKET',
            title: `New market detected: ${country}`,
            description: `${recentCount} new rate cards added for ${country} in the last 3 months`,
            severity: 'MEDIUM',
            affectedCountries: [country],
            detectedAt: new Date(),
            recommendation: 'Evaluate this market for potential cost savings and supplier diversity',
          });
        }
      }
    }

    return trends;
  }

  /**
   * Detect hot roles (high demand/activity)
   */
  private async detectHotRoles(tenantId: string): Promise<EmergingTrend[]> {
    const trends: EmergingTrend[] = [];
    const threeMonthsAgo = subMonths(new Date(), 3);

    // Find roles with significant recent activity
    const roleActivity = await this.prisma.rateCardEntry.groupBy({
      by: ['roleStandardized'],
      where: {
        tenantId,
        effectiveDate: { gte: threeMonthsAgo },
      },
      _count: true,
    });

    // Get historical average activity per role
    const historicalActivity = await this.prisma.rateCardEntry.groupBy({
      by: ['roleStandardized'],
      where: {
        tenantId,
        effectiveDate: { lt: threeMonthsAgo },
      },
      _count: true,
    });

    const historicalMap = new Map(
      historicalActivity.map(h => [h.roleStandardized, h._count])
    );

    for (const activity of roleActivity) {
      const historical = historicalMap.get(activity.roleStandardized) || 0;
      const recentCount = activity._count;

      // If recent activity is 3x historical average, it's a hot role
      if (recentCount >= 5 && recentCount > historical * 3) {
        trends.push({
          type: 'HOT_ROLE',
          title: `High demand for ${activity.roleStandardized}`,
          description: `${recentCount} new rate cards for ${activity.roleStandardized} in the last 3 months (${Math.round(recentCount / historical)}x historical average)`,
          severity: 'MEDIUM',
          affectedRoles: [activity.roleStandardized],
          detectedAt: new Date(),
          recommendation: 'Monitor this role closely for rate increases and supplier availability',
        });
      }
    }

    return trends;
  }
}

// ==========================================================================
// Export
// ==========================================================================

export default MarketIntelligenceService;
