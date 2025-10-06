/**
 * Query Optimizer
 * Analyzes and optimizes database queries for better performance
 */

interface QueryPlan {
  sql: string;
  params: any[];
  estimatedCost: number;
  indexes: string[];
  suggestions: string[];
}

export class QueryOptimizer {
  private queryCache = new Map<string, any>();
  private queryStats = new Map<string, { count: number; avgTime: number }>();

  /**
   * Optimize a query by analyzing its structure and suggesting improvements
   */
  optimize(sql: string, params: any[]): QueryPlan {
    const plan: QueryPlan = {
      sql,
      params,
      estimatedCost: 0,
      indexes: [],
      suggestions: [],
    };

    // Analyze SELECT queries
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      this.optimizeSelect(sql, plan);
    }

    // Analyze JOIN queries
    if (sql.includes('JOIN')) {
      this.optimizeJoins(sql, plan);
    }

    // Analyze WHERE clauses
    if (sql.includes('WHERE')) {
      this.optimizeWhere(sql, plan);
    }

    return plan;
  }

  private optimizeSelect(sql: string, plan: QueryPlan): void {
    // Check for SELECT *
    if (sql.includes('SELECT *')) {
      plan.suggestions.push('Avoid SELECT *, specify only needed columns');
      plan.estimatedCost += 10;
    }

    // Check for DISTINCT
    if (sql.includes('DISTINCT')) {
      plan.suggestions.push('DISTINCT can be expensive, ensure it\'s necessary');
      plan.estimatedCost += 5;
    }

    // Check for subqueries
    if (sql.match(/SELECT.*\(SELECT/i)) {
      plan.suggestions.push('Consider using JOINs instead of subqueries');
      plan.estimatedCost += 15;
    }
  }

  private optimizeJoins(sql: string, plan: QueryPlan): void {
    const joinCount = (sql.match(/JOIN/gi) || []).length;
    
    if (joinCount > 3) {
      plan.suggestions.push(`${joinCount} JOINs detected, consider denormalization`);
      plan.estimatedCost += joinCount * 5;
    }

    // Check for missing indexes on join columns
    const joinPattern = /JOIN\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi;
    const matches = sql.matchAll(joinPattern);
    
    for (const match of matches) {
      const [, table, leftTable, leftCol, rightTable, rightCol] = match;
      plan.indexes.push(`${leftTable}.${leftCol}`, `${rightTable}.${rightCol}`);
    }
  }

  private optimizeWhere(sql: string, plan: QueryPlan): void {
    // Check for OR conditions
    if (sql.match(/WHERE.*OR/i)) {
      plan.suggestions.push('OR conditions can prevent index usage, consider UNION');
      plan.estimatedCost += 8;
    }

    // Check for LIKE with leading wildcard
    if (sql.match(/LIKE\s+'%/i)) {
      plan.suggestions.push('Leading wildcard in LIKE prevents index usage');
      plan.estimatedCost += 12;
    }

    // Check for functions on indexed columns
    if (sql.match(/WHERE\s+\w+\([^)]+\)\s*=/i)) {
      plan.suggestions.push('Functions on columns prevent index usage');
      plan.estimatedCost += 10;
    }
  }

  /**
   * Track query execution time for analysis
   */
  trackQuery(sql: string, executionTime: number): void {
    const stats = this.queryStats.get(sql) || { count: 0, avgTime: 0 };
    stats.count++;
    stats.avgTime = (stats.avgTime * (stats.count - 1) + executionTime) / stats.count;
    this.queryStats.set(sql, stats);
  }

  /**
   * Get slow queries for optimization
   */
  getSlowQueries(threshold: number = 100): Array<{ sql: string; stats: any }> {
    const slow: Array<{ sql: string; stats: any }> = [];
    
    for (const [sql, stats] of this.queryStats.entries()) {
      if (stats.avgTime > threshold) {
        slow.push({ sql, stats });
      }
    }

    return slow.sort((a, b) => b.stats.avgTime - a.stats.avgTime);
  }

  /**
   * Generate index recommendations
   */
  getIndexRecommendations(): string[] {
    const recommendations: string[] = [];
    const indexUsage = new Map<string, number>();

    for (const [sql] of this.queryStats.entries()) {
      const plan = this.optimize(sql, []);
      for (const index of plan.indexes) {
        indexUsage.set(index, (indexUsage.get(index) || 0) + 1);
      }
    }

    // Recommend indexes used frequently
    for (const [index, count] of indexUsage.entries()) {
      if (count > 5) {
        recommendations.push(`CREATE INDEX idx_${index.replace('.', '_')} ON ${index}`);
      }
    }

    return recommendations;
  }

  /**
   * Clear statistics
   */
  clearStats(): void {
    this.queryStats.clear();
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const totalQueries = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);
    
    const avgQueryTime = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.avgTime * stats.count, 0) / totalQueries;

    return {
      totalQueries,
      uniqueQueries: this.queryStats.size,
      avgQueryTime,
      slowQueries: this.getSlowQueries(),
      indexRecommendations: this.getIndexRecommendations(),
    };
  }
}

export const queryOptimizer = new QueryOptimizer();
