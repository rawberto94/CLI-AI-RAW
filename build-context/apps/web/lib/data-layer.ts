/**
 * Data Layer Utilities
 * Repository pattern and data access abstractions
 */

import { AppResult, Result, AppError } from './result';
import { QueryBuilder, QueryParams, toPrismaQuery } from './query-builder';
import { PAGINATION } from './constants';

// Type helper for converting query params
type AnyQueryParams = QueryParams<Record<string, unknown>>;

// ============================================================================
// Types
// ============================================================================

export interface Entity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Repository<T extends Entity> {
  findById(id: string): Promise<AppResult<T>>;
  findMany(query?: QueryParams<T>): Promise<AppResult<PaginatedResult<T>>>;
  findOne(query: QueryParams<T>): Promise<AppResult<T | null>>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<AppResult<T>>;
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AppResult<T>>;
  delete(id: string): Promise<AppResult<void>>;
  count(query?: QueryParams<T>): Promise<AppResult<number>>;
  exists(id: string): Promise<AppResult<boolean>>;
}

// ============================================================================
// Base Repository Implementation
// ============================================================================

export abstract class BaseRepository<T extends Entity> implements Repository<T> {
  protected abstract entityName: string;

  abstract findById(id: string): Promise<AppResult<T>>;
  abstract findMany(query?: QueryParams<T>): Promise<AppResult<PaginatedResult<T>>>;
  abstract findOne(query: QueryParams<T>): Promise<AppResult<T | null>>;
  abstract create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<AppResult<T>>;
  abstract update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AppResult<T>>;
  abstract delete(id: string): Promise<AppResult<void>>;
  abstract count(query?: QueryParams<T>): Promise<AppResult<number>>;

  async exists(id: string): Promise<AppResult<boolean>> {
    const result = await this.findById(id);
    if (result.isOk()) {
      return Result.ok(true);
    }
    if (result.error.code === 'NOT_FOUND') {
      return Result.ok(false);
    }
    return Result.fail(result.error);
  }

  protected notFoundError(id?: string): AppError {
    return AppError.notFound(this.entityName, id);
  }

  protected validationError(field: string, message: string): AppError {
    return AppError.validation(field, message);
  }
}

// ============================================================================
// Prisma Repository Base
// ============================================================================

type PrismaDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  findFirst: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  count: (args: unknown) => Promise<number>;
};

export abstract class PrismaRepository<T extends Entity> extends BaseRepository<T> {
  protected abstract model: PrismaDelegate;

  async findById(id: string): Promise<AppResult<T>> {
    try {
      const entity = await this.model.findUnique({
        where: { id },
      });

      if (!entity) {
        return Result.fail(this.notFoundError(id));
      }

      return Result.ok(entity as T);
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  }

  async findMany(query?: QueryParams<T>): Promise<AppResult<PaginatedResult<T>>> {
    try {
      const page = query?.pagination?.page || PAGINATION.DEFAULT_PAGE;
      const pageSize = Math.min(
        query?.pagination?.pageSize || PAGINATION.DEFAULT_PAGE_SIZE,
        PAGINATION.MAX_PAGE_SIZE
      );

      const prismaQuery = query ? toPrismaQuery(query as AnyQueryParams) : { where: {}, orderBy: [] };
      
      const [items, total] = await Promise.all([
        this.model.findMany({
          ...prismaQuery,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.model.count({ where: prismaQuery.where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return Result.ok({
        items: items as T[],
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      });
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  }

  async findOne(query: QueryParams<T>): Promise<AppResult<T | null>> {
    try {
      const prismaQuery = toPrismaQuery(query as AnyQueryParams);
      const entity = await this.model.findFirst({
        where: prismaQuery.where,
        orderBy: prismaQuery.orderBy,
      });

      return Result.ok(entity as T | null);
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<AppResult<T>> {
    try {
      const entity = await this.model.create({
        data,
      });

      return Result.ok(entity as T);
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  }

  async update(
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<AppResult<T>> {
    try {
      // Check exists
      const exists = await this.exists(id);
      if (exists.isFail()) return Result.fail(exists.error);
      if (!exists.value) {
        return Result.fail(this.notFoundError(id));
      }

      const entity = await this.model.update({
        where: { id },
        data,
      });

      return Result.ok(entity as T);
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  }

  async delete(id: string): Promise<AppResult<void>> {
    try {
      // Check exists
      const exists = await this.exists(id);
      if (exists.isFail()) return Result.fail(exists.error);
      if (!exists.value) {
        return Result.fail(this.notFoundError(id));
      }

      await this.model.delete({
        where: { id },
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  }

  async count(query?: QueryParams<T>): Promise<AppResult<number>> {
    try {
      const prismaQuery = query ? toPrismaQuery(query as AnyQueryParams) : { where: {} };
      const count = await this.model.count({ where: prismaQuery.where });
      return Result.ok(count);
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  }
}

// ============================================================================
// In-Memory Repository (for testing)
// ============================================================================

export class InMemoryRepository<T extends Entity> extends BaseRepository<T> {
  protected entityName = 'Entity';
  private store = new Map<string, T>();
  private idCounter = 0;

  async findById(id: string): Promise<AppResult<T>> {
    const entity = this.store.get(id);
    if (!entity) {
      return Result.fail(this.notFoundError(id));
    }
    return Result.ok({ ...entity });
  }

  async findMany(query?: QueryParams<T>): Promise<AppResult<PaginatedResult<T>>> {
    let items = Array.from(this.store.values());

    // Apply filters
    if (query?.filters) {
      for (const filter of query.filters) {
        items = items.filter(item => {
          const value = item[filter.field as keyof T];
          switch (filter.operator) {
            case 'eq':
              return value === filter.value;
            case 'neq':
              return value !== filter.value;
            case 'gt':
              return (value as number) > (filter.value as number);
            case 'gte':
              return (value as number) >= (filter.value as number);
            case 'lt':
              return (value as number) < (filter.value as number);
            case 'lte':
              return (value as number) <= (filter.value as number);
            case 'in':
              return (filter.value as unknown[]).includes(value);
            case 'contains':
              return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
            default:
              return true;
          }
        });
      }
    }

    // Apply sort
    if (query?.sorts && query.sorts.length > 0) {
      items.sort((a, b) => {
        for (const sort of query.sorts) {
          const aVal = a[sort.field as keyof T];
          const bVal = b[sort.field as keyof T];
          const direction = sort.direction === 'asc' ? 1 : -1;
          
          if (aVal < bVal) return -1 * direction;
          if (aVal > bVal) return 1 * direction;
        }
        return 0;
      });
    }

    const total = items.length;
    const page = query?.pagination?.page || 1;
    const pageSize = query?.pagination?.pageSize || 20;

    // Apply pagination
    const start = (page - 1) * pageSize;
    items = items.slice(start, start + pageSize);

    const totalPages = Math.ceil(total / pageSize);

    return Result.ok({
      items: items.map(i => ({ ...i })),
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    });
  }

  async findOne(query: QueryParams<T>): Promise<AppResult<T | null>> {
    const result = await this.findMany({ ...query, pagination: { page: 1, pageSize: 1 } });
    if (result.isFail()) return Result.fail(result.error);
    return Result.ok(result.value.items[0] || null);
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<AppResult<T>> {
    const id = String(++this.idCounter);
    const now = new Date();
    const entity = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as T;
    this.store.set(id, entity);
    return Result.ok({ ...entity });
  }

  async update(
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<AppResult<T>> {
    const existing = this.store.get(id);
    if (!existing) {
      return Result.fail(this.notFoundError(id));
    }
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    } as T;
    this.store.set(id, updated);
    return Result.ok({ ...updated });
  }

  async delete(id: string): Promise<AppResult<void>> {
    if (!this.store.has(id)) {
      return Result.fail(this.notFoundError(id));
    }
    this.store.delete(id);
    return Result.ok(undefined);
  }

  async count(_query?: QueryParams<T>): Promise<AppResult<number>> {
    // For simplicity, return total count
    return Result.ok(this.store.size);
  }

  // Test helpers
  clear(): void {
    this.store.clear();
    this.idCounter = 0;
  }

  seed(items: T[]): void {
    for (const item of items) {
      this.store.set(item.id, item);
    }
  }
}

// ============================================================================
// Unit of Work Pattern
// ============================================================================

export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export class TransactionScope {
  private committed = false;
  private rolledBack = false;

  constructor(private unitOfWork: UnitOfWork) {}

  async execute<T>(fn: () => Promise<T>): Promise<AppResult<T>> {
    try {
      await this.unitOfWork.begin();
      const result = await fn();
      await this.unitOfWork.commit();
      this.committed = true;
      return Result.ok(result);
    } catch (error) {
      if (!this.committed && !this.rolledBack) {
        await this.unitOfWork.rollback();
        this.rolledBack = true;
      }
      return Result.fail(AppError.fromError(error));
    }
  }
}

// ============================================================================
// Query Helper
// ============================================================================

export function createQuery<T extends Record<string, unknown>>(): QueryBuilder<T> {
  return new QueryBuilder<T>();
}
