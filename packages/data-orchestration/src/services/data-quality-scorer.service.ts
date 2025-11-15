/**
 * Data Quality Scorer Service
 * 
 * Calculates comprehensive data quality scores for rate card entries.
 * Evaluates completeness, accuracy, consistency, and timeliness.
 * 
 * @module DataQualityScorerService
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DataQualityScore {
  rateCardEntryId: string;
  overallScore: number; // 0-100
  dimensions: QualityDimensions;
  issues: QualityIssue[];
  recommendations: string[];
  calculatedAt: Date;
}

export interface QualityDimensions {
  completeness: number; // 0-100
  accuracy: number; // 0-100
  consistency: number; // 0-100
  timeliness: number; // 0-100
}

export interface QualityIssue {
  dimension: 'COMPLETENESS' | 'ACCURACY' | 'CONSISTENCY' | 'TIMELINESS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  field?: string;
  description: string;
  impact: string;
}

export interface QualityReport {
  tenantId: string;
  totalRateCards: number;
  averageQualityScore: number;
  scoreDistribution: Record<string, number>;
  topIssues: Array<{ issue: string; count: number }>;
  lowQualityRateCards: Array<{
    id: string;
    score: number;
    issues: number;
  }>;
  generatedAt: Date;
}

// ============================================================================
// Data Quality Scorer Service
// ============================================================================

export class DataQualityScorerService {
  private prisma: PrismaClient;

  // Quality thresholds
  private readonly EXCELLENT_THRESHOLD = 90;
  private readonly GOOD_THRESHOLD = 75;
  private readonly ACCEPTABLE_THRESHOLD = 60;
  private readonly POOR_THRESHOLD = 40;

  // Weights for overall score calculation
  private readonly WEIGHTS = {
    completeness: 0.30,
    accuracy: 0.30,
    consistency: 0.25,
    timeliness: 0.15,
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // Quality Score Calculation
  // ==========================================================================

  /**
   * Calculate comprehensive quality score for a rate card entry
   */
  async calculateQualityScore(rateCardEntryId: string): Promise<DataQualityScore> {
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

    const issues: QualityIssue[] = [];

    // Calculate each dimension
    const completeness = this.calculateCompleteness(rateCard, issues);
    const accuracy = this.calculateAccuracy(rateCard, issues);
    const consistency = await this.calculateConsistency(rateCard, issues);
    const timeliness = this.calculateTimeliness(rateCard, issues);

    const dimensions: QualityDimensions = {
      completeness,
      accuracy,
      consistency,
      timeliness,
    };

    // Calculate overall score
    const overallScore = this.calculateOverallScore(dimensions);

    // Generate recommendations
    const recommendations = this.generateRecommendations(dimensions, issues);

    const qualityScore: DataQualityScore = {
      rateCardEntryId,
      overallScore,
      dimensions,
      issues,
      recommendations,
      calculatedAt: new Date(),
    };

    // Save to database
    await this.saveQualityScore(qualityScore);

    return qualityScore;
  }

  /**
   * Calculate completeness score (0-100)
   */
  private calculateCompleteness(rateCard: any, issues: QualityIssue[]): number {
    const requiredFields = [
      'dailyRateUSD',
      'roleStandardized',
      'seniority',
      'country',
      'region',
      'lineOfService',
      'supplierName',
      'supplierId',
      'supplierTier',
      'effectiveDate',
    ];

    const optionalFields = [
      'roleOriginal',
      'expiryDate',
      'volumeCommitted',
      'currency',
      'notes',
    ];

    let requiredFilled = 0;
    let optionalFilled = 0;

    // Check required fields
    requiredFields.forEach(field => {
      if (rateCard[field] !== null && rateCard[field] !== undefined && rateCard[field] !== '') {
        requiredFilled++;
      } else {
        issues.push({
          dimension: 'COMPLETENESS',
          severity: 'HIGH',
          field,
          description: `Required field '${field}' is missing`,
          impact: 'Prevents accurate benchmarking and analysis',
        });
      }
    });

    // Check optional fields
    optionalFields.forEach(field => {
      if (rateCard[field] !== null && rateCard[field] !== undefined && rateCard[field] !== '') {
        optionalFilled++;
      }
    });

    // Required fields are 80% of score, optional are 20%
    const requiredScore = (requiredFilled / requiredFields.length) * 80;
    const optionalScore = (optionalFilled / optionalFields.length) * 20;

    return Math.round(requiredScore + optionalScore);
  }

  /**
   * Calculate accuracy score (0-100)
   */
  private calculateAccuracy(rateCard: any, issues: QualityIssue[]): number {
    let accuracyScore = 100;
    const deductions: number[] = [];

    // Check rate value reasonableness
    const rate = Number(rateCard.dailyRateUSD);
    if (rate < 50 || rate > 5000) {
      const severity = rate < 10 || rate > 10000 ? 'HIGH' : 'MEDIUM';
      issues.push({
        dimension: 'ACCURACY',
        severity,
        field: 'dailyRateUSD',
        description: `Rate of $${rate}/day is outside typical range ($50-$5000)`,
        impact: 'May indicate data entry error or currency conversion issue',
      });
      deductions.push(severity === 'HIGH' ? 30 : 15);
    }

    // Check date logic
    if (rateCard.expiryDate && rateCard.effectiveDate) {
      const effective = new Date(rateCard.effectiveDate);
      const expiry = new Date(rateCard.expiryDate);
      if (expiry <= effective) {
        issues.push({
          dimension: 'ACCURACY',
          severity: 'HIGH',
          field: 'expiryDate',
          description: 'Expiry date is before or equal to effective date',
          impact: 'Invalid date range',
        });
        deductions.push(25);
      }
    }

    // Check volume committed reasonableness
    if (rateCard.volumeCommitted) {
      const volume = Number(rateCard.volumeCommitted);
      if (volume < 0 || volume > 365) {
        issues.push({
          dimension: 'ACCURACY',
          severity: 'MEDIUM',
          field: 'volumeCommitted',
          description: `Volume of ${volume} days is outside reasonable range (0-365)`,
          impact: 'May affect savings calculations',
        });
        deductions.push(10);
      }
    }

    // Check role/seniority alignment
    const seniorityRateExpectations: Record<string, { min: number; max: number }> = {
      'JUNIOR': { min: 50, max: 400 },
      'MID_LEVEL': { min: 200, max: 800 },
      'SENIOR': { min: 400, max: 1500 },
      'LEAD': { min: 600, max: 2000 },
      'PRINCIPAL': { min: 800, max: 3000 },
    };

    const expected = seniorityRateExpectations[rateCard.seniority];
    if (expected && (rate < expected.min * 0.5 || rate > expected.max * 2)) {
      issues.push({
        dimension: 'ACCURACY',
        severity: 'MEDIUM',
        field: 'seniority',
        description: `Rate of $${rate}/day seems inconsistent with ${rateCard.seniority} seniority level`,
        impact: 'May indicate misclassification',
      });
      deductions.push(15);
    }

    // Apply deductions
    const totalDeduction = deductions.reduce((sum, d) => sum + d, 0);
    accuracyScore = Math.max(0, accuracyScore - totalDeduction);

    return Math.round(accuracyScore);
  }

  /**
   * Calculate consistency score (0-100)
   */
  private async calculateConsistency(rateCard: any, issues: QualityIssue[]): Promise<number> {
    let consistencyScore = 100;

    // Get benchmark data if available
    const benchmark = rateCard.benchmarkSnapshot?.[0];
    if (!benchmark) {
      // No benchmark data to compare against
      issues.push({
        dimension: 'CONSISTENCY',
        severity: 'LOW',
        description: 'No benchmark data available for consistency check',
        impact: 'Cannot validate against market norms',
      });
      return 70; // Default score when no benchmark
    }

    const rate = Number(rateCard.dailyRateUSD);
    const median = Number(benchmark.median);
    const stdDev = Number(benchmark.standardDeviation);

    // Check deviation from market median
    if (stdDev > 0) {
      const deviationSigma = Math.abs((rate - median) / stdDev);
      
      if (deviationSigma > 3) {
        issues.push({
          dimension: 'CONSISTENCY',
          severity: 'HIGH',
          field: 'dailyRateUSD',
          description: `Rate is ${deviationSigma.toFixed(1)} standard deviations from market median`,
          impact: 'Extreme outlier - may indicate data quality issue',
        });
        consistencyScore -= 30;
      } else if (deviationSigma > 2) {
        issues.push({
          dimension: 'CONSISTENCY',
          severity: 'MEDIUM',
          field: 'dailyRateUSD',
          description: `Rate is ${deviationSigma.toFixed(1)} standard deviations from market median`,
          impact: 'Statistical outlier - warrants review',
        });
        consistencyScore -= 15;
      }
    }

    // Check for duplicate or near-duplicate entries
    const duplicates = await this.findNearDuplicates(rateCard);
    if (duplicates.length > 0) {
      issues.push({
        dimension: 'CONSISTENCY',
        severity: 'MEDIUM',
        description: `${duplicates.length} similar rate card(s) found`,
        impact: 'Possible duplicate entry',
      });
      consistencyScore -= 10;
    }

    return Math.max(0, Math.round(consistencyScore));
  }

  /**
   * Calculate timeliness score (0-100)
   */
  private calculateTimeliness(rateCard: any, issues: QualityIssue[]): number {
    const now = new Date();
    const createdAt = new Date(rateCard.createdAt);
    const updatedAt = new Date(rateCard.updatedAt);
    const effectiveDate = new Date(rateCard.effectiveDate);

    let timelinessScore = 100;

    // Check data freshness (how recently was it updated)
    const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceUpdate > 365) {
      issues.push({
        dimension: 'TIMELINESS',
        severity: 'HIGH',
        field: 'updatedAt',
        description: `Data not updated in ${Math.floor(daysSinceUpdate / 365)} year(s)`,
        impact: 'Stale data may not reflect current market conditions',
      });
      timelinessScore -= 40;
    } else if (daysSinceUpdate > 180) {
      issues.push({
        dimension: 'TIMELINESS',
        severity: 'MEDIUM',
        field: 'updatedAt',
        description: `Data not updated in ${Math.floor(daysSinceUpdate / 30)} months`,
        impact: 'Data may be outdated',
      });
      timelinessScore -= 20;
    } else if (daysSinceUpdate > 90) {
      timelinessScore -= 10;
    }

    // Check if rate is expired
    if (rateCard.expiryDate) {
      const expiryDate = new Date(rateCard.expiryDate);
      if (expiryDate < now) {
        const daysSinceExpiry = Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
        issues.push({
          dimension: 'TIMELINESS',
          severity: 'HIGH',
          field: 'expiryDate',
          description: `Rate expired ${daysSinceExpiry} days ago`,
          impact: 'Expired rate should not be used for benchmarking',
        });
        timelinessScore -= 30;
      }
    }

    // Check if effective date is in the future
    if (effectiveDate > now) {
      issues.push({
        dimension: 'TIMELINESS',
        severity: 'MEDIUM',
        field: 'effectiveDate',
        description: 'Effective date is in the future',
        impact: 'Rate is not yet active',
      });
      timelinessScore -= 15;
    }

    return Math.max(0, Math.round(timelinessScore));
  }

  /**
   * Calculate overall quality score from dimensions
   */
  private calculateOverallScore(dimensions: QualityDimensions): number {
    const overall = 
      dimensions.completeness * this.WEIGHTS.completeness +
      dimensions.accuracy * this.WEIGHTS.accuracy +
      dimensions.consistency * this.WEIGHTS.consistency +
      dimensions.timeliness * this.WEIGHTS.timeliness;

    return Math.round(overall);
  }

  /**
   * Generate recommendations based on quality issues
   */
  private generateRecommendations(dimensions: QualityDimensions, issues: QualityIssue[]): string[] {
    const recommendations: string[] = [];

    // Completeness recommendations
    if (dimensions.completeness < this.ACCEPTABLE_THRESHOLD) {
      recommendations.push('Complete all required fields to improve data quality');
      const missingFields = issues
        .filter(i => i.dimension === 'COMPLETENESS')
        .map(i => i.field)
        .filter(Boolean);
      if (missingFields.length > 0) {
        recommendations.push(`Priority fields to complete: ${missingFields.slice(0, 3).join(', ')}`);
      }
    }

    // Accuracy recommendations
    if (dimensions.accuracy < this.ACCEPTABLE_THRESHOLD) {
      recommendations.push('Review and correct data accuracy issues');
      if (issues.some(i => i.dimension === 'ACCURACY' && i.field === 'dailyRateUSD')) {
        recommendations.push('Verify rate value and currency conversion');
      }
    }

    // Consistency recommendations
    if (dimensions.consistency < this.ACCEPTABLE_THRESHOLD) {
      recommendations.push('Investigate outlier values and validate against market data');
      if (issues.some(i => i.description.includes('duplicate'))) {
        recommendations.push('Review and merge duplicate entries');
      }
    }

    // Timeliness recommendations
    if (dimensions.timeliness < this.ACCEPTABLE_THRESHOLD) {
      recommendations.push('Update stale data or mark as inactive');
      if (issues.some(i => i.description.includes('expired'))) {
        recommendations.push('Remove or archive expired rate cards');
      }
    }

    // Overall recommendations
    if (dimensions.completeness >= this.GOOD_THRESHOLD && 
        dimensions.accuracy >= this.GOOD_THRESHOLD &&
        dimensions.consistency >= this.GOOD_THRESHOLD &&
        dimensions.timeliness >= this.GOOD_THRESHOLD) {
      recommendations.push('Data quality is good - maintain current standards');
    }

    return recommendations;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Find near-duplicate rate cards
   */
  private async findNearDuplicates(rateCard: any): Promise<any[]> {
    const duplicates = await this.prisma.rateCardEntry.findMany({
      where: {
        id: { not: rateCard.id },
        tenantId: rateCard.tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
        supplierId: rateCard.supplierId,
        dailyRateUSD: {
          gte: Number(rateCard.dailyRateUSD) * 0.95,
          lte: Number(rateCard.dailyRateUSD) * 1.05,
        },
      },
      take: 5,
    });

    return duplicates;
  }

  /**
   * Save quality score to database
   */
  private async saveQualityScore(score: DataQualityScore): Promise<void> {
    await this.prisma.dataQuality.upsert({
      where: { rateCardEntryId: score.rateCardEntryId },
      create: {
        rateCardEntryId: score.rateCardEntryId,
        overallScore: score.overallScore,
        completeness: score.dimensions.completeness,
        accuracy: score.dimensions.accuracy,
        consistency: score.dimensions.consistency,
        timeliness: score.dimensions.timeliness,
        issues: score.issues as any,
        recommendations: score.recommendations as any,
        calculatedAt: score.calculatedAt,
      },
      update: {
        overallScore: score.overallScore,
        completeness: score.dimensions.completeness,
        accuracy: score.dimensions.accuracy,
        consistency: score.dimensions.consistency,
        timeliness: score.dimensions.timeliness,
        issues: score.issues as any,
        recommendations: score.recommendations as any,
        calculatedAt: score.calculatedAt,
      },
    });
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Generate quality report for all rate cards in a tenant
   */
  async generateQualityReport(tenantId: string): Promise<QualityReport> {
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      include: {
        dataQualityScore: true,
      },
    });

    const totalRateCards = rateCards.length;
    let totalScore = 0;
    const scoreDistribution: Record<string, number> = {
      'Excellent (90-100)': 0,
      'Good (75-89)': 0,
      'Acceptable (60-74)': 0,
      'Poor (40-59)': 0,
      'Critical (<40)': 0,
    };

    const issueCount: Record<string, number> = {};
    const lowQualityRateCards: Array<{ id: string; score: number; issues: number }> = [];

    for (const rateCard of rateCards) {
      let score: DataQualityScore;
      
      if (rateCard.dataQuality) {
        score = {
          rateCardEntryId: rateCard.id,
          overallScore: Number(rateCard.dataQuality.overallScore),
          dimensions: {
            completeness: Number(rateCard.dataQuality.completeness),
            accuracy: Number(rateCard.dataQuality.accuracy),
            consistency: Number(rateCard.dataQuality.consistency),
            timeliness: Number(rateCard.dataQuality.timeliness),
          },
          issues: rateCard.dataQuality.issues as any,
          recommendations: rateCard.dataQuality.recommendations as any,
          calculatedAt: rateCard.dataQuality.calculatedAt,
        };
      } else {
        // Calculate if not already done
        score = await this.calculateQualityScore(rateCard.id);
      }

      totalScore += score.overallScore;

      // Categorize score
      if (score.overallScore >= 90) scoreDistribution['Excellent (90-100)']++;
      else if (score.overallScore >= 75) scoreDistribution['Good (75-89)']++;
      else if (score.overallScore >= 60) scoreDistribution['Acceptable (60-74)']++;
      else if (score.overallScore >= 40) scoreDistribution['Poor (40-59)']++;
      else scoreDistribution['Critical (<40)']++;

      // Count issues
      score.issues.forEach(issue => {
        const key = `${issue.dimension}: ${issue.description}`;
        issueCount[key] = (issueCount[key] || 0) + 1;
      });

      // Track low quality rate cards
      if (score.overallScore < this.ACCEPTABLE_THRESHOLD) {
        lowQualityRateCards.push({
          id: rateCard.id,
          score: score.overallScore,
          issues: score.issues.length,
        });
      }
    }

    const averageQualityScore = totalRateCards > 0 ? totalScore / totalRateCards : 0;

    // Get top issues
    const topIssues = Object.entries(issueCount)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sort low quality rate cards by score
    lowQualityRateCards.sort((a, b) => a.score - b.score);

    return {
      tenantId,
      totalRateCards,
      averageQualityScore: Math.round(averageQualityScore),
      scoreDistribution,
      topIssues,
      lowQualityRateCards: lowQualityRateCards.slice(0, 20),
      generatedAt: new Date(),
    };
  }
}
