import { PrismaClient } from '@prisma/client';

/**
 * Database connection pool configuration
 * Optimized for high-concurrency scenarios
 */

export interface DatabasePoolConfig {
  connectionLimit: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  maxUses: number;
  allowExitOnIdle: boolean;
}

/**
 * Get optimal pool configuration based on environment
 */
export function getPoolConfig(): DatabasePoolConfig {
  const env = process.env.NODE_ENV || 'development';
  const concurrentUsers = parseInt(process.env.MAX_CONCURRENT_USERS || '100');

  // Calculate pool size based on concurrent users
  // Rule of thumb: pool size = (concurrent users * 0.1) + 5
  const basePoolSize = Math.ceil(concurrentUsers * 0.1) + 5;

  const configs: Record<string, DatabasePoolConfig> = {
    development: {
      connectionLimit: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      maxUses: 1000,
      allowExitOnIdle: true,
    },
    test: {
      connectionLimit: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      maxUses: 500,
      allowExitOnIdle: true,
    },
    production: {
      connectionLimit: Math.max(basePoolSize, 20),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 60000,
      maxUses: 5000,
      allowExitOnIdle: false,
    },
  };

  return configs[env] || configs.development;
}

/**
 * Create Prisma client with optimized connection pool
 */
export function createPrismaClient(): PrismaClient {
  const poolConfig = getPoolConfig();

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Configure connection pool via DATABASE_URL parameters
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  databaseUrl.searchParams.set('connection_limit', poolConfig.connectionLimit.toString());
  databaseUrl.searchParams.set('pool_timeout', (poolConfig.connectionTimeoutMillis / 1000).toString());

  console.log(`✅ Database pool configured:`, {
    connectionLimit: poolConfig.connectionLimit,
    connectionTimeout: `${poolConfig.connectionTimeoutMillis}ms`,
    idleTimeout: `${poolConfig.idleTimeoutMillis}ms`,
    environment: process.env.NODE_ENV,
  });

  return prisma;
}

/**
 * Connection pool monitoring
 */
export class ConnectionPoolMonitor {
  private metrics = {
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalQueries: 0,
    slowQueries: 0,
    errors: 0,
  };

  recordQuery(durationMs: number): void {
    this.metrics.totalQueries++;
    if (durationMs > 1000) {
      this.metrics.slowQueries++;
    }
  }

  recordError(): void {
    this.metrics.errors++;
  }

  updateConnectionStats(active: number, idle: number, waiting: number): void {
    this.metrics.activeConnections = active;
    this.metrics.idleConnections = idle;
    this.metrics.waitingRequests = waiting;
  }

  getMetrics() {
    return {
      ...this.metrics,
      totalConnections: this.metrics.activeConnections + this.metrics.idleConnections,
      utilizationRate:
        this.metrics.activeConnections /
        (this.metrics.activeConnections + this.metrics.idleConnections || 1),
      slowQueryRate: this.metrics.slowQueries / (this.metrics.totalQueries || 1),
      errorRate: this.metrics.errors / (this.metrics.totalQueries || 1),
    };
  }

  reset(): void {
    this.metrics = {
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalQueries: 0,
      slowQueries: 0,
      errors: 0,
    };
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    
    // Pool is unhealthy if:
    // - Utilization > 90%
    // - Waiting requests > 10
    // - Error rate > 5%
    // - Slow query rate > 10%
    
    if (metrics.utilizationRate > 0.9) {
      console.warn('⚠️ High connection pool utilization:', metrics.utilizationRate);
      return false;
    }

    if (metrics.waitingRequests > 10) {
      console.warn('⚠️ High number of waiting requests:', metrics.waitingRequests);
      return false;
    }

    if (metrics.errorRate > 0.05) {
      console.warn('⚠️ High error rate:', metrics.errorRate);
      return false;
    }

    if (metrics.slowQueryRate > 0.1) {
      console.warn('⚠️ High slow query rate:', metrics.slowQueryRate);
      return false;
    }

    return true;
  }
}

// Singleton instances
let prismaInstance: PrismaClient | null = null;
export const poolMonitor = new ConnectionPoolMonitor();

/**
 * Get or create Prisma client singleton
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();

    // Add query logging middleware
    prismaInstance.$use(async (params, next) => {
      const start = Date.now();
      try {
        const result = await next(params);
        const duration = Date.now() - start;
        poolMonitor.recordQuery(duration);

        if (duration > 1000) {
          console.warn(`⚠️ Slow query detected (${duration}ms):`, params.model, params.action);
        }

        return result;
      } catch (error) {
        poolMonitor.recordError();
        throw error;
      }
    });
  }

  return prismaInstance;
}

/**
 * Close database connection pool
 */
export async function closePrismaClient(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    console.log('✅ Database connection pool closed');
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return poolMonitor.isHealthy();
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}
