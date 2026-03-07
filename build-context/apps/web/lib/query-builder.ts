/**
 * Query Builder Pattern
 * Type-safe query construction for API requests
 * 
 * @example
 * const query = new QueryBuilder<Contract>()
 *   .filter('status', 'eq', 'active')
 *   .filter('value', 'gte', 10000)
 *   .search('vendorName', 'Acme')
 *   .sort('createdAt', 'desc')
 *   .paginate(1, 20)
 *   .include('artifacts', 'tags')
 *   .build();
 * 
 * // Use with fetch
 * const url = `/api/contracts?${query.toQueryString()}`;
 */

// ============================================================================
// Types
// ============================================================================

export type FilterOperator =
  | 'eq'      // Equal
  | 'neq'     // Not equal
  | 'gt'      // Greater than
  | 'gte'     // Greater than or equal
  | 'lt'      // Less than
  | 'lte'     // Less than or equal
  | 'in'      // In array
  | 'nin'     // Not in array
  | 'contains' // Contains substring
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull';

export type SortDirection = 'asc' | 'desc';

export interface Filter<T> {
  field: keyof T;
  operator: FilterOperator;
  value: unknown;
}

export interface Sort<T> {
  field: keyof T;
  direction: SortDirection;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface QueryParams<T> {
  filters: Filter<T>[];
  sorts: Sort<T>[];
  pagination?: Pagination;
  search?: { field: keyof T; query: string };
  includes: string[];
  select?: (keyof T)[];
}

// ============================================================================
// Query Builder
// ============================================================================

export class QueryBuilder<T extends Record<string, unknown>> {
  private params: QueryParams<T> = {
    filters: [],
    sorts: [],
    includes: [],
  };

  /**
   * Add a filter condition
   */
  filter(
    field: keyof T,
    operator: FilterOperator,
    value: unknown
  ): QueryBuilder<T> {
    this.params.filters.push({ field, operator, value });
    return this;
  }

  /**
   * Add equality filter (shorthand)
   */
  where(field: keyof T, value: unknown): QueryBuilder<T> {
    return this.filter(field, 'eq', value);
  }

  /**
   * Add not equal filter
   */
  whereNot(field: keyof T, value: unknown): QueryBuilder<T> {
    return this.filter(field, 'neq', value);
  }

  /**
   * Add greater than filter
   */
  whereGreater(field: keyof T, value: number | Date): QueryBuilder<T> {
    return this.filter(field, 'gt', value);
  }

  /**
   * Add greater than or equal filter
   */
  whereGreaterOrEqual(field: keyof T, value: number | Date): QueryBuilder<T> {
    return this.filter(field, 'gte', value);
  }

  /**
   * Add less than filter
   */
  whereLess(field: keyof T, value: number | Date): QueryBuilder<T> {
    return this.filter(field, 'lt', value);
  }

  /**
   * Add less than or equal filter
   */
  whereLessOrEqual(field: keyof T, value: number | Date): QueryBuilder<T> {
    return this.filter(field, 'lte', value);
  }

  /**
   * Add in array filter
   */
  whereIn(field: keyof T, values: unknown[]): QueryBuilder<T> {
    return this.filter(field, 'in', values);
  }

  /**
   * Add not in array filter
   */
  whereNotIn(field: keyof T, values: unknown[]): QueryBuilder<T> {
    return this.filter(field, 'nin', values);
  }

  /**
   * Add contains filter
   */
  whereContains(field: keyof T, value: string): QueryBuilder<T> {
    return this.filter(field, 'contains', value);
  }

  /**
   * Add null check
   */
  whereNull(field: keyof T): QueryBuilder<T> {
    return this.filter(field, 'isNull', true);
  }

  /**
   * Add not null check
   */
  whereNotNull(field: keyof T): QueryBuilder<T> {
    return this.filter(field, 'isNotNull', true);
  }

  /**
   * Add search condition
   */
  search(field: keyof T, query: string): QueryBuilder<T> {
    this.params.search = { field, query };
    return this;
  }

  /**
   * Add sort condition
   */
  sort(field: keyof T, direction: SortDirection = 'asc'): QueryBuilder<T> {
    this.params.sorts.push({ field, direction });
    return this;
  }

  /**
   * Sort ascending (shorthand)
   */
  sortAsc(field: keyof T): QueryBuilder<T> {
    return this.sort(field, 'asc');
  }

  /**
   * Sort descending (shorthand)
   */
  sortDesc(field: keyof T): QueryBuilder<T> {
    return this.sort(field, 'desc');
  }

  /**
   * Add pagination
   */
  paginate(page: number, pageSize: number): QueryBuilder<T> {
    this.params.pagination = { page, pageSize };
    return this;
  }

  /**
   * Set page number
   */
  page(page: number): QueryBuilder<T> {
    this.params.pagination = {
      page,
      pageSize: this.params.pagination?.pageSize || 20,
    };
    return this;
  }

  /**
   * Set page size
   */
  pageSize(size: number): QueryBuilder<T> {
    this.params.pagination = {
      page: this.params.pagination?.page || 1,
      pageSize: size,
    };
    return this;
  }

  /**
   * Add relations to include
   */
  include(...relations: string[]): QueryBuilder<T> {
    this.params.includes.push(...relations);
    return this;
  }

  /**
   * Select specific fields
   */
  select(...fields: (keyof T)[]): QueryBuilder<T> {
    this.params.select = fields;
    return this;
  }

  /**
   * Build and return query params
   */
  build(): QueryParams<T> {
    return { ...this.params };
  }

  /**
   * Convert to URL query string
   */
  toQueryString(): string {
    const parts: string[] = [];

    // Filters
    for (const filter of this.params.filters) {
      const key = `filter[${String(filter.field)}][${filter.operator}]`;
      const value = Array.isArray(filter.value)
        ? filter.value.join(',')
        : String(filter.value);
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }

    // Search
    if (this.params.search) {
      parts.push(`search[field]=${String(this.params.search.field)}`);
      parts.push(`search[query]=${encodeURIComponent(this.params.search.query)}`);
    }

    // Sorts
    if (this.params.sorts.length > 0) {
      const sortStr = this.params.sorts
        .map(s => `${s.direction === 'desc' ? '-' : ''}${String(s.field)}`)
        .join(',');
      parts.push(`sort=${encodeURIComponent(sortStr)}`);
    }

    // Pagination
    if (this.params.pagination) {
      parts.push(`page=${this.params.pagination.page}`);
      parts.push(`pageSize=${this.params.pagination.pageSize}`);
    }

    // Includes
    if (this.params.includes.length > 0) {
      parts.push(`include=${this.params.includes.join(',')}`);
    }

    // Select
    if (this.params.select && this.params.select.length > 0) {
      parts.push(`select=${this.params.select.map(String).join(',')}`);
    }

    return parts.join('&');
  }

  /**
   * Convert to JSON body (for POST requests)
   */
  toJSON(): Record<string, unknown> {
    return {
      filters: this.params.filters.map(f => ({
        field: f.field,
        operator: f.operator,
        value: f.value,
      })),
      search: this.params.search,
      sort: this.params.sorts,
      pagination: this.params.pagination,
      include: this.params.includes,
      select: this.params.select,
    };
  }

  /**
   * Reset all params
   */
  reset(): QueryBuilder<T> {
    this.params = {
      filters: [],
      sorts: [],
      includes: [],
    };
    return this;
  }

  /**
   * Clone the builder
   */
  clone(): QueryBuilder<T> {
    const clone = new QueryBuilder<T>();
    clone.params = {
      filters: [...this.params.filters],
      sorts: [...this.params.sorts],
      pagination: this.params.pagination
        ? { ...this.params.pagination }
        : undefined,
      search: this.params.search ? { ...this.params.search } : undefined,
      includes: [...this.params.includes],
      select: this.params.select ? [...this.params.select] : undefined,
    };
    return clone;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function query<T extends Record<string, unknown>>(): QueryBuilder<T> {
  return new QueryBuilder<T>();
}

// ============================================================================
// Query String Parser (for API routes)
// ============================================================================

export function parseQueryString<T extends Record<string, unknown>>(
  searchParams: URLSearchParams
): QueryParams<T> {
  const params: QueryParams<T> = {
    filters: [],
    sorts: [],
    includes: [],
  };

  // Parse filters (filter[field][operator]=value)
  for (const [key, value] of searchParams.entries()) {
    const filterMatch = key.match(/^filter\[(\w+)\]\[(\w+)\]$/);
    if (filterMatch) {
      const [, field, operator] = filterMatch;
      let parsedValue: unknown = value;
      
      // Handle arrays
      if (value.includes(',') && (operator === 'in' || operator === 'nin')) {
        parsedValue = value.split(',');
      }
      
      params.filters.push({
        field: field as keyof T,
        operator: operator as FilterOperator,
        value: parsedValue,
      });
    }
  }

  // Parse search
  const searchField = searchParams.get('search[field]');
  const searchQuery = searchParams.get('search[query]');
  if (searchField && searchQuery) {
    params.search = {
      field: searchField as keyof T,
      query: searchQuery,
    };
  }

  // Parse sort (-field for desc, field for asc)
  const sortStr = searchParams.get('sort');
  if (sortStr) {
    for (const part of sortStr.split(',')) {
      const trimmed = part.trim();
      if (trimmed.startsWith('-')) {
        params.sorts.push({
          field: trimmed.slice(1) as keyof T,
          direction: 'desc',
        });
      } else {
        params.sorts.push({
          field: trimmed as keyof T,
          direction: 'asc',
        });
      }
    }
  }

  // Parse pagination
  const page = searchParams.get('page');
  const pageSize = searchParams.get('pageSize');
  if (page || pageSize) {
    params.pagination = {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
  }

  // Parse includes
  const includes = searchParams.get('include');
  if (includes) {
    params.includes = includes.split(',');
  }

  // Parse select
  const select = searchParams.get('select');
  if (select) {
    params.select = select.split(',') as (keyof T)[];
  }

  return params;
}

// ============================================================================
// Prisma Query Builder Helper
// ============================================================================

export function toPrismaQuery<T extends Record<string, unknown>>(
  params: QueryParams<T>
): {
  where: Record<string, unknown>;
  orderBy: Record<string, string>[];
  skip?: number;
  take?: number;
  include?: Record<string, boolean>;
  select?: Record<string, boolean>;
} {
  const where: Record<string, unknown> = {};
  const orderBy: Record<string, string>[] = [];

  // Convert filters to Prisma where clause
  for (const filter of params.filters) {
    const field = String(filter.field);
    
    switch (filter.operator) {
      case 'eq':
        where[field] = filter.value;
        break;
      case 'neq':
        where[field] = { not: filter.value };
        break;
      case 'gt':
        where[field] = { gt: filter.value };
        break;
      case 'gte':
        where[field] = { gte: filter.value };
        break;
      case 'lt':
        where[field] = { lt: filter.value };
        break;
      case 'lte':
        where[field] = { lte: filter.value };
        break;
      case 'in':
        where[field] = { in: filter.value };
        break;
      case 'nin':
        where[field] = { notIn: filter.value };
        break;
      case 'contains':
        where[field] = { contains: filter.value, mode: 'insensitive' };
        break;
      case 'startsWith':
        where[field] = { startsWith: filter.value, mode: 'insensitive' };
        break;
      case 'endsWith':
        where[field] = { endsWith: filter.value, mode: 'insensitive' };
        break;
      case 'isNull':
        where[field] = null;
        break;
      case 'isNotNull':
        where[field] = { not: null };
        break;
    }
  }

  // Add search
  if (params.search) {
    where[String(params.search.field)] = {
      contains: params.search.query,
      mode: 'insensitive',
    };
  }

  // Convert sorts
  for (const sort of params.sorts) {
    orderBy.push({ [String(sort.field)]: sort.direction });
  }

  // Build result
  const result: ReturnType<typeof toPrismaQuery> = {
    where,
    orderBy,
  };

  // Add pagination
  if (params.pagination) {
    result.skip = (params.pagination.page - 1) * params.pagination.pageSize;
    result.take = params.pagination.pageSize;
  }

  // Add includes
  if (params.includes.length > 0) {
    result.include = {};
    for (const relation of params.includes) {
      result.include[relation] = true;
    }
  }

  // Add select
  if (params.select && params.select.length > 0) {
    result.select = {};
    for (const field of params.select) {
      result.select[String(field)] = true;
    }
  }

  return result;
}
