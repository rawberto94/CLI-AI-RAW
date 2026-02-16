import { prisma } from '../lib/prisma';


export interface ComplianceReportOptions {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  reportType?: 'full' | 'summary' | 'changes' | 'exports';
  userId?: string;
  includeDetails?: boolean;
}

export interface ComplianceReport {
  reportId: string;
  tenantId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalActivities: number;
    rateCardChanges: number;
    benchmarkCalculations: number;
    dataExports: number;
    userActions: number;
  };
  activities: ActivityLog[];
  userBreakdown: UserActivitySummary[];
  changesByType: Record<string, number>;
  exportsByUser: Record<string, number>;
}

export interface ActivityLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: {
    before: any;
    after: any;
  };
  metadata?: Record<string, any>;
}

export interface UserActivitySummary {
  userId: string;
  userName: string;
  totalActions: number;
  actionsByType: Record<string, number>;
  lastActivity: Date;
}

export class ComplianceReportingService {
  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(
    options: ComplianceReportOptions
  ): Promise<ComplianceReport> {
    const { tenantId, startDate, endDate, reportType = 'full', userId, includeDetails = true } = options;

    // Fetch audit logs for the period
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(userId && { userId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Calculate summary statistics
    const summary = {
      totalActivities: auditLogs.length,
      rateCardChanges: auditLogs.filter((log) => log.action.includes('rate_card')).length,
      benchmarkCalculations: auditLogs.filter((log) => log.action.includes('benchmark')).length,
      dataExports: auditLogs.filter((log) => log.action === 'export').length,
      userActions: new Set(auditLogs.map((log) => log.userId)).size,
    };

    // Process activities
    const activities: ActivityLog[] = includeDetails
      ? auditLogs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt,
          userId: log.userId || '',
          userName: log.user?.email || 'Unknown',
          action: log.action,
          entityType: log.entityType || log.resourceType || '',
          entityId: log.entityId || '',
          changes: log.changes as any,
          metadata: log.metadata as any,
        }))
      : [];

    // User breakdown
    const userBreakdown = this.calculateUserBreakdown(auditLogs);

    // Changes by type
    const changesByType = auditLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Exports by user
    const exportsByUser = auditLogs
      .filter((log) => log.action === 'export')
      .reduce((acc, log) => {
        const userName = log.user?.email || 'Unknown';
        acc[userName] = (acc[userName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      reportId: `CR-${Date.now()}`,
      tenantId,
      generatedAt: new Date(),
      period: {
        start: startDate,
        end: endDate,
      },
      summary,
      activities,
      userBreakdown,
      changesByType,
      exportsByUser,
    };
  }

  /**
   * Calculate user activity breakdown
   */
  private calculateUserBreakdown(auditLogs: any[]): UserActivitySummary[] {
    const userMap = new Map<string, UserActivitySummary>();

    auditLogs.forEach((log) => {
      const userId = log.userId;
      const userName = log.user?.name || 'Unknown';

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName,
          totalActions: 0,
          actionsByType: {},
          lastActivity: log.timestamp,
        });
      }

      const userSummary = userMap.get(userId)!;
      userSummary.totalActions++;
      userSummary.actionsByType[log.action] = (userSummary.actionsByType[log.action] || 0) + 1;

      if (log.timestamp > userSummary.lastActivity) {
        userSummary.lastActivity = log.timestamp;
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.totalActions - a.totalActions);
  }

  /**
   * Export compliance report to CSV
   */
  async exportToCSV(report: ComplianceReport): Promise<string> {
    const rows: string[] = [];

    // Header
    rows.push('Compliance Report');
    rows.push(`Report ID: ${report.reportId}`);
    rows.push(`Generated: ${report.generatedAt.toISOString()}`);
    rows.push(`Period: ${report.period.start.toISOString()} to ${report.period.end.toISOString()}`);
    rows.push('');

    // Summary
    rows.push('Summary');
    rows.push(`Total Activities,${report.summary.totalActivities}`);
    rows.push(`Rate Card Changes,${report.summary.rateCardChanges}`);
    rows.push(`Benchmark Calculations,${report.summary.benchmarkCalculations}`);
    rows.push(`Data Exports,${report.summary.dataExports}`);
    rows.push(`Active Users,${report.summary.userActions}`);
    rows.push('');

    // Activities
    if (report.activities.length > 0) {
      rows.push('Activity Log');
      rows.push('Timestamp,User,Action,Entity Type,Entity ID');
      report.activities.forEach((activity) => {
        rows.push(
          `${activity.timestamp.toISOString()},${activity.userName},${activity.action},${activity.entityType},${activity.entityId}`
        );
      });
      rows.push('');
    }

    // User breakdown
    rows.push('User Activity Summary');
    rows.push('User,Total Actions,Last Activity');
    report.userBreakdown.forEach((user) => {
      rows.push(`${user.userName},${user.totalActions},${user.lastActivity.toISOString()}`);
    });

    return rows.join('\n');
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(options: {
    tenantId: string;
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }) {
    const { tenantId, startDate, endDate, userId, action, entityType, limit = 100, offset = 0 } = options;

    const where: any = { tenantId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * Get compliance statistics for a period
   */
  async getComplianceStatistics(tenantId: string, startDate: Date, endDate: Date) {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const uniqueUsers = new Set(logs.map((log) => log.userId)).size;
    const actionTypes = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dailyActivity = logs.reduce((acc, log) => {
      const date = log.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActivities: logs.length,
      uniqueUsers,
      actionTypes,
      dailyActivity,
      averageActivitiesPerDay: logs.length / Object.keys(dailyActivity).length || 0,
    };
  }
}

export const complianceReportingService = new ComplianceReportingService();
