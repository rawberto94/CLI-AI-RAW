/**
 * Database Error Handler
 * 
 * Categorized database errors with recovery strategies, retry logic, and:
 * - Error classification by type
 * - Automatic recovery suggestions
 * - Retry policies per error type
 * - Detailed error context
 */

import { Prisma } from '@prisma/client';

// ============================================================================
// ERROR TYPES
// ============================================================================

export type DatabaseErrorCategory =
  | 'CONNECTION'
  | 'CONSTRAINT'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TIMEOUT'
  | 'PERMISSION'
  | 'INTERNAL'
  | 'UNKNOWN';

export type DatabaseErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RecoveryStrategy {
  canRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  action: RecoveryAction;
  suggestions: string[];
}

export type RecoveryAction =
  | 'RETRY'
  | 'RECONNECT'
  | 'VALIDATE_INPUT'
  | 'CHECK_CONSTRAINTS'
  | 'REFRESH_DATA'
  | 'MANUAL_INTERVENTION'
  | 'NONE';

export interface DatabaseErrorContext {
  model?: string;
  operation?: string;
  fields?: string[];
  constraint?: string;
  originalError?: Error;
  query?: string;
  params?: unknown[];
  duration?: number;
}

// ============================================================================
// CUSTOM DATABASE ERROR
// ============================================================================

export class DatabaseError extends Error {
  public readonly category: DatabaseErrorCategory;
  public readonly severity: DatabaseErrorSeverity;
  public readonly code: string;
  public readonly context: DatabaseErrorContext;
  public readonly recovery: RecoveryStrategy;
  public readonly timestamp: Date;

  constructor(
    message: string,
    category: DatabaseErrorCategory,
    severity: DatabaseErrorSeverity,
    code: string,
    context: DatabaseErrorContext = {},
    recovery?: Partial<RecoveryStrategy>
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.category = category;
    this.severity = severity;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.recovery = {
      canRetry: recovery?.canRetry ?? false,
      maxRetries: recovery?.maxRetries ?? 0,
      retryDelay: recovery?.retryDelay ?? 1000,
      backoffMultiplier: recovery?.backoffMultiplier ?? 2,
      maxDelay: recovery?.maxDelay ?? 30000,
      action: recovery?.action ?? 'NONE',
      suggestions: recovery?.suggestions ?? [],
    };

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.category) {
      case 'CONNECTION':
        return 'Unable to connect to the database. Please try again later.';
      case 'CONSTRAINT':
        return 'The data violates a database constraint. Please check your input.';
      case 'VALIDATION':
        return 'The provided data is invalid. Please verify and try again.';
      case 'NOT_FOUND':
        return 'The requested record was not found.';
      case 'CONFLICT':
        return 'A conflict occurred with existing data. The record may have been modified.';
      case 'TIMEOUT':
        return 'The operation timed out. Please try again.';
      case 'PERMISSION':
        return 'You do not have permission to perform this operation.';
      case 'INTERNAL':
        return 'An internal error occurred. Our team has been notified.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Get detailed debug information
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      message: this.message,
      category: this.category,
      severity: this.severity,
      code: this.code,
      context: this.context,
      recovery: this.recovery,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(attemptNumber: number): boolean {
    return this.recovery.canRetry && attemptNumber < this.recovery.maxRetries;
  }

  /**
   * Calculate delay for next retry
   */
  getRetryDelay(attemptNumber: number): number {
    const delay = this.recovery.retryDelay * Math.pow(this.recovery.backoffMultiplier, attemptNumber);
    return Math.min(delay, this.recovery.maxDelay);
  }
}

// ============================================================================
// SPECIALIZED ERROR CLASSES
// ============================================================================

export class ConnectionError extends DatabaseError {
  constructor(message: string, context?: DatabaseErrorContext) {
    super(
      message,
      'CONNECTION',
      'CRITICAL',
      'DB_CONNECTION_ERROR',
      context,
      {
        canRetry: true,
        maxRetries: 5,
        retryDelay: 1000,
        backoffMultiplier: 2,
        action: 'RECONNECT',
        suggestions: [
          'Check database server status',
          'Verify connection string',
          'Check network connectivity',
          'Review connection pool settings',
        ],
      }
    );
    this.name = 'ConnectionError';
  }
}

export class ConstraintViolationError extends DatabaseError {
  constructor(message: string, constraintName?: string, context?: DatabaseErrorContext) {
    super(
      message,
      'CONSTRAINT',
      'MEDIUM',
      'DB_CONSTRAINT_VIOLATION',
      { ...context, constraint: constraintName },
      {
        canRetry: false,
        action: 'CHECK_CONSTRAINTS',
        suggestions: [
          'Check for duplicate values in unique fields',
          'Verify foreign key references exist',
          'Review required field values',
        ],
      }
    );
    this.name = 'ConstraintViolationError';
  }
}

export class UniqueConstraintError extends ConstraintViolationError {
  public readonly field: string;

  constructor(field: string, value: unknown, context?: DatabaseErrorContext) {
    super(
      `A record with ${field} = "${value}" already exists`,
      `${field}_unique`,
      { ...context, fields: [field] }
    );
    this.name = 'UniqueConstraintError';
    this.field = field;
  }
}

export class ForeignKeyError extends ConstraintViolationError {
  public readonly foreignKey: string;
  public readonly referencedTable: string;

  constructor(foreignKey: string, referencedTable: string, context?: DatabaseErrorContext) {
    super(
      `Referenced ${referencedTable} does not exist`,
      `${foreignKey}_fkey`,
      context
    );
    this.name = 'ForeignKeyError';
    this.foreignKey = foreignKey;
    this.referencedTable = referencedTable;
  }
}

export class NotFoundError extends DatabaseError {
  public readonly entityType: string;
  public readonly entityId: string;

  constructor(entityType: string, entityId: string, context?: DatabaseErrorContext) {
    super(
      `${entityType} with id "${entityId}" not found`,
      'NOT_FOUND',
      'LOW',
      'DB_NOT_FOUND',
      { ...context, model: entityType },
      {
        canRetry: false,
        action: 'REFRESH_DATA',
        suggestions: [
          'Verify the record ID is correct',
          'Check if the record was deleted',
          'Refresh the data from the source',
        ],
      }
    );
    this.name = 'NotFoundError';
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

export class OptimisticLockingError extends DatabaseError {
  public readonly entityType: string;
  public readonly entityId: string;
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(
    entityType: string,
    entityId: string,
    expectedVersion: number,
    actualVersion: number,
    context?: DatabaseErrorContext
  ) {
    super(
      `Concurrent modification detected on ${entityType} "${entityId}". ` +
      `Expected version ${expectedVersion}, found ${actualVersion}`,
      'CONFLICT',
      'MEDIUM',
      'DB_OPTIMISTIC_LOCK',
      { ...context, model: entityType },
      {
        canRetry: true,
        maxRetries: 3,
        retryDelay: 100,
        action: 'REFRESH_DATA',
        suggestions: [
          'Refresh the data and retry the operation',
          'Implement merge strategy for conflicting changes',
          'Consider using pessimistic locking for this operation',
        ],
      }
    );
    this.name = 'OptimisticLockingError';
    this.entityType = entityType;
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class TimeoutError extends DatabaseError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, context?: DatabaseErrorContext) {
    super(
      `Database operation timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      'HIGH',
      'DB_TIMEOUT',
      context,
      {
        canRetry: true,
        maxRetries: 3,
        retryDelay: 2000,
        backoffMultiplier: 1.5,
        action: 'RETRY',
        suggestions: [
          'Optimize the query for better performance',
          'Consider breaking into smaller operations',
          'Review database indexes',
          'Check for long-running transactions blocking the query',
        ],
      }
    );
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class ValidationError extends DatabaseError {
  public readonly field: string;
  public readonly reason: string;

  constructor(field: string, reason: string, context?: DatabaseErrorContext) {
    super(
      `Validation failed for field "${field}": ${reason}`,
      'VALIDATION',
      'LOW',
      'DB_VALIDATION_ERROR',
      { ...context, fields: [field] },
      {
        canRetry: false,
        action: 'VALIDATE_INPUT',
        suggestions: [
          'Check field format and type',
          'Verify field length constraints',
          'Review allowed values',
        ],
      }
    );
    this.name = 'ValidationError';
    this.field = field;
    this.reason = reason;
  }
}

// ============================================================================
// ERROR PARSER
// ============================================================================

export class DatabaseErrorParser {
  /**
   * Parse a Prisma error into a typed DatabaseError
   */
  static parse(error: unknown, context?: DatabaseErrorContext): DatabaseError {
    // Handle Prisma known errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return this.parsePrismaKnownError(error, context);
    }

    // Handle Prisma validation errors
    if (error instanceof Prisma.PrismaClientValidationError) {
      return new ValidationError(
        'unknown',
        error.message,
        { ...context, originalError: error }
      );
    }

    // Handle Prisma initialization errors
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return new ConnectionError(
        `Database initialization failed: ${error.message}`,
        { ...context, originalError: error }
      );
    }

    // Handle Prisma rust panic errors
    if (error instanceof Prisma.PrismaClientRustPanicError) {
      return new DatabaseError(
        'A critical database error occurred',
        'INTERNAL',
        'CRITICAL',
        'DB_INTERNAL_ERROR',
        { ...context, originalError: error as Error },
        {
          canRetry: false,
          action: 'MANUAL_INTERVENTION',
          suggestions: ['Contact system administrator', 'Check database logs'],
        }
      );
    }

    // Handle generic errors
    if (error instanceof Error) {
      return this.parseGenericError(error, context);
    }

    // Unknown error
    return new DatabaseError(
      'An unknown database error occurred',
      'UNKNOWN',
      'HIGH',
      'DB_UNKNOWN_ERROR',
      context
    );
  }

  /**
   * Parse Prisma known request error
   */
  private static parsePrismaKnownError(
    error: Prisma.PrismaClientKnownRequestError,
    context?: DatabaseErrorContext
  ): DatabaseError {
    const meta = error.meta as Record<string, unknown> | undefined;

    switch (error.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = (meta?.target as string[]) || ['unknown'];
        return new UniqueConstraintError(
          target.join(', '),
          meta?.value,
          { ...context, originalError: error }
        );
      }

      // Foreign key constraint violation
      case 'P2003': {
        const fieldName = (meta?.field_name as string) || 'unknown';
        return new ForeignKeyError(
          fieldName,
          'referenced_table',
          { ...context, originalError: error }
        );
      }

      // Record not found
      case 'P2001':
      case 'P2025': {
        const modelName = (meta?.modelName as string) || context?.model || 'Record';
        return new NotFoundError(
          modelName,
          'unknown',
          { ...context, originalError: error }
        );
      }

      // Value too long
      case 'P2000': {
        const columnName = (meta?.column_name as string) || 'unknown';
        return new ValidationError(
          columnName,
          'Value is too long for this field',
          { ...context, originalError: error }
        );
      }

      // Required field missing
      case 'P2012': {
        const missingField = (meta?.path as string) || 'unknown';
        return new ValidationError(
          missingField,
          'This field is required',
          { ...context, originalError: error }
        );
      }

      // Invalid data type
      case 'P2006':
      case 'P2007': {
        return new ValidationError(
          'unknown',
          `Invalid data type: ${error.message}`,
          { ...context, originalError: error }
        );
      }

      // Connection errors
      case 'P2024': {
        return new TimeoutError(
          30000,
          { ...context, originalError: error }
        );
      }

      case 'P2028': {
        return new TimeoutError(
          30000,
          { ...context, originalError: error }
        );
      }

      // Transaction errors
      case 'P2034': {
        return new OptimisticLockingError(
          context?.model || 'Record',
          'unknown',
          -1,
          -1,
          { ...context, originalError: error }
        );
      }

      default:
        return new DatabaseError(
          error.message,
          'INTERNAL',
          'HIGH',
          error.code,
          { ...context, originalError: error },
          { canRetry: false }
        );
    }
  }

  /**
   * Parse generic error
   */
  private static parseGenericError(
    error: Error,
    context?: DatabaseErrorContext
  ): DatabaseError {
    const message = error.message.toLowerCase();

    // Connection errors
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('connection')
    ) {
      return new ConnectionError(error.message, { ...context, originalError: error });
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('etimedout')) {
      return new TimeoutError(30000, { ...context, originalError: error });
    }

    // Not found errors
    if (message.includes('not found') || message.includes('does not exist')) {
      return new NotFoundError(
        context?.model || 'Record',
        'unknown',
        { ...context, originalError: error }
      );
    }

    return new DatabaseError(
      error.message,
      'UNKNOWN',
      'MEDIUM',
      'DB_GENERIC_ERROR',
      { ...context, originalError: error }
    );
  }
}

// ============================================================================
// ERROR HANDLER WITH RETRY
// ============================================================================

export class DatabaseErrorHandler {
  /**
   * Execute operation with automatic error handling and retry
   */
  static async execute<T>(
    operation: () => Promise<T>,
    context?: DatabaseErrorContext,
    onRetry?: (error: DatabaseError, attempt: number) => void
  ): Promise<T> {
    let lastError: DatabaseError | null = null;
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        lastError = DatabaseErrorParser.parse(error, context);

        if (!lastError.shouldRetry(attempt)) {
          throw lastError;
        }

        const delay = lastError.getRetryDelay(attempt);
        
        if (onRetry) {
          onRetry(lastError, attempt);
        }

        console.warn(
          `Database operation failed (attempt ${attempt + 1}/${lastError.recovery.maxRetries}). ` +
          `Retrying in ${delay}ms...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
  }

  /**
   * Wrap a function with error handling
   */
  static wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    contextBuilder?: (...args: Parameters<T>) => DatabaseErrorContext
  ): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const context = contextBuilder ? contextBuilder(...args) : {};
      return DatabaseErrorHandler.execute(() => fn(...args), context);
    }) as T;
  }
}

// All classes are exported where defined with 'export class'
