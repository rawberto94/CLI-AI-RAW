/**
 * Anomaly Explainer Service
 * 
 * Detects and explains statistical anomalies in rate card data.
 * Provides AI-generated explanations for outliers and unusual patterns.
 * 
 * @module AnomalyExplainerService
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AnomalyDetectionResult {
  rateCardEntryId: string;
  hasAnomaly: boolean;
  anomalies: DetectedAnomaly[];
  overallSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresReview: boolean;
}

export interface DetectedAnomaly {
  type: 'STATISTICAL_OUTLIER' | 'RATE_SPIKE' | 'INCONSISTENT_CLASSIFICATION' | 'DATA_QUALITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviationSigma: number;
}

export interface AnomalyExplanation {
  anomaly: DetectedAnomaly;
  explanation: string;
  possibleCauses: string[];
  recommendations: string[];
  confidence: number;
}

export interface AnomalyReport {
  tenantId: string;
  totalRateCards: number;
  anomaliesDetected: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  anomaliesByType: Record<string, number>;
  topAnomalies: AnomalyDetectionResult[];
  generatedAt: Date;
}

// ============================================================================
// Anomaly Explainer Service
// ============================================================================

export class AnomalyExplainerService {
  private prisma: PrismaClient;
  private readonly OUTLIER_THRESHOLD_SIGMA = 2; // 2 standard deviations
  private readonly EXTREME_OUTLIER_SIGMA = 3; // 3 standard deviations

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // Anomaly Detection
  // ==========================================================================

  /**
   * Detect anomalies in a rate card entry
   */
  async detectAnomalies(rateCardEntryId: string): Promise<AnomalyDetectionResult> {
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    const benchmark = await this.prisma.benchmarkSnapshot.findFirst({
      where: { rateCardEntryId },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!benchmark) {
      // No benchmark available, can't detect anomalies
      return {
        rateCardEntryId,
        hasAnomaly: false,
        anomalies: [],
        overallSeverity: 'LOW',
        requiresReview: false,
      };
    }

    const anomalies: DetectedAnomaly[] = [];

    // Check for statistical outliers
    const outlierAnomaly = this.detectStatisticalOutlier(rateCard, benchmark);
    if (outlierAnomaly) anomalies.push(outlierAnomaly);

    // Check for rate spikes
    const spikeAnomaly = await this.detectRateSpike(rateCard);
    if (spikeAnomaly) anomalies.push(spikeAnomaly);

    // Check for classification inconsistencies
    const classificationAnomaly = await this.detectClassificationInconsistency(rateCard, benchmark);
    if (classificationAnomaly) anomalies.push(classificationAnomaly);

    // Check for data quality issues
    const dataQualityAnomaly = this.detectDataQualityIssues(rateCard);
    if (dataQualityAnomaly) anomalies.push(dataQualityAnomaly);

    // Determine overall severity
    const overallSeverity = this.calculateOverallSeverity(anomalies);
    const requiresReview = overallSeverity === 'HIGH' || anomalies.length >= 2;

    return {
      rateCardEntryId,
      hasAnomaly: anomalies.length > 0,
      anomalies,
      overallSeverity,
      requiresReview,
    };
  }

  /**
   * Detect statistical outliers (>2σ from mean)
   */
  private detectStatisticalOutlier(rateCard: any, benchmark: any): DetectedAnomaly | null {
    const rate = Number(rateCard.dailyRateUSD);
    const mean = Number(benchmark.average);
    const stdDev = Number(benchmark.standardDeviation);

    if (stdDev === 0) return null;

    const deviationSigma = Math.abs((rate - mean) / stdDev);

    if (deviationSigma > this.OUTLIER_THRESHOLD_SIGMA) {
      const severity: DetectedAnomaly['severity'] = 
        deviationSigma > this.EXTREME_OUTLIER_SIGMA ? 'HIGH' : 
        deviationSigma > 2.5 ? 'MEDIUM' : 'LOW';

      return {
        type: 'STATISTICAL_OUTLIER',
        severity,
        description: `Rate is ${deviationSigma.toFixed(2)} standard deviations from market mean`,
        metric: 'dailyRateUSD',
        expectedValue: mean,
        actualValue: rate,
        deviationSigma,
      };
    }

    return null;
  }

  /**
   * Detect sudden rate spikes compared to historical data
   */
  private async detectRateSpike(rateCard: any): Promise<DetectedAnomaly | null> {
    // Get historical rates for same role/location
    const historicalRates = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId: rateCard.tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
        supplierId: rateCard.supplierId,
        effectiveDate: {
          lt: rateCard.effectiveDate,
        },
      },
      orderBy: { effectiveDate: 'desc' },
      take: 5,
    });

    if (historicalRates.length === 0) return null;

    const currentRate = Number(rateCard.dailyRateUSD);
    const previousRate = Number(historicalRates[0].dailyRateUSD);
    const increasePercent = ((currentRate - previousRate) / previousRate) * 100;

    // Flag if rate increased by more than 20%
    if (increasePercent > 20) {
      const severity: DetectedAnomaly['severity'] = 
        increasePercent > 50 ? 'HIGH' : 
        increasePercent > 30 ? 'MEDIUM' : 'LOW';

      return {
        type: 'RATE_SPIKE',
        severity,
        description: `Rate increased ${increasePercent.toFixed(1)}% from previous rate`,
        metric: 'rateChange',
        expectedValue: previousRate,
        actualValue: currentRate,
        deviationSigma: increasePercent / 10, // Normalize to sigma-like scale
      };
    }

    return null;
  }

  /**
   * Detect classification inconsistencies
   */
  private async detectClassificationInconsistency(
    rateCard: any,
    benchmark: any
  ): Promise<DetectedAnomaly | null> {
    const rate = Number(rateCard.dailyRateUSD);
    const percentileRank = benchmark.percentileRank;

    // Check if seniority classification seems inconsistent with rate
    const seniorityExpectations: Record<string, { minPercentile: number; maxPercentile: number }> = {
      'JUNIOR': { minPercentile: 0, maxPercentile: 40 },
      'MID_LEVEL': { minPercentile: 30, maxPercentile: 70 },
      'SENIOR': { minPercentile: 50, maxPercentile: 90 },
      'LEAD': { minPercentile: 60, maxPercentile: 95 },
      'PRINCIPAL': { minPercentile: 70, maxPercentile: 100 },
    };

    const expected = seniorityExpectations[rateCard.seniority];
    if (!expected) return null;

    const isInconsistent = 
      percentileRank < expected.minPercentile || 
      percentileRank > expected.maxPercentile;

    if (isInconsistent) {
      const severity: DetectedAnomaly['severity'] = 
        Math.abs(percentileRank - (expected.minPercentile + expected.maxPercentile) / 2) > 30 ? 'HIGH' : 'MEDIUM';

      return {
        type: 'INCONSISTENT_CLASSIFICATION',
        severity,
        description: `${rateCard.seniority} classification inconsistent with ${percentileRank}th percentile rate`,
        metric: 'seniorityClassification',
        expectedValue: (expected.minPercentile + expected.maxPercentile) / 2,
        actualValue: percentileRank,
        deviationSigma: Math.abs(percentileRank - (expected.minPercentile + expected.maxPercentile) / 2) / 15,
      };
    }

    return null;
  }

  /**
   * Detect data quality issues
   */
  private detectDataQualityIssues(rateCard: any): DetectedAnomaly | null {
    const issues: string[] = [];

    // Check for missing critical fields
    if (!rateCard.roleStandardized) issues.push('Missing standardized role');
    if (!rateCard.seniority) issues.push('Missing seniority level');
    if (!rateCard.country) issues.push('Missing country');
    if (!rateCard.effectiveDate) issues.push('Missing effective date');

    // Check for suspicious values
    const rate = Number(rateCard.dailyRateUSD);
    if (rate < 50 || rate > 5000) {
      issues.push(`Unusual rate value: $${rate}/day`);
    }

    if (issues.length > 0) {
      return {
        type: 'DATA_QUALITY',
        severity: issues.length > 2 ? 'HIGH' : 'MEDIUM',
        description: `Data quality issues detected: ${issues.join(', ')}`,
        metric: 'dataCompleteness',
        expectedValue: 100,
        actualValue: ((5 - issues.length) / 5) * 100,
        deviationSigma: issues.length,
      };
    }

    return null;
  }

  // ==========================================================================
  // Anomaly Explanation
  // ==========================================================================

  /**
   * Generate detailed explanation for an anomaly
   */
  async explainAnomaly(anomaly: DetectedAnomaly, rateCardEntryId: string): Promise<AnomalyExplanation> {
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    const explanation = this.generateExplanation(anomaly, rateCard);
    const possibleCauses = this.identifyPossibleCauses(anomaly, rateCard);
    const recommendations = this.generateRecommendations(anomaly, rateCard);
    const confidence = this.calculateExplanationConfidence(anomaly);

    return {
      anomaly,
      explanation,
      possibleCauses,
      recommendations,
      confidence,
    };
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(anomaly: DetectedAnomaly, rateCard: any): string {
    switch (anomaly.type) {
      case 'STATISTICAL_OUTLIER':
        return `The rate of $${anomaly.actualValue}/day for ${rateCard.roleStandardized} (${rateCard.seniority}) is ${anomaly.deviationSigma.toFixed(2)} standard deviations from the market average of $${anomaly.expectedValue.toFixed(0)}/day. This places it well outside the normal distribution of rates for this role and location, indicating either exceptional circumstances or potential data issues.`;

      case 'RATE_SPIKE':
        const increasePercent = ((anomaly.actualValue - anomaly.expectedValue) / anomaly.expectedValue * 100).toFixed(1);
        return `This rate represents a ${increasePercent}% increase from the previous rate of $${anomaly.expectedValue.toFixed(0)}/day. Such a significant increase in a short period is unusual and warrants investigation to understand the underlying reasons.`;

      case 'INCONSISTENT_CLASSIFICATION':
        return `The seniority classification of ${rateCard.seniority} appears inconsistent with the rate's market position at the ${anomaly.actualValue.toFixed(0)}th percentile. Typically, ${rateCard.seniority} roles fall within a different percentile range, suggesting possible misclassification or unique circumstances.`;

      case 'DATA_QUALITY':
        return `Data quality issues have been identified in this rate card entry. ${anomaly.description}. These issues may affect the accuracy of benchmarking and analysis.`;

      default:
        return `An anomaly has been detected in this rate card that requires review.`;
    }
  }

  /**
   * Identify possible causes for the anomaly
   */
  private identifyPossibleCauses(anomaly: DetectedAnomaly, rateCard: any): string[] {
    const causes: string[] = [];

    switch (anomaly.type) {
      case 'STATISTICAL_OUTLIER':
        if (anomaly.actualValue > anomaly.expectedValue) {
          causes.push('Premium supplier with specialized expertise or certifications');
          causes.push('Legacy contract with outdated pricing not yet renegotiated');
          causes.push('Unique location with limited supplier availability');
          causes.push('Additional services or value-adds bundled into the rate');
          causes.push('Currency conversion error or data entry mistake');
        } else {
          causes.push('Volume discount or strategic partnership pricing');
          causes.push('Offshore or nearshore delivery model');
          causes.push('Promotional or introductory pricing period');
          causes.push('Different scope or reduced service level');
        }
        break;

      case 'RATE_SPIKE':
        causes.push('Market-wide rate increases due to talent shortage');
        causes.push('Supplier-specific cost increases passed to client');
        causes.push('Scope expansion or additional requirements');
        causes.push('Contract renewal with unfavorable terms');
        causes.push('Data entry error or incorrect effective date');
        break;

      case 'INCONSISTENT_CLASSIFICATION':
        causes.push('Incorrect seniority level assignment');
        causes.push('Role title not accurately reflecting actual seniority');
        causes.push('Hybrid role spanning multiple seniority levels');
        causes.push('Geographic market differences in seniority definitions');
        break;

      case 'DATA_QUALITY':
        causes.push('Incomplete data entry during import');
        causes.push('Missing standardization or normalization');
        causes.push('System integration issues');
        causes.push('Manual data entry errors');
        break;
    }

    return causes;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(anomaly: DetectedAnomaly, rateCard: any): string[] {
    const recommendations: string[] = [];

    if (anomaly.severity === 'HIGH') {
      recommendations.push('Immediate review required - flag for urgent attention');
    }

    switch (anomaly.type) {
      case 'STATISTICAL_OUTLIER':
        recommendations.push('Verify data accuracy and contract terms');
        recommendations.push('Compare with similar roles from same supplier');
        if (anomaly.actualValue > anomaly.expectedValue) {
          recommendations.push('Initiate renegotiation with market data');
          recommendations.push('Evaluate alternative suppliers');
        } else {
          recommendations.push('Verify service quality and deliverables');
          recommendations.push('Document special terms for future reference');
        }
        break;

      case 'RATE_SPIKE':
        recommendations.push('Review contract amendment or change order');
        recommendations.push('Investigate market conditions and supplier justification');
        recommendations.push('Consider rate freeze or cap in future contracts');
        break;

      case 'INCONSISTENT_CLASSIFICATION':
        recommendations.push('Review and correct seniority classification');
        recommendations.push('Validate role requirements and actual skill level');
        recommendations.push('Update standardization rules if needed');
        break;

      case 'DATA_QUALITY':
        recommendations.push('Complete missing data fields');
        recommendations.push('Validate data accuracy with source documents');
        recommendations.push('Re-run standardization and normalization');
        break;
    }

    return recommendations;
  }

  // ==========================================================================
  // Bulk Analysis
  // ==========================================================================

  /**
   * Generate anomaly report for all rate cards in a tenant
   */
  async generateAnomalyReport(tenantId: string): Promise<AnomalyReport> {
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
    });

    const anomalyResults: AnomalyDetectionResult[] = [];
    const anomaliesByType: Record<string, number> = {};
    let highSeverityCount = 0;
    let mediumSeverityCount = 0;
    let lowSeverityCount = 0;

    for (const rateCard of rateCards) {
      const result = await this.detectAnomalies(rateCard.id);
      if (result.hasAnomaly) {
        anomalyResults.push(result);

        // Count by severity
        if (result.overallSeverity === 'HIGH') highSeverityCount++;
        else if (result.overallSeverity === 'MEDIUM') mediumSeverityCount++;
        else lowSeverityCount++;

        // Count by type
        result.anomalies.forEach(anomaly => {
          anomaliesByType[anomaly.type] = (anomaliesByType[anomaly.type] || 0) + 1;
        });
      }
    }

    // Sort by severity and get top anomalies
    const topAnomalies = anomalyResults
      .sort((a, b) => {
        const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.overallSeverity] - severityOrder[a.overallSeverity];
      })
      .slice(0, 20);

    return {
      tenantId,
      totalRateCards: rateCards.length,
      anomaliesDetected: anomalyResults.length,
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      anomaliesByType,
      topAnomalies,
      generatedAt: new Date(),
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Calculate overall severity from multiple anomalies
   */
  private calculateOverallSeverity(anomalies: DetectedAnomaly[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (anomalies.length === 0) return 'LOW';
    if (anomalies.some(a => a.severity === 'HIGH')) return 'HIGH';
    if (anomalies.filter(a => a.severity === 'MEDIUM').length >= 2) return 'HIGH';
    if (anomalies.some(a => a.severity === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate confidence in explanation
   */
  private calculateExplanationConfidence(anomaly: DetectedAnomaly): number {
    // Higher confidence for more extreme deviations
    if (anomaly.deviationSigma > 3) return 0.95;
    if (anomaly.deviationSigma > 2.5) return 0.85;
    if (anomaly.deviationSigma > 2) return 0.75;
    return 0.65;
  }
}
