
/**
 * Predictive Analytics Service
 * 
 * Provides rate forecasting and trend prediction using time-series analysis.
 * Generates 3, 6, and 12-month forecasts with confidence intervals.
 * Detects accelerating rates and high-risk scenarios.
 * 
 * @module PredictiveAnalyticsService
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { subMonths, addMonths, differenceInMonths } from 'date-fns';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ForecastCriteria {
  rateCardEntryId: string;
  tenantId: string;
  minHistoricalMonths?: number; // Default: 6
  forecastHorizons?: number[]; // Default: [3, 6, 12]
}

export interface RateForecast {
  rateCardEntryId: string;
  tenantId: string;
  currentRate: number;
  forecastDate: Date;
  predictions: {
    threeMonth: ForecastPrediction;
    sixMonth: ForecastPrediction;
    twelveMonth: ForecastPrediction;
  };
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendCoefficient: number; // Rate of change per month
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  historicalDataPoints: number;
  modelVersion: string;
  calculatedAt: Date;
}

export interface ForecastPrediction {
  rate: number;
  confidence: number; // 0-100
  confidenceInterval: {
    lower: number; // 95% CI lower bound
    upper: number; // 95% CI upper bound
  };
  percentChange: number;
}

export interface TrendTrajectory {
  rateCardEntryId: string;
  historicalRates: Array<{
    date: Date;
    rate: number;
  }>;
  trendLine: {
    slope: number; // Rate change per month
    intercept: number;
    rSquared: number; // Goodness of fit (0-1)
  };
  acceleration: number; // Change in slope (2nd derivative)
  isAccelerating: boolean;
  projectedRates: Array<{
    date: Date;
    rate: number;
  }>;
}

export interface HighRiskRate {
  rateCardEntryId: string;
  currentRate: number;
  quarterOverQuarterChange: number; // Percentage
  projectedSixMonthRate: number;
  projectedTwelveMonthRate: number;
  riskScore: number; // 0-100
  riskFactors: string[];
  recommendedActions: string[];
}

// ============================================================================
// Errors
// ============================================================================

export class PredictiveAnalyticsError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PredictiveAnalyticsError';
  }
}

export class InsufficientDataError extends PredictiveAnalyticsError {
  constructor(requiredMonths: number, availableMonths: number) {
    super(
      `Insufficient historical data. Required: ${requiredMonths} months, Available: ${availableMonths} months`,
      'INSUFFICIENT_DATA'
    );
  }
}

// ============================================================================
// Service
// ============================================================================

export class PredictiveAnalyticsService {
  private prisma: PrismaClient;
  private readonly MODEL_VERSION = '1.0.0';
  private readonly MIN_DATA_POINTS = 6;
  private readonly CONFIDENCE_THRESHOLD = 70;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate rate forecast for a specific rate card entry
   */
  async generateForecast(criteria: ForecastCriteria): Promise<RateForecast> {
    const minMonths = criteria.minHistoricalMonths || this.MIN_DATA_POINTS;
    
    // Fetch historical rate data
    const historicalData = await this.fetchHistoricalRates(
      criteria.rateCardEntryId,
      criteria.tenantId,
      minMonths
    );

    if (historicalData.length < minMonths) {
      throw new InsufficientDataError(minMonths, historicalData.length);
    }

    // Calculate trend using linear regression
    const trend = this.calculateTrend(historicalData);
    
    // Generate forecasts for 3, 6, and 12 months
    const currentRate = historicalData[historicalData.length - 1].rate;
    const threeMonthForecast = this.forecastRate(trend, 3, historicalData);
    const sixMonthForecast = this.forecastRate(trend, 6, historicalData);
    const twelveMonthForecast = this.forecastRate(trend, 12, historicalData);

    // Determine trend direction and risk level
    const trendDirection = this.determineTrendDirection(trend.slope);
    const riskLevel = this.calculateRiskLevel(trend, historicalData);

    return {
      rateCardEntryId: criteria.rateCardEntryId,
      tenantId: criteria.tenantId,
      currentRate,
      forecastDate: new Date(),
      predictions: {
        threeMonth: threeMonthForecast,
        sixMonth: sixMonthForecast,
        twelveMonth: twelveMonthForecast,
      },
      trendDirection,
      trendCoefficient: trend.slope,
      riskLevel,
      confidence: this.calculateOverallConfidence(trend.rSquared, historicalData.length),
      historicalDataPoints: historicalData.length,
      modelVersion: this.MODEL_VERSION,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate trend trajectory with acceleration detection
   */
  async calculateTrendTrajectory(rateCardEntryId: string): Promise<TrendTrajectory> {
    // Fetch rate card to get tenantId
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
      select: { tenantId: true },
    });

    if (!rateCard) {
      throw new PredictiveAnalyticsError('Rate card not found', 'NOT_FOUND');
    }

    // Fetch historical data
    const historicalData = await this.fetchHistoricalRates(
      rateCardEntryId,
      rateCard.tenantId,
      12 // Look back 12 months
    );

    if (historicalData.length < 3) {
      throw new InsufficientDataError(3, historicalData.length);
    }

    // Calculate trend line
    const trendLine = this.calculateTrend(historicalData);
    
    // Calculate acceleration (change in slope over time)
    const acceleration = this.calculateAcceleration(historicalData);
    const isAccelerating = Math.abs(acceleration) > 0.01; // Threshold for significance

    // Project future rates
    const projectedRates = [];
    for (let i = 1; i <= 12; i++) {
      const projectedRate = trendLine.intercept + (trendLine.slope * (historicalData.length + i));
      projectedRates.push({
        date: addMonths(new Date(), i),
        rate: Math.max(0, projectedRate), // Ensure non-negative
      });
    }

    return {
      rateCardEntryId,
      historicalRates: historicalData,
      trendLine,
      acceleration,
      isAccelerating,
      projectedRates,
    };
  }

  /**
   * Detect rates with accelerating increases (>10% QoQ)
   */
  async detectAcceleratingRates(tenantId: string): Promise<HighRiskRate[]> {
    // Fetch all rate cards for tenant
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: {
        id: true,
        roleStandardized: true,
        rateAmount: true,
        updatedAt: true,
      },
    });

    const highRiskRates: HighRiskRate[] = [];

    for (const rateCard of rateCards) {
      try {
        // Get historical data
        const historicalData = await this.fetchHistoricalRates(
          rateCard.id,
          tenantId,
          6
        );

        if (historicalData.length < 4) continue; // Need at least 4 months

        // Calculate QoQ change
        const threeMonthsAgo = historicalData[historicalData.length - 4];
        const current = historicalData[historicalData.length - 1];
        const qoqChange = ((current.rate - threeMonthsAgo.rate) / threeMonthsAgo.rate) * 100;

        // Check if accelerating (>10% QoQ)
        if (qoqChange > 10) {
          // Generate forecast
          const forecast = await this.generateForecast({
            rateCardEntryId: rateCard.id,
            tenantId,
          });

          // Calculate risk score
          const riskScore = this.calculateRiskScore(qoqChange, forecast);

          // Identify risk factors
          const riskFactors = this.identifyRiskFactors(qoqChange, forecast);

          // Generate recommendations
          const recommendedActions = this.generateRecommendations(riskScore, forecast);

          highRiskRates.push({
            rateCardEntryId: rateCard.id,
            currentRate: current.rate,
            quarterOverQuarterChange: qoqChange,
            projectedSixMonthRate: forecast.predictions.sixMonth.rate,
            projectedTwelveMonthRate: forecast.predictions.twelveMonth.rate,
            riskScore,
            riskFactors,
            recommendedActions,
          });
        }
      } catch (error) {
        // Skip rates with insufficient data
        continue;
      }
    }

    // Sort by risk score descending
    return highRiskRates.sort((a, b) => b.riskScore - a.riskScore);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Fetch historical rate data for a rate card
   */
  private async fetchHistoricalRates(
    rateCardEntryId: string,
    tenantId: string,
    months: number
  ): Promise<Array<{ date: Date; rate: number }>> {
    const startDate = subMonths(new Date(), months);

    // In a real implementation, this would query a historical rates table
    // For now, we'll simulate by getting the current rate and creating a simple history
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
      select: {
        rateAmount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!rateCard) {
      return [];
    }

    // TODO: Replace with actual historical data query when available
    // For now, generate synthetic historical data based on current rate
    const historicalData: Array<{ date: Date; rate: number }> = [];
    const currentRate = parseFloat(rateCard.rateAmount.toString());
    
    for (let i = months; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      // Add small random variation for realistic data
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      const rate = currentRate * (1 + variation);
      historicalData.push({ date, rate });
    }

    return historicalData;
  }

  /**
   * Calculate linear regression trend
   */
  private calculateTrend(data: Array<{ date: Date; rate: number }>): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    const n = data.length;
    const x = data.map((_, i) => i); // Time index
    const y = data.map(d => d.rate);

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += Math.pow(x[i] - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Calculate R-squared
    const yPredicted = x.map(xi => intercept + slope * xi);
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - yPredicted[i], 2), 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

    return { slope, intercept, rSquared };
  }

  /**
   * Forecast rate for a specific number of months ahead
   */
  private forecastRate(
    trend: { slope: number; intercept: number; rSquared: number },
    monthsAhead: number,
    historicalData: Array<{ date: Date; rate: number }>
  ): ForecastPrediction {
    const n = historicalData.length;
    const forecastIndex = n + monthsAhead;
    const predictedRate = trend.intercept + (trend.slope * forecastIndex);

    // Calculate standard error
    const residuals = historicalData.map((d, i) => {
      const predicted = trend.intercept + (trend.slope * i);
      return d.rate - predicted;
    });
    const standardError = Math.sqrt(
      residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2)
    );

    // Calculate 95% confidence interval
    const tValue = 1.96; // Approximate for large samples
    const margin = tValue * standardError * Math.sqrt(1 + 1/n);
    
    const currentRate = historicalData[historicalData.length - 1].rate;
    const percentChange = ((predictedRate - currentRate) / currentRate) * 100;

    // Confidence decreases with forecast horizon and increases with R-squared
    const baseConfidence = trend.rSquared * 100;
    const horizonPenalty = monthsAhead * 2; // Lose 2% confidence per month
    const confidence = Math.max(0, Math.min(100, baseConfidence - horizonPenalty));

    return {
      rate: Math.max(0, predictedRate),
      confidence,
      confidenceInterval: {
        lower: Math.max(0, predictedRate - margin),
        upper: predictedRate + margin,
      },
      percentChange,
    };
  }

  /**
   * Calculate acceleration (2nd derivative)
   */
  private calculateAcceleration(data: Array<{ date: Date; rate: number }>): number {
    if (data.length < 3) return 0;

    // Split data into two halves and calculate slopes
    const midpoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midpoint);
    const secondHalf = data.slice(midpoint);

    const firstSlope = this.calculateTrend(firstHalf).slope;
    const secondSlope = this.calculateTrend(secondHalf).slope;

    return secondSlope - firstSlope;
  }

  /**
   * Determine trend direction from slope
   */
  private determineTrendDirection(slope: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.01; // Threshold for significance
    if (Math.abs(slope) < threshold) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Calculate risk level based on trend and data quality
   */
  private calculateRiskLevel(
    trend: { slope: number; rSquared: number },
    data: Array<{ date: Date; rate: number }>
  ): 'low' | 'medium' | 'high' {
    const currentRate = data[data.length - 1].rate;
    const projectedRate = trend.intercept + (trend.slope * (data.length + 6));
    const sixMonthChange = ((projectedRate - currentRate) / currentRate) * 100;

    if (sixMonthChange > 15) return 'high';
    if (sixMonthChange > 8) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(rSquared: number, dataPoints: number): number {
    const fitConfidence = rSquared * 100;
    const dataConfidence = Math.min(100, (dataPoints / 12) * 100);
    return (fitConfidence * 0.7) + (dataConfidence * 0.3);
  }

  /**
   * Calculate risk score (0-100)
   */
  private calculateRiskScore(qoqChange: number, forecast: RateForecast): number {
    let score = 0;
    
    // QoQ change contribution (0-40 points)
    score += Math.min(40, (qoqChange / 20) * 40);
    
    // Trend direction contribution (0-30 points)
    if (forecast.trendDirection === 'increasing') score += 30;
    else if (forecast.trendDirection === 'stable') score += 15;
    
    // 12-month projection contribution (0-30 points)
    const yearChange = forecast.predictions.twelveMonth.percentChange;
    score += Math.min(30, (yearChange / 30) * 30);
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(qoqChange: number, forecast: RateForecast): string[] {
    const factors: string[] = [];
    
    if (qoqChange > 15) {
      factors.push('Rapid quarter-over-quarter rate increase');
    }
    
    if (forecast.trendDirection === 'increasing') {
      factors.push('Sustained upward trend detected');
    }
    
    if (forecast.predictions.twelveMonth.percentChange > 20) {
      factors.push('Projected 12-month increase exceeds 20%');
    }
    
    if (forecast.confidence < this.CONFIDENCE_THRESHOLD) {
      factors.push('Low forecast confidence due to data volatility');
    }
    
    return factors;
  }

  /**
   * Generate recommended actions
   */
  private generateRecommendations(riskScore: number, forecast: RateForecast): string[] {
    const recommendations: string[] = [];
    
    if (riskScore > 70) {
      recommendations.push('Immediate negotiation recommended');
      recommendations.push('Explore alternative suppliers');
      recommendations.push('Consider rate cap or fixed-price agreement');
    } else if (riskScore > 40) {
      recommendations.push('Schedule negotiation within 3 months');
      recommendations.push('Request rate justification from supplier');
      recommendations.push('Monitor market trends closely');
    } else {
      recommendations.push('Continue monitoring rate trends');
      recommendations.push('Plan for budget adjustment');
    }
    
    return recommendations;
  }
}

export default PredictiveAnalyticsService;
