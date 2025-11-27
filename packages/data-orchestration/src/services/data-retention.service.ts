// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RetentionPolicy {
  entityType: string;
  retentionDays: number;
  archiveBeforeDelete: boolean;
  enabled: boolean;
}

export interface RetentionResult {
  entityType: string;
  recordsArchived: number;
  recordsDeleted: number;
  oldestRetained: Date;
  executedAt: Date;
}

export class DataRetentionService {
  // Default retention policies (7 years for audit logs per compliance requirements)
  private defaultPolicies: RetentionPolicy[] = [
    {
      entityType: 'auditLog',
      retentionDays: 2555, // 7 years
      archiveBeforeDelete: true,
      enabled: true,
    },
    {
      entityType: 'rateCardEntry',
      retentionDays: 1825, // 5 years
      archiveBeforeDelete: true,
      enabled: false, // Disabled by default, enable per tenant
    },
    {
      entityType: 'benchmark',
      retentionDays: 730, // 2 years
      archiveBeforeDelete: false,
      enabled: false,
    },
    {
      entityType: 'forecast',
      retentionDays: 365, // 1 year
      archiveBeforeDelete: false,
      enabled: true,
    },
  ];

  /**
   * Apply retention policies for a tenant
   */
  async applyRetentionPolicies(tenantId: string): Promise<RetentionResult[]> {
    const results: RetentionResult[] = [];

    for (const policy of this.defaultPolicies) {
      if (!policy.enabled) continue;

      const result = await this.applyPolicy(tenantId, policy);
      results.push(result);
    }

    return results;
  }

  /**
   * Apply a single retention policy
   */
  private async applyPolicy(tenantId: string, policy: RetentionPolicy): Promise<RetentionResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    let recordsArchived = 0;
    let recordsDeleted = 0;

    switch (policy.entityType) {
      case 'auditLog':
        if (policy.archiveBeforeDelete) {
          recordsArchived = await this.archiveAuditLogs(tenantId, cutoffDate);
        }
        recordsDeleted = await this.deleteAuditLogs(tenantId, cutoffDate);
        break;

      case 'rateCardEntry':
        if (policy.archiveBeforeDelete) {
          recordsArchived = await this.archiveRateCards(tenantId, cutoffDate);
        }
        recordsDeleted = await this.deleteRateCards(tenantId, cutoffDate);
        break;

      case 'benchmark':
        recordsDeleted = await this.deleteBenchmarks(tenantId, cutoffDate);
        break;

      case 'forecast':
        recordsDeleted = await this.deleteForecasts(tenantId, cutoffDate);
        break;
    }

    return {
      entityType: policy.entityType,
      recordsArchived,
      recordsDeleted,
      oldestRetained: cutoffDate,
      executedAt: new Date(),
    };
  }

  /**
   * Archive audit logs to cold storage
   */
  private async archiveAuditLogs(tenantId: string, cutoffDate: Date): Promise<number> {
    // Fetch old audit logs
    const oldLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    if (oldLogs.length === 0) return 0;

    // Create archive records
    await prisma.archivedAuditLog.createMany({
      data: oldLogs.map((log) => ({
        ...log,
        archivedAt: new Date(),
      })),
      skipDuplicates: true,
    });

    return oldLogs.length;
  }

  /**
   * Delete old audit logs
   */
  private async deleteAuditLogs(tenantId: string, cutoffDate: Date): Promise<number> {
    const result = await prisma.auditLog.deleteMany({
      where: {
        tenantId,
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Archive old rate cards
   */
  private async archiveRateCards(tenantId: string, cutoffDate: Date): Promise<number> {
    const oldRateCards = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        createdAt: {
          lt: cutoffDate,
        },
        // Only archive inactive rate cards
        status: 'inactive',
      },
    });

    if (oldRateCards.length === 0) return 0;

    // Create archive records
    await prisma.archivedRateCard.createMany({
      data: oldRateCards.map((rc) => ({
        ...rc,
        archivedAt: new Date(),
      })),
      skipDuplicates: true,
    });

    return oldRateCards.length;
  }

  /**
   * Delete old rate cards
   */
  private async deleteRateCards(tenantId: string, cutoffDate: Date): Promise<number> {
    const result = await prisma.rateCardEntry.deleteMany({
      where: {
        tenantId,
        createdAt: {
          lt: cutoffDate,
        },
        status: 'inactive',
      },
    });

    return result.count;
  }

  /**
   * Delete old benchmarks
   */
  private async deleteBenchmarks(tenantId: string, cutoffDate: Date): Promise<number> {
    const result = await prisma.benchmark.deleteMany({
      where: {
        tenantId,
        calculatedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Delete old forecasts
   */
  private async deleteForecasts(tenantId: string, cutoffDate: Date): Promise<number> {
    const result = await prisma.rateForecast.deleteMany({
      where: {
        tenantId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get retention policy for entity type
   */
  getRetentionPolicy(entityType: string): RetentionPolicy | undefined {
    return this.defaultPolicies.find((p) => p.entityType === entityType);
  }

  /**
   * Update retention policy
   */
  updateRetentionPolicy(entityType: string, updates: Partial<RetentionPolicy>): void {
    const policyIndex = this.defaultPolicies.findIndex((p) => p.entityType === entityType);
    if (policyIndex >= 0) {
      this.defaultPolicies[policyIndex] = {
        ...this.defaultPolicies[policyIndex],
        ...updates,
      };
    }
  }

  /**
   * Get retention statistics
   */
  async getRetentionStatistics(tenantId: string) {
    const stats = await Promise.all([
      // Audit logs
      prisma.auditLog.count({ where: { tenantId } }),
      prisma.auditLog.findFirst({
        where: { tenantId },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      }),

      // Rate cards
      prisma.rateCardEntry.count({ where: { tenantId } }),
      prisma.rateCardEntry.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),

      // Forecasts
      prisma.rateForecast.count({ where: { tenantId } }),
      prisma.rateForecast.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      auditLogs: {
        count: stats[0],
        oldestRecord: stats[1]?.timestamp,
      },
      rateCards: {
        count: stats[2],
        oldestRecord: stats[3]?.createdAt,
      },
      forecasts: {
        count: stats[4],
        oldestRecord: stats[5]?.createdAt,
      },
    };
  }

  /**
   * Schedule automatic retention policy execution
   * This should be called by a cron job or scheduled task
   */
  async scheduleRetentionExecution() {
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true },
    });

    const results: Record<string, RetentionResult[]> = {};

    for (const tenant of tenants) {
      try {
        results[tenant.id] = await this.applyRetentionPolicies(tenant.id);
        console.log(`✅ Retention policies applied for tenant ${tenant.id}`);
      } catch (error) {
        console.error(`❌ Failed to apply retention policies for tenant ${tenant.id}:`, error);
      }
    }

    return results;
  }
}

export const dataRetentionService = new DataRetentionService();
