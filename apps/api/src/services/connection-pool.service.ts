/**
 * Connection Pool Service
 * Manages database connection pooling for high-throughput operations
 */

import pino from 'pino';

const logger = pino({ name: 'connection-pool' });

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  createRetryIntervalMillis: number;
  propagateCreateError: boolean;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingAcquires: number;
  pendingCreates: number;
  acquireCount: number;
  acquireSuccessCount: number;
  acquireFailureCount: number;
  createCount: number;
  destroyCount: number;
  averageAcquireTime: number;
  averageCreateTime: number;
}

export interface Connection {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
  queryCount: number;
  errorCount: number;
  // Database connection object would be here
  client?: any;
}

export class ConnectionPoolService {
  private config: ConnectionPoolConfig;
  private connections: Map<string, Connection> = new Map();
  private availableConnections: string[] = [];
  private pendingAcquires: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    timestamp: Date;
  }> = [];
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    pendingAcquires: 0,
    pendingCreates: 0,
    acquireCount: 0,
    acquireSuccessCount: 0,
    acquireFailureCount: 0,
    createCount: 0,
    destroyCount: 0,
    averageAcquireTime: 0,
    averageCreateTime: 0
  };
  private acquireTimes: number[] = [];
  private createTimes: number[] = [];
  private reapInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      min: 2,
      max: 20,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000, // 5 minutes
      reapIntervalMillis: 1000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      createRetryIntervalMillis: 200,
      propagateCreateError: true,
      ...config
    };

    this.startReaper();
    this.initializeMinConnections();
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<Connection> {
    const startTime = Date.now();
    this.stats.acquireCount++;
    this.stats.pendingAcquires++;

    try {
      // Try to get an available connection immediately
      const availableId = this.availableConnections.pop();
      if (availableId) {
        const connection = this.connections.get(availableId);
        if (connection && this.isConnectionValid(connection)) {
          connection.isActive = true;
          connection.lastUsedAt = new Date();
          this.updateStats();
          this.recordAcquireTime(Date.now() - startTime);
          this.stats.acquireSuccessCount++;
          this.stats.pendingAcquires--;
          return connection;
        } else if (connection) {
          // Connection is invalid, remove it
          await this.destroyConnection(connection.id);
        }
      }

      // No available connections, try to create a new one
      if (this.connections.size < this.config.max) {
        const connection = await this.createConnection();
        connection.isActive = true;
        this.updateStats();
        this.recordAcquireTime(Date.now() - startTime);
        this.stats.acquireSuccessCount++;
        this.stats.pendingAcquires--;
        return connection;
      }

      // Pool is full, wait for a connection to become available
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Remove from pending queue
          const index = this.pendingAcquires.findIndex(p => p.resolve === resolve);
          if (index !== -1) {
            this.pendingAcquires.splice(index, 1);
          }
          this.stats.acquireFailureCount++;
          this.stats.pendingAcquires--;
          reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeoutMillis}ms`));
        }, this.config.acquireTimeoutMillis);

        this.pendingAcquires.push({
          resolve: (connection: Connection) => {
            clearTimeout(timeout);
            this.recordAcquireTime(Date.now() - startTime);
            this.stats.acquireSuccessCount++;
            this.stats.pendingAcquires--;
            resolve(connection);
          },
          reject: (error: Error) => {
            clearTimeout(timeout);
            this.stats.acquireFailureCount++;
            this.stats.pendingAcquires--;
            reject(error);
          },
          timestamp: new Date()
        });
      });

    } catch (error) {
      this.stats.acquireFailureCount++;
      this.stats.pendingAcquires--;
      logger.error({ error }, 'Failed to acquire connection');
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: Connection): Promise<void> {
    try {
      if (!this.connections.has(connection.id)) {
        logger.warn({ connectionId: connection.id }, 'Attempting to release unknown connection');
        return;
      }

      connection.isActive = false;
      connection.lastUsedAt = new Date();

      // Check if there are pending acquires
      const pending = this.pendingAcquires.shift();
      if (pending) {
        connection.isActive = true;
        pending.resolve(connection);
        return;
      }

      // Add back to available connections
      this.availableConnections.push(connection.id);
      this.updateStats();

      logger.debug({ connectionId: connection.id }, 'Connection released to pool');

    } catch (error) {
      logger.error({ error, connectionId: connection.id }, 'Failed to release connection');
      // If release fails, destroy the connection
      await this.destroyConnection(connection.id);
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async withConnection<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    try {
      const result = await fn(connection);
      connection.queryCount++;
      return result;
    } catch (error) {
      connection.errorCount++;
      logger.error({ 
        error, 
        connectionId: connection.id,
        queryCount: connection.queryCount,
        errorCount: connection.errorCount
      }, 'Query failed');
      throw error;
    } finally {
      await this.release(connection);
    }
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<Connection> {
    const startTime = Date.now();
    this.stats.pendingCreates++;
    this.stats.createCount++;

    try {
      const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create actual database connection here
      // For now, we'll create a mock connection
      const dbClient = await this.createDatabaseClient();

      const connection: Connection = {
        id: connectionId,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        isActive: false,
        queryCount: 0,
        errorCount: 0,
        client: dbClient
      };

      this.connections.set(connectionId, connection);
      this.recordCreateTime(Date.now() - startTime);
      this.stats.pendingCreates--;

      logger.debug({ connectionId }, 'New connection created');
      return connection;

    } catch (error) {
      this.stats.pendingCreates--;
      logger.error({ error }, 'Failed to create connection');
      throw error;
    }
  }

  /**
   * Create actual database client
   */
  private async createDatabaseClient(): Promise<any> {
    // This would create the actual database connection
    // For now, return a mock client
    return {
      query: async (sql: string, params?: any[]) => {
        // Mock query execution
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return { rows: [], rowCount: 0 };
      },
      release: () => {
        // Mock connection cleanup
      }
    };
  }

  /**
   * Destroy a connection
   */
  private async destroyConnection(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      // Close the actual database connection
      if (connection.client && typeof connection.client.release === 'function') {
        await connection.client.release();
      }

      this.connections.delete(connectionId);
      
      // Remove from available connections if present
      const availableIndex = this.availableConnections.indexOf(connectionId);
      if (availableIndex !== -1) {
        this.availableConnections.splice(availableIndex, 1);
      }

      this.stats.destroyCount++;
      this.updateStats();

      logger.debug({ connectionId }, 'Connection destroyed');

    } catch (error) {
      logger.error({ error, connectionId }, 'Failed to destroy connection');
    }
  }

  /**
   * Check if a connection is still valid
   */
  private isConnectionValid(connection: Connection): boolean {
    const now = Date.now();
    const age = now - connection.createdAt.getTime();
    const idle = now - connection.lastUsedAt.getTime();

    // Check if connection is too old or has been idle too long
    if (idle > this.config.idleTimeoutMillis) {
      return false;
    }

    // Check if connection has too many errors
    if (connection.errorCount > 10 && connection.queryCount > 0) {
      const errorRate = connection.errorCount / connection.queryCount;
      if (errorRate > 0.5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize minimum number of connections
   */
  private async initializeMinConnections(): Promise<void> {
    const promises = [];
    for (let i = 0; i < this.config.min; i++) {
      promises.push(this.createConnection().then(conn => {
        this.availableConnections.push(conn.id);
      }));
    }

    try {
      await Promise.all(promises);
      this.updateStats();
      logger.info({ 
        minConnections: this.config.min,
        totalConnections: this.connections.size 
      }, 'Initialized minimum connections');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize minimum connections');
    }
  }

  /**
   * Start the connection reaper
   */
  private startReaper(): void {
    this.reapInterval = setInterval(() => {
      this.reapIdleConnections();
    }, this.config.reapIntervalMillis);
  }

  /**
   * Reap idle connections
   */
  private async reapIdleConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToDestroy: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      if (connection.isActive) continue;

      const idle = now - connection.lastUsedAt.getTime();
      if (idle > this.config.idleTimeoutMillis && this.connections.size > this.config.min) {
        connectionsToDestroy.push(id);
      } else if (!this.isConnectionValid(connection)) {
        connectionsToDestroy.push(id);
      }
    }

    // Destroy invalid/idle connections
    for (const id of connectionsToDestroy) {
      await this.destroyConnection(id);
    }

    // Ensure we have minimum connections
    const needed = this.config.min - this.connections.size;
    if (needed > 0) {
      for (let i = 0; i < needed; i++) {
        try {
          const connection = await this.createConnection();
          this.availableConnections.push(connection.id);
        } catch (error) {
          logger.error({ error }, 'Failed to create replacement connection');
        }
      }
    }

    this.updateStats();
  }

  /**
   * Update connection statistics
   */
  private updateStats(): void {
    this.stats.totalConnections = this.connections.size;
    this.stats.activeConnections = Array.from(this.connections.values())
      .filter(c => c.isActive).length;
    this.stats.idleConnections = this.stats.totalConnections - this.stats.activeConnections;
  }

  /**
   * Record acquire time for statistics
   */
  private recordAcquireTime(time: number): void {
    this.acquireTimes.push(time);
    if (this.acquireTimes.length > 100) {
      this.acquireTimes.shift();
    }
    this.stats.averageAcquireTime = this.acquireTimes.reduce((a, b) => a + b, 0) / this.acquireTimes.length;
  }

  /**
   * Record create time for statistics
   */
  private recordCreateTime(time: number): void {
    this.createTimes.push(time);
    if (this.createTimes.length > 100) {
      this.createTimes.shift();
    }
    this.stats.averageCreateTime = this.createTimes.reduce((a, b) => a + b, 0) / this.createTimes.length;
  }

  /**
   * Get connection pool statistics
   */
  getStats(): ConnectionStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get detailed connection information
   */
  getConnectionDetails(): Array<{
    id: string;
    createdAt: Date;
    lastUsedAt: Date;
    isActive: boolean;
    queryCount: number;
    errorCount: number;
    ageMs: number;
    idleMs: number;
  }> {
    const now = Date.now();
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      createdAt: conn.createdAt,
      lastUsedAt: conn.lastUsedAt,
      isActive: conn.isActive,
      queryCount: conn.queryCount,
      errorCount: conn.errorCount,
      ageMs: now - conn.createdAt.getTime(),
      idleMs: now - conn.lastUsedAt.getTime()
    }));
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down connection pool');

    // Stop the reaper
    if (this.reapInterval) {
      clearInterval(this.reapInterval);
      this.reapInterval = null;
    }

    // Reject all pending acquires
    for (const pending of this.pendingAcquires) {
      pending.reject(new Error('Connection pool is shutting down'));
    }
    this.pendingAcquires.length = 0;

    // Destroy all connections
    const destroyPromises = Array.from(this.connections.keys()).map(id => 
      this.destroyConnection(id)
    );

    await Promise.all(destroyPromises);

    logger.info('Connection pool shutdown complete');
  }

  /**
   * Health check for the connection pool
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    stats: ConnectionStats;
    issues: string[];
  }> {
    const stats = this.getStats();
    const issues: string[] = [];
    let healthy = true;

    // Check if we have minimum connections
    if (stats.totalConnections < this.config.min) {
      issues.push(`Below minimum connections: ${stats.totalConnections} < ${this.config.min}`);
      healthy = false;
    }

    // Check if too many pending acquires
    if (stats.pendingAcquires > this.config.max / 2) {
      issues.push(`High pending acquires: ${stats.pendingAcquires}`);
      healthy = false;
    }

    // Check acquire failure rate
    if (stats.acquireCount > 0) {
      const failureRate = stats.acquireFailureCount / stats.acquireCount;
      if (failureRate > 0.1) {
        issues.push(`High acquire failure rate: ${(failureRate * 100).toFixed(1)}%`);
        healthy = false;
      }
    }

    // Check average acquire time
    if (stats.averageAcquireTime > 1000) {
      issues.push(`Slow connection acquisition: ${stats.averageAcquireTime.toFixed(0)}ms`);
      healthy = false;
    }

    return { healthy, stats, issues };
  }
}

export const connectionPoolService = new ConnectionPoolService();