/**
 * Database Utilities
 * 
 * Provides helper functions for database operations including:
 * - Retry logic for transient failures
 * - Transaction wrappers
 * - Connection health monitoring
 */

import { prisma, checkDatabaseConnection, getConnectionStats } from './prisma';
import { Prisma } from '@prisma/client';

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 100;
const MAX_DELAY_MS = 5000;

// Error codes that should trigger a retry
const RETRYABLE_ERROR_CODES = [
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching from pool
  'P2034', // Transaction failed due to write conflict or deadlock
];

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_ERROR_CODES.includes(error.code);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true; // Connection issues are retryable
  }
  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 100;
  return Math.min(exponentialDelay + jitter, MAX_DELAY_MS);
}

/**
 * Execute a database operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    operationName = 'database operation',
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelayMs);
      console.warn(
        `[DB Retry] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
        `retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Execute operations in a transaction with retry logic
 */
export async function withTransaction<T>(
  operations: (tx: Prisma.TransactionClient) => Promise<T>,
  options: {
    maxRetries?: number;
    maxWait?: number; // Max wait time for acquiring transaction (ms)
    timeout?: number; // Max time for transaction to complete (ms)
    isolationLevel?: Prisma.TransactionIsolationLevel;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    maxWait = 5000,
    timeout = 10000,
    isolationLevel,
    operationName = 'transaction',
  } = options;

  return withRetry(
    () => prisma.$transaction(operations, { maxWait, timeout, isolationLevel }),
    { maxRetries, operationName }
  );
}

/**
 * Batch database operations for efficiency
 * Useful for bulk inserts/updates
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  batchSize: number = 100
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await operation(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Monitor database health
 */
export async function getDatabaseHealth(): Promise<{
  healthy: boolean;
  connectionStats: Awaited<ReturnType<typeof getConnectionStats>>;
  latencyMs: number;
}> {
  const start = Date.now();
  const healthy = await checkDatabaseConnection();
  const latencyMs = Date.now() - start;
  const connectionStats = await getConnectionStats();

  return {
    healthy,
    connectionStats,
    latencyMs,
  };
}

/**
 * Safe query execution with timeout
 */
export async function queryWithTimeout<T>(
  query: () => Promise<T>,
  timeoutMs: number = 30000,
  operationName: string = 'query'
): Promise<T> {
  return Promise.race([
    query(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

export { prisma, checkDatabaseConnection, getConnectionStats };
