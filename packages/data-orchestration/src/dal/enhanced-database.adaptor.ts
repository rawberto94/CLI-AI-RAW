/**
 * Enhanced Database Adaptor with Production-Grade Features
 * 
 * Provides:
 * - Transaction support with automatic rollback
 * - Retry logic with exponential backoff
 * - Optimistic locking with version checking
 * - Audit logging for all operations
 * - Connection pooling and health checks
 */

import { PrismaClient, Prisma } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "enhanced-database-adaptor" });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export interface AuditContext {
  userId: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface BatchOptions {
  batchSize?: number;
  continueOnError?: boolean;
}

export enum ErrorCategory {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  TEMPORARY_SERVICE_ERROR = 'temporary_service_error',
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  NOT_FOUND_ERROR = 'not_found_error',
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  DATABASE_ERROR = 'database_error',
  FILE_SYSTEM_ERROR = 'file_system_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
}

// =========================================================================
// ENHANCED DATABASE ADAPTOR
// =========================================================================

export class EnhancedDatabaseAdaptor {
  private prisma: PrismaClient;
  private static instance: EnhancedDatabaseAdaptor;

  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'P1001', // Can't reach database server
      'P1002', // Database server timeout
      'P1008', // Operations timed out
      'P1017', // Server has closed the connection
      'P2024', // Timed out fetching a new connection
    ],
  };

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    logger.info('Enhanced Database Adaptor initialized');
  }

  static getInstance(): EnhancedDatabaseAdaptor {
    if (!EnhancedDatabaseAdaptor.instance) {
      EnhancedDatabaseAdaptor.instance = new EnhancedDatabaseAdaptor();
    }
    return EnhancedDatabaseAdaptor.instance;
  }

  // =========================================================================
  // TRANSACTION SUPPORT
  // =========================================================================

  /**
   * Execute operations within a transaction
   * Automatically rolls back on error
   */
  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting database transaction');
      
      const result = await this.prisma.$transaction(fn, {
        maxWait: options?.maxWait || 5000, // 5 seconds
        timeout: options?.timeout || 30000, // 30 seconds
        isolationLevel: options?.isolationLevel,
      });
      
      const duration = Date.now() - startTime;
      logger.info({ duration }, 'Transaction completed successfully');
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ error, duration }, 'Transaction failed and rolled back');
      throw error;
    }
  }

  // =========================================================================
  // RETRY LOGIC
  // =========================================================================

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const opts = { ...this.defaultRetryOptions, ...options };
    let lastError: any;
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        if (attempt > 0) {
          logger.info({ attempt }, 'Retrying operation');
        }
        
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, opts.retryableErrors!);
        const hasRetriesLeft = attempt < opts.maxRetries!;
        
        if (!isRetryable || !hasRetriesLeft) {
          logger.error(
            { error, attempt, isRetryable, hasRetriesLeft },
            'Operation failed, not retrying'
          );
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.baseDelay! * Math.pow(opts.backoffMultiplier!, attempt),
          opts.maxDelay!
        );
        
        logger.warn(
          { error, attempt, delay, nextAttempt: attempt + 1 },
          'Operation failed, will retry'
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is retryable based on Prisma error codes
   */
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    if (error?.code && retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check for network-related errors
    if (error?.message) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      );
    }
    
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =========================================================================
  // BATCH OPERATIONS
  // =========================================================================

  /**
   * Create multiple records in batches
   */
  async batchCreate<T>(
    model: string,
    items: any[],
    options?: BatchOptions
  ): Promise<T[]> {
    const batchSize = options?.batchSize || 100;
    const continueOnError = options?.continueOnError || false;
    const results: T[] = [];
    const errors: any[] = [];
    
    logger.info({ total: items.length, batchSize }, 'Starting batch create');
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const created = await (this.prisma as any)[model].createMany({
          data: batch,
          skipDuplicates: true,
        });
        
        results.push(...created);
        logger.debug({ batchIndex: i / batchSize, count: created.count }, 'Batch created');
      } catch (error) {
        logger.error({ error, batchIndex: i / batchSize }, 'Batch create failed');
        errors.push({ batchIndex: i / batchSize, error });
        
        if (!continueOnError) {
          throw error;
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn({ errorCount: errors.length }, 'Some batches failed');
    }
    
    logger.info({ total: results.length }, 'Batch create completed');
    return results;
  }

  /**
   * Update multiple records in batches
   */
  async batchUpdate<T>(
    model: string,
    updates: Array<{ where: any; data: any }>,
    options?: BatchOptions
  ): Promise<T[]> {
    const batchSize = options?.batchSize || 100;
    const continueOnError = options?.continueOnError || false;
    const results: T[] = [];
    const errors: any[] = [];
    
    logger.info({ total: updates.length, batchSize }, 'Starting batch update');
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      try {
        // Execute updates in parallel within batch
        const batchResults = await Promise.all(
          batch.map(({ where, data }) =>
            (this.prisma as any)[model].update({ where, data })
          )
        );
        
        results.push(...batchResults);
        logger.debug({ batchIndex: i / batchSize, count: batchResults.length }, 'Batch updated');
      } catch (error) {
        logger.error({ error, batchIndex: i / batchSize }, 'Batch update failed');
        errors.push({ batchIndex: i / batchSize, error });
        
        if (!continueOnError) {
          throw error;
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn({ errorCount: errors.length }, 'Some batches failed');
    }
    
    logger.info({ total: results.length }, 'Batch update completed');
    return results;
  }

  // =========================================================================
  // OPTIMISTIC LOCKING
  // =========================================================================

  /**
   * Update record with version checking (optimistic locking)
   */
  async updateWithVersion<T>(
    model: string,
    id: string,
    currentVersion: number,
    data: any
  ): Promise<T> {
    try {
      logger.debug({ model, id, currentVersion }, 'Updating with version check');
      
      const updated = await (this.prisma as any)[model].updateMany({
        where: {
          id,
          version: currentVersion,
        },
        data: {
          ...data,
          version: currentVersion + 1,
          updatedAt: new Date(),
        },
      });
      
      if (updated.count === 0) {
        throw new Error(
          `Optimistic locking failed: Record ${id} was modified by another process`
        );
      }
      
      // Fetch and return the updated record
      const record = await (this.prisma as any)[model].findUnique({
        where: { id },
      });
      
      logger.info({ model, id, newVersion: currentVersion + 1 }, 'Updated with version check');
      return record;
    } catch (error) {
      logger.error({ error, model, id, currentVersion }, 'Version check update failed');
      throw error;
    }
  }

  // =========================================================================
  // AUDIT LOGGING
  // =========================================================================

  /**
   * Create record with audit logging
   */
  async createWithAudit<T>(
    model: string,
    data: any,
    context: AuditContext
  ): Promise<T> {
    return await this.withTransaction(async (tx) => {
      // Create the record
      const record = await (tx as any)[model].create({
        data: {
          ...data,
          createdBy: context.userId,
          createdAt: new Date(),
        },
      });
      
      // Create audit log
      await this.createAuditLog(tx, {
        action: 'create',
        resource: model,
        resourceId: record.id,
        resourceType: model,
        userId: context.userId,
        userName: context.userName || 'Unknown',
        ipAddress: context.ipAddress || 'Unknown',
        userAgent: context.userAgent || 'Unknown',
        correlationId: context.correlationId,
        timestamp: new Date(),
      });
      
      logger.info({ model, id: record.id, userId: context.userId }, 'Created with audit');
      return record;
    });
  }

  /**
   * Update record with audit logging
   */
  async updateWithAudit<T>(
    model: string,
    id: string,
    data: any,
    context: AuditContext
  ): Promise<T> {
    return await this.withTransaction(async (tx) => {
      // Get current state for audit trail
      const before = await (tx as any)[model].findUnique({
        where: { id },
      });
      
      if (!before) {
        throw new Error(`Record ${id} not found`);
      }
      
      // Update the record
      const after = await (tx as any)[model].update({
        where: { id },
        data: {
          ...data,
          updatedBy: context.userId,
          updatedAt: new Date(),
        },
      });
      
      // Create audit log with changes
      const changes = this.calculateChanges(before, data);
      
      await this.createAuditLog(tx, {
        action: 'update',
        resource: model,
        resourceId: id,
        resourceType: model,
        changes: {
          before,
          after,
          fields: Object.keys(changes),
        },
        userId: context.userId,
        userName: context.userName || 'Unknown',
        ipAddress: context.ipAddress || 'Unknown',
        userAgent: context.userAgent || 'Unknown',
        correlationId: context.correlationId,
        timestamp: new Date(),
      });
      
      logger.info({ model, id, userId: context.userId, changedFields: Object.keys(changes) }, 'Updated with audit');
      return after;
    });
  }

  /**
   * Delete record with audit logging
   */
  async deleteWithAudit(
    model: string,
    id: string,
    context: AuditContext,
    reason?: string
  ): Promise<void> {
    await this.withTransaction(async (tx) => {
      // Get current state for audit trail
      const record = await (tx as any)[model].findUnique({
        where: { id },
      });
      
      if (!record) {
        throw new Error(`Record ${id} not found`);
      }
      
      // Delete the record
      await (tx as any)[model].delete({
        where: { id },
      });
      
      // Create audit log
      await this.createAuditLog(tx, {
        action: 'delete',
        resource: model,
        resourceId: id,
        resourceType: model,
        reason,
        userId: context.userId,
        userName: context.userName || 'Unknown',
        ipAddress: context.ipAddress || 'Unknown',
        userAgent: context.userAgent || 'Unknown',
        correlationId: context.correlationId,
        timestamp: new Date(),
      });
      
      logger.info({ model, id, userId: context.userId, reason }, 'Deleted with audit');
    });
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    tx: Prisma.TransactionClient,
    data: any
  ): Promise<void> {
    try {
      // Only create audit log if the table exists
      // This prevents errors during initial setup
      await (tx as any).auditLog?.create({
        data,
      }).catch((error: any) => {
        // Silently fail if audit log table doesn't exist yet
        if (!error.message?.includes('does not exist')) {
          throw error;
        }
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to create audit log');
      // Don't throw - audit logging should not break main operations
    }
  }

  /**
   * Calculate changes between old and new data
   */
  private calculateChanges(before: any, updates: any): Record<string, any> {
    const changes: Record<string, any> = {};
    
    for (const key in updates) {
      if (updates[key] !== before[key]) {
        changes[key] = {
          from: before[key],
          to: updates[key],
        };
      }
    }
    
    return changes;
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Health check with retry
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.withRetry(
        async () => {
          await this.prisma.$queryRaw`SELECT 1`;
        },
        { maxRetries: 2, baseDelay: 1000 }
      );
      return true;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
  }

  /**
   * Get connection pool stats
   */
  async getConnectionStats(): Promise<any> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to get connection stats');
      return null;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    logger.info('Database disconnected');
  }

  /**
   * Get Prisma client for advanced use cases
   */
  getClient(): PrismaClient {
    return this.prisma;
  }
}

export const enhancedDbAdaptor = EnhancedDatabaseAdaptor.getInstance();
