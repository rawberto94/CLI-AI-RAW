/**
 * Audit Trail System
 * 
 * Automatic change tracking with before/after snapshots, user attribution, 
 * and comprehensive audit logging for:
 * - Compliance requirements
 * - Change history tracking
 * - Rollback support
 * - Security auditing
 */

import { PrismaClient, Prisma } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'RESTORE';

export interface AuditEntry {
  id?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: Record<string, { old: unknown; new: unknown }>;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AuditConfig {
  enabled: boolean;
  includeReadOperations: boolean;
  sensitiveFields: string[];
  excludeFields: string[];
  maxHistoryPerEntity: number;
  retentionDays: number;
  asyncMode: boolean;
}

export interface AuditContext {
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditQueryOptions {
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  userId?: string;
  tenantId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// AUDIT TRAIL IMPLEMENTATION
// ============================================================================

export class AuditTrail {
  private prisma: PrismaClient;
  private config: AuditConfig;
  private context: AuditContext;
  private pendingLogs: AuditEntry[] = [];
  private flushTimer?: ReturnType<typeof setTimeout>;

  constructor(
    prisma: PrismaClient,
    config: Partial<AuditConfig> = {},
    context: AuditContext = {}
  ) {
    this.prisma = prisma;
    this.config = {
      enabled: config.enabled ?? true,
      includeReadOperations: config.includeReadOperations ?? false,
      sensitiveFields: config.sensitiveFields ?? ['password', 'passwordHash', 'token', 'apiKey', 'secret'],
      excludeFields: config.excludeFields ?? ['updatedAt', 'createdAt'],
      maxHistoryPerEntity: config.maxHistoryPerEntity ?? 100,
      retentionDays: config.retentionDays ?? 365,
      asyncMode: config.asyncMode ?? true,
    };
    this.context = context;
  }

  // =========================================================================
  // CONTEXT MANAGEMENT
  // =========================================================================

  setContext(context: Partial<AuditContext>): void {
    this.context = { ...this.context, ...context };
  }

  getContext(): AuditContext {
    return { ...this.context };
  }

  withContext(context: Partial<AuditContext>): AuditTrail {
    return new AuditTrail(this.prisma, this.config, {
      ...this.context,
      ...context,
    });
  }

  // =========================================================================
  // LOGGING OPERATIONS
  // =========================================================================

  async logCreate(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      entityType,
      entityId,
      action: 'CREATE',
      after: this.sanitizeData(data),
      metadata,
    });
  }

  async logUpdate(
    entityType: string,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const changes = this.computeChanges(before, after);

    await this.log({
      entityType,
      entityId,
      action: 'UPDATE',
      before: this.sanitizeData(before),
      after: this.sanitizeData(after),
      changes,
      metadata,
    });
  }

  async logDelete(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      entityType,
      entityId,
      action: 'DELETE',
      before: this.sanitizeData(data),
      metadata,
    });
  }

  async logRead(
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.includeReadOperations) return;

    await this.log({
      entityType,
      entityId,
      action: 'READ',
      metadata,
    });
  }

  async logRestore(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      entityType,
      entityId,
      action: 'RESTORE',
      after: this.sanitizeData(data),
      metadata,
    });
  }

  // =========================================================================
  // QUERY OPERATIONS
  // =========================================================================

  async getHistory(
    entityType: string,
    entityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });

    return logs.map(this.mapToAuditEntry);
  }

  async query(options: AuditQueryOptions): Promise<{
    entries: AuditEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;
    if (options.action) where.action = options.action;
    if (options.userId) where.userId = options.userId;
    if (options.tenantId) where.tenantId = options.tenantId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    return {
      entries: logs.map(this.mapToAuditEntry),
      total,
      hasMore: offset + logs.length < total,
    };
  }

  async getStateAt(
    entityType: string,
    entityId: string,
    timestamp: Date
  ): Promise<Record<string, unknown> | null> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
        createdAt: { lte: timestamp },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (logs.length === 0) return null;

    let state: Record<string, unknown> = {};

    for (let i = logs.length - 1; i >= 0; i--) {
      const log = logs[i];
      if (!log) continue;
      const action = log.action as AuditAction;
      const changes = log.changes as Record<string, unknown> | null;

      if (action === 'CREATE' && changes) {
        state = changes;
      } else if (action === 'UPDATE' && changes) {
        state = { ...state, ...changes };
      } else if (action === 'DELETE') {
        return null;
      } else if (action === 'RESTORE' && changes) {
        state = changes;
      }
    }

    return state;
  }

  async getChangesBetween(
    entityType: string,
    entityId: string,
    startTime: Date,
    endTime: Date
  ): Promise<AuditEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map(this.mapToAuditEntry);
  }

  // =========================================================================
  // ROLLBACK SUPPORT
  // =========================================================================

  async generateRollbackData(
    entityType: string,
    entityId: string,
    targetTimestamp: Date
  ): Promise<{
    canRollback: boolean;
    targetState: Record<string, unknown> | null;
    changesAfter: AuditEntry[];
  }> {
    const targetState = await this.getStateAt(entityType, entityId, targetTimestamp);
    const changesAfter = await this.getChangesBetween(
      entityType,
      entityId,
      targetTimestamp,
      new Date()
    );

    return {
      canRollback: targetState !== null,
      targetState,
      changesAfter,
    };
  }

  // =========================================================================
  // MAINTENANCE
  // =========================================================================

  async cleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  async flush(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logs = [...this.pendingLogs];
    this.pendingLogs = [];

    // Filter logs that have required tenantId
    const validLogs = logs.filter(entry => entry.tenantId);

    if (validLogs.length > 0) {
      await this.prisma.auditLog.createMany({
        data: validLogs.map((entry) => ({
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          changes: (entry.changes ?? entry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          userId: entry.userId ?? null,
          tenantId: entry.tenantId!, // Required by schema
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: (entry.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        })),
      });
    }
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async log(entry: Omit<AuditEntry, 'createdAt' | 'userId' | 'tenantId' | 'ipAddress' | 'userAgent'>): Promise<void> {
    if (!this.config.enabled) return;

    const fullEntry: AuditEntry = {
      ...entry,
      userId: this.context.userId,
      tenantId: this.context.tenantId,
      ipAddress: this.context.ipAddress,
      userAgent: this.context.userAgent,
      createdAt: new Date(),
    };

    if (this.config.asyncMode) {
      this.pendingLogs.push(fullEntry);
      this.scheduleFlush();
    } else {
      // Sync mode requires tenantId
      if (!fullEntry.tenantId) {
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          entityType: fullEntry.entityType,
          entityId: fullEntry.entityId,
          action: fullEntry.action,
          changes: (fullEntry.changes ?? fullEntry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          userId: fullEntry.userId ?? null,
          tenantId: fullEntry.tenantId,
          ipAddress: fullEntry.ipAddress ?? null,
          userAgent: fullEntry.userAgent ?? null,
          metadata: (fullEntry.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(async () => {
      this.flushTimer = undefined;
      await this.flush();
    }, 1000);
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (this.config.excludeFields.includes(key)) {
        continue;
      }

      if (this.config.sensitiveFields.includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private computeChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>
  ): Record<string, { old: unknown; new: unknown }> {
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const key of Object.keys(after)) {
      if (this.config.excludeFields.includes(key)) continue;

      const oldValue = before[key];
      const newValue = after[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          old: this.config.sensitiveFields.includes(key) ? '[REDACTED]' : oldValue,
          new: this.config.sensitiveFields.includes(key) ? '[REDACTED]' : newValue,
        };
      }
    }

    for (const key of Object.keys(before)) {
      if (this.config.excludeFields.includes(key)) continue;
      if (!(key in after)) {
        changes[key] = {
          old: this.config.sensitiveFields.includes(key) ? '[REDACTED]' : before[key],
          new: undefined,
        };
      }
    }

    return changes;
  }

  private mapToAuditEntry = (log: {
    id: string;
    entityType: string | null;
    entityId: string | null;
    action: string;
    changes: Prisma.JsonValue;
    userId: string | null;
    tenantId: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    metadata: Prisma.JsonValue;
  }): AuditEntry => ({
    id: log.id,
    entityType: log.entityType ?? 'unknown',
    entityId: log.entityId ?? 'unknown',
    action: log.action as AuditAction,
    changes: log.changes as Record<string, { old: unknown; new: unknown }> | undefined,
    userId: log.userId ?? undefined,
    tenantId: log.tenantId,
    ipAddress: log.ipAddress ?? undefined,
    userAgent: log.userAgent ?? undefined,
    createdAt: log.createdAt,
    metadata: log.metadata as Record<string, unknown> | undefined,
  });
}

// ============================================================================
// AUDIT MIDDLEWARE
// ============================================================================

export function createAuditMiddleware(auditTrail: AuditTrail): Prisma.Middleware {
  return async (params, next) => {
    const modelName = params.model;

    if (!modelName || modelName === 'AuditLog') {
      return next(params);
    }

    const result = await next(params);

    try {
      const entityId = result?.id || params.args?.where?.id;

      switch (params.action) {
        case 'create':
          if (entityId) {
            await auditTrail.logCreate(modelName, entityId, result);
          }
          break;
        case 'delete':
          if (entityId) {
            await auditTrail.logDelete(modelName, entityId, result || {});
          }
          break;
      }
    } catch {
      // Audit logging failed silently
    }

    return result;
  };
}

// ============================================================================
// SINGLETON
// ============================================================================

let auditTrailInstance: AuditTrail | null = null;

export function getAuditTrail(
  prisma?: PrismaClient,
  config?: Partial<AuditConfig>
): AuditTrail {
  if (!auditTrailInstance) {
    if (!prisma) {
      throw new Error('PrismaClient required for first initialization');
    }
    auditTrailInstance = new AuditTrail(prisma, config);
  }
  return auditTrailInstance;
}

export function resetAuditTrail(): void {
  if (auditTrailInstance) {
    auditTrailInstance.flush().catch(() => {});
  }
  auditTrailInstance = null;
}
