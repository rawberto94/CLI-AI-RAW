
/**
 * Rate Card Benchmarking Engine
 * 
 * Core service for calculating benchmarks, market intelligence, and savings opportunities
 * for rate cards. Provides statistical analysis, percentile rankings, and trend detection.
 * 
 * @module RateCardBenchmarkingEngine
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { subMonths, subYears } from 'date-fns';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BenchmarkCohortCriteria {
  roleStandardized: string;
  seniority: string;
  country?: string;
  region?: string;
  lineOfService?: string;
  supplierTier?: string;
  periodMonths?: number;
}

export interface BenchmarkStatistics {
  sampleSize: number;
  mean: number;
  median: number;
  mode?: number;
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface MarketPosition {
  rate: number;
  percentileRank: number;
  position: 'BOTTOM_DECILE' | 'BOTTOM_QUARTILE' | 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'TOP_QUARTILE' | 'TOP_DECILE';
  deviation: number;
  deviationPercent: number;
}

export interface SavingsAnalysis {
  currentRate: number;
  marketMedian: number;
  marketP25: number;
  marketP10: number;
  savingsToMedian: number;
  savingsToP25: number;
  savingsToP10: number;
  savingsPercentToMedian: number;
  savingsPercentToP25: number;
  savingsPercentToP10: number;
  annualSavings?: number;
  annualSavingsPotential?: number;
  isAboveMarket: boolean;
}

export interface TrendAnalysis {
  direction: 'INCREASING' | 'STABLE' | 'DECREASING';
  monthOverMonth?: number;
  quarterOverQuarter?: number;
  yearOverYear?: number;
  confidence: number;
  dataPoints: number;
}

export interface BenchmarkResult {
  rateCardEntryId: string;
  cohortDefinition: BenchmarkCohortCriteria;
  statistics: BenchmarkStatistics;
  marketPosition: MarketPosition;
  savingsAnalysis: SavingsAnalysis;
  trendAnalysis?: TrendAnalysis;
  competitorCount: number;
  calculatedAt: Date;
}

export interface MarketIntelligence {
  role: string;
  seniority: string;
  country: string;
  lineOfService: string;
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
  insights: string[];
}

export interface SavingsOpportunity {
  rateCardEntryId: string;
  category: 'RATE_REDUCTION' | 'SUPPLIER_SWITCH' | 'VOLUME_DISCOUNT' | 'TERM_RENEGOTIATION' | 'GEOGRAPHIC_ARBITRAGE' | 'SKILL_OPTIMIZATION';
  title: string;
  description: string;
  currentAnnualCost: number;
  projectedAnnualCost: number;
  annualSavings: number;
  savingsPercentage: number;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  recommendedAction: string;
  alternativeSuppliers?: string[];
  negotiationPoints?: string[];
}

export interface BestRateCriteria {
  roleStandardized: string;
  seniority: string;
  country: string;
  lineOfService?: string;
  tenantId?: string;
}

export interface BestRateResult {
  bestRate: number;
  bestRateEntry: {
    id: string;
    supplierName: string;
    supplierId: string;
    effectiveDate: Date;
    expiryDate?: Date | null;
    roleOriginal: string;
    country: string;
    region: string;
    lineOfService: string;
  };
  cohortSize: number;
  confidence: number;
  averageRate: number;
  medianRate: number;
  savingsVsAverage: number;
  savingsVsMedian: number;
}

export interface SavingsVsBestResult {
  currentRate: number;
  bestRate: number;
  dailySavings: number;
  savingsPercentage: number;
  annualSavings?: number;
  recommendation: string;
  bestRateSupplier: string;
  bestRateEffectiveDate: Date;
  confidence: number;
}

export interface BestRateChange {
  roleStandardized: string;
  seniority: string;
  country: string;
  lineOfService: string;
  previousBestRate: number;
  newBestRate: number;
  changeAmount: number;
  changePercentage: number;
  newBestSupplier: string;
  detectedAt: Date;
  affectedRateCards: number;
}

// ============================================================================
// Rate Card Benchmarking Engine
// ============================================================================

export class RateCardBenchmarkingEngine {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // Core Benchmark Calculation
  // ==========================================================================

  /**
   * Calculate comprehensive benchmark for a rate card entry
   */
  async calculateBenchmark(rateCardEntryId: string): Promise<BenchmarkResult> {
    // Get the rate card entry
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    // Define cohort criteria
    const cohortCriteria: BenchmarkCohortCriteria = {
      roleStandardized: rateCard.roleStandardized,
      seniority: rateCard.seniority,
      country: rateCard.country,
      lineOfService: rateCard.lineOfService,
      periodMonths: 12,
    };

    // Get cohort data
    const cohortRates = await this.getCohortRates(cohortCriteria);

    if (cohortRates.length < 3) {
      // Not enough data for meaningful benchmark
      throw new Error(`Insufficient data for benchmarking. Found ${cohortRates.length} rates, need at least 3.`);
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(cohortRates);

    // Determine market position
    const marketPosition = this.calculateMarketPosition(Number(rateCard.dailyRateUSD), statistics);

    // Calculate savings analysis
    const savingsAnalysis = this.calculateSavingsAnalysis(
      Number(rateCard.dailyRateUSD),
      statistics,
      rateCard.volumeCommitted
    );

    // Calculate trend
    const trendAnalysis = await this.calculateTrend(cohortCriteria);

    // Get competitor count (unique suppliers)
    const competitorCount = await this.getCompetitorCount(cohortCriteria);

    const result: BenchmarkResult = {
      rateCardEntryId,
      cohortDefinition: cohortCriteria,
      statistics,
      marketPosition,
      savingsAnalysis,
      trendAnalysis,
      competitorCount,
      calculatedAt: new Date(),
    };

    // Save benchmark snapshot
    await this.saveBenchmarkSnapshot(result);

    // Update rate card entry with benchmark data
    await this.updateRateCardWithBenchmark(rateCardEntryId, result);

    return result;
  }

  /**
   * Get rates matching cohort criteria
   */
  private async getCohortRates(criteria: BenchmarkCohortCriteria): Promise<number[]> {
    const periodStart = subMonths(new Date(), criteria.periodMonths || 12);

    const where: Prisma.RateCardEntryWhereInput = {
      roleStandardized: criteria.roleStandardized,
      seniority: criteria.seniority as any,
      effectiveDate: { gte: periodStart },
    };

    if (criteria.country) {
      where.country = criteria.country;
    }

    if (criteria.lineOfService) {
      where.lineOfService = criteria.lineOfService;
    }

    if (criteria.region) {
      where.region = criteria.region;
    }

    if (criteria.supplierTier) {
      where.supplierTier = criteria.supplierTier as any;
    }

    const rates = await this.prisma.rateCardEntry.findMany({
      where,
      select: { dailyRateUSD: true },
      orderBy: { dailyRateUSD: 'asc' },
    });

    return rates.map(r => Number(r.dailyRateUSD));
  }

  /**
   * Calculate statistical metrics
   */
  private calculateStatistics(rates: number[]): BenchmarkStatistics {
    const sorted = [...rates].sort((a, b) => a - b);
    const n = sorted.length;

    // Mean
    const mean = sorted.reduce((sum, val) => sum + val, 0) / n;

    // Median
    const median = this.percentile(sorted, 50);

    // Mode (most frequent value)
    const frequency: Record<number, number> = {};
    sorted.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    const maxFreq = Math.max(...Object.values(frequency));
    const mode = maxFreq > 1 ? Number(Object.keys(frequency).find(k => frequency[Number(k)] === maxFreq)) : undefined;

    // Standard deviation
    const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Min/Max/Range
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;

    // Percentiles
    const p10 = this.percentile(sorted, 10);
    const p25 = this.percentile(sorted, 25);
    const p50 = this.percentile(sorted, 50);
    const p75 = this.percentile(sorted, 75);
    const p90 = this.percentile(sorted, 90);
    const p95 = this.percentile(sorted, 95);

    return {
      sampleSize: n,
      mean,
      median,
      mode,
      standardDeviation,
      variance,
      min,
      max,
      range,
      p10,
      p25,
      p50,
      p75,
      p90,
      p95,
    };
  }

  /**
   * Calculate percentile value
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Determine market position for a rate
   */
  private calculateMarketPosition(rate: number, stats: BenchmarkStatistics): MarketPosition {
    const sorted = [stats.min, stats.p10, stats.p25, stats.p50, stats.p75, stats.p90, stats.p95, stats.max];
    
    // Calculate percentile rank
    const percentileRank = this.calculatePercentileRank(rate, sorted);

    // Determine position category
    let position: MarketPosition['position'];
    if (percentileRank <= 10) {
      position = 'BOTTOM_DECILE';
    } else if (percentileRank <= 25) {
      position = 'BOTTOM_QUARTILE';
    } else if (percentileRank < 45) {
      position = 'BELOW_AVERAGE';
    } else if (percentileRank <= 55) {
      position = 'AVERAGE';
    } else if (percentileRank < 75) {
      position = 'ABOVE_AVERAGE';
    } else if (percentileRank < 90) {
      position = 'TOP_QUARTILE';
    } else {
      position = 'TOP_DECILE';
    }

    const deviation = rate - stats.median;
    const deviationPercent = (deviation / stats.median) * 100;

    return {
      rate,
      percentileRank,
      position,
      deviation,
      deviationPercent,
    };
  }

  /**
   * Calculate percentile rank of a value
   */
  private calculatePercentileRank(value: number, sortedArray: number[]): number {
    let countBelow = 0;
    let countEqual = 0;

    for (const val of sortedArray) {
      if (val < value) countBelow++;
      if (val === value) countEqual++;
    }

    return ((countBelow + 0.5 * countEqual) / sortedArray.length) * 100;
  }

  /**
   * Calculate savings analysis
   */
  private calculateSavingsAnalysis(
    currentRate: number,
    stats: BenchmarkStatistics,
    volumeCommitted?: number | null
  ): SavingsAnalysis {
    const savingsToMedian = Math.max(0, currentRate - stats.median);
    const savingsToP25 = Math.max(0, currentRate - stats.p25);
    const savingsToP10 = Math.max(0, currentRate - stats.p10);

    const savingsPercentToMedian = stats.median > 0 ? (savingsToMedian / stats.median) * 100 : 0;
    const savingsPercentToP25 = stats.p25 > 0 ? (savingsToP25 / stats.p25) * 100 : 0;
    const savingsPercentToP10 = stats.p10 > 0 ? (savingsToP10 / stats.p10) * 100 : 0;

    const annualSavings = volumeCommitted ? savingsToP25 * volumeCommitted : undefined;

    return {
      currentRate,
      marketMedian: stats.median,
      marketP25: stats.p25,
      marketP10: stats.p10,
      savingsToMedian,
      savingsToP25,
      savingsToP10,
      savingsPercentToMedian,
      savingsPercentToP25,
      savingsPercentToP10,
      annualSavings,
      isAboveMarket: currentRate > stats.median,
    };
  }

  /**
   * Calculate trend analysis
   */
  private async calculateTrend(criteria: BenchmarkCohortCriteria): Promise<TrendAnalysis | undefined> {
    try {
      const now = new Date();
      const oneMonthAgo = subMonths(now, 1);
      const threeMonthsAgo = subMonths(now, 3);
      const oneYearAgo = subYears(now, 1);

      // Get current period rates
      const currentRates = await this.getCohortRatesForPeriod(criteria, oneMonthAgo, now);
      
      // Get previous period rates
      const previousMonthRates = await this.getCohortRatesForPeriod(criteria, subMonths(oneMonthAgo, 1), oneMonthAgo);
      const previousQuarterRates = await this.getCohortRatesForPeriod(criteria, subMonths(threeMonthsAgo, 3), threeMonthsAgo);
      const previousYearRates = await this.getCohortRatesForPeriod(criteria, subYears(oneYearAgo, 1), oneYearAgo);

      if (currentRates.length < 2) {
        return undefined;
      }

      const currentAvg = currentRates.reduce((sum, val) => sum + val, 0) / currentRates.length;
      
      let monthOverMonth: number | undefined;
      let quarterOverQuarter: number | undefined;
      let yearOverYear: number | undefined;

      if (previousMonthRates.length >= 2) {
        const prevMonthAvg = previousMonthRates.reduce((sum, val) => sum + val, 0) / previousMonthRates.length;
        monthOverMonth = ((currentAvg - prevMonthAvg) / prevMonthAvg) * 100;
      }

      if (previousQuarterRates.length >= 2) {
        const prevQuarterAvg = previousQuarterRates.reduce((sum, val) => sum + val, 0) / previousQuarterRates.length;
        quarterOverQuarter = ((currentAvg - prevQuarterAvg) / prevQuarterAvg) * 100;
      }

      if (previousYearRates.length >= 2) {
        const prevYearAvg = previousYearRates.reduce((sum, val) => sum + val, 0) / previousYearRates.length;
        yearOverYear = ((currentAvg - prevYearAvg) / prevYearAvg) * 100;
      }

      // Determine direction based on available data
      const trendValue = yearOverYear ?? quarterOverQuarter ?? monthOverMonth ?? 0;
      let direction: TrendAnalysis['direction'];
      if (Math.abs(trendValue) < 2) {
        direction = 'STABLE';
      } else if (trendValue > 0) {
        direction = 'INCREASING';
      } else {
        direction = 'DECREASING';
      }

      const confidence = Math.min(currentRates.length / 10, 1); // Higher confidence with more data points

      return {
        direction,
        monthOverMonth,
        quarterOverQuarter,
        yearOverYear,
        confidence,
        dataPoints: currentRates.length,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Get cohort rates for a specific period
   */
  private async getCohortRatesForPeriod(
    criteria: BenchmarkCohortCriteria,
    start: Date,
    end: Date
  ): Promise<number[]> {
    const where: Prisma.RateCardEntryWhereInput = {
      roleStandardized: criteria.roleStandardized,
      seniority: criteria.seniority as any,
      effectiveDate: {
        gte: start,
        lte: end,
      },
    };

    if (criteria.country) where.country = criteria.country;
    if (criteria.lineOfService) where.lineOfService = criteria.lineOfService;

    const rates = await this.prisma.rateCardEntry.findMany({
      where,
      select: { dailyRateUSD: true },
    });

    return rates.map(r => Number(r.dailyRateUSD));
  }

  /**
   * Get count of unique suppliers (competitors) in cohort
   */
  private async getCompetitorCount(criteria: BenchmarkCohortCriteria): Promise<number> {
    const periodStart = subMonths(new Date(), criteria.periodMonths || 12);

    const where: Prisma.RateCardEntryWhereInput = {
      roleStandardized: criteria.roleStandardized,
      seniority: criteria.seniority as any,
      effectiveDate: { gte: periodStart },
    };

    if (criteria.country) where.country = criteria.country;
    if (criteria.lineOfService) where.lineOfService = criteria.lineOfService;

    const uniqueSuppliers = await this.prisma.rateCardEntry.findMany({
      where,
      distinct: ['supplierId'],
      select: { supplierId: true },
    });

    return uniqueSuppliers.length;
  }

  /**
   * Save benchmark snapshot to database
   */
  private async saveBenchmarkSnapshot(result: BenchmarkResult): Promise<void> {
    await this.prisma.benchmarkSnapshot.create({
      data: {
        rateCardEntryId: result.rateCardEntryId,
        tenantId: '', // TODO: Get from rate card entry
        snapshotDate: result.calculatedAt,
        periodStart: subMonths(new Date(), result.cohortDefinition.periodMonths || 12),
        periodEnd: new Date(),
        cohortDefinition: result.cohortDefinition as any,
        cohortSize: result.statistics.sampleSize,
        rateValue: result.statistics.mean, // Required field
        marketMedian: result.statistics.median, // Required field
        average: result.statistics.mean,
        median: result.statistics.median,
        mode: result.statistics.mode,
        standardDeviation: result.statistics.standardDeviation,
        percentile25: result.statistics.p25,
        percentile50: result.statistics.p50,
        percentile75: result.statistics.p75,
        percentile90: result.statistics.p90,
        percentile95: result.statistics.p95,
        min: result.statistics.min,
        max: result.statistics.max,
        positionInMarket: result.marketPosition.position,
        percentileRank: Math.round(result.marketPosition.percentileRank),
        potentialSavings: result.savingsAnalysis.savingsToP25,
        savingsToMedian: result.savingsAnalysis.savingsToMedian,
        savingsToP25: result.savingsAnalysis.savingsToP25,
        marketTrend: result.trendAnalysis?.direction,
        trendPercentage: result.trendAnalysis?.yearOverYear,
        competitorCount: result.competitorCount,
        competitorAverage: result.statistics.mean,
      },
    });
  }

  /**
   * Update rate card entry with benchmark results
   */
  private async updateRateCardWithBenchmark(rateCardEntryId: string, result: BenchmarkResult): Promise<void> {
    await this.prisma.rateCardEntry.update({
      where: { id: rateCardEntryId },
      data: {
        marketRateAverage: result.statistics.mean,
        marketRateMedian: result.statistics.median,
        marketRateP25: result.statistics.p25,
        marketRateP75: result.statistics.p75,
        marketRateP90: result.statistics.p90,
        percentileRank: Math.round(result.marketPosition.percentileRank),
        savingsAmount: result.savingsAnalysis.savingsToP25,
        savingsPercentage: result.savingsAnalysis.savingsPercentToP25,
        lastBenchmarkedAt: result.calculatedAt,
      },
    });
  }

  // ==========================================================================
  // Market Intelligence
  // ==========================================================================

  /**
   * Calculate market intelligence for a specific role/location combination
   */
  async calculateMarketIntelligence(criteria: BenchmarkCohortCriteria): Promise<MarketIntelligence> {
    const periodEnd = new Date();
    const periodStart = subMonths(periodEnd, criteria.periodMonths || 12);

    // Get cohort rates
    const cohortRates = await this.getCohortRates(criteria);

    if (cohortRates.length < 3) {
      throw new Error('Insufficient data for market intelligence');
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(cohortRates);

    // Calculate trend
    const trend = await this.calculateTrend(criteria) || {
      direction: 'STABLE' as const,
      confidence: 0,
      dataPoints: cohortRates.length,
    };

    // Get supplier distribution
    const supplierDistribution = await this.getSupplierDistribution(criteria);

    // Get top suppliers
    const topSuppliers = await this.getTopSuppliers(criteria);

    // Generate insights
    const insights = this.generateInsights(statistics, trend, supplierDistribution);

    return {
      role: criteria.roleStandardized,
      seniority: criteria.seniority,
      country: criteria.country || 'All',
      lineOfService: criteria.lineOfService || 'All',
      periodStart,
      periodEnd,
      statistics,
      trend,
      supplierDistribution,
      topSuppliers,
      insights,
    };
  }

  /**
   * Get supplier distribution in cohort
   */
  private async getSupplierDistribution(criteria: BenchmarkCohortCriteria): Promise<Record<string, number>> {
    const periodStart = subMonths(new Date(), criteria.periodMonths || 12);

    const where: Prisma.RateCardEntryWhereInput = {
      roleStandardized: criteria.roleStandardized,
      seniority: criteria.seniority as any,
      effectiveDate: { gte: periodStart },
    };

    if (criteria.country) where.country = criteria.country;
    if (criteria.lineOfService) where.lineOfService = criteria.lineOfService;

    const entries = await this.prisma.rateCardEntry.findMany({
      where,
      select: {
        supplierTier: true,
      },
    });

    const distribution: Record<string, number> = {};
    const total = entries.length;

    entries.forEach(entry => {
      const tier = entry.supplierTier;
      distribution[tier] = (distribution[tier] || 0) + 1;
    });

    // Convert to percentages
    Object.keys(distribution).forEach(key => {
      distribution[key] = (distribution[key] / total) * 100;
    });

    return distribution;
  }

  /**
   * Get top suppliers by average rate
   */
  private async getTopSuppliers(criteria: BenchmarkCohortCriteria): Promise<Array<{ name: string; averageRate: number; sampleSize: number }>> {
    const periodStart = subMonths(new Date(), criteria.periodMonths || 12);

    const where: Prisma.RateCardEntryWhereInput = {
      roleStandardized: criteria.roleStandardized,
      seniority: criteria.seniority as any,
      effectiveDate: { gte: periodStart },
    };

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

    // Calculate averages and return top 5
    return Array.from(supplierMap.values())
      .map(supplier => ({
        name: supplier.name,
        averageRate: supplier.rates.reduce((sum, rate) => sum + rate, 0) / supplier.rates.length,
        sampleSize: supplier.rates.length,
      }))
      .sort((a, b) => a.averageRate - b.averageRate)
      .slice(0, 5);
  }

  /**
   * Generate AI insights from benchmark data
   */
  private generateInsights(
    stats: BenchmarkStatistics,
    trend: TrendAnalysis,
    supplierDistribution: Record<string, number>
  ): string[] {
    const insights: string[] = [];

    // Market trend insights
    if (trend.direction === 'INCREASING' && trend.yearOverYear && trend.yearOverYear > 5) {
      insights.push(`Market rates are increasing significantly (+${trend.yearOverYear.toFixed(1)}% YoY). Consider locking in rates now.`);
    } else if (trend.direction === 'DECREASING' && trend.yearOverYear && trend.yearOverYear < -5) {
      insights.push(`Market rates are declining (${trend.yearOverYear.toFixed(1)}% YoY). Good opportunity to renegotiate.`);
    }

    // Supplier tier insights
    const big4Percent = supplierDistribution['BIG_4'] || 0;
    if (big4Percent > 60) {
      insights.push(`Market dominated by Big 4 firms (${big4Percent.toFixed(0)}%). Consider tier 2 suppliers for cost savings.`);
    }

    // Rate spread insights
    if (stats.standardDeviation / stats.mean > 0.2) {
      insights.push(`High rate variability detected (CV: ${((stats.standardDeviation / stats.mean) * 100).toFixed(0)}%). Strong negotiation potential.`);
    }

    // Sample size insights
    if (stats.sampleSize < 10) {
      insights.push(`Limited market data available (${stats.sampleSize} data points). Benchmark should be used with caution.`);
    } else if (stats.sampleSize > 50) {
      insights.push(`Strong market data available (${stats.sampleSize} data points). High confidence in benchmark.`);
    }

    // Range insights
    const rangePercent = (stats.range / stats.median) * 100;
    if (rangePercent > 50) {
      insights.push(`Wide rate range ($${stats.min.toFixed(0)}-$${stats.max.toFixed(0)}). Significant savings potential through supplier selection.`);
    }

    return insights;
  }

  // ==========================================================================
  // Savings Opportunity Detection
  // ==========================================================================

  /**
   * Detect savings opportunities for a rate card entry
   */
  async detectSavingsOpportunities(rateCardEntryId: string): Promise<SavingsOpportunity[]> {
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
      include: {
        benchmarkSnapshots: {
          take: 1,
          orderBy: { snapshotDate: 'desc' },
        },
      },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    const opportunities: SavingsOpportunity[] = [];

    // Get benchmark if it exists
    const benchmark = rateCard.benchmarkSnapshots[0];
    if (!benchmark) {
      // No benchmark yet, trigger calculation
      await this.calculateBenchmark(rateCardEntryId);
      return this.detectSavingsOpportunities(rateCardEntryId);
    }

    const currentRate = Number(rateCard.dailyRateUSD);
    const marketMedian = Number(benchmark.median);
    const marketP25 = Number(benchmark.percentile25);
    const volumeCommitted = rateCard.volumeCommitted || 250; // Default 250 days/year

    // Opportunity 1: Rate Reduction (if above 75th percentile)
    if (rateCard.percentileRank && rateCard.percentileRank > 75) {
      const targetRate = marketP25;
      const dailySavings = currentRate - targetRate;
      const annualSavings = dailySavings * volumeCommitted;
      const savingsPercent = (dailySavings / currentRate) * 100;

      opportunities.push({
        rateCardEntryId,
        category: 'RATE_REDUCTION',
        title: `Reduce ${rateCard.roleStandardized} rate to market standard`,
        description: `Current rate ($${currentRate.toFixed(0)}/day) is in the top quartile. Market 25th percentile is $${targetRate.toFixed(0)}/day.`,
        currentAnnualCost: currentRate * volumeCommitted,
        projectedAnnualCost: targetRate * volumeCommitted,
        annualSavings,
        savingsPercentage: savingsPercent,
        effort: savingsPercent > 20 ? 'HIGH' : savingsPercent > 10 ? 'MEDIUM' : 'LOW',
        risk: 'LOW',
        confidence: Math.min(benchmark.cohortSize / 20, 1),
        recommendedAction: `Negotiate rate reduction to $${targetRate.toFixed(0)}/day (market 25th percentile)`,
        negotiationPoints: [
          `Market median is $${marketMedian.toFixed(0)}/day`,
          `${benchmark.competitorCount} competing suppliers offer lower rates`,
          `Potential annual savings of $${annualSavings.toFixed(0)}`,
        ],
      });
    }

    // Opportunity 2: Supplier Switch (if better alternatives exist)
    if (rateCard.percentileRank && rateCard.percentileRank > 60) {
      const alternativeSuppliers = await this.findAlternativeSuppliers(rateCard);
      
      if (alternativeSuppliers.length > 0) {
        const bestAlternative = alternativeSuppliers[0];
        const dailySavings = currentRate - bestAlternative.averageRate;
        const annualSavings = dailySavings * volumeCommitted;

        opportunities.push({
          rateCardEntryId,
          category: 'SUPPLIER_SWITCH',
          title: `Switch to more competitive supplier for ${rateCard.roleStandardized}`,
          description: `Alternative suppliers available at $${bestAlternative.averageRate.toFixed(0)}/day vs current $${currentRate.toFixed(0)}/day`,
          currentAnnualCost: currentRate * volumeCommitted,
          projectedAnnualCost: bestAlternative.averageRate * volumeCommitted,
          annualSavings,
          savingsPercentage: (dailySavings / currentRate) * 100,
          effort: 'HIGH',
          risk: 'MEDIUM',
          confidence: 0.7,
          recommendedAction: `Evaluate ${bestAlternative.name} as alternative supplier`,
          alternativeSuppliers: alternativeSuppliers.map(s => s.name),
        });
      }
    }

    // Opportunity 3: Volume Discount (if high volume)
    if (volumeCommitted && volumeCommitted > 200) {
      const volumeDiscountRate = currentRate * 0.85; // Assume 15% volume discount
      const dailySavings = currentRate - volumeDiscountRate;
      const annualSavings = dailySavings * volumeCommitted;

      opportunities.push({
        rateCardEntryId,
        category: 'VOLUME_DISCOUNT',
        title: `Negotiate volume discount for ${rateCard.roleStandardized}`,
        description: `High commitment (${volumeCommitted} days/year) qualifies for volume pricing`,
        currentAnnualCost: currentRate * volumeCommitted,
        projectedAnnualCost: volumeDiscountRate * volumeCommitted,
        annualSavings,
        savingsPercentage: 15,
        effort: 'LOW',
        risk: 'LOW',
        confidence: 0.8,
        recommendedAction: `Request 15% volume discount based on ${volumeCommitted} day annual commitment`,
        negotiationPoints: [
          `Annual commitment of ${volumeCommitted} days`,
          `Long-term partnership opportunity`,
          `Industry standard volume discounts range from 10-20%`,
        ],
      });
    }

    // Save opportunities to database
    for (const opp of opportunities) {
      await this.saveOpportunity(opp);
    }

    return opportunities;
  }

  /**
   * Find alternative suppliers with better rates
   */
  private async findAlternativeSuppliers(rateCard: any): Promise<Array<{ name: string; averageRate: number }>> {
    const periodStart = subMonths(new Date(), 12);

    const alternatives = await this.prisma.rateCardEntry.findMany({
      where: {
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
        supplierId: { not: rateCard.supplierId },
        effectiveDate: { gte: periodStart },
        dailyRateUSD: { lt: rateCard.dailyRateUSD },
      },
      select: {
        supplierId: true,
        supplierName: true,
        dailyRateUSD: true,
      },
    });

    // Group by supplier and calculate averages
    const supplierMap = new Map<string, { name: string; rates: number[] }>();
    
    alternatives.forEach(alt => {
      if (!supplierMap.has(alt.supplierId)) {
        supplierMap.set(alt.supplierId, {
          name: alt.supplierName,
          rates: [],
        });
      }
      supplierMap.get(alt.supplierId)!.rates.push(Number(alt.dailyRateUSD));
    });

    return Array.from(supplierMap.values())
      .map(supplier => ({
        name: supplier.name,
        averageRate: supplier.rates.reduce((sum, rate) => sum + rate, 0) / supplier.rates.length,
      }))
      .sort((a, b) => a.averageRate - b.averageRate)
      .slice(0, 3);
  }

  /**
   * Save savings opportunity to database
   */
  private async saveOpportunity(opportunity: SavingsOpportunity): Promise<void> {
    // Check if opportunity already exists
    const existing = await this.prisma.rateSavingsOpportunity.findFirst({
      where: {
        rateCardEntryId: opportunity.rateCardEntryId,
        category: opportunity.category,
        status: { notIn: ['REJECTED', 'IMPLEMENTED'] },
      },
    });

    if (existing) {
      // Update existing opportunity
      await this.prisma.rateSavingsOpportunity.update({
        where: { id: existing.id },
        data: {
          annualSavingsPotential: opportunity.annualSavings,
          savingsPercentage: opportunity.savingsPercentage,
          confidence: opportunity.confidence,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new opportunity
      await this.prisma.rateSavingsOpportunity.create({
        data: {
          rateCardEntryId: opportunity.rateCardEntryId,
          tenantId: '', // TODO: Get from rate card
          title: opportunity.title,
          description: opportunity.description,
          category: opportunity.category,
          currentAnnualCost: opportunity.currentAnnualCost,
          projectedAnnualCost: opportunity.projectedAnnualCost,
          annualSavingsPotential: opportunity.annualSavings,
          savingsPercentage: opportunity.savingsPercentage,
          effort: opportunity.effort,
          risk: opportunity.risk,
          confidence: opportunity.confidence,
          recommendedAction: opportunity.recommendedAction,
          alternativeSuppliers: opportunity.alternativeSuppliers || [],
          negotiationPoints: opportunity.negotiationPoints || [],
        },
      });
    }
  }

  // ==========================================================================
  // Best Rate Tracking
  // ==========================================================================

  /**
   * Get the best (lowest) rate for a specific role-geography-seniority combination
   */
  async getBestRate(criteria: BestRateCriteria): Promise<BestRateResult> {
    const periodStart = subMonths(new Date(), 12); // Look at last 12 months

    const where: Prisma.RateCardEntryWhereInput = {
      roleStandardized: criteria.roleStandardized,
      seniority: criteria.seniority as any,
      country: criteria.country,
      effectiveDate: { gte: periodStart },
    };

    if (criteria.lineOfService) {
      where.lineOfService = criteria.lineOfService;
    }

    if (criteria.tenantId) {
      where.tenantId = criteria.tenantId;
    }

    // Get all matching rates
    const allRates = await this.prisma.rateCardEntry.findMany({
      where,
      select: {
        id: true,
        dailyRateUSD: true,
        supplierName: true,
        supplierId: true,
        effectiveDate: true,
        expiryDate: true,
        roleOriginal: true,
        country: true,
        region: true,
        lineOfService: true,
      },
      orderBy: { dailyRateUSD: 'asc' },
    });

    if (allRates.length === 0) {
      throw new Error('No rates found matching criteria');
    }

    // Get the best (lowest) rate
    const bestRateEntry = allRates[0];
    const bestRate = Number(bestRateEntry.dailyRateUSD);

    // Calculate statistics for the cohort
    const rateValues = allRates.map(r => Number(r.dailyRateUSD));
    const averageRate = rateValues.reduce((sum, val) => sum + val, 0) / rateValues.length;
    const sortedRates = [...rateValues].sort((a, b) => a - b);
    const medianRate = this.percentile(sortedRates, 50);

    // Calculate confidence based on cohort size
    const confidence = Math.min(allRates.length / 20, 1); // Max confidence at 20+ data points

    return {
      bestRate,
      bestRateEntry: {
        id: bestRateEntry.id,
        supplierName: bestRateEntry.supplierName,
        supplierId: bestRateEntry.supplierId,
        effectiveDate: bestRateEntry.effectiveDate,
        expiryDate: bestRateEntry.expiryDate,
        roleOriginal: bestRateEntry.roleOriginal,
        country: bestRateEntry.country,
        region: bestRateEntry.region,
        lineOfService: bestRateEntry.lineOfService,
      },
      cohortSize: allRates.length,
      confidence,
      averageRate,
      medianRate,
      savingsVsAverage: averageRate - bestRate,
      savingsVsMedian: medianRate - bestRate,
    };
  }

  /**
   * Calculate savings vs best rate for a specific rate card entry
   */
  async calculateSavingsVsBest(rateCardEntryId: string): Promise<SavingsVsBestResult> {
    // Get the rate card entry
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    // Get best rate for this combination
    const bestRateResult = await this.getBestRate({
      roleStandardized: rateCard.roleStandardized,
      seniority: rateCard.seniority,
      country: rateCard.country,
      lineOfService: rateCard.lineOfService,
      tenantId: rateCard.tenantId,
    });

    const currentRate = Number(rateCard.dailyRateUSD);
    const bestRate = bestRateResult.bestRate;
    const dailySavings = Math.max(0, currentRate - bestRate);
    const savingsPercentage = bestRate > 0 ? (dailySavings / bestRate) * 100 : 0;

    // Calculate annual savings if volume is known
    const annualSavings = rateCard.volumeCommitted 
      ? dailySavings * rateCard.volumeCommitted 
      : undefined;

    // Generate recommendation
    let recommendation: string;
    if (dailySavings === 0) {
      recommendation = `This is the best rate in the market! No savings opportunity identified.`;
    } else if (savingsPercentage < 5) {
      recommendation = `Rate is competitive (within 5% of best rate). Minor savings potential of ${dailySavings.toFixed(0)}/day.`;
    } else if (savingsPercentage < 15) {
      recommendation = `Moderate savings opportunity. Target rate of ${bestRate.toFixed(0)}/day could save ${dailySavings.toFixed(0)}/day (${savingsPercentage.toFixed(1)}%).`;
    } else {
      recommendation = `Significant savings opportunity! Best market rate is ${bestRate.toFixed(0)}/day vs current ${currentRate.toFixed(0)}/day. Potential savings: ${dailySavings.toFixed(0)}/day (${savingsPercentage.toFixed(1)}%).`;
    }

    return {
      currentRate,
      bestRate,
      dailySavings,
      savingsPercentage,
      annualSavings,
      recommendation,
      bestRateSupplier: bestRateResult.bestRateEntry.supplierName,
      bestRateEffectiveDate: bestRateResult.bestRateEntry.effectiveDate,
      confidence: bestRateResult.confidence,
    };
  }

  /**
   * Track best rate changes over time
   * Detects when a new best rate appears for any role-geography combination
   */
  async trackBestRateChanges(tenantId: string): Promise<BestRateChange[]> {
    const changes: BestRateChange[] = [];

    // Get all unique role-geography-seniority combinations for the tenant
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

    for (const combo of uniqueCombinations) {
      try {
        // Get current best rate
        const currentBest = await this.getBestRate({
          roleStandardized: combo.roleStandardized,
          seniority: combo.seniority,
          country: combo.country,
          lineOfService: combo.lineOfService,
          tenantId,
        });

        // Get best rate from 30 days ago
        const thirtyDaysAgo = subMonths(new Date(), 1);
        const previousRates = await this.prisma.rateCardEntry.findMany({
          where: {
            tenantId,
            roleStandardized: combo.roleStandardized,
            seniority: combo.seniority as any,
            country: combo.country,
            lineOfService: combo.lineOfService,
            effectiveDate: { lte: thirtyDaysAgo },
          },
          select: { dailyRateUSD: true },
          orderBy: { dailyRateUSD: 'asc' },
          take: 1,
        });

        if (previousRates.length > 0) {
          const previousBestRate = Number(previousRates[0].dailyRateUSD);
          const changeAmount = currentBest.bestRate - previousBestRate;
          const changePercentage = (changeAmount / previousBestRate) * 100;

          // Only report if there's a significant change (>2%)
          if (Math.abs(changePercentage) > 2) {
            // Count affected rate cards
            const affectedCount = await this.prisma.rateCardEntry.count({
              where: {
                tenantId,
                roleStandardized: combo.roleStandardized,
                seniority: combo.seniority as any,
                country: combo.country,
                lineOfService: combo.lineOfService,
                dailyRateUSD: { gt: currentBest.bestRate },
              },
            });

            changes.push({
              roleStandardized: combo.roleStandardized,
              seniority: combo.seniority,
              country: combo.country,
              lineOfService: combo.lineOfService,
              previousBestRate,
              newBestRate: currentBest.bestRate,
              changeAmount,
              changePercentage,
              newBestSupplier: currentBest.bestRateEntry.supplierName,
              detectedAt: new Date(),
              affectedRateCards: affectedCount,
            });
          }
        }
      } catch {
        // Skip combinations with insufficient data
      }
    }

    return changes;
  }

  /**
   * Get all best rates for a tenant (one per unique combination)
   */
  async getAllBestRates(tenantId: string): Promise<BestRateResult[]> {
    // Get all unique role-geography-seniority combinations
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

    const bestRates: BestRateResult[] = [];

    for (const combo of uniqueCombinations) {
      try {
        const bestRate = await this.getBestRate({
          roleStandardized: combo.roleStandardized,
          seniority: combo.seniority,
          country: combo.country,
          lineOfService: combo.lineOfService,
          tenantId,
        });
        bestRates.push(bestRate);
      } catch {
        // Skip combinations with no data
      }
    }

    return bestRates;
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Calculate benchmarks for all rate cards that need it
   */
  async calculateAllBenchmarks(tenantId?: string): Promise<void> {
    const where: Prisma.RateCardEntryWhereInput = {
      OR: [
        { lastBenchmarkedAt: null },
        { lastBenchmarkedAt: { lt: subMonths(new Date(), 1) } }, // Re-benchmark monthly
      ],
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const rateCards = await this.prisma.rateCardEntry.findMany({
      where,
      select: { id: true },
    });

    for (const rateCard of rateCards) {
      try {
        await this.calculateBenchmark(rateCard.id);
        await this.detectSavingsOpportunities(rateCard.id);
      } catch {
        // Skip rate cards that fail benchmarking
      }
    }
  }
}

// ==========================================================================
// Export
// ==========================================================================

export default RateCardBenchmarkingEngine;
