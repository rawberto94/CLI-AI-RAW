/**
 * Enhanced Base Repository with Optimistic Locking
 * 
 * Provides version-based optimistic locking for concurrent updates with:
 * - Automatic version increment
 * - Conflict detection
 * - Retry strategies
 * - Cache integration
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { QueryCache, getQueryCache } from '../cache/query-cache';
import { UnitOfWork } from '../patterns/unit-of-work';

// ============================================================================
// TYPES
// ============================================================================

export interface BaseRepository<T, CreateInput, UpdateInput, WhereInput> {
  create(data: CreateInput): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(where?: WhereInput, options?: QueryOptions): Promise<T[]>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<T>;
  count(where?: WhereInput): Promise<number>;
}

export interface QueryOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
  include?: Record<string, boolean | object>;
  select?: Record<string, boolean>;
  cache?: CacheQueryOptions;
}

export interface CacheQueryOptions {
  enabled?: boolean;
  ttl?: number;
  tags?: string[];
}

export interface OptimisticLockOptions {
  enabled?: boolean;
  versionField?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RepositoryConfig {
  cache?: QueryCache;
  enableOptimisticLocking?: boolean;
  versionField?: string;
  enableSoftDelete?: boolean;
  softDeleteField?: string;
  tenantIsolation?: boolean;
  tenantField?: string;
}

export class OptimisticLockError extends Error {
  constructor(
    public entityType: string,
    public entityId: string,
    public expectedVersion: number,
    public actualVersion: number
  ) {
    super(
      `Optimistic lock failed for ${entityType}:${entityId}. ` +
      `Expected version ${expectedVersion}, but found ${actualVersion}`
    );
    this.name = 'OptimisticLockError';
  }
}

export class EntityNotFoundError extends Error {
  constructor(public entityType: string, public entityId: string) {
    super(`${entityType} with id ${entityId} not found`);
    this.name = 'EntityNotFoundError';
  }
}

// ============================================================================
// ENHANCED ABSTRACT REPOSITORY
// ============================================================================

export abstract class AbstractRepository<T, CreateInput, UpdateInput, WhereInput>
  implements BaseRepository<T, CreateInput, UpdateInput, WhereInput> {
  
  protected prisma: PrismaClient;
  protected cache?: QueryCache;
  protected abstract modelName: string;
  protected config: Required<RepositoryConfig>;

  constructor(
    prisma: PrismaClient,
    config: RepositoryConfig = {}
  ) {
    this.prisma = prisma;
    this.cache = config.cache ?? getQueryCache();
    this.config = {
      cache: this.cache,
      enableOptimisticLocking: config.enableOptimisticLocking ?? false,
      versionField: config.versionField ?? 'version',
      enableSoftDelete: config.enableSoftDelete ?? false,
      softDeleteField: config.softDeleteField ?? 'deletedAt',
      tenantIsolation: config.tenantIsolation ?? false,
      tenantField: config.tenantField ?? 'tenantId',
    };
  }

  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  // =========================================================================
  // BASIC CRUD OPERATIONS
  // =========================================================================

  async create(data: CreateInput): Promise<T> {
    // Add initial version if optimistic locking is enabled
    const createData = this.config.enableOptimisticLocking
      ? { ...data, [this.config.versionField]: 1 }
      : data;

    const result = await this.model.create({ data: createData });

    // Invalidate related caches
    await this.invalidateListCache();

    return result;
  }

  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    const cacheKey = this.cache?.entityKey(this.modelName, id);

    if (this.shouldUseCache(options)) {
      return this.cache!.getOrSet(
        cacheKey!,
        () => this.model.findUnique({
          where: this.buildWhereWithId(id),
          include: options?.include,
          select: options?.select,
        }),
        { ttl: options?.cache?.ttl, tags: [this.modelName, `${this.modelName}:${id}`] }
      );
    }

    return this.model.findUnique({
      where: this.buildWhereWithId(id),
      include: options?.include,
      select: options?.select,
    });
  }

  async findMany(where?: WhereInput, options?: QueryOptions): Promise<T[]> {
    const finalWhere = this.buildWhere(where);
    const cacheKey = this.cache?.listKey(this.modelName, { where: finalWhere, ...options });

    const query = {
      where: finalWhere,
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
      include: options?.include,
      select: options?.select,
    };

    if (this.shouldUseCache(options)) {
      return this.cache!.getOrSet(
        cacheKey!,
        () => this.model.findMany(query),
        { ttl: options?.cache?.ttl, tags: [this.modelName] }
      );
    }

    return this.model.findMany(query);
  }

  async update(id: string, data: UpdateInput, options?: OptimisticLockOptions): Promise<T> {
    if (this.config.enableOptimisticLocking || options?.enabled) {
      return this.updateWithOptimisticLock(id, data, options);
    }

    const result = await this.model.update({
      where: this.buildWhereWithId(id),
      data,
    });

    await this.invalidateEntityCache(id);
    return result;
  }

  async delete(id: string): Promise<T> {
    let result: T;

    if (this.config.enableSoftDelete) {
      result = await this.model.update({
        where: this.buildWhereWithId(id),
        data: { [this.config.softDeleteField]: new Date() },
      });
    } else {
      result = await this.model.delete({
        where: this.buildWhereWithId(id),
      });
    }

    await this.invalidateEntityCache(id);
    await this.invalidateListCache();
    return result;
  }

  async count(where?: WhereInput): Promise<number> {
    const finalWhere = this.buildWhere(where);
    const cacheKey = this.cache?.countKey(this.modelName, finalWhere);

    if (this.cache) {
      return this.cache.getOrSet(
        cacheKey!,
        () => this.model.count({ where: finalWhere }),
        { ttl: 60, tags: [this.modelName] }
      );
    }

    return this.model.count({ where: finalWhere });
  }

  // =========================================================================
  // OPTIMISTIC LOCKING
  // =========================================================================

  /**
   * Update with optimistic locking
   */
  async updateWithOptimisticLock(
    id: string,
    data: UpdateInput,
    options: OptimisticLockOptions = {}
  ): Promise<T> {
    const versionField = options.versionField ?? this.config.versionField;
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 100;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Get current entity with version
      const current = await this.model.findUnique({
        where: this.buildWhereWithId(id),
        select: { id: true, [versionField]: true },
      });

      if (!current) {
        throw new EntityNotFoundError(this.modelName, id);
      }

      const currentVersion = current[versionField] ?? 0;
      const newVersion = currentVersion + 1;

      try {
        // Attempt update with version check
        const result = await this.model.update({
          where: {
            id,
            [versionField]: currentVersion,
          },
          data: {
            ...data,
            [versionField]: newVersion,
          },
        });

        await this.invalidateEntityCache(id);
        return result;
      } catch (error) {
        if (this.isVersionConflictError(error as Error)) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            continue;
          }

          // Get actual current version for error message
          const actual = await this.model.findUnique({
            where: this.buildWhereWithId(id),
            select: { [versionField]: true },
          });

          throw new OptimisticLockError(
            this.modelName,
            id,
            currentVersion,
            actual?.[versionField] ?? -1
          );
        }
        throw error;
      }
    }

    throw new Error('Optimistic lock failed after max retries');
  }

  /**
   * Update with version check (explicit version)
   */
  async updateWithVersion(
    id: string,
    expectedVersion: number,
    data: UpdateInput
  ): Promise<T> {
    const versionField = this.config.versionField;
    const newVersion = expectedVersion + 1;

    try {
      const result = await this.model.update({
        where: {
          id,
          [versionField]: expectedVersion,
        },
        data: {
          ...data,
          [versionField]: newVersion,
        },
      });

      await this.invalidateEntityCache(id);
      return result;
    } catch (error) {
      if (this.isNotFoundOrVersionConflict(error as Error)) {
        const current = await this.findById(id);
        if (!current) {
          throw new EntityNotFoundError(this.modelName, id);
        }
        throw new OptimisticLockError(
          this.modelName,
          id,
          expectedVersion,
          (current as any)[versionField] ?? -1
        );
      }
      throw error;
    }
  }

  // =========================================================================
  // EXTENDED QUERY METHODS
  // =========================================================================

  async findFirst(where?: WhereInput, options?: QueryOptions): Promise<T | null> {
    const finalWhere = this.buildWhere(where);
    return this.model.findFirst({
      where: finalWhere,
      orderBy: options?.orderBy,
      include: options?.include,
      select: options?.select,
    });
  }

  async findFirstOrThrow(where?: WhereInput, options?: QueryOptions): Promise<T> {
    const result = await this.findFirst(where, options);
    if (!result) {
      throw new EntityNotFoundError(this.modelName, JSON.stringify(where));
    }
    return result;
  }

  async upsert(
    where: unknown,
    create: CreateInput,
    update: UpdateInput
  ): Promise<T> {
    const result = await this.model.upsert({
      where,
      create: this.config.enableOptimisticLocking
        ? { ...create, [this.config.versionField]: 1 }
        : create,
      update,
    });

    await this.invalidateListCache();
    return result;
  }

  async exists(where: WhereInput): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  async findByIds(ids: string[], options?: QueryOptions): Promise<T[]> {
    return this.findMany(
      { id: { in: ids } } as unknown as WhereInput,
      options
    );
  }

  // =========================================================================
  // BULK OPERATIONS
  // =========================================================================

  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    const createData = this.config.enableOptimisticLocking
      ? data.map(d => ({ ...d, [this.config.versionField]: 1 }))
      : data;

    const result = await this.model.createMany({ data: createData });
    await this.invalidateListCache();
    return result;
  }

  async updateMany(
    where: WhereInput,
    data: Partial<UpdateInput>
  ): Promise<{ count: number }> {
    const result = await this.model.updateMany({
      where: this.buildWhere(where),
      data,
    });

    await this.invalidateListCache();
    return result;
  }

  async deleteMany(where: WhereInput): Promise<{ count: number }> {
    const finalWhere = this.buildWhere(where);

    let result: { count: number };
    if (this.config.enableSoftDelete) {
      result = await this.model.updateMany({
        where: finalWhere,
        data: { [this.config.softDeleteField]: new Date() },
      });
    } else {
      result = await this.model.deleteMany({ where: finalWhere });
    }

    await this.invalidateListCache();
    return result;
  }

  // =========================================================================
  // UNIT OF WORK INTEGRATION
  // =========================================================================

  /**
   * Register entity for creation in unit of work
   */
  trackCreate(uow: UnitOfWork, data: CreateInput): void {
    uow.trackCreate(this.modelName, data as Record<string, unknown>);
  }

  /**
   * Register entity for update in unit of work
   */
  trackUpdate(uow: UnitOfWork, id: string, data: UpdateInput): void {
    uow.trackUpdate(this.modelName, id, data as Record<string, unknown>);
  }

  /**
   * Register entity for deletion in unit of work
   */
  trackDelete(uow: UnitOfWork, id: string): void {
    uow.trackDelete(this.modelName, id);
  }

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================

  async invalidateEntityCache(id: string): Promise<void> {
    if (this.cache) {
      await this.cache.invalidateEntity(this.modelName, id);
      this.cache.incrementVersion(this.modelName);
    }
  }

  async invalidateListCache(): Promise<void> {
    if (this.cache) {
      await this.cache.invalidateByTag(this.modelName);
      this.cache.incrementVersion(this.modelName);
    }
  }

  async warmCache(ids: string[]): Promise<void> {
    if (!this.cache) return;

    await this.cache.prefetch(
      ids.map(id => this.cache!.entityKey(this.modelName, id)),
      async (key) => {
        const id = key.split(':')[1];
        return this.model.findUnique({ where: { id } });
      }
    );
  }

  // =========================================================================
  // TRANSACTION HELPERS
  // =========================================================================

  /**
   * Execute operations within a transaction
   */
  async transaction<R>(
    callback: (tx: Prisma.TransactionClient) => Promise<R>
  ): Promise<R> {
    return this.prisma.$transaction(callback);
  }

  /**
   * Get repository with transaction client
   */
  withTransaction(tx: Prisma.TransactionClient): this {
    const TransactionalRepository = this.constructor as new (
      prisma: PrismaClient,
      config: RepositoryConfig
    ) => this;

    return new TransactionalRepository(tx as unknown as PrismaClient, this.config);
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  protected buildWhereWithId(id: string): Record<string, unknown> {
    return { id };
  }

  protected buildWhere(where?: WhereInput): Record<string, unknown> {
    const baseWhere = (where ?? {}) as Record<string, unknown>;

    // Add soft delete filter if enabled
    if (this.config.enableSoftDelete) {
      return {
        ...baseWhere,
        [this.config.softDeleteField]: null,
      };
    }

    return baseWhere;
  }

  protected shouldUseCache(options?: QueryOptions): boolean {
    return !!(this.cache && (options?.cache?.enabled ?? true));
  }

  protected isVersionConflictError(error: Error): boolean {
    return (
      error.message.includes('Record to update not found') ||
      error.message.includes('P2025')
    );
  }

  protected isNotFoundOrVersionConflict(error: Error): boolean {
    return (
      (error as any)?.code === 'P2025' ||
      error.message.includes('Record to update not found')
    );
  }
}

// ============================================================================
// SOFT DELETE MIXIN
// ============================================================================

/**
 * Mixin to add soft delete functionality to a concrete repository class.
 * Note: Use this with a concrete implementation of AbstractRepository, not the abstract class itself.
 */
export function withSoftDelete<
  T,
  CreateInput,
  UpdateInput,
  WhereInput,
  TBase extends abstract new (...args: any[]) => AbstractRepository<T, CreateInput, UpdateInput, WhereInput>
>(Base: TBase) {
  abstract class SoftDeleteRepository extends Base {
    async restore(id: string): Promise<T> {
      const result = await this.model.update({
        where: { id },
        data: { [this.config.softDeleteField]: null },
      });
      await this.invalidateEntityCache(id);
      return result;
    }

    async findDeleted(where?: WhereInput): Promise<T[]> {
      return this.model.findMany({
        where: {
          ...(where ?? {}),
          [this.config.softDeleteField]: { not: null },
        },
      });
    }

    async hardDelete(id: string): Promise<T> {
      const result = await this.model.delete({ where: { id } });
      await this.invalidateEntityCache(id);
      return result;
    }
  }
  return SoftDeleteRepository;
}

// All classes and functions exported inline with 'export'
