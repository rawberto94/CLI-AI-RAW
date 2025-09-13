import { EventEmitter } from 'events';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxConnections?: number;
  minConnections?: number;
}

interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalAcquired: number;
  totalReleased: number;
  totalCreated: number;
  totalDestroyed: number;
  averageAcquisitionTime: number;
  averageQueryTime: number;
  errorCount: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

interface Connection {
  id: string;
  createdAt: Date;
  lastUsed: Date;
  queryCount: number;
  errorCount: number;
  isActive: boolean;
  client: any; // Database client (would be pg.Client in real implementation)
}

interface QueuedRequest {
  id: string;
  queuedAt: Date;
  timeout: NodeJS.Timeout;
  resolve: (connection: Connection) => void;
  reject: (error: Error) => void;
}

class OptimizedDatabasePool extends EventEmitter {
  private config: Required<DatabaseConfig>;
  private connections = new Map<string, Connection>();
  private availableConnections: string[] = [];
  private requestQueue: QueuedRequest[] = [];
  private stats: ConnectionPoolStats;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private acquisitionTimes: number[] = [];
  private queryTimes: number[] = [];
  private isShuttingDown = false;

  constructor(config: DatabaseConfig) {
    super();
    
    this.config = {
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: config.ssl ?? true,
      connectionTimeout: config.connectionTimeout ?? 30000,
      idleTimeout: config.idleTimeout ?? 300000, // 5 minutes
      maxConnections: config.maxConnections ?? 20,
      minConnections: config.minConnections ?? 5
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalAcquired: 0,
      totalReleased: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      averageAcquisitionTime: 0,
      averageQueryTime: 0,
      errorCount: 0,
      healthStatus: 'healthy'
    };

    this.initialize();
  }

  /**
   * Initialize the connection pool
   */
  private async initialize(): Promise<void> {
    console.log('Initializing database connection pool...');
    
    try {
      // Create minimum connections
      const connectionPromises = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        connectionPromises.push(this.createConnection());
      }
      
      await Promise.all(connectionPromises);
      
      // Start health checks
      this.startHealthCheck();
      
      // Start idle connection cleanup
      this.startIdleConnectionCleanup();
      
      console.log(`Database pool initialized with ${this.connections.size} connections`);
      this.emit('poolReady');
      
    } catch (error) {
      console.error('Failed to initialize database pool:', error);
      this.emit('poolError', error);
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(timeout: number = this.config.connectionTimeout): Promise<Connection> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const startTime = Date.now();
    
    // Try to get an available connection
    const connectionId = this.availableConnections.shift();
    if (connectionId) {
      const connection = this.connections.get(connectionId);
      if (connection && this.isConnectionValid(connection)) {
        connection.isActive = true;
        connection.lastUsed = new Date();
        this.stats.totalAcquired++;
        this.stats.activeConnections++;
        this.stats.idleConnections--;
        
        const acquisitionTime = Date.now() - startTime;
        this.updateAcquisitionTime(acquisitionTime);
        
        return connection;
      } else if (connection) {
        // Connection is invalid, destroy it
        this.destroyConnection(connectionId);
      }
    }

    // No available connections, try to create a new one
    if (this.connections.size < this.config.maxConnections) {
      try {
        const connection = await this.createConnection();
        connection.isActive = true;
        this.stats.totalAcquired++;
        this.stats.activeConnections++;
        
        const acquisitionTime = Date.now() - startTime;
        this.updateAcquisitionTime(acquisitionTime);
        
        return connection;
      } catch (error) {
        this.stats.errorCount++;
        throw error;
      }
    }

    // Pool is at capacity, queue the request
    return new Promise((resolve, reject) => {
      const requestId = this.generateId();
      const timeoutHandle = setTimeout(() => {
        this.removeFromQueue(requestId);
        reject(new Error(`Connection acquisition timeout after ${timeout}ms`));
      }, timeout);

      const queuedRequest: QueuedRequest = {
        id: requestId,
        queuedAt: new Date(),
        timeout: timeoutHandle,
        resolve,
        reject
      };

      this.requestQueue.push(queuedRequest);
      this.stats.waitingClients++;
      
      this.emit('connectionQueued', { requestId, queueLength: this.requestQueue.length });
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: Connection): Promise<void> {
    if (!this.connections.has(connection.id)) {
      console.warn(`Attempting to release unknown connection ${connection.id}`);
      return;
    }

    connection.isActive = false;
    connection.lastUsed = new Date();
    this.stats.totalReleased++;
    this.stats.activeConnections--;

    // Check if connection is still valid
    if (!this.isConnectionValid(connection)) {
      this.destroyConnection(connection.id);
      return;
    }

    // Check if there are queued requests
    if (this.requestQueue.length > 0) {
      const queuedRequest = this.requestQueue.shift()!;
      clearTimeout(queuedRequest.timeout);
      this.stats.waitingClients--;
      
      connection.isActive = true;
      this.stats.activeConnections++;
      
      const acquisitionTime = Date.now() - queuedRequest.queuedAt.getTime();
      this.updateAcquisitionTime(acquisitionTime);
      
      queuedRequest.resolve(connection);
      return;
    }

    // No queued requests, add to available pool
    this.availableConnections.push(connection.id);
    this.stats.idleConnections++;
    
    this.emit('connectionReleased', { connectionId: connection.id });
  }

  /**
   * Execute a query with automatic connection management
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    const connection = await this.acquire();
    const startTime = Date.now();
    
    try {
      // Simulate query execution (replace with actual database client)
      const result = await this.executeQuery(connection, sql, params);
      
      const queryTime = Date.now() - startTime;
      this.updateQueryTime(queryTime);
      connection.queryCount++;
      
      return result;
      
    } catch (error) {
      connection.errorCount++;
      this.stats.errorCount++;
      throw error;
    } finally {
      await this.release(connection);
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (connection: Connection) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    
    try {
      await this.executeQuery(connection, 'BEGIN');
      const result = await callback(connection);
      await this.executeQuery(connection, 'COMMIT');
      return result;
    } catch (error) {
      await this.executeQuery(connection, 'ROLLBACK');
      throw error;
    } finally {
      await this.release(connection);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }

  /**
   * Get detailed connection information
   */
  getConnectionDetails(): Array<{
    id: string;
    createdAt: Date;
    lastUsed: Date;
    queryCount: number;
    errorCount: number;
    isActive: boolean;
    age: number;
    idleTime: number;
  }> {
    const now = Date.now();
    
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      createdAt: conn.createdAt,
      lastUsed: conn.lastUsed,
      queryCount: conn.queryCount,
      errorCount: conn.errorCount,
      isActive: conn.isActive,
      age: now - conn.createdAt.getTime(),
      idleTime: conn.isActive ? 0 : now - conn.lastUsed.getTime()
    }));
  }

  /**
   * Health check for the entire pool
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: {
      totalConnections: number;
      activeConnections: number;
      idleConnections: number;
      waitingClients: number;
      errorRate: number;
      averageQueryTime: number;
      oldestConnection: number;
      connectionDistribution: { [key: string]: number };
    };
  }> {
    const stats = this.getStats();
    const connections = this.getConnectionDetails();
    
    // Calculate error rate
    const totalQueries = connections.reduce((sum, conn) => sum + conn.queryCount, 0);
    const errorRate = totalQueries > 0 ? (stats.errorCount / totalQueries) * 100 : 0;
    
    // Find oldest connection
    const oldestConnection = connections.length > 0 
      ? Math.max(...connections.map(conn => conn.age))
      : 0;
    
    // Connection age distribution
    const connectionDistribution = {
      'under_1min': 0,
      '1-5min': 0,
      '5-15min': 0,
      '15-60min': 0,
      'over_1hour': 0
    };
    
    connections.forEach(conn => {
      const ageMinutes = conn.age / (1000 * 60);
      if (ageMinutes < 1) connectionDistribution['under_1min']++;
      else if (ageMinutes < 5) connectionDistribution['1-5min']++;
      else if (ageMinutes < 15) connectionDistribution['5-15min']++;
      else if (ageMinutes < 60) connectionDistribution['15-60min']++;
      else connectionDistribution['over_1hour']++;
    });

    // Determine health status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (errorRate > 10 || stats.waitingClients > 5 || stats.averageQueryTime > 5000) {
      status = 'critical';
    } else if (errorRate > 5 || stats.waitingClients > 2 || stats.averageQueryTime > 2000) {
      status = 'warning';
    }
    
    this.stats.healthStatus = status;

    return {
      status,
      details: {
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        idleConnections: stats.idleConnections,
        waitingClients: stats.waitingClients,
        errorRate,
        averageQueryTime: stats.averageQueryTime,
        oldestConnection,
        connectionDistribution
      }
    };
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(timeout: number = 30000): Promise<void> {
    console.log('Shutting down database connection pool...');
    this.isShuttingDown = true;
    
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Reject all queued requests
    this.requestQueue.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool is shutting down'));
    });
    this.requestQueue.length = 0;

    // Wait for active connections to be released or timeout
    const shutdownStart = Date.now();
    while (this.stats.activeConnections > 0 && Date.now() - shutdownStart < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force close remaining connections
    const connectionPromises = Array.from(this.connections.keys()).map(id => 
      this.destroyConnection(id)
    );
    
    await Promise.all(connectionPromises);
    
    console.log('Database connection pool shutdown complete');
    this.emit('poolShutdown');
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<Connection> {
    const connectionId = this.generateId();
    
    try {
      // Simulate database connection creation
      // In real implementation, this would create actual database connection
      const client = await this.createDatabaseClient();
      
      const connection: Connection = {
        id: connectionId,
        createdAt: new Date(),
        lastUsed: new Date(),
        queryCount: 0,
        errorCount: 0,
        isActive: false,
        client
      };

      this.connections.set(connectionId, connection);
      this.stats.totalConnections++;
      this.stats.totalCreated++;
      this.stats.idleConnections++;

      console.log(`Created database connection ${connectionId}`);
      this.emit('connectionCreated', { connectionId });
      
      return connection;
      
    } catch (error) {
      console.error(`Failed to create database connection: ${error}`);
      this.stats.errorCount++;
      throw error;
    }
  }

  /**
   * Destroy a database connection
   */
  private async destroyConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Close the database client
      if (connection.client && typeof connection.client.end === 'function') {
        await connection.client.end();
      }
    } catch (error) {
      console.warn(`Error closing database connection ${connectionId}:`, error);
    }

    this.connections.delete(connectionId);
    this.stats.totalConnections--;
    this.stats.totalDestroyed++;
    
    if (connection.isActive) {
      this.stats.activeConnections--;
    } else {
      this.stats.idleConnections--;
      // Remove from available connections
      const index = this.availableConnections.indexOf(connectionId);
      if (index > -1) {
        this.availableConnections.splice(index, 1);
      }
    }

    console.log(`Destroyed database connection ${connectionId}`);
    this.emit('connectionDestroyed', { connectionId });
  }

  /**
   * Check if a connection is still valid
   */
  private isConnectionValid(connection: Connection): boolean {
    const now = Date.now();
    const idleTime = now - connection.lastUsed.getTime();
    
    // Check if connection has been idle too long
    if (idleTime > this.config.idleTimeout) {
      return false;
    }

    // Check error rate
    if (connection.errorCount > 10 && connection.queryCount > 0) {
      const errorRate = (connection.errorCount / connection.queryCount) * 100;
      if (errorRate > 20) {
        return false;
      }
    }

    return true;
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
        
        // Clean up invalid connections
        for (const [id, connection] of this.connections.entries()) {
          if (!connection.isActive && !this.isConnectionValid(connection)) {
            await this.destroyConnection(id);
          }
        }
        
        // Ensure minimum connections
        while (this.connections.size < this.config.minConnections) {
          try {
            await this.createConnection();
          } catch (error) {
            console.error('Failed to maintain minimum connections:', error);
            break;
          }
        }
        
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start idle connection cleanup
   */
  private startIdleConnectionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const connectionsToDestroy: string[] = [];
      
      for (const [id, connection] of this.connections.entries()) {
        if (!connection.isActive) {
          const idleTime = now - connection.lastUsed.getTime();
          if (idleTime > this.config.idleTimeout && this.connections.size > this.config.minConnections) {
            connectionsToDestroy.push(id);
          }
        }
      }
      
      connectionsToDestroy.forEach(id => this.destroyConnection(id));
    }, 60000); // Every minute
  }

  /**
   * Simulate database client creation
   */
  private async createDatabaseClient(): Promise<any> {
    // In real implementation, this would create actual database client
    // For example, with PostgreSQL: new pg.Client(this.config)
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          query: async (sql: string, params?: any[]) => {
            // Simulate query execution
            await new Promise(r => setTimeout(r, 10 + Math.random() * 100));
            return { rows: [], rowCount: 0 };
          },
          end: async () => {
            // Simulate connection close
            await new Promise(r => setTimeout(r, 10));
          }
        });
      }, 100 + Math.random() * 200); // Simulate connection time
    });
  }

  /**
   * Execute query on connection
   */
  private async executeQuery(connection: Connection, sql: string, params?: any[]): Promise<any> {
    try {
      return await connection.client.query(sql, params);
    } catch (error) {
      console.error(`Query failed on connection ${connection.id}:`, error);
      throw error;
    }
  }

  private removeFromQueue(requestId: string): void {
    const index = this.requestQueue.findIndex(req => req.id === requestId);
    if (index > -1) {
      this.requestQueue.splice(index, 1);
      this.stats.waitingClients--;
    }
  }

  private updateAcquisitionTime(time: number): void {
    this.acquisitionTimes.push(time);
    if (this.acquisitionTimes.length > 1000) {
      this.acquisitionTimes = this.acquisitionTimes.slice(-1000);
    }
    
    const sum = this.acquisitionTimes.reduce((acc, t) => acc + t, 0);
    this.stats.averageAcquisitionTime = sum / this.acquisitionTimes.length;
  }

  private updateQueryTime(time: number): void {
    this.queryTimes.push(time);
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    const sum = this.queryTimes.reduce((acc, t) => acc + t, 0);
    this.stats.averageQueryTime = sum / this.queryTimes.length;
  }

  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Database pool factory
export class DatabasePoolManager {
  private pools = new Map<string, OptimizedDatabasePool>();

  /**
   * Create or get a database pool
   */
  getPool(name: string, config: DatabaseConfig): OptimizedDatabasePool {
    if (!this.pools.has(name)) {
      const pool = new OptimizedDatabasePool(config);
      this.pools.set(name, pool);
    }
    
    return this.pools.get(name)!;
  }

  /**
   * Get all pools for monitoring
   */
  getAllPools(): Map<string, OptimizedDatabasePool> {
    return new Map(this.pools);
  }

  /**
   * Shutdown all pools
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.pools.values()).map(pool => pool.shutdown());
    await Promise.all(shutdownPromises);
    this.pools.clear();
  }
}

// Export singleton instance
export const dbPoolManager = new DatabasePoolManager();

// Helper function to get default pool
export function getDefaultPool(): OptimizedDatabasePool {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'contracts',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '5')
  };
  
  return dbPoolManager.getPool('default', config);
}
