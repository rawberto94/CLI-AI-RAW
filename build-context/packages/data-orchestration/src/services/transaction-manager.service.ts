/**
 * Transaction Manager Service
 * 
 * Provides transaction management for multi-step database operations
 * with automatic rollback on errors and timeout handling.
 * 
 * Requirements: 6.4 - THE System SHALL implement database transactions for multi-step operations
 */

import { Prisma } from '@prisma/client';
import { prisma, PrismaClient } from '../lib/prisma';
import { monitoringService } from './monitoring.service';

export interface TransactionOptions {
  timeout?: number; // milliseconds
  maxWait?: number; // milliseconds
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
}

export interface TransactionStep<T = any> {
  name: string;
  execute: (tx: Prisma.TransactionClient) => Promise<T>;
  onError?: (error: Error) => Promise<void>;
}

class TransactionManagerService {
  private db: PrismaClient;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_MAX_WAIT = 5000; // 5 seconds

  constructor() {
    this.db = prisma;
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async executeTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const startTime = Date.now();
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const maxWait = options.maxWait || this.DEFAULT_MAX_WAIT;

    try {
      const data = await this.db.$transaction(
        operation,
        {
          timeout,
          maxWait,
          isolationLevel: options.isolationLevel
        }
      );

      const duration = Date.now() - startTime;

      monitoringService.recordTiming('transaction.success', duration);
      monitoringService.incrementCounter('transaction.completed', {
        status: 'success'
      });

      return {
        success: true,
        data,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      monitoringService.recordTiming('transaction.failure', duration);
      monitoringService.incrementCounter('transaction.completed', {
        status: 'failure'
      });

      monitoringService.logError(error as Error, {
        context: 'transaction_manager.execute_transaction',
        duration
      });

      return {
        success: false,
        error: error as Error,
        duration
      };
    }
  }

  /**
   * Execute multiple steps in a transaction with individual error handling
   */
  async executeSteps<T>(
    steps: TransactionStep[],
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> {
    const startTime = Date.now();
    const results: any[] = [];

    try {
      const data = await this.db.$transaction(
        async (tx) => {
          for (const step of steps) {
            try {
              const result = await step.execute(tx);
              results.push(result);

              monitoringService.incrementCounter('transaction.step_completed', {
                step: step.name,
                status: 'success'
              });
            } catch (error) {
              monitoringService.incrementCounter('transaction.step_completed', {
                step: step.name,
                status: 'failure'
              });

              // Call step-specific error handler if provided
              if (step.onError) {
                await step.onError(error as Error);
              }

              // Re-throw to trigger transaction rollback
              throw error;
            }
          }

          return results;
        },
        {
          timeout: options.timeout || this.DEFAULT_TIMEOUT,
          maxWait: options.maxWait || this.DEFAULT_MAX_WAIT,
          isolationLevel: options.isolationLevel
        }
      );

      const duration = Date.now() - startTime;

      monitoringService.recordTiming('transaction.steps_success', duration, {
        stepCount: steps.length.toString()
      });

      return {
        success: true,
        data,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      monitoringService.logError(error as Error, {
        context: 'transaction_manager.execute_steps',
        stepCount: steps.length,
        completedSteps: results.length,
        duration
      });

      return {
        success: false,
        error: error as Error,
        duration
      };
    }
  }

  /**
   * Execute a transaction with timeout handling
   */
  async executeWithTimeout<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    timeoutMs: number
  ): Promise<TransactionResult<T>> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Transaction timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const transactionPromise = this.db.$transaction(operation, {
        timeout: timeoutMs,
        maxWait: Math.min(timeoutMs / 6, 5000)
      });

      const data = await Promise.race([transactionPromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      monitoringService.recordTiming('transaction.with_timeout_success', duration);

      return {
        success: true,
        data,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      monitoringService.logError(error as Error, {
        context: 'transaction_manager.execute_with_timeout',
        timeoutMs,
        duration
      });

      monitoringService.incrementCounter('transaction.timeout', {
        exceeded: duration > timeoutMs ? 'true' : 'false'
      });

      return {
        success: false,
        error: error as Error,
        duration
      };
    }
  }

  /**
   * Execute a transaction with retry logic
   */
  async executeWithRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries: number = 3,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < maxRetries) {
      const result = await this.executeTransaction(operation, options);

      if (result.success) {
        if (attempt > 0) {
          monitoringService.incrementCounter('transaction.retry_success', {
            attempts: attempt.toString()
          });
        }
        return result;
      }

      lastError = result.error!;
      attempt++;

      // Check if error is retryable
      if (!this.isRetryableError(lastError)) {
        break;
      }

      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));

        monitoringService.incrementCounter('transaction.retry_attempt', {
          attempt: attempt.toString()
        });
      }
    }

    monitoringService.incrementCounter('transaction.retry_exhausted', {
      attempts: attempt.toString()
    });

    return {
      success: false,
      error: lastError || new Error('Transaction failed after retries'),
      duration: 0
    };
  }

  /**
   * Create a contract with artifacts in a transaction
   */
  async createContractWithArtifacts(
    contractData: any,
    artifacts: any[],
    userId?: string
  ): Promise<TransactionResult<{ contract: any; artifacts: any[] }>> {
    return this.executeTransaction(async (tx) => {
      // Create contract
      const contract = await tx.contract.create({
        data: {
          ...contractData,
          uploadedBy: userId
        }
      });

      // Create artifacts
      const createdArtifacts = await Promise.all(
        artifacts.map(artifact =>
          tx.artifact.create({
            data: {
              ...artifact,
              contractId: contract.id,
              tenantId: contract.tenantId
            }
          })
        )
      );

      // Create audit log
      if (userId) {
        await tx.auditLog.create({
          data: {
            tenantId: contract.tenantId,
            userId,
            action: 'CONTRACT_CREATED',
            resource: contract.id,
            resourceType: 'contract',
            details: {
              contractId: contract.id,
              artifactCount: createdArtifacts.length
            }
          }
        });
      }

      return { contract, artifacts: createdArtifacts };
    });
  }

  /**
   * Update rate card entry with baseline comparison in a transaction
   */
  async updateRateCardWithComparison(
    rateCardEntryId: string,
    rateCardData: any,
    baselineId: string,
    comparisonData: any,
    userId?: string
  ): Promise<TransactionResult<{ rateCard: any; comparison: any }>> {
    return this.executeTransaction(async (tx) => {
      // Update rate card entry
      const rateCard = await (tx as any).rateCardEntry.update({
        where: { id: rateCardEntryId },
        data: {
          ...rateCardData,
          editedBy: userId,
          editedAt: new Date()
        }
      });

      // Create or update baseline comparison
      const comparison = await (tx as any).baselineComparison.create({
        data: {
          ...comparisonData,
          baselineId,
          rateCardEntryId,
          tenantId: rateCard.tenantId,
          createdBy: userId
        }
      });

      // Create audit log
      if (userId) {
        await tx.auditLog.create({
          data: {
            tenantId: rateCard.tenantId,
            userId,
            action: 'RATE_CARD_UPDATED',
            resource: rateCardEntryId,
            resourceType: 'rateCardEntry',
            details: {
              rateCardEntryId,
              baselineId,
              comparisonId: comparison.id
            }
          }
        });
      }

      return { rateCard, comparison };
    });
  }

  /**
   * Bulk update with transaction
   */
  async bulkUpdate<T>(
    updates: Array<{
      model: string;
      where: any;
      data: any;
    }>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T[]>> {
    return this.executeTransaction(async (tx) => {
      const results = await Promise.all(
        updates.map(update => {
          const model = (tx as any)[update.model];
          if (!model) {
            throw new Error(`Unknown model: ${update.model}`);
          }

          return model.update({
            where: update.where,
            data: update.data
          });
        })
      );

      return results;
    }, options);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableCodes = [
      'P2034', // Transaction conflict
      'P2024', // Timed out fetching a new connection
      'P1008', // Operations timed out
      'P1017'  // Server has closed the connection
    ];

    const errorCode = (error as any).code;
    return retryableCodes.includes(errorCode);
  }

  /**
   * Get transaction statistics
   */
  getStatistics(): {
    activeTransactions: number;
    completedTransactions: number;
    failedTransactions: number;
  } {
    // This would require maintaining state, which we can add if needed
    return {
      activeTransactions: 0,
      completedTransactions: 0,
      failedTransactions: 0
    };
  }
}

export const transactionManager = new TransactionManagerService();
