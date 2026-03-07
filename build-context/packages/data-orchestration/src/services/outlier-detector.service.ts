/**
 * Outlier Detector Service
 * 
 * Detects statistical outliers in rate card data (>3σ from mean).
 * Flags outliers for manual review and tracks resolution status.
 * 
 * @module OutlierDetectorService
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface OutlierDetectionResult {
  rateCardEntryId: string;
  isOutlier: boolean;
  outlierType: 'HIGH' | 'LOW' | 'NONE';
  deviationSigma: number;
  rate: number;
  marketMean: number;
  marketMedian: number;
  standardDeviation: number;
  severity: 'EXTREME' | 'MODERATE' | 'MILD' | 'NONE';
  flaggedForReview: boolean;
  reviewStatus: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  detectedAt: Date;
}

export interface OutlierReviewAction {
  rateCardEntryId: string;
  reviewedBy: string;
  reviewedAt: Date;
  action: 'CORRECT_DATA' | 'ACCEPT_AS_VALID' | 'MARK_INACTIVE' | 'MERGE_DUPLICATE' | 'INVESTIGATE_FURTHER';
  notes?: string;
  resolution?: string;
}

export interface OutlierReport {
  tenantId: string;
  totalRateCards: number;
  outliersDetected: number;
  extremeOutliers: number;
  moderateOutliers: number;
  mildOutliers: number;
  pendingReview: number;
  reviewed: number;
  resolved: number;
  dismissed: number;
  outliersByCategory: Record<string, number>;
  topOutliers: OutlierDetectionResult[];
  generatedAt: Date;
}

// ============================================================================
// Outlier Detector Service
// ============================================================================

export class OutlierDetectorService {
  private prisma: PrismaClient;

  // Outlier thresholds (standard deviations)
  private readonly EXTREME_THRESHOLD = 3.0;
  private readonly MODERATE_THRESHOLD = 2.5;
  private readonly MILD_THRESHOLD = 2.0;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // Outlier Detection
  // ==========================================================================

  /**
   * Detect if a rate card is a statistical outlier
   */
  async detectOutlier(rateCardEntryId: string): Promise<OutlierDetectionResult> {
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    // Get benchmark data
    const benchmark = await this.prisma.benchmarkSnapshot.findFirst({
      where: { rateCardEntryId },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!benchmark) {
      // No benchmark available, can't determine outlier status
      return {
        rateCardEntryId,
        isOutlier: false,
        outlierType: 'NONE',
        deviationSigma: 0,
        rate: Number(rateCard.dailyRateUSD),
        marketMean: 0,
        marketMedian: 0,
        standardDeviation: 0,
        severity: 'NONE',
        flaggedForReview: false,
        reviewStatus: 'DISMISSED',
        detectedAt: new Date(),
      };
    }

    const rate = Number(rateCard.dailyRateUSD);
    const mean = Number(benchmark.average);
    const median = Number(benchmark.median);
    const stdDev = Number(benchmark.standardDeviation);

    // Calculate deviation in standard deviations
    const deviationSigma = stdDev > 0 ? Math.abs((rate - mean) / stdDev) : 0;

    // Determine if outlier
    const isOutlier = deviationSigma >= this.MILD_THRESHOLD;
    
    // Determine outlier type
    let outlierType: OutlierDetectionResult['outlierType'] = 'NONE';
    if (isOutlier) {
      outlierType = rate > mean ? 'HIGH' : 'LOW';
    }

    // Determine severity
    let severity: OutlierDetectionResult['severity'] = 'NONE';
    if (deviationSigma >= this.EXTREME_THRESHOLD) {
      severity = 'EXTREME';
    } else if (deviationSigma >= this.MODERATE_THRESHOLD) {
      severity = 'MODERATE';
    } else if (deviationSigma >= this.MILD_THRESHOLD) {
      severity = 'MILD';
    }

    // Flag for review if extreme or moderate
    const flaggedForReview = severity === 'EXTREME' || severity === 'MODERATE';

    // Check existing review status
    const existingFlag = await this.prisma.outlierFlag.findUnique({
      where: { rateCardEntryId },
    });

    const reviewStatus = existingFlag?.reviewStatus || 'PENDING';

    const result: OutlierDetectionResult = {
      rateCardEntryId,
      isOutlier,
      outlierType,
      deviationSigma,
      rate,
      marketMean: mean,
      marketMedian: median,
      standardDeviation: stdDev,
      severity,
      flaggedForReview,
      reviewStatus: reviewStatus as any,
      detectedAt: new Date(),
    };

    // Save or update outlier flag
    if (flaggedForReview) {
      await this.saveOutlierFlag(result);
    }

    return result;
  }

  /**
   * Detect all outliers for a tenant
   */
  async detectAllOutliers(tenantId: string): Promise<OutlierDetectionResult[]> {
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
    });

    const results: OutlierDetectionResult[] = [];

    for (const rateCard of rateCards) {
      try {
        const result = await this.detectOutlier(rateCard.id);
        if (result.isOutlier) {
          results.push(result);
        }
      } catch {
        // Outlier detection failed for rate card
      }
    }

    return results.sort((a, b) => b.deviationSigma - a.deviationSigma);
  }

  // ==========================================================================
  // Outlier Review & Resolution
  // ==========================================================================

  /**
   * Mark outlier as reviewed
   */
  async reviewOutlier(
    rateCardEntryId: string,
    reviewedBy: string,
    action: OutlierReviewAction['action'],
    notes?: string
  ): Promise<void> {
    const outlierFlag = await this.prisma.outlierFlag.findUnique({
      where: { rateCardEntryId },
    });

    if (!outlierFlag) {
      throw new Error('Outlier flag not found');
    }

    await this.prisma.outlierFlag.update({
      where: { rateCardEntryId },
      data: {
        reviewStatus: 'REVIEWED',
        reviewedBy,
        reviewedAt: new Date(),
        reviewAction: action,
        reviewNotes: notes,
      },
    });

    // Create review action record
    await this.prisma.outlierReviewAction.create({
      data: {
        rateCardEntryId,
        reviewedBy,
        reviewedAt: new Date(),
        action,
        notes,
      },
    });
  }

  /**
   * Mark outlier as resolved
   */
  async resolveOutlier(
    rateCardEntryId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    await this.prisma.outlierFlag.update({
      where: { rateCardEntryId },
      data: {
        reviewStatus: 'RESOLVED',
        resolvedBy,
        resolvedAt: new Date(),
        resolution,
      },
    });
  }

  /**
   * Dismiss outlier (accept as valid)
   */
  async dismissOutlier(
    rateCardEntryId: string,
    dismissedBy: string,
    reason: string
  ): Promise<void> {
    await this.prisma.outlierFlag.update({
      where: { rateCardEntryId },
      data: {
        reviewStatus: 'DISMISSED',
        reviewedBy: dismissedBy,
        reviewedAt: new Date(),
        reviewNotes: reason,
      },
    });
  }

  /**
   * Get pending outliers for review
   */
  async getPendingOutliers(tenantId: string): Promise<OutlierDetectionResult[]> {
    const flags = await this.prisma.outlierFlag.findMany({
      where: {
        tenantId,
        reviewStatus: 'PENDING',
      },
      include: {
        rateCardEntry: true,
      },
      orderBy: { deviationSigma: 'desc' },
    });

    return flags.map(flag => ({
      rateCardEntryId: flag.rateCardEntryId,
      isOutlier: true,
      outlierType: flag.outlierType as any,
      deviationSigma: Number(flag.deviationSigma),
      rate: Number(flag.rateCardEntry.dailyRateUSD),
      marketMean: Number(flag.marketMean),
      marketMedian: Number(flag.marketMedian),
      standardDeviation: Number(flag.standardDeviation),
      severity: flag.severity as any,
      flaggedForReview: true,
      reviewStatus: flag.reviewStatus as any,
      detectedAt: flag.detectedAt,
    }));
  }

  // ==========================================================================
  // Reporting
  // ==========================================================================

  /**
   * Generate comprehensive outlier report
   */
  async generateOutlierReport(tenantId: string): Promise<OutlierReport> {
    const allOutliers = await this.detectAllOutliers(tenantId);
    const totalRateCards = await this.prisma.rateCardEntry.count({
      where: { tenantId },
    });

    const extremeOutliers = allOutliers.filter(o => o.severity === 'EXTREME').length;
    const moderateOutliers = allOutliers.filter(o => o.severity === 'MODERATE').length;
    const mildOutliers = allOutliers.filter(o => o.severity === 'MILD').length;

    const pendingReview = allOutliers.filter(o => o.reviewStatus === 'PENDING').length;
    const reviewed = allOutliers.filter(o => o.reviewStatus === 'REVIEWED').length;
    const resolved = allOutliers.filter(o => o.reviewStatus === 'RESOLVED').length;
    const dismissed = allOutliers.filter(o => o.reviewStatus === 'DISMISSED').length;

    // Count by category (role)
    const outliersByCategory: Record<string, number> = {};
    for (const outlier of allOutliers) {
      const rateCard = await this.prisma.rateCardEntry.findUnique({
        where: { id: outlier.rateCardEntryId },
        select: { roleStandardized: true },
      });
      if (rateCard) {
        const role = rateCard.roleStandardized;
        outliersByCategory[role] = (outliersByCategory[role] || 0) + 1;
      }
    }

    return {
      tenantId,
      totalRateCards,
      outliersDetected: allOutliers.length,
      extremeOutliers,
      moderateOutliers,
      mildOutliers,
      pendingReview,
      reviewed,
      resolved,
      dismissed,
      outliersByCategory,
      topOutliers: allOutliers.slice(0, 20),
      generatedAt: new Date(),
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Save outlier flag to database
   */
  private async saveOutlierFlag(result: OutlierDetectionResult): Promise<void> {
    // Get tenantId from rate card
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: result.rateCardEntryId },
      select: { tenantId: true },
    });

    if (!rateCard) {
      throw new Error(`Rate card not found: ${result.rateCardEntryId}`);
    }

    await this.prisma.outlierFlag.upsert({
      where: { rateCardEntryId: result.rateCardEntryId },
      create: {
        rateCardEntryId: result.rateCardEntryId,
        tenantId: rateCard.tenantId,
        outlierType: result.outlierType,
        deviationSigma: result.deviationSigma,
        marketMean: result.marketMean,
        marketMedian: result.marketMedian,
        standardDeviation: result.standardDeviation,
        severity: result.severity,
        reviewStatus: 'PENDING',
        detectedAt: result.detectedAt,
      },
      update: {
        outlierType: result.outlierType,
        deviationSigma: result.deviationSigma,
        marketMean: result.marketMean,
        marketMedian: result.marketMedian,
        standardDeviation: result.standardDeviation,
        severity: result.severity,
        detectedAt: result.detectedAt,
      },
    });
  }
}
