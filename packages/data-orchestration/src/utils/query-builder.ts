import { Prisma } from '@prisma/client';

export interface QueryOptions {
  // Pagination
  page?: number;
  limit?: number;
  cursor?: string;

  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  multiSort?: Array<{ field: string; order: 'asc' | 'desc' }>;

  // Field selection (sparse fieldsets)
  fields?: string[];

  // Filtering
  filters?: Record<string, any>;

  // Search
  search?: string;
  searchFields?: string[];
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

/**
 * Query Builder for advanced API queries
 */
export class QueryBuilder {
  /**
   * Build Prisma query from query options
   */
  static buildQuery(options: QueryOptions): Record<string, unknown> {
    const query: Record<string, unknown> = {};

    // Add where clause for filters
    if (options.filters) {
      query.where = this.buildWhereClause(options.filters);
    }

    // Add search
    if (options.search && options.searchFields) {
      const searchWhere = this.buildSearchClause(options.search, options.searchFields);
      query.where = query.where ? { AND: [query.where, searchWhere] } : searchWhere;
    }

    // Add field selection
    if (options.fields && options.fields.length > 0) {
      query.select = this.buildSelectClause(options.fields);
    }

    // Add sorting
    if (options.multiSort && options.multiSort.length > 0) {
      query.orderBy = options.multiSort.map((sort) => ({
        [sort.field]: sort.order,
      }));
    } else if (options.sortBy) {
      query.orderBy = {
        [options.sortBy]: options.sortOrder || 'asc',
      };
    }

    // Add pagination
    if (options.cursor) {
      // Cursor-based pagination
      query.cursor = { id: options.cursor };
      query.skip = 1; // Skip the cursor
      query.take = options.limit || 50;
    } else if (options.page && options.limit) {
      // Offset-based pagination
      query.skip = (options.page - 1) * options.limit;
      query.take = options.limit;
    } else if (options.limit) {
      query.take = options.limit;
    }

    return query;
  }

  /**
   * Build WHERE clause from filters
   */
  private static buildWhereClause(filters: Record<string, unknown>): Record<string, any> {
    const where: Record<string, any> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }

      // Handle special operators
      if (typeof value === 'object' && !Array.isArray(value)) {
        const objValue = value as Record<string, unknown>;
        // Range queries: { min: 100, max: 200 }
        if ('min' in objValue || 'max' in objValue) {
          where[key] = {};
          if ('min' in objValue) where[key].gte = objValue.min;
          if ('max' in objValue) where[key].lte = objValue.max;
        }
        // Contains query: { contains: 'text' }
        else if ('contains' in objValue) {
          where[key] = { contains: objValue.contains, mode: 'insensitive' };
        }
        // In query: { in: ['value1', 'value2'] }
        else if ('in' in objValue) {
          where[key] = { in: objValue.in };
        }
        // Not query: { not: 'value' }
        else if ('not' in objValue) {
          where[key] = { not: objValue.not };
        }
        // Greater than: { gt: 100 }
        else if ('gt' in objValue) {
          where[key] = { gt: objValue.gt };
        }
        // Less than: { lt: 100 }
        else if ('lt' in objValue) {
          where[key] = { lt: objValue.lt };
        }
      }
      // Handle array (IN query)
      else if (Array.isArray(value)) {
        where[key] = { in: value };
      }
      // Simple equality
      else {
        where[key] = value;
      }
    });

    return where;
  }

  /**
   * Build search clause for full-text search
   */
  private static buildSearchClause(search: string, searchFields: string[]): Record<string, unknown> {
    return {
      OR: searchFields.map((field) => ({
        [field]: {
          contains: search,
          mode: 'insensitive',
        },
      })),
    };
  }

  /**
   * Build SELECT clause for field selection
   */
  private static buildSelectClause(fields: string[]): Record<string, any> {
    const select: Record<string, any> = {};
    fields.forEach((field) => {
      // Handle nested fields: "user.name" -> { user: { select: { name: true } } }
      if (field.includes('.')) {
        const parts = field.split('.');
        let current: any = select;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = { select: {} };
          }
          current = current[parts[i]].select;
        }
        current[parts[parts.length - 1]] = true;
      } else {
        select[field] = true;
      }
    });
    return select;
  }

  /**
   * Execute paginated query
   */
  static async executePaginatedQuery<T extends { id: string }>(
    model: {
      findMany: (args: Record<string, unknown>) => Promise<T[]>;
      count: (args: { where?: Record<string, unknown> }) => Promise<number>;
    },
    options: QueryOptions
  ): Promise<PaginationResult<T>> {
    const query = this.buildQuery(options);

    // Execute query
    const [data, total] = await Promise.all([
      model.findMany(query),
      model.count({ where: query.where as Record<string, unknown> }),
    ]);

    // Calculate pagination metadata
    const page = options.page || 1;
    const limit = options.limit || 50;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextCursor: data.length > 0 ? data[data.length - 1].id : undefined,
        prevCursor: data.length > 0 ? data[0].id : undefined,
      },
    };
  }

  /**
   * Parse query options from URL search params
   */
  static parseQueryOptions(searchParams: URLSearchParams): QueryOptions {
    const options: QueryOptions = {};

    // Pagination
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const cursor = searchParams.get('cursor');

    if (page) options.page = parseInt(page, 10);
    if (limit) options.limit = Math.min(parseInt(limit, 10), 100); // Max 100
    if (cursor) options.cursor = cursor;

    // Sorting
    const sortBy = searchParams.get('sortBy');
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;
    const multiSort = searchParams.get('multiSort');

    if (sortBy) options.sortBy = sortBy;
    if (sortOrder) options.sortOrder = sortOrder;
    if (multiSort) {
      try {
        options.multiSort = JSON.parse(multiSort);
      } catch {
        // Invalid multiSort format, ignore
      }
    }

    // Field selection
    const fields = searchParams.get('fields');
    if (fields) {
      options.fields = fields.split(',').map((f) => f.trim());
    }

    // Search
    const search = searchParams.get('search');
    const searchFields = searchParams.get('searchFields');
    if (search) options.search = search;
    if (searchFields) {
      options.searchFields = searchFields.split(',').map((f) => f.trim());
    }

    // Filters (all other params)
    const filters: Record<string, any> = {};
    searchParams.forEach((value, key) => {
      // Skip known params
      if (
        [
          'page',
          'limit',
          'cursor',
          'sortBy',
          'sortOrder',
          'multiSort',
          'fields',
          'search',
          'searchFields',
        ].includes(key)
      ) {
        return;
      }

      // Try to parse as JSON for complex filters
      try {
        filters[key] = JSON.parse(value);
      } catch {
        filters[key] = value;
      }
    });

    if (Object.keys(filters).length > 0) {
      options.filters = filters;
    }

    return options;
  }

  /**
   * Validate query options
   */
  static validateQueryOptions(options: QueryOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate pagination
    if (options.page && options.page < 1) {
      errors.push('Page must be greater than 0');
    }
    if (options.limit && (options.limit < 1 || options.limit > 100)) {
      errors.push('Limit must be between 1 and 100');
    }

    // Validate sorting
    if (options.sortOrder && !['asc', 'desc'].includes(options.sortOrder)) {
      errors.push('Sort order must be "asc" or "desc"');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Helper function to apply query options to API route
 */
export async function applyQueryOptions<T extends { id: string }>(
  model: {
    findMany: (args: Record<string, unknown>) => Promise<T[]>;
    count: (args: { where?: Record<string, unknown> }) => Promise<number>;
  },
  searchParams: URLSearchParams
): Promise<PaginationResult<T>> {
  const options = QueryBuilder.parseQueryOptions(searchParams);
  const validation = QueryBuilder.validateQueryOptions(options);

  if (!validation.valid) {
    throw new Error(`Invalid query options: ${validation.errors.join(', ')}`);
  }

  return await QueryBuilder.executePaginatedQuery<T>(model, options);
}
