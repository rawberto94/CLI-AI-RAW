/**
 * Database Optimization Strategy
 * Advanced PostgreSQL + pgvector performance tuning
 */

import { PrismaClient } from '@prisma/client';
import { Pool, PoolConfig } from 'pg';

// Connection pool configuration
const poolConfig: PoolConfig = {
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  
  // Connection pool settings
  min: 5,           // Minimum connections
  max: 50,          // Maximum connections  
  idleTimeoutMillis: 300000,  // 5 minutes
  
  // Performance optimizations
  connectionTimeoutMillis: 2000,
  query_timeout: 30000,
  statement_timeout: 45000,
  idle_in_transaction_session_timeout: 10000
};

export class DatabaseOptimizer {
  private pool: Pool;
  private prisma: PrismaClient;

  constructor() {
    this.pool = new Pool(poolConfig);
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }

  /**
   * Initialize optimized database settings
   */
  async initialize(): Promise<void> {
    await this.createIndexes();
    await this.optimizePostgreSQLSettings();
    await this.createMaterializedViews();
  }

  /**
   * Create optimized indexes for contract intelligence
   */
  private async createIndexes(): Promise<void> {
    const indexQueries = [
      // Document indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_tenant_status 
       ON documents(tenant_id, status) WHERE status = 'processed';`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_created_at_desc 
       ON documents(tenant_id, created_at DESC);`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_file_hash 
       ON documents(file_hash) WHERE file_hash IS NOT NULL;`,
       
      // Vector search indexes (pgvector)
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_vector_cosine 
       ON document_chunks USING ivfflat (embedding vector_cosine_ops) 
       WITH (lists = 100);`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_tenant_doc 
       ON document_chunks(tenant_id, document_id);`,
       
      // Analysis indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_document_tenant 
       ON analysis(document_id, tenant_id, analysis_type);`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analysis_created_at 
       ON analysis(tenant_id, created_at DESC);`,
       
      // Search optimization
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_search_text 
       ON documents USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));`,
       
      // Repository connector indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_repository_sync_status 
       ON repository_sync_operations(repository_id, status, created_at DESC);`,
       
      // Multi-tenant performance
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_email 
       ON users(tenant_id, email) WHERE active = true;`,
       
      // Queue optimization
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_jobs_status_priority 
       ON queue_jobs(status, priority DESC, created_at ASC) 
       WHERE status IN ('waiting', 'active');`
    ];

    for (const query of indexQueries) {
      try {
        await this.pool.query(query);
        console.log(`✅ Index created: ${query.split('idx_')[1]?.split(' ')[0]}`);
      } catch (error) {
        console.error(`❌ Index creation failed: ${error}`);
      }
    }
  }

  /**
   * Optimize PostgreSQL settings for performance
   */
  private async optimizePostgreSQLSettings(): Promise<void> {
    const optimizations = [
      // Memory settings
      `ALTER SYSTEM SET shared_buffers = '${this.calculateSharedBuffers()}';`,
      `ALTER SYSTEM SET effective_cache_size = '${this.calculateCacheSize()}';`,
      `ALTER SYSTEM SET work_mem = '32MB';`,
      `ALTER SYSTEM SET maintenance_work_mem = '256MB';`,
      
      // Checkpoint settings
      `ALTER SYSTEM SET checkpoint_completion_target = 0.9;`,
      `ALTER SYSTEM SET wal_buffers = '16MB';`,
      `ALTER SYSTEM SET max_wal_size = '2GB';`,
      `ALTER SYSTEM SET min_wal_size = '512MB';`,
      
      // Query planner
      `ALTER SYSTEM SET random_page_cost = 1.1;`,
      `ALTER SYSTEM SET effective_io_concurrency = 200;`,
      
      // Logging and monitoring
      `ALTER SYSTEM SET log_min_duration_statement = 1000;`,
      `ALTER SYSTEM SET log_checkpoints = on;`,
      `ALTER SYSTEM SET log_connections = on;`,
      `ALTER SYSTEM SET log_disconnections = on;`,
      
      // Connection settings
      `ALTER SYSTEM SET max_connections = 200;`,
      `ALTER SYSTEM SET idle_in_transaction_session_timeout = '10min';`,
      
      // pgvector optimizations
      `ALTER SYSTEM SET shared_preload_libraries = 'vector';`
    ];

    for (const query of optimizations) {
      try {
        await this.pool.query(query);
      } catch (error) {
        console.error(`Optimization failed: ${error}`);
      }
    }

    // Reload configuration
    await this.pool.query('SELECT pg_reload_conf();');
  }

  /**
   * Create materialized views for analytics
   */
  private async createMaterializedViews(): Promise<void> {
    const views = [
      // Document analytics
      `CREATE MATERIALIZED VIEW IF NOT EXISTS mv_document_analytics AS
       SELECT 
         tenant_id,
         date_trunc('day', created_at) as day,
         COUNT(*) as total_documents,
         COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_documents,
         AVG(CASE WHEN analysis IS NOT NULL THEN 
           CAST(analysis->>'risk_score' AS FLOAT) END) as avg_risk_score,
         COUNT(CASE WHEN analysis->>'compliance_status' = 'compliant' THEN 1 END) as compliant_documents
       FROM documents 
       WHERE created_at > NOW() - INTERVAL '90 days'
       GROUP BY tenant_id, date_trunc('day', created_at);`,
       
      // Search performance view
      `CREATE MATERIALIZED VIEW IF NOT EXISTS mv_search_performance AS
       SELECT 
         tenant_id,
         COUNT(*) as total_chunks,
         AVG(chunk_size) as avg_chunk_size,
         COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as embedded_chunks
       FROM document_chunks
       GROUP BY tenant_id;`,
       
      // Repository activity
      `CREATE MATERIALIZED VIEW IF NOT EXISTS mv_repository_activity AS
       SELECT 
         r.tenant_id,
         r.repository_id,
         r.repository_name,
         COUNT(s.id) as total_syncs,
         MAX(s.completed_at) as last_sync,
         SUM(s.processed_files) as total_files_processed
       FROM repositories r
       LEFT JOIN repository_sync_operations s ON r.id = s.repository_id
       GROUP BY r.tenant_id, r.repository_id, r.repository_name;`
    ];

    for (const view of views) {
      try {
        await this.pool.query(view);
        // Create refresh indexes
        const viewName = view.match(/mv_(\w+)/)?.[1];
        if (viewName) {
          await this.pool.query(
            `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_${viewName}_refresh 
             ON mv_${viewName}(tenant_id);`
          );
        }
      } catch (error) {
        console.error(`View creation failed: ${error}`);
      }
    }
  }

  /**
   * Vector search optimization for contract analysis
   */
  async optimizeVectorSearch(tenantId: string, query: string, limit: number = 10): Promise<any[]> {
    // Use prepared statement for better performance
    const results = await this.pool.query(`
      SELECT 
        dc.document_id,
        dc.content,
        dc.metadata,
        (dc.embedding <=> $1::vector) as distance,
        d.title,
        d.file_path
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.tenant_id = $2
        AND d.status = 'processed'
        AND (dc.embedding <=> $1::vector) < 0.8
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $3;
    `, [query, tenantId, limit]);

    return results.rows;
  }

  /**
   * Bulk operations for better performance
   */
  async bulkInsertChunks(chunks: any[]): Promise<void> {
    const batchSize = 1000;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      const values = batch.map((chunk, index) => {
        const baseIndex = i * 8; // 8 parameters per chunk
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
      }).join(', ');

      const params = batch.flatMap(chunk => [
        chunk.id, chunk.documentId, chunk.tenantId, chunk.chunkIndex,
        chunk.content, chunk.metadata, chunk.embedding, chunk.createdAt
      ]);

      await this.pool.query(`
        INSERT INTO document_chunks 
        (id, document_id, tenant_id, chunk_index, content, metadata, embedding, created_at)
        VALUES ${values}
        ON CONFLICT (id) DO NOTHING;
      `, params);
    }
  }

  /**
   * Database maintenance and optimization
   */
  async performMaintenance(): Promise<void> {
    // Refresh materialized views
    await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_document_analytics;');
    await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_performance;');
    await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_repository_activity;');

    // Update table statistics
    await this.pool.query('ANALYZE documents;');
    await this.pool.query('ANALYZE document_chunks;');
    await this.pool.query('ANALYZE analysis;');

    // Vacuum for performance
    await this.pool.query('VACUUM (ANALYZE) document_chunks;');
  }

  /**
   * Calculate optimal shared_buffers based on available memory
   */
  private calculateSharedBuffers(): string {
    const totalMemoryGB = parseFloat(process.env.TOTAL_MEMORY_GB || '4');
    const sharedBuffersGB = Math.min(totalMemoryGB * 0.25, 8); // 25% of RAM, max 8GB
    return `${sharedBuffersGB}GB`;
  }

  /**
   * Calculate effective_cache_size
   */
  private calculateCacheSize(): string {
    const totalMemoryGB = parseFloat(process.env.TOTAL_MEMORY_GB || '4');
    const cacheSize = totalMemoryGB * 0.75; // 75% of total RAM
    return `${cacheSize}GB`;
  }

  /**
   * Monitor query performance
   */
  async getSlowQueries(limit: number = 10): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT 
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        stddev_exec_time,
        rows
      FROM pg_stat_statements 
      ORDER BY mean_exec_time DESC 
      LIMIT $1;
    `, [limit]);

    return result.rows;
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    const [indexUsage, tableStats, connectionStats] = await Promise.all([
      this.pool.query(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public' 
        ORDER BY n_distinct DESC;
      `),
      this.pool.query(`
        SELECT 
          relname,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_live_tup,
          n_dead_tup
        FROM pg_stat_user_tables;
      `),
      this.pool.query(`
        SELECT 
          state,
          COUNT(*) as count
        FROM pg_stat_activity 
        GROUP BY state;
      `)
    ]);

    return {
      indexUsage: indexUsage.rows,
      tableStats: tableStats.rows,
      connectionStats: connectionStats.rows
    };
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
  }
}

export const databaseOptimizer = new DatabaseOptimizer();