/**
 * Database Performance Service
 * Optimizes database operations for high-throughput artifact storage and retrieval
 */

import pino from 'pino';

const logger = pino({ name: 'database-performance' });

export interface QueryPerformanceMetrics {
  queryType: string;
  executionTime: number;
  rowsAffected: number;
  indexesUsed: string[];
  cacheHit: boolean;
  timestamp: Date;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  averageWaitTime: number;
  connectionErrors: number;
}

export interface DatabaseOptimizationConfig {
  connectionPool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
  };
  queryOptimization: {
    enableQueryCache: boolean;
    cacheSize: number;
    cacheTTL: number;
    enablePreparedStatements: boolean;
  };
  indexOptimization: {
    enableAutoIndexing: boolean;
    analyzeThreshold: number;
    maintenanceWindow: string;
  };
  performance: {
    slowQueryThreshold: number;
    enableQueryLogging: boolean;
    enableMetrics: boolean;
  };
}

export class DatabasePerformanceService {
  private queryMetrics: QueryPerformanceMetrics[] = [];
  private connectionStats: ConnectionPoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    averageWaitTime: 0,
    connectionErrors: 0
  };
  private queryCache = new Map<string, { result: any; timestamp: Date; ttl: number }>();
  private config: DatabaseOptimizationConfig;

  constructor(config: Partial<DatabaseOptimizationConfig> = {}) {
    this.config = {
      connectionPool: {
        min: 2,
        max: 20,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000,
        reapIntervalMillis: 1000,
        ...config.connectionPool
      },
      queryOptimization: {
        enableQueryCache: true,
        cacheSize: 1000,
        cacheTTL: 300000, // 5 minutes
        enablePreparedStatements: true,
        ...config.queryOptimization
      },
      indexOptimization: {
        enableAutoIndexing: true,
        analyzeThreshold: 1000,
        maintenanceWindow: '02:00-04:00',
        ...config.indexOptimization
      },
      performance: {
        slowQueryThreshold: 1000, // 1 second
        enableQueryLogging: true,
        enableMetrics: true,
        ...config.performance
      }
    };

    // Start periodic maintenance
    this.startPeriodicMaintenance();
  }

  /**
   * Execute optimized query with performance tracking
   */
  async executeOptimizedQuery<T>(
    queryType: string,
    query: string,
    params: any[] = [],
    options: { useCache?: boolean; timeout?: number; priority?: 'high' | 'normal' | 'low' } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, params);
    
    try {
      // Check cache first if enabled
      if (options.useCache !== false && this.config.queryOptimization.enableQueryCache) {
        const cached = this.getCachedResult<T>(cacheKey);
        if (cached) {
          this.recordQueryMetrics(queryType, Date.now() - startTime, 0, [], true);
          return cached;
        }
      }

      // Apply query optimization hints
      const optimizedQuery = this.optimizeQuery(query, queryType);
      
      // Execute query with connection pooling and timeout
      const result = await this.executeWithConnectionPool(optimizedQuery, params, options);
      
      // Cache result if applicable
      if (options.useCache !== false && this.config.queryOptimization.enableQueryCache) {
        this.setCachedResult(cacheKey, result, this.config.queryOptimization.cacheTTL);
      }

      // Record metrics
      const executionTime = Date.now() - startTime;
      const indexesUsed = this.extractIndexesUsed(result);
      this.recordQueryMetrics(queryType, executionTime, this.getRowsAffected(result), indexesUsed, false);

      // Log slow queries with optimization suggestions
      if (executionTime > this.config.performance.slowQueryThreshold) {
        const suggestions = this.generateOptimizationSuggestions(query, executionTime, indexesUsed);
        logger.warn({
          queryType,
          executionTime,
          query: query.substring(0, 200),
          params: params.slice(0, 5),
          suggestions
        }, 'Slow query detected with optimization suggestions');
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error({
        error,
        queryType,
        executionTime,
        query: query.substring(0, 200)
      }, 'Query execution failed');
      throw error;
    }
  }

  /**
   * Batch insert with optimization
   */
  async batchInsert(
    table: string,
    records: any[],
    options: { batchSize?: number; onConflict?: 'ignore' | 'update' } = {}
  ): Promise<{ inserted: number; updated: number; errors: number }> {
    const batchSize = options.batchSize || 1000;
    const results = { inserted: 0, updated: 0, errors: 0 };

    logger.info({
      table,
      totalRecords: records.length,
      batchSize
    }, 'Starting batch insert operation');

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const query = this.buildBatchInsertQuery(table, batch, options.onConflict);
        const result = await this.executeOptimizedQuery(
          'batch_insert',
          query,
          this.flattenBatchParams(batch),
          { useCache: false }
        );

        results.inserted += this.getInsertedCount(result);
        results.updated += this.getUpdatedCount(result);

        logger.debug({
          table,
          batchNumber: Math.floor(i / batchSize) + 1,
          recordsProcessed: batch.length
        }, 'Batch insert completed');

      } catch (error) {
        results.errors += batch.length;
        logger.error({
          error,
          table,
          batchNumber: Math.floor(i / batchSize) + 1,
          recordsInBatch: batch.length
        }, 'Batch insert failed');
      }
    }

    logger.info({
      table,
      results
    }, 'Batch insert operation completed');

    return results;
  }

  /**
   * Create optimized indexes for artifact storage
   */
  async createOptimizedIndexes(): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
    const results = { created: [], skipped: [], errors: [] };
    
    const indexDefinitions = [
      {
        name: 'idx_contracts_tenant_status',
        table: 'contracts',
        columns: ['tenant_id', 'status'],
        type: 'btree'
      },
      {
        name: 'idx_contracts_created_at',
        table: 'contracts',
        columns: ['created_at'],
        type: 'btree'
      },
      {
        name: 'idx_artifacts_contract_type',
        table: 'artifacts',
        columns: ['contract_id', 'type'],
        type: 'btree'
      },
      {
        name: 'idx_artifacts_tenant_created',
        table: 'artifacts',
        columns: ['tenant_id', 'created_at'],
        type: 'btree'
      },
      {
        name: 'idx_artifacts_search_content',
        table: 'artifacts',
        columns: ['searchable_content'],
        type: 'gin'
      },
      {
        name: 'idx_contract_relationships_source',
        table: 'contract_relationships',
        columns: ['source_contract_id'],
        type: 'btree'
      },
      {
        name: 'idx_contract_relationships_target',
        table: 'contract_relationships',
        columns: ['target_contract_id'],
        type: 'btree'
      },
      {
        name: 'idx_contract_patterns_tenant_type',
        table: 'contract_patterns',
        columns: ['tenant_id', 'pattern_type'],
        type: 'btree'
      }
    ];

    for (const indexDef of indexDefinitions) {
      try {
        const exists = await this.checkIndexExists(indexDef.name);
        if (exists) {
          results.skipped.push(indexDef.name);
          continue;
        }

        const query = this.buildCreateIndexQuery(indexDef);
        await this.executeOptimizedQuery('create_index', query, [], { useCache: false });
        
        results.created.push(indexDef.name);
        logger.info({ indexName: indexDef.name, table: indexDef.table }, 'Index created successfully');

      } catch (error) {
        results.errors.push(indexDef.name);
        logger.error({
          error,
          indexName: indexDef.name,
          table: indexDef.table
        }, 'Failed to create index');
      }
    }

    return results;
  }

  /**
   * Advanced batch processing with transaction management
   */
  async batchProcessWithTransaction(
    operations: Array<{
      type: 'insert' | 'update' | 'delete';
      table: string;
      data: any;
      where?: any;
    }>,
    options: { 
      batchSize?: number; 
      maxRetries?: number;
      rollbackOnError?: boolean;
    } = {}
  ): Promise<{ 
    successful: number; 
    failed: number; 
    errors: Array<{ operation: any; error: string }> 
  }> {
    const batchSize = options.batchSize || 500;
    const maxRetries = options.maxRetries || 3;
    const rollbackOnError = options.rollbackOnError ?? true;
    
    const results = { successful: 0, failed: 0, errors: [] as Array<{ operation: any; error: string }> };
    
    // Process operations in batches
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      let retries = 0;
      
      while (retries <= maxRetries) {
        try {
          await this.executeTransactionBatch(batch, rollbackOnError);
          results.successful += batch.length;
          break;
        } catch (error) {
          retries++;
          if (retries > maxRetries) {
            results.failed += batch.length;
            results.errors.push({
              operation: { batchIndex: Math.floor(i / batchSize), operations: batch.length },
              error: error instanceof Error ? error.message : String(error)
            });
          } else {
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          }
        }
      }
    }
    
    logger.info({
      totalOperations: operations.length,
      successful: results.successful,
      failed: results.failed,
      errorCount: results.errors.length
    }, 'Batch processing completed');
    
    return results;
  }

  /**
   * Execute a batch of operations in a transaction
   */
  private async executeTransactionBatch(
    operations: Array<{
      type: 'insert' | 'update' | 'delete';
      table: string;
      data: any;
      where?: any;
    }>,
    rollbackOnError: boolean
  ): Promise<void> {
    const { connectionPoolService } = await import('./connection-pool.service');
    
    return connectionPoolService.withConnection(async (connection) => {
      try {
        // Begin transaction
        await connection.client.query('BEGIN');
        
        for (const operation of operations) {
          const query = this.buildOperationQuery(operation);
          const params = this.extractOperationParams(operation);
          await connection.client.query(query, params);
        }
        
        // Commit transaction
        await connection.client.query('COMMIT');
        
      } catch (error) {
        if (rollbackOnError) {
          try {
            await connection.client.query('ROLLBACK');
          } catch (rollbackError) {
            logger.error({ rollbackError }, 'Failed to rollback transaction');
          }
        }
        throw error;
      }
    });
  }

  /**
   * Build SQL query for operation
   */
  private buildOperationQuery(operation: {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: any;
    where?: any;
  }): string {
    switch (operation.type) {
      case 'insert':
        const columns = Object.keys(operation.data);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        return `INSERT INTO ${operation.table} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      case 'update':
        const updateColumns = Object.keys(operation.data);
        const setClauses = updateColumns.map((col, index) => `${col} = $${index + 1}`).join(', ');
        const whereColumns = Object.keys(operation.where || {});
        const whereClauses = whereColumns.map((col, index) => 
          `${col} = $${updateColumns.length + index + 1}`
        ).join(' AND ');
        return `UPDATE ${operation.table} SET ${setClauses} WHERE ${whereClauses}`;
      
      case 'delete':
        const deleteWhereColumns = Object.keys(operation.where || {});
        const deleteWhereClauses = deleteWhereColumns.map((col, index) => 
          `${col} = $${index + 1}`
        ).join(' AND ');
        return `DELETE FROM ${operation.table} WHERE ${deleteWhereClauses}`;
      
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  /**
   * Extract parameters for operation
   */
  private extractOperationParams(operation: {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: any;
    where?: any;
  }): any[] {
    switch (operation.type) {
      case 'insert':
        return Object.values(operation.data);
      
      case 'update':
        return [...Object.values(operation.data), ...Object.values(operation.where || {})];
      
      case 'delete':
        return Object.values(operation.where || {});
      
      default:
        return [];
    }
  }

  /**
   * Create materialized views for analytics
   */
  async createMaterializedViews(): Promise<{ created: string[]; refreshed: string[]; errors: string[] }> {
    const results = { created: [], refreshed: [], errors: [] };

    const viewDefinitions = [
      {
        name: 'mv_contract_analytics',
        query: `
          SELECT 
            tenant_id,
            DATE_TRUNC('day', created_at) as date,
            COUNT(*) as contract_count,
            AVG(CASE WHEN total_value IS NOT NULL THEN total_value ELSE 0 END) as avg_value,
            SUM(CASE WHEN total_value IS NOT NULL THEN total_value ELSE 0 END) as total_value,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_contracts
          FROM contracts 
          WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY tenant_id, DATE_TRUNC('day', created_at)
        `
      },
      {
        name: 'mv_artifact_performance',
        query: `
          SELECT 
            tenant_id,
            type as artifact_type,
            DATE_TRUNC('hour', created_at) as hour,
            COUNT(*) as artifact_count,
            AVG(confidence_score) as avg_confidence,
            AVG(processing_time_ms) as avg_processing_time
          FROM artifacts 
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY tenant_id, type, DATE_TRUNC('hour', created_at)
        `
      },
      {
        name: 'mv_relationship_insights',
        query: `
          SELECT 
            tenant_id,
            relationship_type,
            COUNT(*) as relationship_count,
            AVG(strength) as avg_strength,
            COUNT(DISTINCT source_contract_id) as unique_sources,
            COUNT(DISTINCT target_contract_id) as unique_targets
          FROM contract_relationships cr
          JOIN contracts c ON cr.source_contract_id = c.id
          WHERE cr.created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY tenant_id, relationship_type
        `
      }
    ];

    for (const viewDef of viewDefinitions) {
      try {
        const exists = await this.checkMaterializedViewExists(viewDef.name);
        
        if (exists) {
          // Refresh existing view
          await this.executeOptimizedQuery(
            'refresh_materialized_view',
            `REFRESH MATERIALIZED VIEW ${viewDef.name}`,
            [],
            { useCache: false }
          );
          results.refreshed.push(viewDef.name);
          logger.info({ viewName: viewDef.name }, 'Materialized view refreshed');
        } else {
          // Create new view
          const createQuery = `CREATE MATERIALIZED VIEW ${viewDef.name} AS ${viewDef.query}`;
          await this.executeOptimizedQuery('create_materialized_view', createQuery, [], { useCache: false });
          results.created.push(viewDef.name);
          logger.info({ viewName: viewDef.name }, 'Materialized view created');
        }

      } catch (error) {
        results.errors.push(viewDef.name);
        logger.error({
          error,
          viewName: viewDef.name
        }, 'Failed to create/refresh materialized view');
      }
    }

    return results;
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  analyzeQueryPerformance(): {
    slowQueries: QueryPerformanceMetrics[];
    recommendations: string[];
    cacheEfficiency: number;
  } {
    const recentMetrics = this.queryMetrics.filter(
      m => Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );

    const slowQueries = recentMetrics.filter(
      m => m.executionTime > this.config.performance.slowQueryThreshold
    );

    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheEfficiency = recentMetrics.length > 0 ? (cacheHits / recentMetrics.length) * 100 : 0;

    const recommendations: string[] = [];

    // Analyze slow queries
    if (slowQueries.length > 0) {
      const slowQueryTypes = [...new Set(slowQueries.map(q => q.queryType))];
      recommendations.push(`Consider optimizing these query types: ${slowQueryTypes.join(', ')}`);
    }

    // Analyze cache efficiency
    if (cacheEfficiency < 50) {
      recommendations.push('Cache hit rate is low. Consider increasing cache size or TTL.');
    }

    // Analyze connection pool
    if (this.connectionStats.waitingRequests > 0) {
      recommendations.push('Connection pool may be undersized. Consider increasing max connections.');
    }

    return {
      slowQueries: slowQueries.slice(0, 10), // Top 10 slow queries
      recommendations,
      cacheEfficiency
    };
  }

  /**
   * Advanced query analysis and optimization recommendations
   */
  async analyzeQueryPatterns(): Promise<{
    patterns: Array<{
      queryType: string;
      frequency: number;
      averageTime: number;
      optimization: string[];
    }>;
    recommendations: string[];
    indexSuggestions: Array<{
      table: string;
      columns: string[];
      reason: string;
    }>;
  }> {
    const recentMetrics = this.queryMetrics.filter(
      m => Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );

    // Group metrics by query type
    const patternMap = new Map<string, QueryPerformanceMetrics[]>();
    recentMetrics.forEach(metric => {
      if (!patternMap.has(metric.queryType)) {
        patternMap.set(metric.queryType, []);
      }
      patternMap.get(metric.queryType)!.push(metric);
    });

    const patterns = Array.from(patternMap.entries()).map(([queryType, metrics]) => {
      const totalTime = metrics.reduce((sum, m) => sum + m.executionTime, 0);
      const averageTime = totalTime / metrics.length;
      
      const optimization: string[] = [];
      
      // Analyze patterns and suggest optimizations
      if (averageTime > 1000) {
        optimization.push('Consider adding indexes for frequently queried columns');
      }
      
      const cacheHitRate = metrics.filter(m => m.cacheHit).length / metrics.length;
      if (cacheHitRate < 0.3) {
        optimization.push('Increase cache TTL or cache size for better hit rate');
      }
      
      if (metrics.some(m => m.indexesUsed.length === 0)) {
        optimization.push('Queries not using indexes - review WHERE clauses');
      }

      return {
        queryType,
        frequency: metrics.length,
        averageTime,
        optimization
      };
    });

    // Generate index suggestions based on slow queries
    const indexSuggestions = this.generateIndexSuggestions(recentMetrics);

    // Generate general recommendations
    const recommendations = this.generatePerformanceRecommendations(patterns, recentMetrics);

    return {
      patterns: patterns.sort((a, b) => b.frequency - a.frequency),
      recommendations,
      indexSuggestions
    };
  }

  /**
   * Generate index suggestions based on query patterns
   */
  private generateIndexSuggestions(metrics: QueryPerformanceMetrics[]): Array<{
    table: string;
    columns: string[];
    reason: string;
  }> {
    const suggestions: Array<{ table: string; columns: string[]; reason: string }> = [];
    
    // Analyze slow queries for missing indexes
    const slowQueries = metrics.filter(m => m.executionTime > 1000 && m.indexesUsed.length === 0);
    
    if (slowQueries.some(q => q.queryType === 'artifact_search')) {
      suggestions.push({
        table: 'artifacts',
        columns: ['tenant_id', 'type', 'created_at'],
        reason: 'Frequent artifact searches without proper indexing'
      });
    }
    
    if (slowQueries.some(q => q.queryType === 'contract_list')) {
      suggestions.push({
        table: 'contracts',
        columns: ['tenant_id', 'status', 'created_at'],
        reason: 'Contract listing queries showing poor performance'
      });
    }
    
    if (slowQueries.some(q => q.queryType === 'relationship_analysis')) {
      suggestions.push({
        table: 'contract_relationships',
        columns: ['source_contract_id', 'relationship_type'],
        reason: 'Relationship analysis queries need better indexing'
      });
    }

    return suggestions;
  }

  /**
   * Generate performance recommendations
   */
  private generatePerformanceRecommendations(
    patterns: Array<{ queryType: string; frequency: number; averageTime: number }>,
    metrics: QueryPerformanceMetrics[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Check for high-frequency slow queries
    const problematicPatterns = patterns.filter(p => p.frequency > 10 && p.averageTime > 500);
    if (problematicPatterns.length > 0) {
      recommendations.push(
        `High-frequency slow queries detected: ${problematicPatterns.map(p => p.queryType).join(', ')}`
      );
    }
    
    // Check cache efficiency
    const totalQueries = metrics.length;
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;
    
    if (cacheHitRate < 40) {
      recommendations.push('Cache hit rate is low. Consider increasing cache size or TTL.');
    }
    
    // Check for queries without indexes
    const queriesWithoutIndexes = metrics.filter(m => m.indexesUsed.length === 0).length;
    const noIndexRate = totalQueries > 0 ? (queriesWithoutIndexes / totalQueries) * 100 : 0;
    
    if (noIndexRate > 20) {
      recommendations.push('Many queries are not using indexes. Review query patterns and add appropriate indexes.');
    }
    
    // Check for very slow queries
    const verySlowQueries = metrics.filter(m => m.executionTime > 5000).length;
    if (verySlowQueries > 0) {
      recommendations.push(`${verySlowQueries} queries taking over 5 seconds. Consider query optimization or data partitioning.`);
    }

    return recommendations;
  }

  /**
   * Create performance monitoring dashboard data
   */
  async getPerformanceDashboard(): Promise<{
    overview: {
      totalQueries: number;
      averageResponseTime: number;
      slowQueryCount: number;
      cacheHitRate: number;
      connectionPoolHealth: number;
    };
    trends: {
      queryVolume: Array<{ timestamp: Date; count: number }>;
      responseTime: Array<{ timestamp: Date; avgTime: number }>;
      cachePerformance: Array<{ timestamp: Date; hitRate: number }>;
    };
    topSlowQueries: Array<{
      queryType: string;
      count: number;
      avgTime: number;
      maxTime: number;
    }>;
    resourceUtilization: {
      connectionPool: ConnectionPoolStats;
      cacheUtilization: number;
      indexEfficiency: number;
    };
  }> {
    const recentMetrics = this.queryMetrics.filter(
      m => Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );

    // Calculate overview metrics
    const totalQueries = recentMetrics.length;
    const averageResponseTime = totalQueries > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries 
      : 0;
    const slowQueryCount = recentMetrics.filter(m => m.executionTime > 1000).length;
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    // Get connection pool health
    const { connectionPoolService } = await import('./connection-pool.service');
    const poolHealth = await connectionPoolService.healthCheck();
    const connectionPoolHealth = poolHealth.healthy ? 100 : 50;

    // Generate trends (simplified - in production would use time-series data)
    const trends = this.generateTrendData(recentMetrics);

    // Top slow queries
    const queryTypeMap = new Map<string, { times: number[]; count: number }>();
    recentMetrics.forEach(metric => {
      if (!queryTypeMap.has(metric.queryType)) {
        queryTypeMap.set(metric.queryType, { times: [], count: 0 });
      }
      const entry = queryTypeMap.get(metric.queryType)!;
      entry.times.push(metric.executionTime);
      entry.count++;
    });

    const topSlowQueries = Array.from(queryTypeMap.entries())
      .map(([queryType, data]) => ({
        queryType,
        count: data.count,
        avgTime: data.times.reduce((sum, t) => sum + t, 0) / data.times.length,
        maxTime: Math.max(...data.times)
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    // Resource utilization
    const connectionPoolStats = connectionPoolService.getStats();
    const cacheUtilization = (this.queryCache.size / this.config.queryOptimization.cacheSize) * 100;
    const indexEfficiency = recentMetrics.filter(m => m.indexesUsed.length > 0).length / totalQueries * 100;

    return {
      overview: {
        totalQueries,
        averageResponseTime,
        slowQueryCount,
        cacheHitRate,
        connectionPoolHealth
      },
      trends,
      topSlowQueries,
      resourceUtilization: {
        connectionPool: connectionPoolStats,
        cacheUtilization,
        indexEfficiency
      }
    };
  }

  /**
   * Generate trend data for dashboard
   */
  private generateTrendData(metrics: QueryPerformanceMetrics[]): {
    queryVolume: Array<{ timestamp: Date; count: number }>;
    responseTime: Array<{ timestamp: Date; avgTime: number }>;
    cachePerformance: Array<{ timestamp: Date; hitRate: number }>;
  } {
    // Group metrics by 5-minute intervals
    const intervalMs = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const intervals = new Map<number, QueryPerformanceMetrics[]>();

    metrics.forEach(metric => {
      const intervalStart = Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs;
      if (!intervals.has(intervalStart)) {
        intervals.set(intervalStart, []);
      }
      intervals.get(intervalStart)!.push(metric);
    });

    const queryVolume: Array<{ timestamp: Date; count: number }> = [];
    const responseTime: Array<{ timestamp: Date; avgTime: number }> = [];
    const cachePerformance: Array<{ timestamp: Date; hitRate: number }> = [];

    // Generate data for last 12 intervals (1 hour)
    for (let i = 11; i >= 0; i--) {
      const intervalStart = now - (i * intervalMs);
      const intervalMetrics = intervals.get(Math.floor(intervalStart / intervalMs) * intervalMs) || [];
      
      queryVolume.push({
        timestamp: new Date(intervalStart),
        count: intervalMetrics.length
      });

      const avgTime = intervalMetrics.length > 0
        ? intervalMetrics.reduce((sum, m) => sum + m.executionTime, 0) / intervalMetrics.length
        : 0;
      responseTime.push({
        timestamp: new Date(intervalStart),
        avgTime
      });

      const cacheHits = intervalMetrics.filter(m => m.cacheHit).length;
      const hitRate = intervalMetrics.length > 0 ? (cacheHits / intervalMetrics.length) * 100 : 0;
      cachePerformance.push({
        timestamp: new Date(intervalStart),
        hitRate
      });
    }

    return { queryVolume, responseTime, cachePerformance };
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): {
    queryMetrics: {
      totalQueries: number;
      averageExecutionTime: number;
      slowQueryCount: number;
      cacheHitRate: number;
    };
    connectionPool: ConnectionPoolStats;
    cacheStats: {
      size: number;
      hitRate: number;
      evictions: number;
    };
  } {
    const recentMetrics = this.queryMetrics.filter(
      m => Date.now() - m.timestamp.getTime() < 3600000
    );

    const totalQueries = recentMetrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries 
      : 0;
    const slowQueryCount = recentMetrics.filter(
      m => m.executionTime > this.config.performance.slowQueryThreshold
    ).length;
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    return {
      queryMetrics: {
        totalQueries,
        averageExecutionTime,
        slowQueryCount,
        cacheHitRate
      },
      connectionPool: { ...this.connectionStats },
      cacheStats: {
        size: this.queryCache.size,
        hitRate: cacheHitRate,
        evictions: 0 // Would track this in a real implementation
      }
    };
  }

  // Private helper methods
  private generateCacheKey(query: string, params: any[]): string {
    return `${query}:${JSON.stringify(params)}`;
  }

  private getCachedResult<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCachedResult(key: string, result: any, ttl: number): void {
    if (this.queryCache.size >= this.config.queryOptimization.cacheSize) {
      // Simple LRU eviction - remove oldest entry
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, {
      result,
      timestamp: new Date(),
      ttl
    });
  }

  /**
   * Execute query with connection pool and advanced optimizations
   */
  private async executeWithConnectionPool(
    query: string, 
    params: any[], 
    options: { timeout?: number; priority?: 'high' | 'normal' | 'low' } = {}
  ): Promise<any> {
    const { connectionPoolService } = await import('./connection-pool.service');
    
    return connectionPoolService.withConnection(async (connection) => {
      const timeout = options.timeout || 30000;
      const priority = options.priority || 'normal';
      
      // Apply priority-based query hints
      const prioritizedQuery = this.applyPriorityHints(query, priority);
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Query timeout after ${timeout}ms`));
        }, timeout);

        // Execute query with the connection's client
        connection.client.query(prioritizedQuery, params)
          .then((result: any) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error: any) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    });
  }

  /**
   * Optimize query based on type and patterns
   */
  private optimizeQuery(query: string, queryType: string): string {
    let optimizedQuery = query;

    // Add query hints based on type
    switch (queryType) {
      case 'artifact_search':
        // Use index hints for artifact searches
        optimizedQuery = query.replace(
          /FROM artifacts/gi,
          'FROM artifacts /*+ INDEX(artifacts idx_artifacts_tenant_type_created) */'
        );
        break;
      
      case 'contract_list':
        // Optimize contract listing queries
        optimizedQuery = query.replace(
          /FROM contracts/gi,
          'FROM contracts /*+ INDEX(contracts idx_contracts_tenant_status) */'
        );
        break;
      
      case 'relationship_analysis':
        // Optimize relationship queries
        optimizedQuery = query.replace(
          /FROM contract_relationships/gi,
          'FROM contract_relationships /*+ INDEX(contract_relationships idx_contract_relationships_source) */'
        );
        break;
    }

    // Add LIMIT if not present for potentially large result sets
    if (!optimizedQuery.toLowerCase().includes('limit') && 
        (queryType.includes('list') || queryType.includes('search'))) {
      optimizedQuery += ' LIMIT 1000';
    }

    return optimizedQuery;
  }

  /**
   * Apply priority-based query hints
   */
  private applyPriorityHints(query: string, priority: 'high' | 'normal' | 'low'): string {
    switch (priority) {
      case 'high':
        return `/*+ PRIORITY(HIGH) */ ${query}`;
      case 'low':
        return `/*+ PRIORITY(LOW) */ ${query}`;
      default:
        return query;
    }
  }

  /**
   * Extract indexes used from query result
   */
  private extractIndexesUsed(result: any): string[] {
    // In a real implementation, this would parse EXPLAIN output
    // For now, return mock indexes based on common patterns
    return ['idx_contracts_tenant_status', 'idx_artifacts_contract_type'];
  }

  /**
   * Generate optimization suggestions for slow queries
   */
  private generateOptimizationSuggestions(query: string, executionTime: number, indexesUsed: string[]): string[] {
    const suggestions: string[] = [];
    
    if (indexesUsed.length === 0) {
      suggestions.push('Consider adding indexes for WHERE clause columns');
    }
    
    if (query.toLowerCase().includes('order by') && !query.toLowerCase().includes('limit')) {
      suggestions.push('Add LIMIT clause to ORDER BY queries');
    }
    
    if (query.toLowerCase().includes('like %')) {
      suggestions.push('Consider using full-text search instead of LIKE with leading wildcard');
    }
    
    if (executionTime > 5000) {
      suggestions.push('Consider breaking down complex query into smaller parts');
    }
    
    if (query.toLowerCase().includes('select *')) {
      suggestions.push('Select only required columns instead of SELECT *');
    }
    
    return suggestions;
  }

  private recordQueryMetrics(
    queryType: string,
    executionTime: number,
    rowsAffected: number,
    indexesUsed: string[],
    cacheHit: boolean
  ): void {
    if (!this.config.performance.enableMetrics) return;

    const metric: QueryPerformanceMetrics = {
      queryType,
      executionTime,
      rowsAffected,
      indexesUsed,
      cacheHit,
      timestamp: new Date()
    };

    this.queryMetrics.push(metric);

    // Keep only recent metrics
    const cutoff = Date.now() - 3600000; // 1 hour
    this.queryMetrics = this.queryMetrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  private getRowsAffected(result: any): number {
    return result?.rowCount || result?.affectedRows || 0;
  }

  private buildBatchInsertQuery(table: string, records: any[], onConflict?: 'ignore' | 'update'): string {
    if (records.length === 0) return '';

    const columns = Object.keys(records[0]);
    const placeholders = records.map((_, index) => 
      `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');

    let query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;

    if (onConflict === 'ignore') {
      query += ' ON CONFLICT DO NOTHING';
    } else if (onConflict === 'update') {
      const updateClauses = columns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
      query += ` ON CONFLICT DO UPDATE SET ${updateClauses}`;
    }

    return query;
  }

  private flattenBatchParams(records: any[]): any[] {
    const params: any[] = [];
    records.forEach(record => {
      Object.values(record).forEach(value => params.push(value));
    });
    return params;
  }

  private getInsertedCount(result: any): number {
    return result?.rowCount || 0;
  }

  private getUpdatedCount(result: any): number {
    // This would depend on your database client's response format
    return 0;
  }

  private async checkIndexExists(indexName: string): Promise<boolean> {
    // Mock implementation - would check actual database
    return false;
  }

  private buildCreateIndexQuery(indexDef: any): string {
    const { name, table, columns, type } = indexDef;
    const columnList = columns.join(', ');
    
    if (type === 'gin') {
      return `CREATE INDEX ${name} ON ${table} USING gin(${columnList})`;
    } else {
      return `CREATE INDEX ${name} ON ${table} (${columnList})`;
    }
  }

  private async checkMaterializedViewExists(viewName: string): Promise<boolean> {
    // Mock implementation - would check actual database
    return false;
  }

  private startPeriodicMaintenance(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const cutoff = Date.now() - 3600000;
      this.queryMetrics = this.queryMetrics.filter(m => m.timestamp.getTime() > cutoff);
      
      // Clean up expired cache entries
      for (const [key, cached] of this.queryCache.entries()) {
        if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
          this.queryCache.delete(key);
        }
      }
    }, 3600000); // Every hour
  }
}

export const databasePerformanceService = new DatabasePerformanceService();