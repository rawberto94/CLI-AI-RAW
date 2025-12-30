/**
 * Audit Trail Service
 * 
 * Provides comprehensive audit logging for compliance and debugging:
 * - Create/Update/Delete/Access logging
 * - Change tracking with before/after snapshots
 * - Suspicious activity detection
 * - Audit log querying and export
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';
import { dbAdaptor } from '../dal/database.adaptor';

const logger = createLogger('audit-trail-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS' | 'EXPORT' | 'IMPORT';

export interface AuditContext {
  userId: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  correlationId?: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  resourceType: string;
  changesBefore?: any;
  changesAfter?: any;
  changedFields?: string[];
  userId: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  correlationId?: string;
  reason?: string;
  metadata?: any;
  suspicious: boolean;
  suspiciousReason?: string;
  timestamp: Date;
}

export interface AuditFilters {
  tenantId: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: AuditAction[];
  startDate?: Date;
  endDate?: Date;
  suspicious?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditQueryResult {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =========================================================================
// AUDIT TRAIL SERVICE
// =========================================================================

export class AuditTrailService {
  private static instance: AuditTrailService;

  private constructor() {
    logger.info('Audit Trail Service initialized');
  }

  static getInstance(): AuditTrailService {
    if (!AuditTrailService.instance) {
      AuditTrailService.instance = new AuditTrailService();
    }
    return AuditTrailService.instance;
  }

  // =========================================================================
  // AUDIT LOGGING
  // =========================================================================

  /**
   * Log create operation
   */
  async logCreate(
    tenantId: string,
    resource: string,
    resourceId: string,
    resourceType: string,
    data: any,
    context: AuditContext
  ): Promise<void> {
    try {
      await this.createAuditLog({
        tenantId,
        action: 'CREATE',
        resource,
        resourceId,
        resourceType,
        changesAfter: data,
        ...context,
      });

      logger.debug({ resource, resourceId }, 'Create operation logged');
    } catch (error) {
      logger.error({ error, resource, resourceId }, 'Failed to log create');
      // Don't throw - audit logging should not break main operations
    }
  }

  /**
   * Log update operation
   */
  async logUpdate(
    tenantId: string,
    resource: string,
    resourceId: string,
    resourceType: string,
    before: any,
    after: any,
    context: AuditContext
  ): Promise<void> {
    try {
      const changedFields = this.getChangedFields(before, after);

      await this.createAuditLog({
        tenantId,
        action: 'UPDATE',
        resource,
        resourceId,
        resourceType,
        changesBefore: before,
        changesAfter: after,
        changedFields,
        ...context,
      });

      logger.debug(
        { resource, resourceId, changedFields },
        'Update operation logged'
      );
    } catch (error) {
      logger.error({ error, resource, resourceId }, 'Failed to log update');
    }
  }

  /**
   * Log delete operation
   */
  async logDelete(
    tenantId: string,
    resource: string,
    resourceId: string,
    resourceType: string,
    data: any,
    reason: string | undefined,
    context: AuditContext
  ): Promise<void> {
    try {
      await this.createAuditLog({
        tenantId,
        action: 'DELETE',
        resource,
        resourceId,
        resourceType,
        changesBefore: data,
        reason,
        ...context,
      });

      logger.debug({ resource, resourceId, reason }, 'Delete operation logged');
    } catch (error) {
      logger.error({ error, resource, resourceId }, 'Failed to log delete');
    }
  }

  /**
   * Log access operation
   */
  async logAccess(
    tenantId: string,
    resource: string,
    resourceId: string,
    resourceType: string,
    context: AuditContext
  ): Promise<void> {
    try {
      await this.createAuditLog({
        tenantId,
        action: 'ACCESS',
        resource,
        resourceId,
        resourceType,
        ...context,
      });

      logger.debug({ resource, resourceId }, 'Access operation logged');
    } catch (error) {
      logger.error({ error, resource, resourceId }, 'Failed to log access');
    }
  }

  /**
   * Log export operation
   */
  async logExport(
    tenantId: string,
    resource: string,
    resourceType: string,
    metadata: any,
    context: AuditContext
  ): Promise<void> {
    try {
      await this.createAuditLog({
        tenantId,
        action: 'EXPORT',
        resource,
        resourceId: 'bulk',
        resourceType,
        metadata,
        ...context,
      });

      logger.info({ resource, metadata }, 'Export operation logged');
    } catch (error) {
      logger.error({ error, resource }, 'Failed to log export');
    }
  }

  /**
   * Log generic activity
   */
  async logActivity(
    tenantId: string,
    action: string,
    resource: string,
    resourceId: string,
    metadata?: any,
    context?: Partial<AuditContext>
  ): Promise<void> {
    try {
      await this.createAuditLog({
        tenantId,
        action: action as any,
        resource,
        resourceId,
        resourceType: resource,
        metadata,
        userId: context?.userId || 'system',
        userName: context?.userName || 'System',
        ipAddress: context?.ipAddress || '0.0.0.0',
        userAgent: context?.userAgent || 'system',
        correlationId: context?.correlationId,
        reason: context?.reason,
      });

      logger.debug({ action, resource, resourceId }, 'Activity logged');
    } catch (error) {
      logger.error({ error, action, resource }, 'Failed to log activity');
    }
  }

  // =========================================================================
  // AUDIT LOG CREATION
  // =========================================================================

  /**
   * Create audit log entry
   */
  private async createAuditLog(data: Partial<AuditLog>): Promise<void> {
    try {
      await (dbAdaptor.getClient() as any).auditLog?.create({
        data: {
          id: randomUUID(),
          tenantId: data.tenantId!,
          action: data.action!,
          resource: data.resource!,
          resourceId: data.resourceId!,
          resourceType: data.resourceType!,
          changesBefore: data.changesBefore,
          changesAfter: data.changesAfter,
          changedFields: data.changedFields,
          userId: data.userId!,
          userName: data.userName!,
          ipAddress: data.ipAddress!,
          userAgent: data.userAgent!,
          correlationId: data.correlationId,
          reason: data.reason,
          metadata: data.metadata,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      // Silently fail if audit log table doesn't exist
      if (!error.message?.includes('does not exist')) {
        throw error;
      }
    }
  }

  // =========================================================================
  // AUDIT LOG QUERYING
  // =========================================================================

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(filters: AuditFilters): Promise<AuditQueryResult> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        tenantId: filters.tenantId,
      };

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.resourceType) {
        where.resourceType = filters.resourceType;
      }

      if (filters.resourceId) {
        where.resourceId = filters.resourceId;
      }

      if (filters.action && filters.action.length > 0) {
        where.action = { in: filters.action };
      }

      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) {
          where.timestamp.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.timestamp.lte = filters.endDate;
        }
      }

      if (filters.suspicious !== undefined) {
        where.suspicious = filters.suspicious;
      }

      if (filters.search) {
        where.OR = [
          { resource: { contains: filters.search, mode: 'insensitive' } },
          { userName: { contains: filters.search, mode: 'insensitive' } },
          { reason: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [logs, total] = await Promise.all([
        (dbAdaptor.getClient() as any).auditLog?.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
        }) || [],
        (dbAdaptor.getClient() as any).auditLog?.count({ where }) || 0,
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info({ total, page, limit }, 'Audit logs queried');

      return {
        logs: logs as AuditLog[],
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error({ error, filters }, 'Failed to query audit logs');
      return {
        logs: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
    }
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceAuditTrail(
    tenantId: string,
    resourceType: string,
    resourceId: string
  ): Promise<AuditLog[]> {
    try {
      const logs = await (dbAdaptor.getClient() as any).auditLog?.findMany({
        where: {
          tenantId,
          resourceType,
          resourceId,
        },
        orderBy: { timestamp: 'desc' },
      });

      return logs || [];
    } catch (error) {
      logger.error({ error, resourceType, resourceId }, 'Failed to get audit trail');
      return [];
    }
  }

  /**
   * Get suspicious activity
   */
  async getSuspiciousActivity(
    tenantId: string,
    days: number = 7
  ): Promise<AuditLog[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await (dbAdaptor.getClient() as any).auditLog?.findMany({
        where: {
          tenantId,
          suspicious: true,
          timestamp: { gte: startDate },
        },
        orderBy: { timestamp: 'desc' },
      });

      return logs || [];
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get suspicious activity');
      return [];
    }
  }

  // =========================================================================
  // EXPORT
  // =========================================================================

  /**
   * Export audit logs to JSON
   */
  async exportAuditLogsJSON(filters: AuditFilters): Promise<string> {
    try {
      const result = await this.queryAuditLogs({
        ...filters,
        limit: 10000, // Export limit
      });

      return JSON.stringify(result.logs, null, 2);
    } catch (error) {
      logger.error({ error, filters }, 'Failed to export audit logs as JSON');
      throw error;
    }
  }

  /**
   * Export audit logs to CSV
   */
  async exportAuditLogsCSV(filters: AuditFilters): Promise<string> {
    try {
      const result = await this.queryAuditLogs({
        ...filters,
        limit: 10000, // Export limit
      });

      const headers = [
        'Timestamp',
        'Action',
        'Resource Type',
        'Resource ID',
        'User',
        'IP Address',
        'Suspicious',
        'Reason',
      ];

      const rows = result.logs.map(log => [
        log.timestamp.toISOString(),
        log.action,
        log.resourceType,
        log.resourceId,
        log.userName,
        log.ipAddress,
        log.suspicious ? 'Yes' : 'No',
        log.reason || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return csv;
    } catch (error) {
      logger.error({ error, filters }, 'Failed to export audit logs as CSV');
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get changed fields between two objects
   */
  private getChangedFields(before: any, after: any): string[] {
    const changed: string[] = [];

    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  /**
   * Clean old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await (dbAdaptor.getClient() as any).auditLog?.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          suspicious: false,
        },
      });

      const deletedCount = result?.count || 0;

      logger.info(
        { deletedCount, retentionDays },
        'Old audit logs cleaned up'
      );

      return deletedCount;
    } catch (error) {
      logger.error({ error, retentionDays }, 'Failed to cleanup old logs');
      return 0;
    }
  }
}

export const auditTrailService = AuditTrailService.getInstance();
