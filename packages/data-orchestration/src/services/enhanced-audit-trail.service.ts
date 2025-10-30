import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'EXPORT'
  | 'IMPORT'
  | 'CALCULATE'
  | 'APPROVE'
  | 'REJECT';

export type AuditResourceType =
  | 'RATE_CARD'
  | 'BENCHMARK'
  | 'FORECAST'
  | 'SUPPLIER'
  | 'OPPORTUNITY'
  | 'SEGMENT'
  | 'REPORT'
  | 'BASELINE';

interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  details: any;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

interface AuditLogFilter {
  tenantId: string;
  userId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Enhanced Audit Trail Service
 * Comprehensive logging for compliance and security
 */
export class EnhancedAuditTrailService {
  /**
   * Log an audit event
   */
  async logEvent(
    tenantId: string,
    action: AuditAction,
    resourceType: AuditResourceType,
    options: {
      userId?: string;
      resourceId?: string;
      details?: any;
      beforeState?: any;
      afterState?: any;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: options.userId,
          action,
          resourceType,
          resource: options.resourceId,
          details: {
            ...options.details,
            beforeState: options.beforeState,
            afterState: options.afterState,
          },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Log rate card modification
   */
  async logRateCardModification(
    tenantId: string,
    userId: string,
    rateCardId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    beforeState?: any,
    afterState?: any,
    metadata?: any
  ): Promise<void> {
    await this.logEvent(tenantId, action, 'RATE_CARD', {
      userId,
      resourceId: rateCardId,
      beforeState,
      afterState,
      details: {
        ...metadata,
        changes: this.calculateChanges(beforeState, afterState),
      },
    });
  }

  /**
   * Log benchmark calculation
   */
  async logBenchmarkCalculation(
    tenantId: string,
    userId: string,
    rateCardId: string,
    parameters: any,
    result: any
  ): Promise<void> {
    await this.logEvent(tenantId, 'CALCULATE', 'BENCHMARK', {
      userId,
      resourceId: rateCardId,
      details: {
        parameters,
        result: {
          cohortSize: result.cohortSize,
          median: result.median,
          percentileRank: result.percentileRank,
        },
      },
    });
  }

  /**
   * Log data export
   */
  async logDataExport(
    tenantId: string,
    userId: string,
    exportType: string,
    scope: {
      filters?: any;
      recordCount?: number;
      format?: string;
    }
  ): Promise<void> {
    await this.logEvent(tenantId, 'EXPORT', 'RATE_CARD', {
      userId,
      details: {
        exportType,
        ...scope,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Query audit logs
   */
  async queryLogs(filter: AuditLogFilter): Promise<AuditLogEntry[]> {
    const where: any = {
      tenantId: filter.tenantId,
    };

    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = filter.action;
    if (filter.resourceType) where.resourceType = filter.resourceType;
    if (filter.resourceId) where.resource = filter.resourceId;

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: filter.limit || 100,
    });

    return logs.map((log) => ({
      id: log.id,
      tenantId: log.tenantId,
      userId: log.userId || undefined,
      action: log.action as AuditAction,
      resourceType: log.resourceType as AuditResourceType,
      resourceId: log.resource || undefined,
      details: log.details,
      beforeState: (log.details as any)?.beforeState,
      afterState: (log.details as any)?.afterState,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      timestamp: log.createdAt,
    }));
  }

  /**
   * Get audit trail for specific resource
   */
  async getResourceAuditTrail(
    tenantId: string,
    resourceType: AuditResourceType,
    resourceId: string
  ): Promise<AuditLogEntry[]> {
    return await this.queryLogs({
      tenantId,
      resourceType,
      resourceId,
      limit: 1000,
    });
  }

  /**
   * Get user activity
   */
  async getUserActivity(
    tenantId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditLogEntry[]> {
    return await this.queryLogs({
      tenantId,
      userId,
      startDate,
      endDate,
      limit: 500,
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByResourceType: Record<string, number>;
    eventsByUser: Record<string, number>;
    criticalEvents: AuditLogEntry[];
    dataExports: AuditLogEntry[];
  }> {
    const logs = await this.queryLogs({
      tenantId,
      startDate,
      endDate,
      limit: 10000,
    });

    const eventsByAction: Record<string, number> = {};
    const eventsByResourceType: Record<string, number> = {};
    const eventsByUser: Record<string, number> = {};
    const criticalEvents: AuditLogEntry[] = [];
    const dataExports: AuditLogEntry[] = [];

    logs.forEach((log) => {
      // Count by action
      eventsByAction[log.action] = (eventsByAction[log.action] || 0) + 1;

      // Count by resource type
      eventsByResourceType[log.resourceType] =
        (eventsByResourceType[log.resourceType] || 0) + 1;

      // Count by user
      if (log.userId) {
        eventsByUser[log.userId] = (eventsByUser[log.userId] || 0) + 1;
      }

      // Identify critical events
      if (['DELETE', 'APPROVE', 'REJECT'].includes(log.action)) {
        criticalEvents.push(log);
      }

      // Track exports
      if (log.action === 'EXPORT') {
        dataExports.push(log);
      }
    });

    return {
      totalEvents: logs.length,
      eventsByAction,
      eventsByResourceType,
      eventsByUser,
      criticalEvents,
      dataExports,
    };
  }

  /**
   * Calculate changes between before and after states
   */
  private calculateChanges(beforeState: any, afterState: any): any {
    if (!beforeState || !afterState) return null;

    const changes: any = {};

    // Compare all keys
    const allKeys = new Set([
      ...Object.keys(beforeState || {}),
      ...Object.keys(afterState || {}),
    ]);

    allKeys.forEach((key) => {
      const before = beforeState[key];
      const after = afterState[key];

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes[key] = {
          before,
          after,
        };
      }
    });

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Archive old audit logs
   */
  async archiveOldLogs(daysToKeep: number = 2555): Promise<number> {
    // 2555 days = ~7 years (compliance requirement)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // In production, move to archive storage instead of deleting
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV(filter: AuditLogFilter): Promise<string> {
    const logs = await this.queryLogs(filter);

    const headers = [
      'Timestamp',
      'User ID',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'Details',
    ];

    const rows = logs.map((log) => [
      log.timestamp.toISOString(),
      log.userId || '',
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.ipAddress || '',
      JSON.stringify(log.details),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    return csv;
  }
}

export const enhancedAuditTrailService = new EnhancedAuditTrailService();
