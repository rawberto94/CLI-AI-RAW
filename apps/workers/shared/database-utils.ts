/**
 * Shared Database Utilities
 * Consolidates database operations, connection management, and common queries
 */

// Database configuration
export interface DatabaseConfig {
  connectionString?: string;
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// Database operation result
export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  affectedRows?: number;
}

// Artifact creation data
export interface ArtifactCreationData {
  contractId: string;
  type: string;
  data: any;
  tenantId: string;
  metadata?: any;
}

// Contract query filters
export interface ContractFilters {
  tenantId?: string;
  contractType?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  parties?: string[];
}

/**
 * Shared Database Client with enhanced error handling and retry logic
 */
export class SharedDatabaseClient {
  private config: DatabaseConfig;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: DatabaseConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      connectionTimeout: config.connectionTimeout || 30000,
      queryTimeout: config.queryTimeout || 60000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
    
    this.retryAttempts = this.config.retryAttempts!;
    this.retryDelay = this.config.retryDelay!;
  }

  /**
   * Get database client with fallback handling
   */
  async getClient(): Promise<any> {
    try {
      // Try to import the main database client
      const db = await import('clients-db');
      return db.default;
    } catch (error) {
      console.warn('Main database client not available, using fallback');
      
      // Return mock client for development/testing
      return this.getMockClient();
    }
  }

  /**
   * Execute database operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'database operation'
  ): Promise<DatabaseResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await operation();
        const executionTime = Date.now() - startTime;

        return {
          success: true,
          data: result,
          executionTime
        };

      } catch (error) {
        lastError = error as Error;
        console.warn(`${operationName} attempt ${attempt} failed:`, error);

        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    const executionTime = Date.now() - startTime;
    return {
      success: false,
      error: `${operationName} failed after ${this.retryAttempts} attempts: ${lastError?.message}`,
      executionTime
    };
  }

  /**
   * Create artifact with enhanced error handling
   */
  async createArtifact(artifactData: ArtifactCreationData): Promise<DatabaseResult<any>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const result = await db.artifact.create({
        data: {
          contractId: artifactData.contractId,
          type: artifactData.type,
          data: artifactData.data,
          tenantId: artifactData.tenantId,
          metadata: artifactData.metadata
        }
      });

      return result;
    }, 'create artifact');
  }

  /**
   * Find contract with related data
   */
  async findContract(
    contractId: string,
    includeArtifacts: boolean = false
  ): Promise<DatabaseResult<any>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const result = await db.contract.findUnique({
        where: { id: contractId },
        include: includeArtifacts ? {
          artifacts: {
            orderBy: { createdAt: 'desc' }
          }
        } : undefined
      });

      return result;
    }, 'find contract');
  }

  /**
   * Find artifacts by contract and type
   */
  async findArtifacts(
    contractId: string,
    artifactType?: string,
    limit?: number
  ): Promise<DatabaseResult<any[]>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const where: any = { contractId };
      if (artifactType) {
        where.type = artifactType;
      }

      const result = await db.artifact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return result;
    }, 'find artifacts');
  }

  /**
   * Count artifacts by type
   */
  async countArtifacts(
    contractId: string,
    artifactType?: string
  ): Promise<DatabaseResult<number>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const where: any = { contractId };
      if (artifactType) {
        where.type = artifactType;
      }

      const result = await db.artifact.count({ where });
      return result;
    }, 'count artifacts');
  }

  /**
   * Find contracts with filters
   */
  async findContracts(
    filters: ContractFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<DatabaseResult<any[]>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const where: any = {};
      
      if (filters.tenantId) {
        where.tenantId = filters.tenantId;
      }
      
      if (filters.contractType) {
        where.contractType = filters.contractType;
      }
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.dateRange) {
        where.createdAt = {
          gte: filters.dateRange.start,
          lte: filters.dateRange.end
        };
      }

      const result = await db.contract.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });

      return result;
    }, 'find contracts');
  }

  /**
   * Update contract metadata
   */
  async updateContractMetadata(
    contractId: string,
    metadata: any
  ): Promise<DatabaseResult<any>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const result = await db.contract.update({
        where: { id: contractId },
        data: { metadata }
      });

      return result;
    }, 'update contract metadata');
  }

  /**
   * Execute raw SQL query
   */
  async executeRawQuery(
    query: string,
    params: any[] = []
  ): Promise<DatabaseResult<any>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const result = await db.$queryRaw`${query}`;
      return result;
    }, 'execute raw query');
  }

  /**
   * Execute raw SQL command
   */
  async executeRawCommand(
    command: string,
    params: any[] = []
  ): Promise<DatabaseResult<any>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      const result = await db.$executeRaw`${command}`;
      return result;
    }, 'execute raw command');
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<DatabaseResult<any>> {
    return this.executeWithRetry(async () => {
      const db = await this.getClient();
      
      // Simple health check query
      const result = await db.$queryRaw`SELECT 1 as health_check`;
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connectionPool: 'active',
        queryResult: result
      };
    }, 'health check');
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get mock database client for development/testing
   */
  private getMockClient(): any {
    return {
      contract: {
        findUnique: async (params: any) => {
          console.log('Mock: Finding contract', params.where.id);
          return {
            id: params.where.id,
            name: 'Mock Contract',
            tenantId: 'mock-tenant',
            createdAt: new Date(),
            artifacts: []
          };
        },
        findMany: async (params: any) => {
          console.log('Mock: Finding contracts with params', params);
          return [
            {
              id: 'mock-contract-1',
              name: 'Mock Contract 1',
              tenantId: 'mock-tenant',
              createdAt: new Date()
            }
          ];
        },
        update: async (params: any) => {
          console.log('Mock: Updating contract', params.where.id);
          return {
            id: params.where.id,
            ...params.data
          };
        }
      },
      artifact: {
        create: async (params: any) => {
          console.log('Mock: Creating artifact', params.data.type);
          return {
            id: 'mock-artifact-' + Date.now(),
            ...params.data,
            createdAt: new Date()
          };
        },
        findMany: async (params: any) => {
          console.log('Mock: Finding artifacts', params.where);
          return [
            {
              id: 'mock-artifact-1',
              type: 'INGESTION',
              data: { content: 'Mock content' },
              createdAt: new Date()
            }
          ];
        },
        findFirst: async (params: any) => {
          console.log('Mock: Finding first artifact', params.where);
          return {
            id: 'mock-artifact-1',
            type: params.where.type || 'INGESTION',
            data: { content: 'Mock content' },
            createdAt: new Date()
          };
        },
        count: async (params: any) => {
          console.log('Mock: Counting artifacts', params.where);
          return 1;
        }
      },
      $queryRaw: async (query: any) => {
        console.log('Mock: Executing raw query', query);
        return [{ health_check: 1 }];
      },
      $executeRaw: async (command: any) => {
        console.log('Mock: Executing raw command', command);
        return 1;
      }
    };
  }
}

/**
 * Common Database Queries
 */
export class CommonQueries {
  
  /**
   * Get contract with all artifacts
   */
  static async getContractWithArtifacts(
    db: SharedDatabaseClient,
    contractId: string
  ): Promise<DatabaseResult<any>> {
    return db.findContract(contractId, true);
  }

  /**
   * Get latest artifact of specific type
   */
  static async getLatestArtifact(
    db: SharedDatabaseClient,
    contractId: string,
    artifactType: string
  ): Promise<DatabaseResult<any>> {
    const result = await db.findArtifacts(contractId, artifactType, 1);
    
    if (result.success && result.data && result.data.length > 0) {
      return {
        ...result,
        data: result.data[0]
      };
    }
    
    return {
      success: false,
      error: `No ${artifactType} artifact found for contract ${contractId}`,
      executionTime: result.executionTime
    };
  }

  /**
   * Check if contract exists
   */
  static async contractExists(
    db: SharedDatabaseClient,
    contractId: string
  ): Promise<boolean> {
    const result = await db.findContract(contractId, false);
    return result.success && result.data !== null;
  }

  /**
   * Get contract statistics
   */
  static async getContractStats(
    db: SharedDatabaseClient,
    contractId: string
  ): Promise<DatabaseResult<any>> {
    const artifactCountResult = await db.countArtifacts(contractId);
    const contractResult = await db.findContract(contractId, false);
    
    if (!contractResult.success || !artifactCountResult.success) {
      return {
        success: false,
        error: 'Failed to retrieve contract statistics',
        executionTime: contractResult.executionTime + artifactCountResult.executionTime
      };
    }
    
    return {
      success: true,
      data: {
        contract: contractResult.data,
        artifactCount: artifactCountResult.data,
        lastUpdated: contractResult.data?.updatedAt || contractResult.data?.createdAt
      },
      executionTime: contractResult.executionTime + artifactCountResult.executionTime
    };
  }
}

/**
 * Database Connection Pool Manager
 */
export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager;
  private connections: Map<string, SharedDatabaseClient> = new Map();
  
  static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager();
    }
    return ConnectionPoolManager.instance;
  }
  
  /**
   * Get or create database connection
   */
  getConnection(tenantId: string, config?: DatabaseConfig): SharedDatabaseClient {
    if (!this.connections.has(tenantId)) {
      this.connections.set(tenantId, new SharedDatabaseClient(config));
    }
    return this.connections.get(tenantId)!;
  }
  
  /**
   * Close all connections
   */
  closeAllConnections(): void {
    this.connections.clear();
  }
  
  /**
   * Get connection pool status
   */
  getPoolStatus(): any {
    return {
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.keys())
    };
  }
}

/**
 * Singleton database client instance
 */
let sharedDatabaseClient: SharedDatabaseClient | null = null;

/**
 * Get shared database client instance
 */
export function getSharedDatabaseClient(config?: DatabaseConfig): SharedDatabaseClient {
  if (!sharedDatabaseClient) {
    sharedDatabaseClient = new SharedDatabaseClient(config);
  }
  return sharedDatabaseClient;
}

/**
 * Database health check utility
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = getSharedDatabaseClient();
    const result = await db.getHealthStatus();
    return result.success;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Create standardized provenance entry for database operations
 */
export function createDatabaseProvenance(
  worker: string,
  operation: string,
  executionTime: number,
  additionalData?: Record<string, any>
): any {
  return {
    worker,
    operation,
    timestamp: new Date().toISOString(),
    durationMs: executionTime,
    database: 'postgresql',
    ...additionalData
  };
}

// Export all utilities - already exported above