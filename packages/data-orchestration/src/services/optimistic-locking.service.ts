/**
 * Optimistic Locking Service
 * 
 * Provides version-based optimistic concurrency control to prevent conflicts
 * when multiple users or processes attempt to update the same resource simultaneously.
 * 
 * Requirements: 6.1 - WHEN concurrent updates occur, THE System SHALL use optimistic locking to prevent conflicts
 */

import { PrismaClient } from 'clients-db';
import { monitoringService } from './monitoring.service';

export class OptimisticLockError extends Error {
  constructor(
    message: string,
    public resourceType: string,
    public resourceId: string,
    public expectedVersion: number,
    public actualVersion: number
  ) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

export interface LockResult {
  success: boolean;
  currentVersion: number;
  error?: string;
}

export interface UpdateWithVersionOptions {
  resourceType: string;
  resourceId: string;
  expectedVersion: number;
  data: any;
  userId?: string;
}

class OptimisticLockingService {
  private db: PrismaClient;

  constructor() {
    this.db = new PrismaClient();
  }

  /**
   * Check if a resource version matches the expected version
   */
  async checkVersion(
    resourceType: string,
    resourceId: string,
    expectedVersion: number
  ): Promise<LockResult> {
    try {
      const model = this.getModel(resourceType);
      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { version: true }
      });

      if (!resource) {
        return {
          success: false,
          currentVersion: -1,
          error: 'Resource not found'
        };
      }

      const currentVersion = resource.version || 1;

      if (currentVersion !== expectedVersion) {
        monitoringService.incrementCounter('optimistic_lock.version_mismatch', {
          resourceType,
          expected: expectedVersion.toString(),
          actual: currentVersion.toString()
        });

        return {
          success: false,
          currentVersion,
          error: `Version mismatch: expected ${expectedVersion}, got ${currentVersion}`
        };
      }

      return {
        success: true,
        currentVersion
      };
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'optimistic_locking.check_version',
        resourceType,
        resourceId
      });

      return {
        success: false,
        currentVersion: -1,
        error: (error as Error).message
      };
    }
  }

  /**
   * Update a resource with optimistic locking
   * Throws OptimisticLockError if version mismatch occurs
   */
  async updateWithVersion<T>(options: UpdateWithVersionOptions): Promise<T> {
    const { resourceType, resourceId, expectedVersion, data, userId } = options;
    const startTime = Date.now();

    try {
      // Check version first
      const versionCheck = await this.checkVersion(resourceType, resourceId, expectedVersion);

      if (!versionCheck.success) {
        throw new OptimisticLockError(
          versionCheck.error || 'Version check failed',
          resourceType,
          resourceId,
          expectedVersion,
          versionCheck.currentVersion
        );
      }

      // Perform update with version check in WHERE clause
      const model = this.getModel(resourceType);
      const updated = await model.update({
        where: {
          id: resourceId,
          version: expectedVersion
        },
        data: {
          ...data,
          updatedAt: new Date(),
          ...(userId && { updatedBy: userId })
        }
      });

      // Record successful update
      monitoringService.recordTiming(
        'optimistic_lock.update_success',
        Date.now() - startTime,
        { resourceType }
      );

      monitoringService.incrementCounter('optimistic_lock.update_success', {
        resourceType
      });

      return updated as T;
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        throw error;
      }

      // Check if it's a Prisma "Record not found" error (version mismatch)
      if ((error as any).code === 'P2025') {
        // Re-fetch to get current version
        const model = this.getModel(resourceType);
        const current = await model.findUnique({
          where: { id: resourceId },
          select: { version: true }
        });

        throw new OptimisticLockError(
          'Resource was modified by another user',
          resourceType,
          resourceId,
          expectedVersion,
          current?.version || -1
        );
      }

      monitoringService.logError(error as Error, {
        context: 'optimistic_locking.update_with_version',
        resourceType,
        resourceId,
        expectedVersion
      });

      throw error;
    }
  }

  /**
   * Perform a transaction with optimistic locking on multiple resources
   */
  async transactionWithLocking<T>(
    operations: Array<{
      resourceType: string;
      resourceId: string;
      expectedVersion: number;
      data: any;
    }>,
    userId?: string
  ): Promise<T[]> {
    const startTime = Date.now();

    try {
      // Check all versions first
      for (const op of operations) {
        const versionCheck = await this.checkVersion(
          op.resourceType,
          op.resourceId,
          op.expectedVersion
        );

        if (!versionCheck.success) {
          throw new OptimisticLockError(
            versionCheck.error || 'Version check failed',
            op.resourceType,
            op.resourceId,
            op.expectedVersion,
            versionCheck.currentVersion
          );
        }
      }

      // Perform all updates in a transaction
      const results = await this.db.$transaction(
        operations.map(op => {
          const model = this.getModel(op.resourceType);
          return model.update({
            where: {
              id: op.resourceId,
              version: op.expectedVersion
            },
            data: {
              ...op.data,
              updatedAt: new Date(),
              ...(userId && { updatedBy: userId })
            }
          });
        })
      );

      monitoringService.recordTiming(
        'optimistic_lock.transaction_success',
        Date.now() - startTime,
        { operationCount: operations.length.toString() }
      );

      return results as T[];
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'optimistic_locking.transaction_with_locking',
        operationCount: operations.length
      });

      throw error;
    }
  }

  /**
   * Get the current version of a resource
   */
  async getCurrentVersion(resourceType: string, resourceId: string): Promise<number> {
    try {
      const model = this.getModel(resourceType);
      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { version: true }
      });

      return resource?.version || 1;
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'optimistic_locking.get_current_version',
        resourceType,
        resourceId
      });

      return -1;
    }
  }

  /**
   * Retry an update operation with the latest version
   */
  async retryUpdate<T>(
    options: UpdateWithVersionOptions,
    maxRetries: number = 3
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        // Get the latest version
        const currentVersion = await this.getCurrentVersion(
          options.resourceType,
          options.resourceId
        );

        if (currentVersion === -1) {
          throw new Error('Resource not found');
        }

        // Attempt update with current version
        return await this.updateWithVersion<T>({
          ...options,
          expectedVersion: currentVersion
        });
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (error instanceof OptimisticLockError && attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          );
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Get the Prisma model for a resource type
   */
  private getModel(resourceType: string): any {
    const modelMap: Record<string, any> = {
      contract: this.db.contract,
      artifact: this.db.artifact,
      rateCardEntry: (this.db as any).rateCardEntry,
      rateCardBaseline: (this.db as any).rateCardBaseline,
      contractMetadata: (this.db as any).contractMetadata,
      rateCardSupplier: (this.db as any).rateCardSupplier,
      user: this.db.user,
      tenant: this.db.tenant
    };

    const model = modelMap[resourceType];
    if (!model) {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return model;
  }

  /**
   * Handle optimistic lock conflict
   * Returns the current state of the resource for conflict resolution
   */
  async handleConflict<T>(
    resourceType: string,
    resourceId: string
  ): Promise<T | null> {
    try {
      const model = this.getModel(resourceType);
      const current = await model.findUnique({
        where: { id: resourceId }
      });

      monitoringService.incrementCounter('optimistic_lock.conflict_handled', {
        resourceType
      });

      return current as T;
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'optimistic_locking.handle_conflict',
        resourceType,
        resourceId
      });

      return null;
    }
  }
}

export const optimisticLockingService = new OptimisticLockingService();
