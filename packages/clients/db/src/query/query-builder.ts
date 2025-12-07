/**
 * Type-Safe Query Builder
 * 
 * Fluent API for building complex queries with:
 * - Full type safety
 * - SQL injection prevention
 * - Composable query parts
 * - Support for complex joins and subqueries
 */

import { Prisma } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export type ComparisonOperator = 
  | 'equals' 
  | 'not' 
  | 'in' 
  | 'notIn' 
  | 'lt' 
  | 'lte' 
  | 'gt' 
  | 'gte' 
  | 'contains' 
  | 'startsWith' 
  | 'endsWith'
  | 'isNull'
  | 'isNotNull';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export type SortDirection = 'asc' | 'desc';

export interface WhereCondition {
  field: string;
  operator: ComparisonOperator;
  value?: unknown;
  mode?: 'insensitive' | 'default';
}

export interface OrderByClause {
  field: string;
  direction: SortDirection;
  nulls?: 'first' | 'last';
}

export interface SelectField {
  field: string;
  alias?: string;
}

export interface IncludeRelation {
  relation: string;
  select?: string[];
  where?: Record<string, unknown>;
  orderBy?: OrderByClause;
  take?: number;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  cursor?: string;
  cursorField?: string;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// QUERY BUILDER IMPLEMENTATION
// ============================================================================

export class QueryBuilder<T = unknown> {
  private whereConditions: Array<{ operator: LogicalOperator; conditions: WhereCondition[] }> = [];
  private orderByClausees: OrderByClause[] = [];
  private selectFields: SelectField[] = [];
  private includeRelations: IncludeRelation[] = [];
  private pagination: PaginationOptions = {};
  private distinctFields: string[] = [];
  private groupByFields: string[] = [];
  private havingConditions: WhereCondition[] = [];

  // =========================================================================
  // WHERE CLAUSES
  // =========================================================================

  /**
   * Add a simple equality condition
   */
  where(field: string, value: unknown): this {
    this.whereConditions.push({
      operator: 'AND',
      conditions: [{ field, operator: 'equals', value }],
    });
    return this;
  }

  /**
   * Add a condition with explicit operator
   */
  whereOp(field: string, operator: ComparisonOperator, value?: unknown): this {
    this.whereConditions.push({
      operator: 'AND',
      conditions: [{ field, operator, value }],
    });
    return this;
  }

  /**
   * Add multiple AND conditions
   */
  whereAll(conditions: Array<{ field: string; operator?: ComparisonOperator; value?: unknown }>): this {
    this.whereConditions.push({
      operator: 'AND',
      conditions: conditions.map(c => ({
        field: c.field,
        operator: c.operator ?? 'equals',
        value: c.value,
      })),
    });
    return this;
  }

  /**
   * Add OR conditions
   */
  orWhere(field: string, value: unknown): this {
    this.whereConditions.push({
      operator: 'OR',
      conditions: [{ field, operator: 'equals', value }],
    });
    return this;
  }

  /**
   * Add multiple OR conditions
   */
  orWhereAny(conditions: Array<{ field: string; operator?: ComparisonOperator; value?: unknown }>): this {
    this.whereConditions.push({
      operator: 'OR',
      conditions: conditions.map(c => ({
        field: c.field,
        operator: c.operator ?? 'equals',
        value: c.value,
      })),
    });
    return this;
  }

  /**
   * Add NOT condition
   */
  whereNot(field: string, value: unknown): this {
    this.whereConditions.push({
      operator: 'NOT',
      conditions: [{ field, operator: 'equals', value }],
    });
    return this;
  }

  /**
   * Add IN condition
   */
  whereIn(field: string, values: unknown[]): this {
    return this.whereOp(field, 'in', values);
  }

  /**
   * Add NOT IN condition
   */
  whereNotIn(field: string, values: unknown[]): this {
    return this.whereOp(field, 'notIn', values);
  }

  /**
   * Add LIKE condition (contains)
   */
  whereLike(field: string, pattern: string, options?: { mode?: 'insensitive' }): this {
    this.whereConditions.push({
      operator: 'AND',
      conditions: [{
        field,
        operator: 'contains',
        value: pattern,
        mode: options?.mode,
      }],
    });
    return this;
  }

  /**
   * Add IS NULL condition
   */
  whereNull(field: string): this {
    return this.whereOp(field, 'isNull');
  }

  /**
   * Add IS NOT NULL condition
   */
  whereNotNull(field: string): this {
    return this.whereOp(field, 'isNotNull');
  }

  /**
   * Add date range condition
   */
  whereDateBetween(field: string, start: Date, end: Date): this {
    this.whereConditions.push({
      operator: 'AND',
      conditions: [
        { field, operator: 'gte', value: start },
        { field, operator: 'lte', value: end },
      ],
    });
    return this;
  }

  /**
   * Add numeric range condition
   */
  whereBetween(field: string, min: number, max: number): this {
    this.whereConditions.push({
      operator: 'AND',
      conditions: [
        { field, operator: 'gte', value: min },
        { field, operator: 'lte', value: max },
      ],
    });
    return this;
  }

  /**
   * Add text search condition
   */
  whereSearch(fields: string[], searchTerm: string): this {
    const conditions = fields.map(field => ({
      field,
      operator: 'contains' as ComparisonOperator,
      value: searchTerm,
      mode: 'insensitive' as const,
    }));

    this.whereConditions.push({
      operator: 'OR',
      conditions,
    });
    return this;
  }

  // =========================================================================
  // SELECT & INCLUDE
  // =========================================================================

  /**
   * Select specific fields
   */
  select(...fields: string[]): this {
    this.selectFields = fields.map(field => ({ field }));
    return this;
  }

  /**
   * Select with aliases
   */
  selectAs(selections: Array<{ field: string; alias: string }>): this {
    this.selectFields = selections;
    return this;
  }

  /**
   * Include a relation
   */
  include(relation: string, options?: Omit<IncludeRelation, 'relation'>): this {
    this.includeRelations.push({ relation, ...options });
    return this;
  }

  /**
   * Include multiple relations
   */
  includeMany(relations: string[]): this {
    relations.forEach(relation => this.includeRelations.push({ relation }));
    return this;
  }

  // =========================================================================
  // ORDER BY
  // =========================================================================

  /**
   * Add order by clause
   */
  orderBy(field: string, direction: SortDirection = 'asc'): this {
    this.orderByClausees.push({ field, direction });
    return this;
  }

  /**
   * Order by multiple fields
   */
  orderByMany(orders: Array<{ field: string; direction?: SortDirection }>): this {
    orders.forEach(order => {
      this.orderByClausees.push({
        field: order.field,
        direction: order.direction ?? 'asc',
      });
    });
    return this;
  }

  /**
   * Order nulls first/last
   */
  orderByNulls(field: string, direction: SortDirection, nulls: 'first' | 'last'): this {
    this.orderByClausees.push({ field, direction, nulls });
    return this;
  }

  // =========================================================================
  // PAGINATION
  // =========================================================================

  /**
   * Set page-based pagination
   */
  page(pageNumber: number, pageSize: number = 20): this {
    this.pagination = { page: pageNumber, pageSize };
    return this;
  }

  /**
   * Set cursor-based pagination
   */
  cursor(cursorValue: string, cursorField: string = 'id', pageSize: number = 20): this {
    this.pagination = { cursor: cursorValue, cursorField, pageSize };
    return this;
  }

  /**
   * Limit results
   */
  limit(count: number): this {
    this.pagination.pageSize = count;
    return this;
  }

  /**
   * Skip results
   */
  skip(count: number): this {
    this.pagination.page = Math.floor(count / (this.pagination.pageSize || 20)) + 1;
    return this;
  }

  // =========================================================================
  // GROUPING & DISTINCT
  // =========================================================================

  /**
   * Add DISTINCT clause
   */
  distinct(...fields: string[]): this {
    this.distinctFields = fields;
    return this;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(...fields: string[]): this {
    this.groupByFields = fields;
    return this;
  }

  /**
   * Add HAVING clause
   */
  having(field: string, operator: ComparisonOperator, value: unknown): this {
    this.havingConditions.push({ field, operator, value });
    return this;
  }

  // =========================================================================
  // BUILD METHODS
  // =========================================================================

  /**
   * Build Prisma-compatible query object
   */
  build(): {
    where: Record<string, unknown>;
    orderBy: Record<string, string>[];
    select?: Record<string, boolean>;
    include?: Record<string, unknown>;
    skip?: number;
    take?: number;
    cursor?: Record<string, string>;
    distinct?: string[];
  } {
    const query: any = {};

    // Build where clause
    if (this.whereConditions.length > 0) {
      query.where = this.buildWhereClause();
    }

    // Build order by
    if (this.orderByClausees.length > 0) {
      query.orderBy = this.orderByClausees.map(o => ({
        [o.field]: o.direction,
      }));
    }

    // Build select
    if (this.selectFields.length > 0) {
      query.select = this.selectFields.reduce((acc, field) => {
        acc[field.field] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Build include
    if (this.includeRelations.length > 0) {
      query.include = this.buildIncludeClause();
    }

    // Build pagination
    if (this.pagination.page || this.pagination.pageSize) {
      const page = this.pagination.page || 1;
      const pageSize = this.pagination.pageSize || 20;
      query.skip = (page - 1) * pageSize;
      query.take = pageSize;
    } else if (this.pagination.cursor) {
      query.cursor = { [this.pagination.cursorField || 'id']: this.pagination.cursor };
      query.skip = 1;
      query.take = this.pagination.pageSize || 20;
    }

    // Build distinct
    if (this.distinctFields.length > 0) {
      query.distinct = this.distinctFields;
    }

    return query;
  }

  /**
   * Build for findMany
   */
  buildFindMany(): Record<string, unknown> {
    return this.build();
  }

  /**
   * Build for count
   */
  buildCount(): { where: Record<string, unknown> } {
    return {
      where: this.buildWhereClause(),
    };
  }

  /**
   * Clone the query builder
   */
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>();
    cloned.whereConditions = [...this.whereConditions];
    cloned.orderByClausees = [...this.orderByClausees];
    cloned.selectFields = [...this.selectFields];
    cloned.includeRelations = [...this.includeRelations];
    cloned.pagination = { ...this.pagination };
    cloned.distinctFields = [...this.distinctFields];
    cloned.groupByFields = [...this.groupByFields];
    cloned.havingConditions = [...this.havingConditions];
    return cloned;
  }

  /**
   * Reset the query builder
   */
  reset(): this {
    this.whereConditions = [];
    this.orderByClausees = [];
    this.selectFields = [];
    this.includeRelations = [];
    this.pagination = {};
    this.distinctFields = [];
    this.groupByFields = [];
    this.havingConditions = [];
    return this;
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private buildWhereClause(): Record<string, unknown> {
    if (this.whereConditions.length === 0) {
      return {};
    }

    const andConditions: any[] = [];
    const orConditions: any[] = [];
    const notConditions: any[] = [];

    for (const group of this.whereConditions) {
      const conditions = group.conditions.map(c => this.buildCondition(c));

      switch (group.operator) {
        case 'AND':
          andConditions.push(...conditions);
          break;
        case 'OR':
          orConditions.push(...conditions);
          break;
        case 'NOT':
          notConditions.push(...conditions);
          break;
      }
    }

    const where: any = {};

    if (andConditions.length > 0) {
      Object.assign(where, ...andConditions);
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    if (notConditions.length > 0) {
      where.NOT = notConditions;
    }

    return where;
  }

  private buildCondition(condition: WhereCondition): Record<string, unknown> {
    const { field, operator, value, mode } = condition;

    switch (operator) {
      case 'equals':
        return { [field]: value };
      case 'not':
        return { [field]: { not: value } };
      case 'in':
        return { [field]: { in: value } };
      case 'notIn':
        return { [field]: { notIn: value } };
      case 'lt':
        return { [field]: { lt: value } };
      case 'lte':
        return { [field]: { lte: value } };
      case 'gt':
        return { [field]: { gt: value } };
      case 'gte':
        return { [field]: { gte: value } };
      case 'contains':
        return { [field]: { contains: value, mode: mode ?? 'default' } };
      case 'startsWith':
        return { [field]: { startsWith: value, mode: mode ?? 'default' } };
      case 'endsWith':
        return { [field]: { endsWith: value, mode: mode ?? 'default' } };
      case 'isNull':
        return { [field]: null };
      case 'isNotNull':
        return { [field]: { not: null } };
      default:
        return { [field]: value };
    }
  }

  private buildIncludeClause(): Record<string, unknown> {
    const include: Record<string, unknown> = {};

    for (const rel of this.includeRelations) {
      const relConfig: any = {};

      if (rel.select && rel.select.length > 0) {
        relConfig.select = rel.select.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      if (rel.where) {
        relConfig.where = rel.where;
      }

      if (rel.orderBy) {
        relConfig.orderBy = { [rel.orderBy.field]: rel.orderBy.direction };
      }

      if (rel.take) {
        relConfig.take = rel.take;
      }

      include[rel.relation] = Object.keys(relConfig).length > 0 ? relConfig : true;
    }

    return include;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new query builder
 */
export function query<T = unknown>(): QueryBuilder<T> {
  return new QueryBuilder<T>();
}

/**
 * Create a query builder with initial where condition
 */
export function where<T = unknown>(field: string, value: unknown): QueryBuilder<T> {
  return new QueryBuilder<T>().where(field, value);
}

/**
 * Create a query builder for searching
 */
export function search<T = unknown>(fields: string[], term: string): QueryBuilder<T> {
  return new QueryBuilder<T>().whereSearch(fields, term);
}

// ============================================================================
// PREBUILT QUERIES
// ============================================================================

export const commonQueries = {
  /**
   * Active records query
   */
  active: <T = unknown>(statusField: string = 'status', activeValue: string = 'ACTIVE'): QueryBuilder<T> =>
    new QueryBuilder<T>().where(statusField, activeValue),

  /**
   * Not deleted (soft delete) query
   */
  notDeleted: <T = unknown>(deletedAtField: string = 'deletedAt'): QueryBuilder<T> =>
    new QueryBuilder<T>().whereNull(deletedAtField),

  /**
   * Tenant scoped query
   */
  forTenant: <T = unknown>(tenantId: string, tenantField: string = 'tenantId'): QueryBuilder<T> =>
    new QueryBuilder<T>().where(tenantField, tenantId),

  /**
   * Created in date range
   */
  createdBetween: <T = unknown>(start: Date, end: Date): QueryBuilder<T> =>
    new QueryBuilder<T>().whereDateBetween('createdAt', start, end),

  /**
   * Recent records
   */
  recent: <T = unknown>(days: number = 7): QueryBuilder<T> => {
    const start = new Date();
    start.setDate(start.getDate() - days);
    return new QueryBuilder<T>()
      .whereOp('createdAt', 'gte', start)
      .orderBy('createdAt', 'desc');
  },

  /**
   * By user query
   */
  byUser: <T = unknown>(userId: string, userField: string = 'userId'): QueryBuilder<T> =>
    new QueryBuilder<T>().where(userField, userId),
};

// All classes and functions exported inline
