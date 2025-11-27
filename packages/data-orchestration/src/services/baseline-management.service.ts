// @ts-nocheck
/**
 * Baseline Management Service
 * 
 * Handles import, storage, and comparison of baseline rates using RateCardBaseline model
 * Enables savings calculations against target/historical/industry benchmarks
 */

import { PrismaClient, BaselineType, BaselineSource, ApprovalStatus, SeniorityLevel } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface BaselineImportRow {
  baselineName: string;
  baselineType: BaselineType;
  role: string;
  seniority?: SeniorityLevel;
  country?: string;
  region?: string;
  categoryL1?: string;
  categoryL2?: string;
  dailyRateUSD: number;
  currency?: string;
  minimumRate?: number;
  maximumRate?: number;
  tolerancePercentage?: number;
  source?: BaselineSource;
  sourceDetails?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  notes?: string;
}

export interface BaselineComparisonResult {
  rateCardEntryId: string;
  baselineId: string;
  baselineName: string;
  baselineType: BaselineType;
  actualRate: number;
  baselineRate: number;
  variance: number;
  variancePercentage: number;
  isWithinTolerance: boolean;
  potentialSavings: number;
  status: 'BELOW_BASELINE' | 'AT_BASELINE' | 'ABOVE_BASELINE';
}

export interface BulkImportResult {
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  baselineIds: string[];
}

export class BaselineManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Import baselines from CSV/JSON data
   */
  async importBaselines(
    tenantId: string,
    baselines: BaselineImportRow[],
    options: {
      updateExisting?: boolean;
      batchSize?: number;
      autoApprove?: boolean;
    } = {}
  ): Promise<BulkImportResult> {
    const { updateExisting = true, batchSize = 100, autoApprove = false } = options;
    
    const result: BulkImportResult = {
      imported: 0,
      updated: 0,
      failed: 0,
      errors: [],
      baselineIds: [],
    };

    // Get procurement category mappings if categories provided
    const categoryMap = new Map<string, string>();
    const uniqueCategories = [...new Set(
      baselines
        .filter(b => b.categoryL1 && b.categoryL2)
        .map(b => `${b.categoryL1}/${b.categoryL2}`)
    )];

    for (const catPath of uniqueCategories) {
      const [l1, l2] = catPath.split('/');
      const category = await this.prisma.procurementCategory.findFirst({
        where: { tenantId, categoryL1: l1, categoryL2: l2 },
      });
      if (category) {
        categoryMap.set(catPath, category.id);
      }
    }

    // Process in batches
    for (let i = 0; i < baselines.length; i += batchSize) {
      const batch = baselines.slice(i, i + batchSize);
      
      for (const [idx, baseline] of batch.entries()) {
        const rowNum = i + idx + 1;
        
        try {
          // Prepare baseline data
          const baselineData = {
            tenantId,
            baselineName: baseline.baselineName,
            baselineType: baseline.baselineType,
            roleStandardized: baseline.role,
            seniority: baseline.seniority || null,
            country: baseline.country,
            region: baseline.region,
            categoryL1: baseline.categoryL1,
            categoryL2: baseline.categoryL2,
            procurementCategoryId: baseline.categoryL1 && baseline.categoryL2
              ? categoryMap.get(`${baseline.categoryL1}/${baseline.categoryL2}`)
              : null,
            targetRateUSD: new Decimal(baseline.dailyRateUSD),
            targetRate: new Decimal(baseline.dailyRateUSD),
            currency: baseline.currency || 'USD',
            rateUnit: 'daily',
            minimumRate: baseline.minimumRate ? new Decimal(baseline.minimumRate) : null,
            maximumRate: baseline.maximumRate ? new Decimal(baseline.maximumRate) : null,
            tolerancePercentage: baseline.tolerancePercentage ? new Decimal(baseline.tolerancePercentage) : null,
            source: baseline.source || ('IMPORTED_FILE' as BaselineSource),
            sourceDetails: baseline.sourceDetails,
            effectiveDate: baseline.effectiveDate || new Date(),
            expiryDate: baseline.expiryDate,
            approvalStatus: autoApprove ? ('APPROVED' as ApprovalStatus) : ('PENDING' as ApprovalStatus),
            approvedAt: autoApprove ? new Date() : null,
            approvedBy: autoApprove ? 'system' : null,
            isActive: true,
            notes: baseline.notes,
            metadata: {
              importedAt: new Date().toISOString(),
              source: 'BULK_IMPORT',
            },
          };

          if (updateExisting) {
            // Try to find existing baseline
            const existing = await this.prisma.rateCardBaseline.findUnique({
              where: {
                tenantId_baselineName: {
                  tenantId,
                  baselineName: baseline.baselineName,
                },
              },
            });

            if (existing) {
              await this.prisma.rateCardBaseline.update({
                where: { id: existing.id },
                data: {
                  ...baselineData,
                  updatedAt: new Date(),
                },
              });
              result.updated++;
            } else {
              const created = await this.prisma.rateCardBaseline.create({
                data: baselineData,
              });
              result.baselineIds.push(created.id);
              result.imported++;
            }
          } else {
            const created = await this.prisma.rateCardBaseline.create({
              data: baselineData,
            });
            result.baselineIds.push(created.id);
            result.imported++;
          }
        } catch (error) {
          result.errors.push({
            row: rowNum,
            error: error instanceof Error ? error.message : String(error),
          });
          result.failed++;
        }
      }
    }

    return result;
  }

  /**
   * Compare rate card entry against baselines
   */
  async compareAgainstBaselines(
    rateCardEntryId: string
  ): Promise<BaselineComparisonResult[]> {
    const entry = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!entry) {
      throw new Error(`Rate card entry ${rateCardEntryId} not found`);
    }

    // Find matching baselines
    const baselines = await this.prisma.rateCardBaseline.findMany({
      where: {
        tenantId: entry.tenantId,
        isActive: true,
        approvalStatus: 'APPROVED',
        effectiveDate: { lte: new Date() },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: new Date() } },
        ],
        // Match on role
        roleStandardized: {
          contains: entry.roleStandardized || entry.lineOfService || '',
          mode: 'insensitive',
        },
      },
    });

    const comparisons: BaselineComparisonResult[] = [];
    const actualRate = Number(entry.dailyRateUSD);

    for (const baseline of baselines) {
      const baselineRate = Number(baseline.targetRateUSD);
      const variance = actualRate - baselineRate;
      const variancePercentage = (variance / baselineRate) * 100;
      
      const tolerance = baseline.tolerancePercentage 
        ? Number(baseline.tolerancePercentage) 
        : 5;
      const isWithinTolerance = Math.abs(variancePercentage) <= tolerance;
      
      let status: 'BELOW_BASELINE' | 'AT_BASELINE' | 'ABOVE_BASELINE';
      if (isWithinTolerance) {
        status = 'AT_BASELINE';
      } else if (variance < 0) {
        status = 'BELOW_BASELINE';
      } else {
        status = 'ABOVE_BASELINE';
      }

      comparisons.push({
        rateCardEntryId: entry.id,
        baselineId: baseline.id,
        baselineName: baseline.baselineName,
        baselineType: baseline.baselineType,
        actualRate,
        baselineRate,
        variance,
        variancePercentage,
        isWithinTolerance,
        potentialSavings: Math.max(0, variance),
        status,
      });
    }

    return comparisons;
  }

  /**
   * Bulk compare all rate card entries against baselines
   */
  async bulkCompareAgainstBaselines(
    tenantId: string,
    options: {
      minVariancePercentage?: number;
      baselineTypes?: BaselineType[];
      categoryL1?: string;
      categoryL2?: string;
    } = {}
  ): Promise<{
    totalEntries: number;
    entriesWithMatches: number;
    totalSavingsOpportunity: number;
    comparisons: Array<{
      entryId: string;
      resourceType: string;
      lineOfService: string;
      actualRate: number;
      comparisons: BaselineComparisonResult[];
      maxSavings: number;
    }>;
  }> {
    const { minVariancePercentage = 5, baselineTypes, categoryL1, categoryL2 } = options;

    // Get all rate card entries
    const entries = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
      },
    });

    // Get all approved baselines
    const baselineWhere: any = {
      tenantId,
      isActive: true,
      approvalStatus: 'APPROVED',
      effectiveDate: { lte: new Date() },
      OR: [
        { expiryDate: null },
        { expiryDate: { gte: new Date() } },
      ],
    };

    if (baselineTypes && baselineTypes.length > 0) {
      baselineWhere.baselineType = { in: baselineTypes };
    }

    if (categoryL1) {
      baselineWhere.categoryL1 = categoryL1;
    }

    if (categoryL2) {
      baselineWhere.categoryL2 = categoryL2;
    }

    const baselines = await this.prisma.rateCardBaseline.findMany({
      where: baselineWhere,
    });

    const comparisons = [];
    let totalSavingsOpportunity = 0;

    for (const entry of entries) {
      const actualRate = Number(entry.dailyRateUSD);
      const entryComparisons: BaselineComparisonResult[] = [];

      // Find matching baselines for this entry
      const matchingBaselines = baselines.filter(baseline => {
        const roleMatch = baseline.roleStandardized.toLowerCase().includes(
          (entry.roleStandardized || entry.lineOfService || '').toLowerCase()
        ) || (entry.roleStandardized || entry.lineOfService || '').toLowerCase().includes(
          baseline.roleStandardized.toLowerCase()
        );

        const countryMatch = !baseline.country || 
          baseline.country === entry.country || 
          baseline.isGlobal;

        return roleMatch && countryMatch;
      });

      for (const baseline of matchingBaselines) {
        const baselineRate = Number(baseline.targetRateUSD);
        const variance = actualRate - baselineRate;
        const variancePercentage = (variance / baselineRate) * 100;
        
        // Skip if below minimum threshold
        if (Math.abs(variancePercentage) < minVariancePercentage) {
          continue;
        }

        const tolerance = baseline.tolerancePercentage 
          ? Number(baseline.tolerancePercentage) 
          : 5;
        const isWithinTolerance = Math.abs(variancePercentage) <= tolerance;
        
        let status: 'BELOW_BASELINE' | 'AT_BASELINE' | 'ABOVE_BASELINE';
        if (isWithinTolerance) {
          status = 'AT_BASELINE';
        } else if (variance < 0) {
          status = 'BELOW_BASELINE';
        } else {
          status = 'ABOVE_BASELINE';
        }

        const potentialSavings = Math.max(0, variance);

        entryComparisons.push({
          rateCardEntryId: entry.id,
          baselineId: baseline.id,
          baselineName: baseline.baselineName,
          baselineType: baseline.baselineType,
          actualRate,
          baselineRate,
          variance,
          variancePercentage,
          isWithinTolerance,
          potentialSavings,
          status,
        });
      }

      if (entryComparisons.length > 0) {
        const maxSavings = Math.max(...entryComparisons.map(c => c.potentialSavings));
        totalSavingsOpportunity += maxSavings;

        comparisons.push({
          entryId: entry.id,
          resourceType: entry.roleStandardized || '',
          lineOfService: entry.lineOfService || '',
          actualRate,
          comparisons: entryComparisons,
          maxSavings,
        });
      }
    }

    // Sort by savings opportunity descending
    comparisons.sort((a, b) => b.maxSavings - a.maxSavings);

    return {
      totalEntries: entries.length,
      entriesWithMatches: comparisons.length,
      totalSavingsOpportunity,
      comparisons,
    };
  }

  /**
   * Get baseline statistics
   */
  async getBaselineStatistics(tenantId: string) {
    const [totalBaselines, activeBaselines, byType, byCategory] = await Promise.all([
      this.prisma.rateCardBaseline.count({ where: { tenantId } }),
      this.prisma.rateCardBaseline.count({
        where: { tenantId, isActive: true, approvalStatus: 'APPROVED' },
      }),
      this.prisma.rateCardBaseline.groupBy({
        by: ['baselineType'],
        where: { tenantId, isActive: true },
        _count: true,
        _avg: { targetRateUSD: true },
      }),
      this.prisma.rateCardBaseline.groupBy({
        by: ['categoryL1'],
        where: { tenantId, isActive: true, categoryL1: { not: null } },
        _count: true,
      }),
    ]);

    const typeBreakdown = byType.map(t => ({
      type: t.baselineType,
      count: t._count,
      avgRate: t._avg.targetRateUSD ? Number(t._avg.targetRateUSD) : 0,
    }));

    const categoryBreakdown = byCategory.map(c => ({
      category: c.categoryL1 || 'Uncategorized',
      count: c._count,
    }));

    return {
      totalBaselines,
      activeBaselines,
      byType: typeBreakdown,
      byCategory: categoryBreakdown,
    };
  }

  /**
   * Archive old baselines
   */
  async archiveOldBaselines(tenantId: string, olderThan: Date) {
    const result = await this.prisma.rateCardBaseline.updateMany({
      where: {
        tenantId,
        isActive: true,
        expiryDate: { lt: olderThan },
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return { archived: result.count };
  }

  /**
   * Delete baseline
   */
  async deleteBaseline(baselineId: string) {
    await this.prisma.rateCardBaseline.delete({
      where: { id: baselineId },
    });
  }

  /**
   * Update baseline status
   */
  async updateBaselineStatus(
    baselineId: string,
    approvalStatus: ApprovalStatus
  ) {
    return this.prisma.rateCardBaseline.update({
      where: { id: baselineId },
      data: { 
        approvalStatus, 
        approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Create baseline comparison record
   */
  async createComparisonRecord(
    comparison: BaselineComparisonResult,
    options: {
      volumeImpacted?: number;
      assignedTo?: string;
      notes?: string;
    } = {}
  ) {
    const { volumeImpacted, assignedTo, notes } = options;

    const annualSavingsImpact = volumeImpacted 
      ? comparison.potentialSavings * volumeImpacted * 220 // 220 working days
      : null;

    return this.prisma.baselineComparison.create({
      data: {
        tenantId: (await this.prisma.rateCardEntry.findUnique({
          where: { id: comparison.rateCardEntryId },
          select: { tenantId: true },
        }))!.tenantId,
        comparisonName: `${comparison.baselineName} vs ${comparison.rateCardEntryId}`,
        baselineId: comparison.baselineId,
        rateCardEntryId: comparison.rateCardEntryId,
        actualRate: new Decimal(comparison.actualRate),
        actualRateSource: 'RATE_CARD',
        variance: new Decimal(comparison.variance),
        variancePercentage: new Decimal(comparison.variancePercentage),
        isWithinTolerance: comparison.isWithinTolerance,
        potentialSavings: new Decimal(comparison.potentialSavings),
        annualSavingsImpact: annualSavingsImpact ? new Decimal(annualSavingsImpact) : null,
        volumeImpacted,
        assignedTo,
        notes,
        status: comparison.status === 'ABOVE_BASELINE' ? ('IDENTIFIED' as const) : ('REVIEWED' as const),
        actionRequired: comparison.status === 'ABOVE_BASELINE',
        priority: comparison.potentialSavings > 100 ? 1 : comparison.potentialSavings > 50 ? 2 : 3,
      },
    });
  }
}

export default BaselineManagementService;
