/**
 * Unit of Work Pattern
 * 
 * Provides transaction scoping, change tracking, and coordinated 
 * commits/rollbacks across multiple repositories with:
 * - Automatic change detection
 * - Deferred execution
 * - Before/after snapshots
 * - Nested transaction support
 */

import { PrismaClient, Prisma } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export type ChangeType = 'create' | 'update' | 'delete';

export interface TrackedEntity {
  type: string;
  id: string | null;
  data: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  changeType: ChangeType;
  timestamp: number;
}

export interface UnitOfWorkOptions {
  maxRetries?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  enableChangeTracking?: boolean;
  enableSnapshots?: boolean;
}

export interface TransactionContext {
  tx: Prisma.TransactionClient;
  unitOfWork: UnitOfWork;
  userId?: string;
  tenantId?: string;
}

export type TransactionCallback<T> = (context: TransactionContext) => Promise<T>;

export interface UnitOfWorkStats {
  creates: number;
  updates: number;
  deletes: number;
  totalOperations: number;
  duration?: number;
}

export interface Snapshot {
  timestamp: number;
  entities: Map<string, Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

// ============================================================================
// UNIT OF WORK IMPLEMENTATION
// ============================================================================

export class UnitOfWork {
  private prisma: PrismaClient;
  private trackedEntities: Map<string, TrackedEntity>;
  private pendingOperations: Array<() => Promise<void>>;
  private snapshots: Snapshot[];
  private options: Required<UnitOfWorkOptions>;
  private isCommitted: boolean;
  private isRolledBack: boolean;
  private startTime?: number;

  constructor(prisma: PrismaClient, options: UnitOfWorkOptions = {}) {
    this.prisma = prisma;
    this.trackedEntities = new Map();
    this.pendingOperations = [];
    this.snapshots = [];
    this.isCommitted = false;
    this.isRolledBack = false;
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      timeout: options.timeout ?? 30000,
      isolationLevel: options.isolationLevel ?? 'ReadCommitted',
      enableChangeTracking: options.enableChangeTracking ?? true,
      enableSnapshots: options.enableSnapshots ?? false,
    };
  }

  // =========================================================================
  // ENTITY TRACKING
  // =========================================================================

  /**
   * Track an entity for creation
   */
  trackCreate<T extends Record<string, unknown>>(
    entityType: string,
    data: T
  ): void {
    this.assertNotCompleted();
    
    const key = `${entityType}:new:${Date.now()}:${Math.random()}`;
    this.trackedEntities.set(key, {
      type: entityType,
      id: null,
      data,
      changeType: 'create',
      timestamp: Date.now(),
    });
  }

  /**
   * Track an entity for update
   */
  trackUpdate<T extends Record<string, unknown>>(
    entityType: string,
    id: string,
    data: T,
    originalData?: T
  ): void {
    this.assertNotCompleted();
    
    const key = `${entityType}:${id}`;
    const existing = this.trackedEntities.get(key);
    
    if (existing && existing.changeType === 'create') {
      // Merge update into creation
      existing.data = { ...existing.data, ...data };
    } else if (existing && existing.changeType === 'delete') {
      // Trying to update a deleted entity
      throw new Error(`Cannot update deleted entity: ${key}`);
    } else {
      this.trackedEntities.set(key, {
        type: entityType,
        id,
        data,
        originalData: originalData ?? existing?.originalData,
        changeType: 'update',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Track an entity for deletion
   */
  trackDelete(entityType: string, id: string): void {
    this.assertNotCompleted();
    
    const key = `${entityType}:${id}`;
    const existing = this.trackedEntities.get(key);
    
    if (existing && existing.changeType === 'create') {
      // Remove the creation - never created in DB
      this.trackedEntities.delete(key);
    } else {
      this.trackedEntities.set(key, {
        type: entityType,
        id,
        data: {},
        changeType: 'delete',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Register a pending operation
   */
  registerOperation(operation: () => Promise<void>): void {
    this.assertNotCompleted();
    this.pendingOperations.push(operation);
  }

  // =========================================================================
  // SNAPSHOTS
  // =========================================================================

  /**
   * Create a snapshot of current tracked entities
   */
  createSnapshot(metadata: Record<string, unknown> = {}): number {
    if (!this.options.enableSnapshots) {
      throw new Error('Snapshots are not enabled');
    }

    const snapshot: Snapshot = {
      timestamp: Date.now(),
      entities: new Map(
        Array.from(this.trackedEntities.entries()).map(([key, entity]) => [
          key,
          { ...entity.data },
        ])
      ),
      metadata,
    };

    this.snapshots.push(snapshot);
    return this.snapshots.length - 1;
  }

  /**
   * Restore from a snapshot
   */
  restoreSnapshot(index: number): void {
    if (!this.options.enableSnapshots) {
      throw new Error('Snapshots are not enabled');
    }

    const snapshot = this.snapshots[index];
    if (!snapshot) {
      throw new Error(`Snapshot at index ${index} not found`);
    }

    // Clear current tracked entities after the snapshot
    for (const [key, entity] of this.trackedEntities) {
      if (entity.timestamp > snapshot.timestamp) {
        this.trackedEntities.delete(key);
      }
    }

    // Discard snapshots after this one
    this.snapshots = this.snapshots.slice(0, index + 1);
  }

  // =========================================================================
  // COMMIT / ROLLBACK
  // =========================================================================

  /**
   * Commit all tracked changes
   */
  async commit<T = void>(
    callback?: TransactionCallback<T>
  ): Promise<T | void> {
    this.assertNotCompleted();
    this.startTime = Date.now();

    try {
      const result = await this.executeWithRetry(async () => {
        return await this.prisma.$transaction(
          async (tx) => {
            const context: TransactionContext = {
              tx,
              unitOfWork: this,
            };

            // Execute pending operations
            for (const operation of this.pendingOperations) {
              await operation();
            }

            // Process tracked entities in order: creates, updates, deletes
            await this.processCreates(tx);
            await this.processUpdates(tx);
            await this.processDeletes(tx);

            // Execute custom callback if provided
            if (callback) {
              return await callback(context);
            }
          },
          {
            maxWait: this.options.timeout,
            timeout: this.options.timeout,
            isolationLevel: this.options.isolationLevel,
          }
        );
      });

      this.isCommitted = true;
      return result;
    } catch (error) {
      this.isRolledBack = true;
      throw error;
    }
  }

  /**
   * Rollback all tracked changes (discard without committing)
   */
  rollback(): void {
    this.trackedEntities.clear();
    this.pendingOperations = [];
    this.snapshots = [];
    this.isRolledBack = true;
  }

  // =========================================================================
  // CHANGE DETECTION
  // =========================================================================

  /**
   * Get all tracked changes
   */
  getChanges(): TrackedEntity[] {
    return Array.from(this.trackedEntities.values());
  }

  /**
   * Get changes by entity type
   */
  getChangesByType(entityType: string): TrackedEntity[] {
    return this.getChanges().filter((e) => e.type === entityType);
  }

  /**
   * Get changes by change type
   */
  getChangesByChangeType(changeType: ChangeType): TrackedEntity[] {
    return this.getChanges().filter((e) => e.changeType === changeType);
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.trackedEntities.size > 0 || this.pendingOperations.length > 0;
  }

  /**
   * Get change statistics
   */
  getStats(): UnitOfWorkStats {
    const changes = this.getChanges();
    const creates = changes.filter((c) => c.changeType === 'create').length;
    const updates = changes.filter((c) => c.changeType === 'update').length;
    const deletes = changes.filter((c) => c.changeType === 'delete').length;

    return {
      creates,
      updates,
      deletes,
      totalOperations: creates + updates + deletes + this.pendingOperations.length,
      duration: this.startTime ? Date.now() - this.startTime : undefined,
    };
  }

  /**
   * Detect changes between original and current data
   */
  detectChanges<T extends Record<string, unknown>>(
    original: T,
    current: T
  ): Partial<T> {
    const changes: Partial<T> = {};

    for (const key of Object.keys(current) as Array<keyof T>) {
      if (JSON.stringify(original[key]) !== JSON.stringify(current[key])) {
        changes[key] = current[key];
      }
    }

    return changes;
  }

  // =========================================================================
  // STATUS
  // =========================================================================

  get completed(): boolean {
    return this.isCommitted || this.isRolledBack;
  }

  get committed(): boolean {
    return this.isCommitted;
  }

  get rolledBack(): boolean {
    return this.isRolledBack;
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private assertNotCompleted(): void {
    if (this.isCommitted) {
      throw new Error('UnitOfWork has already been committed');
    }
    if (this.isRolledBack) {
      throw new Error('UnitOfWork has already been rolled back');
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error as Error)) {
          throw error;
        }

        if (attempt < this.options.maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError;
  }

  private isRetryableError(error: Error): boolean {
    const retryableCodes = [
      'P2024', // Connection timeout
      'P2028', // Transaction timeout
      'P2034', // Transaction conflict
      '40001', // Serialization failure
      '40P01', // Deadlock detected
    ];

    return retryableCodes.some(
      (code) =>
        error.message.includes(code) || (error as any)?.code === code
    );
  }

  private async processCreates(tx: Prisma.TransactionClient): Promise<void> {
    const creates = this.getChangesByChangeType('create');

    for (const entity of creates) {
      const model = (tx as any)[entity.type.toLowerCase()];
      if (!model) {
        throw new Error(`Unknown entity type: ${entity.type}`);
      }
      await model.create({ data: entity.data });
    }
  }

  private async processUpdates(tx: Prisma.TransactionClient): Promise<void> {
    const updates = this.getChangesByChangeType('update');

    for (const entity of updates) {
      if (!entity.id) continue;

      const model = (tx as any)[entity.type.toLowerCase()];
      if (!model) {
        throw new Error(`Unknown entity type: ${entity.type}`);
      }
      await model.update({
        where: { id: entity.id },
        data: entity.data,
      });
    }
  }

  private async processDeletes(tx: Prisma.TransactionClient): Promise<void> {
    const deletes = this.getChangesByChangeType('delete');

    for (const entity of deletes) {
      if (!entity.id) continue;

      const model = (tx as any)[entity.type.toLowerCase()];
      if (!model) {
        throw new Error(`Unknown entity type: ${entity.type}`);
      }
      await model.delete({ where: { id: entity.id } });
    }
  }
}

// ============================================================================
// UNIT OF WORK FACTORY
// ============================================================================

export class UnitOfWorkFactory {
  private prisma: PrismaClient;
  private defaultOptions: UnitOfWorkOptions;

  constructor(prisma: PrismaClient, defaultOptions: UnitOfWorkOptions = {}) {
    this.prisma = prisma;
    this.defaultOptions = defaultOptions;
  }

  /**
   * Create a new unit of work
   */
  create(options?: UnitOfWorkOptions): UnitOfWork {
    return new UnitOfWork(this.prisma, {
      ...this.defaultOptions,
      ...options,
    });
  }

  /**
   * Execute work within a unit of work scope
   */
  async scope<T>(
    work: (uow: UnitOfWork) => Promise<T>,
    options?: UnitOfWorkOptions
  ): Promise<T> {
    const uow = this.create(options);

    try {
      const result = await work(uow);
      await uow.commit();
      return result;
    } catch (error) {
      uow.rollback();
      throw error;
    }
  }

  /**
   * Execute a simple transaction
   */
  async transaction<T>(
    callback: TransactionCallback<T>,
    options?: UnitOfWorkOptions
  ): Promise<T> {
    const uow = this.create(options);
    return (await uow.commit(callback)) as T;
  }
}

// ============================================================================
// SCOPED UNIT OF WORK (For DI/Request Scoping)
// ============================================================================

export class ScopedUnitOfWork {
  private uow: UnitOfWork | null = null;
  private factory: UnitOfWorkFactory;
  private userId?: string;
  private tenantId?: string;

  constructor(
    factory: UnitOfWorkFactory,
    options?: { userId?: string; tenantId?: string }
  ) {
    this.factory = factory;
    this.userId = options?.userId;
    this.tenantId = options?.tenantId;
  }

  /**
   * Get or create the current unit of work
   */
  get current(): UnitOfWork {
    if (!this.uow || this.uow.completed) {
      this.uow = this.factory.create();
    }
    return this.uow;
  }

  /**
   * Begin a new unit of work
   */
  begin(options?: UnitOfWorkOptions): UnitOfWork {
    if (this.uow && !this.uow.completed) {
      throw new Error('There is already an active unit of work');
    }
    this.uow = this.factory.create(options);
    return this.uow;
  }

  /**
   * Commit the current unit of work
   */
  async commit<T>(callback?: TransactionCallback<T>): Promise<T | void> {
    if (!this.uow) {
      throw new Error('No active unit of work to commit');
    }
    return await this.uow.commit(callback);
  }

  /**
   * Rollback the current unit of work
   */
  rollback(): void {
    if (this.uow) {
      this.uow.rollback();
      this.uow = null;
    }
  }

  /**
   * Get scoped context information
   */
  getContext(): { userId?: string; tenantId?: string } {
    return {
      userId: this.userId,
      tenantId: this.tenantId,
    };
  }
}

// All classes exported inline with 'export class'
