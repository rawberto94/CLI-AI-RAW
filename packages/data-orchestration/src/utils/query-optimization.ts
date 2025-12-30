/**
 * Query Optimization Utilities
 * Provides helpers for optimizing database queries
 * Requirements: 4.4
 */

import { Prisma } from '@prisma/client';
import { monitoringService } from '../services/monitoring.service';

/**
 * Optimize select fields to reduce data transfer
 */
export function optimizeSelect<T extends Record<string, any>>(
  fields: (keyof T)[]
): Record<string, boolean> {
  const select: Record<string, boolean> = {};
  fields.forEach((field) => {
    select[field as string] = true;
  });
  return select;
}

/**
 * Build efficient where clause with proper indexing
 */
export function buildWhereClause(filters: Record<string, unknown>): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    // Handle array values (IN queries)
    if (Array.isArray(value)) {
      where[key] = { in: value };
      return;
    }

    // Handle range queries
    if (typeof value === 'object' && ('gte' in value || 'lte' in value || 'gt' in value || 'lt' in value)) {
      where[key] = value;
      return;
    }

    // Handle string searches (use case-insensitive)
    if (typeof value === 'string' && value.includes('*')) {
      where[key] = {
        contains: value.replace(/\*/g, ''),
        mode: 'insensitive',
      };
      return;
    }

    // Exact match
    where[key] = value;
  });

  return where;
}

/**
 * Optimize pagination with cursor-based approach
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  cursor?: string;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    cursor?: string;
  };
}

export function buildPaginationQuery(options: PaginationOptions): Record<string, unknown> {
  const page = options.page || 1;
  const pageSize = Math.min(options.pageSize || 100, 100); // Max 100 items per page
  const skip = (page - 1) * pageSize;

  const query: Record<string, unknown> = {
    take: pageSize,
    skip,
  };

  // Use cursor-based pagination if cursor is provided
  if (options.cursor) {
    query.cursor = { id: options.cursor };
    query.skip = 1; // Skip the cursor itself
  }

  // Add ordering
  if (options.orderBy) {
    query.orderBy = options.orderBy;
  }

  return query;
}

/**
 * Batch queries to reduce round trips
 */
export async function batchQueries<T>(
  queries: Array<() => Promise<T>>
): Promise<T[]> {
  const startTime = Date.now();
  
  try {
    const results = await Promise.all(queries.map(q => q()));
    const duration = Date.now() - startTime;
    
    monitoringService.recordTiming('query.batch', duration, {
      count: queries.length.toString(),
    });
    
    return results;
  } catch (error) {
    monitoringService.incrementCounter('query.batch.error');
    throw error;
  }
}

/**
 * Optimize includes to prevent N+1 queries
 */
export function optimizeIncludes<T extends Record<string, any>>(
  includes: (keyof T)[]
): Record<string, boolean | object> {
  const include: Record<string, boolean | object> = {};
  
  includes.forEach((field) => {
    include[field as string] = true;
  });
  
  return include;
}

/**
 * Build efficient aggregation query
 */
export interface AggregationOptions {
  groupBy: string[];
  aggregations: {
    field: string;
    operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  }[];
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
}

export function buildAggregationQuery(options: AggregationOptions): Record<string, unknown> {
  const query: Record<string, unknown> = {
    by: options.groupBy,
  };

  // Add aggregations
  const aggregations: Record<string, Record<string, boolean>> = {};
  options.aggregations.forEach((agg) => {
    if (!aggregations[agg.field]) {
      aggregations[agg.field] = {};
    }
    aggregations[agg.field][agg.operation] = true;
  });
  query._count = aggregations;

  // Add where clause
  if (options.where) {
    query.where = options.where;
  }

  // Add ordering
  if (options.orderBy) {
    query.orderBy = options.orderBy;
  }

  // Add limit
  if (options.limit) {
    query.take = options.limit;
  }

  return query;
}

/**
 * Optimize full-text search queries
 */
export function buildFullTextSearch(
  searchTerm: string,
  fields: string[]
): Record<string, unknown> {
  const searchWords = searchTerm.trim().split(/\s+/);
  
  // Build OR conditions for each field
  const conditions = fields.flatMap((field) =>
    searchWords.map((word) => ({
      [field]: {
        contains: word,
        mode: 'insensitive' as const,
      },
    }))
  );

  return {
    OR: conditions,
  };
}

/**
 * Monitor slow queries
 */
export async function monitorQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  slowThreshold: number = 1000
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    monitoringService.recordTiming(`query.${queryName}`, duration);
    
    if (duration > slowThreshold) {
      console.warn(`⚠️ Slow query detected: ${queryName} (${duration}ms)`);
      monitoringService.incrementCounter('query.slow', { query: queryName });
    }
    
    return result;
  } catch (error) {
    monitoringService.incrementCounter('query.error', { query: queryName });
    throw error;
  }
}

/**
 * Optimize JSON field queries
 */
export function buildJsonQuery(
  field: string,
  path: string[],
  value: unknown
): Record<string, unknown> {
  return {
    [field]: {
      path,
      equals: value,
    },
  };
}

/**
 * Build efficient date range query
 */
export function buildDateRangeQuery(
  field: string,
  startDate?: Date,
  endDate?: Date
): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (startDate) {
    query.gte = startDate;
  }

  if (endDate) {
    query.lte = endDate;
  }

  return { [field]: query };
}

/**
 * Optimize relation loading
 */
export interface RelationLoadOptions {
  include?: Record<string, boolean | object>;
  select?: Record<string, boolean>;
}

export function optimizeRelationLoading(
  relations: string[],
  selectFields?: Record<string, string[]>
): RelationLoadOptions {
  const include: Record<string, boolean | object> = {};

  relations.forEach((relation) => {
    if (selectFields && selectFields[relation]) {
      include[relation] = {
        select: optimizeSelect(selectFields[relation]),
      };
    } else {
      include[relation] = true;
    }
  });

  return { include };
}

/**
 * Build efficient count query
 */
export async function efficientCount(
  model: { count: (args: { where: Record<string, unknown> }) => Promise<number> },
  where: Record<string, unknown>
): Promise<number> {
  const startTime = Date.now();
  
  try {
    // Use count instead of findMany + length
    const count = await model.count({ where });
    const duration = Date.now() - startTime;
    
    monitoringService.recordTiming('query.count', duration);
    
    return count;
  } catch (error) {
    monitoringService.incrementCounter('query.count.error');
    throw error;
  }
}

/**
 * Optimize bulk operations
 */
export async function bulkCreate<T>(
  model: { createMany: (args: { data: T[]; skipDuplicates?: boolean }) => Promise<unknown> },
  data: T[],
  batchSize: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Split into batches
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    
    // Execute batches in parallel
    await Promise.all(
      batches.map((batch) =>
        model.createMany({
          data: batch,
          skipDuplicates: true,
        })
      )
    );
    
    const duration = Date.now() - startTime;
    monitoringService.recordTiming('query.bulkCreate', duration, {
      count: data.length.toString(),
      batches: batches.length.toString(),
    });
  } catch (error) {
    monitoringService.incrementCounter('query.bulkCreate.error');
    throw error;
  }
}

/**
 * Optimize bulk updates
 */
export async function bulkUpdate<T>(
  model: { update: (args: { where: Record<string, unknown>; data: T }) => Promise<unknown> },
  updates: Array<{ where: Record<string, unknown>; data: T }>,
  batchSize: number = 50
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Split into batches
    const batches: Array<Array<{ where: Record<string, unknown>; data: T }>> = [];
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }
    
    // Execute batches sequentially to avoid conflicts
    for (const batch of batches) {
      await Promise.all(
        batch.map((update) =>
          model.update({
            where: update.where,
            data: update.data,
          })
        )
      );
    }
    
    const duration = Date.now() - startTime;
    monitoringService.recordTiming('query.bulkUpdate', duration, {
      count: updates.length.toString(),
      batches: batches.length.toString(),
    });
  } catch (error) {
    monitoringService.incrementCounter('query.bulkUpdate.error');
    throw error;
  }
}
