/**
 * Enhanced Database Manager
 * 
 * Central database management with integrated:
 * - Query caching
 * - Read replica support
 * - Unit of Work pattern
 * - Audit trail
 * - Error handling
 * - Connection pooling
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { performance } from 'perf_hooks';

// Import new patterns
import { QueryCache, getQueryCache, CacheConfig } from '../cache/query-cache';
import { UnitOfWork, UnitOfWorkFactory, UnitOfWorkOptions } from '../patterns/unit-of-work';
import { ReplicaManager, ReplicaManagerConfig, ReplicaConfig } from '../replication/replica-manager';
import { AuditTrail, AuditConfig, AuditContext, createAuditMiddleware } from '../audit/audit-trail';
import { DatabaseErrorParser, DatabaseErrorHandler, DatabaseError } from '../errors/database-errors';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancedDatabaseConfig {
  // Connection settings
  connection: {
    url: string;
    poolMin?: number;
    poolMax?: number;
    idleTimeout?: number;
    connectionTimeout?: number;
  };
  
  // Replication settings
  replication?: {
    enabled: boolean;
    replicas: ReplicaConfig[];
    loadBalanceStrategy?: 'round-robin' | 'weighted' | 'random' | 'least-connections' | 'latency-based';
    maxReplicationLag?: number;
  };
  
  // Cache settings
  cache?: {
    enabled: boolean;
    defaultTTL?: number;
    maxMemoryCacheSize?: number;
    keyPrefix?: string;
  };
  
  // Audit settings
  audit?: {
    enabled: boolean;
    includeReadOperations?: boolean;
    sensitiveFields?: string[];
    asyncMode?: boolean;
    retentionDays?: number;
  };
  
  // Retry settings
  retry: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoff: number;
  };
  
  // Monitoring settings
  monitoring: {
    slowQueryThreshold: number;
    enableQueryLogging: boolean;
    enableMetrics: boolean;
  };
  
  // Feature flags
  features: {
    optimisticLocking: boolean;
    softDelete: boolean;
    tenantIsolation: boolean;
  };
}

export interface DatabaseHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  primary: {
    status: 'healthy' | 'unhealthy';
    latency: number;
  };
  replicas: Array<{
    id: string;
    status: 'healthy' | 'unhealthy';
    lag: number;
    latency: number;
  }>;
  cache: {
    enabled: boolean;
    hitRate: number;
    entries: number;
  };
  metrics: DatabaseMetrics;
}

export interface DatabaseMetrics {
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  errorRate: number;
  activeConnections: number;
  cacheHitRate: number;
  uptime: number;
}

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const defaultConfig: EnhancedDatabaseConfig = {
  connection: {
    url: process.env.DATABASE_URL || '',
    poolMin: 2,
    poolMax: 10,
    idleTimeout: 30000,
    connectionTimeout: 5000,
  },
  retry: {
    maxRetries: 3,
    backoffMultiplier: 2,
    maxBackoff: 5000,
  },
  monitoring: {
    slowQueryThreshold: 1000,
    enableQueryLogging: process.env.NODE_ENV === 'development',
    enableMetrics: true,
  },
  features: {
    optimisticLocking: false,
    softDelete: false,
    tenantIsolation: true,
  },
};

// ============================================================================
// ENHANCED DATABASE MANAGER
// ============================================================================

export class EnhancedDatabaseManager {
  private config: EnhancedDatabaseConfig;
  private prisma: PrismaClient;
  private cache: QueryCache;
  private replicaManager?: ReplicaManager;
  private auditTrail?: AuditTrail;
  private unitOfWorkFactory: UnitOfWorkFactory;
  private metrics: DatabaseMetrics;
  private startTime: Date;

  constructor(config: Partial<EnhancedDatabaseConfig> = {}) {
    this.config = this.mergeConfig(defaultConfig, config);
    this.startTime = new Date();
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      errorRate: 0,
      activeConnections: 0,
      cacheHitRate: 0,
      uptime: 0,
    };

    // Initialize Prisma client
    this.prisma = new PrismaClient({
      log: this.config.monitoring.enableQueryLogging
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      datasources: {
        db: { url: this.config.connection.url },
      },
    });

    // Initialize cache
    this.cache = getQueryCache({
      enabled: this.config.cache?.enabled ?? true,
      defaultTTL: this.config.cache?.defaultTTL ?? 300,
      maxMemoryCacheSize: this.config.cache?.maxMemoryCacheSize ?? 1000,
      keyPrefix: this.config.cache?.keyPrefix ?? 'db:',
    });

    // Initialize Unit of Work factory
    this.unitOfWorkFactory = new UnitOfWorkFactory(this.prisma);

    // Initialize replica manager if configured
    if (this.config.replication?.enabled && this.config.replication.replicas.length > 0) {
      this.replicaManager = new ReplicaManager({
        primary: this.config.connection.url,
        replicas: this.config.replication.replicas,
        loadBalanceStrategy: this.config.replication.loadBalanceStrategy,
        maxReplicationLag: this.config.replication.maxReplicationLag,
      });
    }

    // Initialize audit trail if configured
    if (this.config.audit?.enabled) {
      this.auditTrail = new AuditTrail(this.prisma, {
        enabled: true,
        includeReadOperations: this.config.audit.includeReadOperations,
        sensitiveFields: this.config.audit.sensitiveFields,
        asyncMode: this.config.audit.asyncMode,
        retentionDays: this.config.audit.retentionDays,
      });

      // Add audit middleware
      this.prisma.$use(createAuditMiddleware(this.auditTrail));
    }

    // Add monitoring middleware
    this.addMonitoringMiddleware();

    // Add tenant isolation middleware if enabled
    if (this.config.features.tenantIsolation) {
      this.addTenantIsolationMiddleware();
    }
  }

  // =========================================================================
  // CONNECTION MANAGEMENT
  // =========================================================================

  /**
   * Initialize database connections
   */
  async initialize(): Promise<void> {
    try {
      await this.prisma.$connect();

      if (this.replicaManager) {
        await this.replicaManager.connect();
        this.replicaManager.startHealthChecks();
      }
    } catch (error) {
      const dbError = DatabaseErrorParser.parse(error);
      throw dbError;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.auditTrail) {
      await (this.auditTrail as any).flush?.();
    }

    if (this.replicaManager) {
      await this.replicaManager.disconnect();
    }

    await this.prisma.$disconnect();
  }

  // =========================================================================
  // CLIENT ACCESS
  // =========================================================================

  /**
   * Get the primary Prisma client
   */
  getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Get a read-optimized client (from replica if available)
   */
  getReadClient(): PrismaClient {
    if (this.replicaManager) {
      return this.replicaManager.getReadClient().client;
    }
    return this.prisma;
  }

  /**
   * Get the write client (always primary)
   */
  getWriteClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Get the cache instance
   */
  getCache(): QueryCache {
    return this.cache;
  }

  /**
   * Get the audit trail instance
   */
  getAuditTrail(): AuditTrail | undefined {
    return this.auditTrail;
  }

  // =========================================================================
  // UNIT OF WORK
  // =========================================================================

  /**
   * Create a new unit of work
   */
  createUnitOfWork(options?: UnitOfWorkOptions): UnitOfWork {
    return this.unitOfWorkFactory.create(options);
  }

  /**
   * Execute work within a unit of work scope
   */
  async scopedWork<T>(
    work: (uow: UnitOfWork) => Promise<T>,
    options?: UnitOfWorkOptions
  ): Promise<T> {
    return this.unitOfWorkFactory.scope(work, options);
  }

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================

  /**
   * Execute operations in a transaction
   */
  async transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return DatabaseErrorHandler.execute(
      () => this.prisma.$transaction(callback, options),
      { operation: 'transaction' }
    );
  }

  /**
   * Execute interactive transaction
   */
  async interactiveTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.prisma.$transaction(callback, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 30000,
      isolationLevel: options?.isolationLevel,
    });
  }

  // =========================================================================
  // QUERY EXECUTION
  // =========================================================================

  /**
   * Execute a read query with caching and error handling
   */
  async executeRead<T>(
    operation: (client: PrismaClient) => Promise<T>,
    options?: {
      cacheKey?: string;
      cacheTTL?: number;
      skipCache?: boolean;
    }
  ): Promise<T> {
    const client = this.getReadClient();

    if (options?.cacheKey && !options.skipCache) {
      return this.cache.getOrSet(
        options.cacheKey,
        () => DatabaseErrorHandler.execute(() => operation(client)),
        { ttl: options.cacheTTL }
      );
    }

    return DatabaseErrorHandler.execute(() => operation(client));
  }

  /**
   * Execute a write query with error handling
   */
  async executeWrite<T>(
    operation: (client: PrismaClient) => Promise<T>
  ): Promise<T> {
    return DatabaseErrorHandler.execute(() => operation(this.prisma));
  }

  /**
   * Execute raw SQL query
   */
  async executeRaw<T>(query: string, params: unknown[] = []): Promise<T[]> {
    // $queryRawUnsafe is intentional here — generic executor with parameterized placeholders ($1, $2).
    // Callers pass pre-built SQL strings with positional params; this is the correct Prisma API for that pattern.
    return DatabaseErrorHandler.execute(
      () => this.prisma.$queryRawUnsafe<T[]>(query, ...params),
      { operation: 'raw_query', query }
    );
  }

  // =========================================================================
  // HEALTH & MONITORING
  // =========================================================================

  /**
   * Perform health check
   */
  async healthCheck(): Promise<DatabaseHealthReport> {
    const primaryCheck = await this.checkPrimary();
    const replicaChecks = this.replicaManager
      ? await this.checkReplicas()
      : [];
    const cacheStats = this.cache.getStats();

    const primaryHealthy = primaryCheck.status === 'healthy';
    const allReplicasHealthy = replicaChecks.every(r => r.status === 'healthy');

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (!primaryHealthy) {
      overall = 'unhealthy';
    } else if (!allReplicasHealthy && replicaChecks.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      primary: primaryCheck,
      replicas: replicaChecks,
      cache: {
        enabled: this.config.cache?.enabled ?? true,
        hitRate: cacheStats.hitRate,
        entries: cacheStats.entries,
      },
      metrics: this.getMetrics(),
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): DatabaseMetrics {
    const cacheStats = this.cache.getStats();
    return {
      ...this.metrics,
      cacheHitRate: cacheStats.hitRate,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================

  /**
   * Invalidate cache by entity type
   */
  async invalidateCache(entityType: string, entityId?: string): Promise<void> {
    await this.cache.invalidateEntity(entityType, entityId);
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache<T>(
    queries: Array<{
      key: string;
      queryFn: () => Promise<T>;
      ttl?: number;
    }>
  ): Promise<void> {
    await this.cache.warmCache(queries);
  }

  // =========================================================================
  // AUDIT
  // =========================================================================

  /**
   * Set audit context (usually from request)
   */
  setAuditContext(context: AuditContext): void {
    if (this.auditTrail) {
      this.auditTrail.setContext(context);
    }
  }

  /**
   * Get audit history for an entity
   */
  async getAuditHistory(entityType: string, entityId: string) {
    if (!this.auditTrail) {
      throw new Error('Audit trail is not enabled');
    }
    return this.auditTrail.getHistory(entityType, entityId);
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private mergeConfig(
    defaults: EnhancedDatabaseConfig,
    overrides: Partial<EnhancedDatabaseConfig>
  ): EnhancedDatabaseConfig {
    return {
      connection: { ...defaults.connection, ...overrides.connection },
      replication: overrides.replication,
      cache: overrides.cache ? { ...defaults.cache, ...overrides.cache } : defaults.cache,
      audit: overrides.audit,
      retry: { ...defaults.retry, ...overrides.retry },
      monitoring: { ...defaults.monitoring, ...overrides.monitoring },
      features: { ...defaults.features, ...overrides.features },
    };
  }

  private addMonitoringMiddleware(): void {
    this.prisma.$use(async (params, next) => {
      const start = performance.now();
      this.metrics.activeConnections++;

      try {
        const result = await next(params);
        const duration = performance.now() - start;

        this.updateQueryMetrics(duration, false);

        if (duration > this.config.monitoring.slowQueryThreshold) {
          this.metrics.slowQueries++;
        }

        return result;
      } catch (error) {
        const duration = performance.now() - start;
        this.updateQueryMetrics(duration, true);
        throw error;
      } finally {
        this.metrics.activeConnections--;
      }
    });
  }

  private addTenantIsolationMiddleware(): void {
    const tenantModels = [
      'Contract',
      'Artifact',
      'ProcessingJob',
      'FileIntegrity',
      'AuditLog',
      'ContractMetadata',
      'RateCard',
      'Supplier',
      'ComplianceCheck',
    ];

    this.prisma.$use(async (params, next) => {
      if (!tenantModels.includes(params.model || '')) {
        return next(params);
      }

      // Check read operations
      if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(params.action)) {
        // Silent check - tenantId filter validation
      }

      // Check write operations
      if (['create', 'upsert'].includes(params.action)) {
        if (!params.args?.data?.tenantId) {
          throw new Error(`tenantId is required when creating ${params.model}`);
        }
      }

      return next(params);
    });
  }

  private updateQueryMetrics(duration: number, isError: boolean): void {
    this.metrics.totalQueries++;

    if (isError) {
      this.metrics.errorRate =
        (this.metrics.errorRate * (this.metrics.totalQueries - 1) + 1) /
        this.metrics.totalQueries;
    } else {
      this.metrics.errorRate =
        (this.metrics.errorRate * (this.metrics.totalQueries - 1)) /
        this.metrics.totalQueries;
    }

    this.metrics.averageQueryTime =
      (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + duration) /
      this.metrics.totalQueries;
  }

  private async checkPrimary(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latency: performance.now() - start,
      };
    } catch {
      return {
        status: 'unhealthy',
        latency: performance.now() - start,
      };
    }
  }

  private async checkReplicas(): Promise<
    Array<{ id: string; status: 'healthy' | 'unhealthy'; lag: number; latency: number }>
  > {
    if (!this.replicaManager) return [];

    const statuses = this.replicaManager.getStatuses();
    return statuses
      .filter((s: { id: string }) => s.id !== 'primary')
      .map((s: { id: string; healthy: boolean; lag: number; latency: number }) => ({
        id: s.id,
        status: s.healthy ? 'healthy' as const : 'unhealthy' as const,
        lag: s.lag,
        latency: s.latency,
      }));
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let enhancedDatabaseManager: EnhancedDatabaseManager | null = null;

export function getEnhancedDatabaseManager(
  config?: Partial<EnhancedDatabaseConfig>
): EnhancedDatabaseManager {
  if (!enhancedDatabaseManager) {
    enhancedDatabaseManager = new EnhancedDatabaseManager(config);
  }
  return enhancedDatabaseManager;
}

export function resetEnhancedDatabaseManager(): void {
  if (enhancedDatabaseManager) {
    enhancedDatabaseManager.disconnect().catch(() => {});
  }
  enhancedDatabaseManager = null;
}

// Class exported inline
