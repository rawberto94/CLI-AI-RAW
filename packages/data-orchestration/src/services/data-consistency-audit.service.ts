/**
 * Data Consistency Audit Service
 * 
 * Enhanced audit trail service specifically for data consistency tracking.
 * Logs all data modifications with before/after values and tracks user actions.
 * 
 * Requirements: 6.5 - THE System SHALL provide audit trails for all data modifications
 */

import { PrismaClient } from 'clients-db';
import { monitoringService } from './monitoring.service';
import { auditTrailService, AuditContext } from './audit-trail.service';

export interface DataModificationLog {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId: string;
  userName?: string;
  beforeData: any;
  afterData: any;
  changedFields: string[];
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  metadata?: any;
}

export interface AuditTrailQuery {
  tenantId: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  action?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class DataConsistencyAuditService {
  private db: PrismaClient;

  constructor() {
    this.db = new PrismaClient();
  }

  /**
   * Log a data creation event
   */
  async logCreate(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    data: any,
    context: {
      userId: string;
      userName?: string;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Use existing audit trail service
      await auditTrailService.logCreate(
        tenantId,
        resourceType,
        resourceId,
        resourceType,
        data,
        {
          userId: context.userId,
          userName: context.userName || 'Unknown',
          ipAddress: context.ipAddress || 'Unknown',
          userAgent: context.userAgent || 'Unknown'
        }
      );

      monitoringService.recordTiming(
        'data_consistency_audit.log_create',
        Date.now() - startTime,
        { resourceType }
      );

      monitoringService.incrementCounter('data_consistency_audit.logged', {
        action: 'CREATE',
        resourceType
      });
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.log_create',
        resourceType,
        resourceId
      });
    }
  }

  /**
   * Log a data update event with before/after values
   */
  async logUpdate(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    beforeData: any,
    afterData: any,
    context: {
      userId: string;
      userName?: string;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Calculate changed fields
      const changedFields = this.getChangedFields(beforeData, afterData);

      // Use existing audit trail service
      await auditTrailService.logUpdate(
        tenantId,
        resourceType,
        resourceId,
        resourceType,
        beforeData,
        afterData,
        {
          userId: context.userId,
          userName: context.userName || 'Unknown',
          ipAddress: context.ipAddress || 'Unknown',
          userAgent: context.userAgent || 'Unknown'
        }
      );

      monitoringService.recordTiming(
        'data_consistency_audit.log_update',
        Date.now() - startTime,
        { resourceType, changedFieldCount: changedFields.length.toString() }
      );

      monitoringService.incrementCounter('data_consistency_audit.logged', {
        action: 'UPDATE',
        resourceType
      });
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.log_update',
        resourceType,
        resourceId
      });
    }
  }

  /**
   * Log a data deletion event
   */
  async logDelete(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    data: any,
    context: {
      userId: string;
      userName?: string;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Use existing audit trail service
      await auditTrailService.logDelete(
        tenantId,
        resourceType,
        resourceId,
        resourceType,
        data,
        context.reason,
        {
          userId: context.userId,
          userName: context.userName || 'Unknown',
          ipAddress: context.ipAddress || 'Unknown',
          userAgent: context.userAgent || 'Unknown'
        }
      );

      monitoringService.recordTiming(
        'data_consistency_audit.log_delete',
        Date.now() - startTime,
        { resourceType }
      );

      monitoringService.incrementCounter('data_consistency_audit.logged', {
        action: 'DELETE',
        resourceType
      });
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.log_delete',
        resourceType,
        resourceId
      });
    }
  }

  /**
   * Get audit trail for a specific resource
   */
  async getResourceAuditTrail(
    tenantId: string,
    resourceType: string,
    resourceId: string
  ): Promise<DataModificationLog[]> {
    try {
      const logs = await auditTrailService.getResourceAuditTrail(
        tenantId,
        resourceType,
        resourceId
      );

      return logs.map(log => ({
        id: log.id,
        tenantId: log.tenantId,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        action: log.action as 'CREATE' | 'UPDATE' | 'DELETE',
        userId: log.userId,
        userName: log.userName,
        beforeData: log.changesBefore,
        afterData: log.changesAfter,
        changedFields: log.changedFields || [],
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        reason: log.reason,
        metadata: log.metadata
      }));
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.get_resource_audit_trail',
        resourceType,
        resourceId
      });

      return [];
    }
  }

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(query: AuditTrailQuery): Promise<{
    logs: DataModificationLog[];
    total: number;
  }> {
    try {
      const result = await auditTrailService.queryAuditLogs({
        tenantId: query.tenantId,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        userId: query.userId,
        action: query.action as any,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.offset ? Math.floor(query.offset / (query.limit || 50)) + 1 : 1,
        limit: query.limit || 50
      });

      const logs = result.logs.map(log => ({
        id: log.id,
        tenantId: log.tenantId,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        action: log.action as 'CREATE' | 'UPDATE' | 'DELETE',
        userId: log.userId,
        userName: log.userName,
        beforeData: log.changesBefore,
        afterData: log.changesAfter,
        changedFields: log.changedFields || [],
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        reason: log.reason,
        metadata: log.metadata
      }));

      return {
        logs,
        total: result.total
      };
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.query_audit_logs',
        query
      });

      return { logs: [], total: 0 };
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(
    tenantId: string,
    userId: string,
    days: number = 30
  ): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    recentActions: DataModificationLog[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await this.queryAuditLogs({
        tenantId,
        userId,
        startDate,
        limit: 100
      });

      const actionsByType: Record<string, number> = {};
      result.logs.forEach(log => {
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      });

      return {
        totalActions: result.total,
        actionsByType,
        recentActions: result.logs.slice(0, 10)
      };
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.get_user_activity_summary',
        userId
      });

      return {
        totalActions: 0,
        actionsByType: {},
        recentActions: []
      };
    }
  }

  /**
   * Get data modification statistics
   */
  async getModificationStatistics(
    tenantId: string,
    resourceType?: string,
    days: number = 7
  ): Promise<{
    totalModifications: number;
    creates: number;
    updates: number;
    deletes: number;
    byResourceType: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await this.queryAuditLogs({
        tenantId,
        resourceType,
        startDate,
        limit: 10000
      });

      const stats = {
        totalModifications: result.total,
        creates: 0,
        updates: 0,
        deletes: 0,
        byResourceType: {} as Record<string, number>,
        byUser: {} as Record<string, number>
      };

      result.logs.forEach(log => {
        // Count by action
        if (log.action === 'CREATE') stats.creates++;
        else if (log.action === 'UPDATE') stats.updates++;
        else if (log.action === 'DELETE') stats.deletes++;

        // Count by resource type
        stats.byResourceType[log.resourceType] = 
          (stats.byResourceType[log.resourceType] || 0) + 1;

        // Count by user
        const userName = log.userName || log.userId;
        stats.byUser[userName] = (stats.byUser[userName] || 0) + 1;
      });

      return stats;
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.get_modification_statistics',
        resourceType
      });

      return {
        totalModifications: 0,
        creates: 0,
        updates: 0,
        deletes: 0,
        byResourceType: {},
        byUser: {}
      };
    }
  }

  /**
   * Detect suspicious modifications
   */
  async detectSuspiciousModifications(
    tenantId: string,
    days: number = 1
  ): Promise<DataModificationLog[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await this.queryAuditLogs({
        tenantId,
        startDate,
        limit: 1000
      });

      // Detect suspicious patterns
      const suspicious: DataModificationLog[] = [];
      const userActionCounts: Record<string, number> = {};

      result.logs.forEach(log => {
        userActionCounts[log.userId] = (userActionCounts[log.userId] || 0) + 1;

        // Flag if user has made too many modifications
        if (userActionCounts[log.userId] > 100) {
          suspicious.push(log);
        }

        // Flag bulk deletes
        if (log.action === 'DELETE' && log.changedFields.length > 10) {
          suspicious.push(log);
        }
      });

      monitoringService.incrementCounter('data_consistency_audit.suspicious_detected', {
        count: suspicious.length.toString()
      });

      return suspicious;
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.detect_suspicious_modifications'
      });

      return [];
    }
  }

  /**
   * Compare two versions of data
   */
  compareVersions(before: any, after: any): {
    changedFields: string[];
    changes: Array<{
      field: string;
      before: any;
      after: any;
    }>;
  } {
    const changedFields = this.getChangedFields(before, after);
    const changes = changedFields.map(field => ({
      field,
      before: before[field],
      after: after[field]
    }));

    return { changedFields, changes };
  }

  /**
   * Get changed fields between two objects
   */
  private getChangedFields(before: any, after: any): string[] {
    const changed: string[] = [];
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {})
    ]);

    for (const key of allKeys) {
      // Skip system fields
      if (['updatedAt', 'version'].includes(key)) {
        continue;
      }

      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  /**
   * Export audit trail to JSON
   */
  async exportAuditTrail(
    tenantId: string,
    resourceType?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    try {
      const result = await this.queryAuditLogs({
        tenantId,
        resourceType,
        startDate,
        endDate,
        limit: 10000
      });

      return JSON.stringify(result.logs, null, 2);
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_consistency_audit.export_audit_trail'
      });

      throw error;
    }
  }
}

export const dataConsistencyAuditService = new DataConsistencyAuditService();
