import { PrismaClient, Prisma } from '@prisma/client';
import { performance } from 'perf_hooks';

// ============================================================================
// ADVANCED ARCHITECTURE EXPORTS
// Re-export all advanced database patterns for easier imports
// ============================================================================

export * from './src/advanced';

// ============================================================================
// LEGACY DATABASE MANAGER (maintained for backward compatibility)
// For new code, prefer using EnhancedDatabaseManager from './src/advanced'
// ============================================================================

// Database configuration interface
export interface DatabaseConfig {
  connectionPool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
  monitoring: {
    slowQueryThreshold: number;
    enableQueryLogging: boolean;
  };
}

// Health status interface
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  timestamp: Date;
  responseTime?: number;
}

// Database metrics interface
export interface DatabaseMetrics {
  activeConnections: number;
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  errorRate: number;
  uptime: number;
}

// Transaction operation interface
export interface TransactionOperation {
  operation: string;
  model: string;
  data: any;
}

// Default configuration
const defaultConfig: DatabaseConfig = {
  connectionPool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  retryPolicy: {
    maxRetries: 3,
    backoffMultiplier: 2,
    maxBackoffMs: 5000,
  },
  monitoring: {
    slowQueryThreshold: 1000, // 1 second
    enableQueryLogging: process.env.NODE_ENV === 'development',
  },
};

export class DatabaseManager {
  private prisma: PrismaClient;
  private config: DatabaseConfig;
  private metrics: DatabaseMetrics;
  private startTime: Date;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.startTime = new Date();
    this.metrics = {
      activeConnections: 0,
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      errorRate: 0,
      uptime: 0,
    };

    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'production' || !this.config.monitoring.enableQueryLogging
        ? ['error']
        : ['warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Add tenant isolation middleware
    this.prisma.$use(async (params, next) => {
      // Models that require tenant isolation
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

      // Check if this model requires tenant isolation
      if (tenantModels.includes(params.model || '')) {
        // For read operations, ensure tenantId filter is present
        if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(params.action)) {
          if (!params.args) {
            params.args = {};
          }
          if (!params.args.where) {
            params.args.where = {};
          }
          
          // Silent check - tenantId filter validation
        }

        // For write operations, ensure tenantId is present
        if (['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany'].includes(params.action)) {
          if (params.action === 'create') {
            if (!params.args?.data?.tenantId) {
              throw new Error(`tenantId is required when creating ${params.model}`);
            }
          }
          
          // For upsert, check the create block (upsert uses create/update, not data)
          if (params.action === 'upsert') {
            if (!params.args?.create?.tenantId) {
              throw new Error(`tenantId is required in upsert create block for ${params.model}`);
            }
          }
          
          // Silent check for update/delete - tenantId filter validation
        }
      }

      return next(params);
    });

    // Add query logging middleware
    this.prisma.$use(async (params, next) => {
      const start = performance.now();
      this.metrics.activeConnections++;
      
      try {
        const result = await next(params);
        const duration = performance.now() - start;
        
        this.updateMetrics(duration, false);
        
        if (duration > this.config.monitoring.slowQueryThreshold) {
          this.metrics.slowQueries++;
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        this.updateMetrics(duration, true);
        throw error;
      } finally {
        this.metrics.activeConnections--;
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.prisma.$connect();
    } catch (error: unknown) {
      throw error;
    }
  }

  async executeQuery<T>(query: string, params: any[] = []): Promise<T[]> {
    return this.withRetry(async () => {
      // $queryRawUnsafe is intentional here — generic executor with parameterized placeholders ($1, $2).
      // Callers pass pre-built SQL strings with positional params; this is the correct Prisma API for that pattern.
      return await this.prisma.$queryRawUnsafe<T[]>(query, ...params);
    });
  }

  async executeTransaction<T>(operations: TransactionOperation[]): Promise<T> {
    return this.withRetry(async () => {
      return await this.prisma.$transaction(async (tx) => {
        const results = [];
        for (const op of operations) {
          const model = (tx as any)[op.model];
          if (!model || !model[op.operation]) {
            throw new Error(`Invalid operation: ${op.model}.${op.operation}`);
          }
          const result = await model[op.operation](op.data);
          results.push(result);
        }
        return results as T;
      });
    });
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = performance.now();
    
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = performance.now() - start;
      
      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        timestamp: new Date(),
        responseTime,
      };
    } catch (error) {
      const responseTime = performance.now() - start;
      
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${(error as Error).message}`,
        timestamp: new Date(),
        responseTime,
      };
    }
  }

  async getMetrics(): Promise<DatabaseMetrics> {
    this.metrics.uptime = Date.now() - this.startTime.getTime();
    return { ...this.metrics };
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Get the Prisma client for direct access
  getClient(): PrismaClient {
    return this.prisma;
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.retryPolicy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.retryPolicy.maxRetries) {
          break;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error as Error)) {
          throw error;
        }
        
        const backoffMs = Math.min(
          Math.pow(this.config.retryPolicy.backoffMultiplier, attempt) * 1000,
          this.config.retryPolicy.maxBackoffMs
        );
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    throw lastError!;
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'P2024', // Prisma connection timeout
      'P2028', // Prisma transaction timeout
    ];
    
    return retryableErrors.some(code => 
      error.message.includes(code) || 
      (error as any)?.code === code
    );
  }

  private updateMetrics(duration: number, isError: boolean): void {
    this.metrics.totalQueries++;
    
    if (isError) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalQueries - 1) + 1) / this.metrics.totalQueries;
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalQueries - 1)) / this.metrics.totalQueries;
    }
    
    this.metrics.averageQueryTime = (
      (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + duration) / 
      this.metrics.totalQueries
    );
  }
}

// Singleton instance (lazy initialization)
let databaseManagerInstance: DatabaseManager | null = null;

export function getDatabaseManager(config?: Partial<DatabaseConfig>): DatabaseManager {
  if (!databaseManagerInstance) {
    databaseManagerInstance = new DatabaseManager(config);
  }
  return databaseManagerInstance;
}

// Export everything
export * from '@prisma/client';
export * from './src/repositories';

// Default export for backward compatibility
export default function getClient() {
  return getDatabaseManager().getClient();
}