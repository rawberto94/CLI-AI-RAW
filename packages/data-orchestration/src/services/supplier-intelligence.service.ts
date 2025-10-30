/**
 * Supplier Intelligence Service
 * 
 * Provides comprehensive supplier performance evaluation and tracking.
 * Calculates multi-factor competitiveness scores based on:
 * - Price Competitiveness (40%)
 * - Geographic Coverage (25%)
 * - Rate Stability (20%)
 * - Growth Trajectory (15%)
 */

import { PrismaClient, SeniorityLevel } from '@prisma/client';

const prisma = new PrismaClient();

export interface SupplierScore {
  supplierId: string;
  supplierName: string;
  overallScore: number; // 0-100
  dimensions: {
    priceCompetitiveness: number;
    geographicCoverage: number;
    rateStability: number;
    growthTrajectory: number;
  };
  ranking: number; // 1-N among all suppliers
  trend: 'improving' | 'declining' | 'stable';
  calculatedAt: Date;
}

export interface SupplierMetrics {
  supplierId: string;
  avgRate: number;
  marketAvgRate: number;
  ratePercentile: number;
  countriesCount: number;
  totalCountries: number;
  rateChanges: number[];
  rateStdDev: number;
}

export class SupplierIntelligenceService {
  /**
   * Calculate comprehensive competitiveness score for a supplier
   * 
   * Formula:
   * Overall Score = (
   *   0.40 * Price Competitiveness +
   *   0.25 * Geographic Coverage +
   *   0.20 * Rate Stability +
   *   0.15 * Growth Trajectory
   * )
   */
  async calculateCompetitivenessScore(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierScore> {
    // Get supplier details
    const supplier = await prisma.rateCardSupplier.findUnique({
      where: { id: supplierId },
      include: {
        rateCards: {
          where: { tenantId },
          include: {
            forecasts: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }

    // Calculate metrics
    const metrics = await this.calculateSupplierMetrics(supplierId, tenantId);

    // Calculate dimension scores
    const priceCompetitiveness = this.calculatePriceCompetitiveness(metrics);
    const geographicCoverage = this.calculateGeographicCoverage(metrics);
    const rateStability = this.calculateRateStability(metrics);
    const growthTrajectory = this.calculateGrowthTrajectory(metrics);

    // Calculate overall score
    const overallScore = 
      0.40 * priceCompetitiveness +
      0.25 * geographicCoverage +
      0.20 * rateStability +
      0.15 * growthTrajectory;

    // Get ranking among all suppliers
    const ranking = await this.calculateSupplierRanking(
      tenantId,
      overallScore
    );

    // Determine trend
    const trend = await this.determineSupplierTrend(supplierId, tenantId);

    const score: SupplierScore = {
      supplierId,
      supplierName: supplier.name,
      overallScore: Math.round(overallScore * 100) / 100,
      dimensions: {
        priceCompetitiveness: Math.round(priceCompetitiveness * 100) / 100,
        geographicCoverage: Math.round(geographicCoverage * 100) / 100,
        rateStability: Math.round(rateStability * 100) / 100,
        growthTrajectory: Math.round(growthTrajectory * 100) / 100,
      },
      ranking,
      trend,
      calculatedAt: new Date()
    };

    // Store the score in database
    await this.storeSupplierScore(score, tenantId);

    return score;
  }

  /**
   * Calculate all supplier metrics needed for scoring
   */
  private async calculateSupplierMetrics(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierMetrics> {
    // Get supplier's rate cards
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        supplierId,
        tenantId
      },
      orderBy: {
        effectiveDate: 'asc'
      }
    });

    if (rateCards.length === 0) {
      throw new Error(`No rate cards found for supplier: ${supplierId}`);
    }

    // Calculate average rate
    const avgRate = rateCards.reduce((sum, rc) => 
      sum + Number(rc.dailyRateUSD), 0
    ) / rateCards.length;

    // Get market average rate for comparison
    const allRates = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { dailyRateUSD: true }
    });

    const marketAvgRate = allRates.reduce((sum, rc) => 
      sum + Number(rc.dailyRateUSD), 0
    ) / allRates.length;

    // Calculate rate percentile
    const sortedRates = allRates
      .map(r => Number(r.dailyRateUSD))
      .sort((a, b) => a - b);
    const supplierRateIndex = sortedRates.findIndex(r => r >= avgRate);
    const ratePercentile = (supplierRateIndex / sortedRates.length) * 100;

    // Get unique countries
    const countries = new Set(rateCards.map(rc => rc.country));
    const countriesCount = countries.size;

    // Get total unique countries in market
    const allCountries = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { country: true },
      distinct: ['country']
    });
    const totalCountries = allCountries.length;

    // Calculate rate changes over time (for stability)
    const rateChanges: number[] = [];
    for (let i = 1; i < rateCards.length; i++) {
      const prevRate = Number(rateCards[i - 1].dailyRateUSD);
      const currRate = Number(rateCards[i].dailyRateUSD);
      const change = ((currRate - prevRate) / prevRate) * 100;
      rateChanges.push(change);
    }

    // Calculate standard deviation of rate changes
    const rateStdDev = this.calculateStdDev(rateChanges);

    return {
      supplierId,
      avgRate,
      marketAvgRate,
      ratePercentile,
      countriesCount,
      totalCountries,
      rateChanges,
      rateStdDev
    };
  }

  /**
   * Calculate Price Competitiveness Score
   * Formula: 100 - (Avg Rate Percentile)
   * Lower rates = higher score
   */
  private calculatePriceCompetitiveness(metrics: SupplierMetrics): number {
    return 100 - metrics.ratePercentile;
  }

  /**
   * Calculate Geographic Coverage Score
   * Formula: (Countries Covered / Total Countries) * 100
   */
  private calculateGeographicCoverage(metrics: SupplierMetrics): number {
    if (metrics.totalCountries === 0) return 0;
    return (metrics.countriesCount / metrics.totalCountries) * 100;
  }

  /**
   * Calculate Rate Stability Score
   * Formula: 100 - (Std Dev of Rate Changes * 10)
   * Lower volatility = higher score
   */
  private calculateRateStability(metrics: SupplierMetrics): number {
    const volatilityPenalty = Math.min(metrics.rateStdDev * 10, 100);
    return Math.max(100 - volatilityPenalty, 0);
  }

  /**
   * Calculate Growth Trajectory Score
   * Positive if rates decreasing (good for buyer)
   * Negative if rates increasing (bad for buyer)
   */
  private calculateGrowthTrajectory(metrics: SupplierMetrics): number {
    if (metrics.rateChanges.length === 0) return 50; // Neutral

    // Calculate average rate change
    const avgChange = metrics.rateChanges.reduce((sum, c) => sum + c, 0) / 
      metrics.rateChanges.length;

    // Convert to score: decreasing rates = higher score
    // -10% change = 100 score, +10% change = 0 score
    const score = 50 - (avgChange * 5);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate supplier ranking among all suppliers
   */
  private async calculateSupplierRanking(
    tenantId: string,
    overallScore: number
  ): Promise<number> {
    // Get all suppliers for this tenant
    const suppliers = await prisma.rateCardSupplier.findMany({
      where: { tenantId }
    });

    // For now, calculate ranking based on current score
    // In production, this would query stored scores
    const ranking = suppliers.length > 0 
      ? Math.ceil(suppliers.length * (1 - overallScore / 100))
      : 1;

    return Math.max(1, ranking);
  }

  /**
   * Determine supplier trend (improving, declining, stable)
   */
  private async determineSupplierTrend(
    supplierId: string,
    tenantId: string
  ): Promise<'improving' | 'declining' | 'stable'> {
    // Get recent forecasts to determine trend
    const recentForecasts = await prisma.rateForecast.findMany({
      where: {
        tenantId,
        rateCardEntry: {
          supplierId
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    if (recentForecasts.length === 0) return 'stable';

    // Count trends
    let improvingCount = 0;
    let decliningCount = 0;

    recentForecasts.forEach(forecast => {
      if (forecast.trendDirection === 'decreasing') {
        improvingCount++; // Decreasing rates = improving for buyer
      } else if (forecast.trendDirection === 'increasing') {
        decliningCount++; // Increasing rates = declining for buyer
      }
    });

    if (improvingCount > decliningCount * 1.5) return 'improving';
    if (decliningCount > improvingCount * 1.5) return 'declining';
    return 'stable';
  }

  /**
   * Store supplier score in database
   */
  private async storeSupplierScore(
    score: SupplierScore,
    tenantId: string
  ): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO "SupplierScore" (
        id, "supplierId", "tenantId", "overallScore",
        "priceCompetitiveness", "geographicCoverage",
        "rateStability", "growthTrajectory",
        ranking, trend, "calculatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${score.supplierId},
        ${tenantId},
        ${score.overallScore},
        ${score.dimensions.priceCompetitiveness},
        ${score.dimensions.geographicCoverage},
        ${score.dimensions.rateStability},
        ${score.dimensions.growthTrajectory},
        ${score.ranking},
        ${score.trend},
        ${score.calculatedAt}
      )
    `;
  }

  /**
   * Get all supplier scores for a tenant, ranked by overall score
   */
  async getAllSupplierScores(tenantId: string): Promise<SupplierScore[]> {
    const suppliers = await prisma.rateCardSupplier.findMany({
      where: { tenantId }
    });

    const scores: SupplierScore[] = [];

    for (const supplier of suppliers) {
      try {
        const score = await this.calculateCompetitivenessScore(
          supplier.id,
          tenantId
        );
        scores.push(score);
      } catch (error) {
        console.error(`Error calculating score for supplier ${supplier.id}:`, error);
      }
    }

    // Sort by overall score descending
    return scores.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }
}

export const supplierIntelligenceService = new SupplierIntelligenceService();
