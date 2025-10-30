/**
 * SSE Connection Manager Service
 * Manages SSE connections with pooling, lifecycle management, and metrics tracking
 */

import { EventEmitter } from 'events';

export interface SSEConnection {
  id: string;
  tenantId: string;
  userId?: string;
  controller: ReadableStreamDefaultController;
  createdAt: Date;
  lastActivity: Date;
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
  metadata: Record<string, any>;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsByTenant: Record<string, number>;
  connectionsByState: Record<string, number>;
  averageConnectionDuration: number;
  totalReconnectAttempts: number;
  staleConnections: number;
}

export interface ConnectionManagerConfig {
  maxConnectionsPerTenant?: number;
  maxTotalConnections?: number;
  connectionTimeout?: number; // milliseconds
  staleConnectionThreshold?: number; // milliseconds
  cleanupInterval?: number; // milliseconds
  enableMetrics?: boolean;
  enableConnectionQueue?: boolean;
  maxQueueSize?: number;
  queueTimeout?: number; // milliseconds
  gracefulDegradationThreshold?: number; // percentage (0-100)
  enableGracefulDegradation?: boolean;
}

export interface QueuedConnection {
  tenantId: string;
  userId?: string;
  metadata: Record<string, any>;
  queuedAt: Date;
  resolve: (connection: SSEConnection) => void;
  reject: (error: Error) => void;
}

export interface DegradationStatus {
  isDegraded: boolean;
  currentLoad: number; // percentage
  threshold: number; // percentage
  activeConnections: number;
  maxConnections: number;
  queuedConnections: number;
  message?: string;
}

class SSEConnectionManagerService extends EventEmitter {
  private connections: Map<string, SSEConnection> = new Map();
  private connectionsByTenant: Map<string, Set<string>> = new Map();
  private config: Required<ConnectionManagerConfig>;
  private cleanupTimer?: NodeJS.Timeout;
  private metricsHistory: Array<{ timestamp: Date; metrics: ConnectionMetrics }> = [];
  private connectionQueue: QueuedConnection[] = [];
  private queueProcessingTimer?: NodeJS.Timeout;

  constructor(config: ConnectionManagerConfig = {}) {
    super();
    this.config = {
      maxConnectionsPerTenant: config.maxConnectionsPerTenant ?? 100,
      maxTotalConnections: config.maxTotalConnections ?? 1000,
      connectionTimeout: config.connectionTimeout ?? 300000, // 5 minutes
      staleConnectionThreshold: config.staleConnectionThreshold ?? 60000, // 1 minute
      cleanupInterval: config.cleanupInterval ?? 30000, // 30 seconds
      enableMetrics: config.enableMetrics ?? true,
      enableConnectionQueue: config.enableConnectionQueue ?? true,
      maxQueueSize: config.maxQueueSize ?? 500,
      queueTimeout: config.queueTimeout ?? 30000, // 30 seconds
      gracefulDegradationThreshold: config.gracefulDegradationThreshold ?? 80, // 80%
      enableGracefulDegradation: config.enableGracefulDegradation ?? true,
    };

    this.startCleanupTimer();
    this.startQueueProcessing();
  }

  /**
   * Register a new connection
   */
  registerConnection(
    controller: ReadableStreamDefaultController,
    tenantId: string,
    userId?: string,
    metadata: Record<string, any> = {}
  ): SSEConnection {
    // Check total connection limit
    if (this.connections.size >= this.config.maxTotalConnections) {
      throw new Error('Maximum total connections reached');
    }

    // Check per-tenant connection limit
    const tenantConnections = this.connectionsByTenant.get(tenantId);
    if (tenantConnections && tenantConnections.size >= this.config.maxConnectionsPerTenant) {
      throw new Error(`Maximum connections reached for tenant: ${tenantId}`);
    }

    // Generate unique connection ID
    const connectionId = this.generateConnectionId(tenantId, userId);

    // Create connection object
    const connection: SSEConnection = {
      id: connectionId,
      tenantId,
      userId,
      controller,
      createdAt: new Date(),
      lastActivity: new Date(),
      state: 'connecting',
      reconnectAttempts: 0,
      metadata,
    };

    // Store connection
    this.connections.set(connectionId, connection);

    // Track by tenant
    if (!this.connectionsByTenant.has(tenantId)) {
      this.connectionsByTenant.set(tenantId, new Set());
    }
    this.connectionsByTenant.get(tenantId)!.add(connectionId);

    // Update state to connected
    this.updateConnectionState(connectionId, 'connected');

    // Emit event
    this.emit('connection:registered', connection);

    console.log(`[ConnectionManager] Registered connection ${connectionId} (Total: ${this.connections.size})`);

    return connection;
  }

  /**
   * Register a new connection with queuing support
   */
  async registerConnectionWithQueue(
    controller: ReadableStreamDefaultController,
    tenantId: string,
    userId?: string,
    metadata: Record<string, any> = {}
  ): Promise<SSEConnection> {
    // Try to register immediately
    try {
      return this.registerConnection(controller, tenantId, userId, metadata);
    } catch (error) {
      // If connection limit reached and queuing is enabled, add to queue
      if (this.config.enableConnectionQueue && 
          (error as Error).message.includes('Maximum')) {
        
        // Check queue size limit
        if (this.connectionQueue.length >= this.config.maxQueueSize) {
          throw new Error('Connection queue is full. Please try again later.');
        }

        // Add to queue and return promise
        return new Promise<SSEConnection>((resolve, reject) => {
          const queuedConnection: QueuedConnection = {
            tenantId,
            userId,
            metadata: { ...metadata, controller },
            queuedAt: new Date(),
            resolve,
            reject,
          };

          this.connectionQueue.push(queuedConnection);
          this.emit('connection:queued', { tenantId, userId, queuePosition: this.connectionQueue.length });

          console.log(`[ConnectionManager] Connection queued for ${tenantId} (Queue size: ${this.connectionQueue.length})`);

          // Set timeout for queued connection
          setTimeout(() => {
            const index = this.connectionQueue.indexOf(queuedConnection);
            if (index !== -1) {
              this.connectionQueue.splice(index, 1);
              reject(new Error('Connection request timed out in queue'));
              this.emit('connection:queueTimeout', { tenantId, userId });
            }
          }, this.config.queueTimeout);
        });
      }

      throw error;
    }
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Remove from tenant tracking
    const tenantConnections = this.connectionsByTenant.get(connection.tenantId);
    if (tenantConnections) {
      tenantConnections.delete(connectionId);
      if (tenantConnections.size === 0) {
        this.connectionsByTenant.delete(connection.tenantId);
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    // Emit event
    this.emit('connection:unregistered', connection);

    console.log(`[ConnectionManager] Unregistered connection ${connectionId} (Total: ${this.connections.size})`);

    return true;
  }

  /**
   * Get a connection by ID
   */
  getConnection(connectionId: string): SSEConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a tenant
   */
  getConnectionsByTenant(tenantId: string): SSEConnection[] {
    const connectionIds = this.connectionsByTenant.get(tenantId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is SSEConnection => conn !== undefined);
  }

  /**
   * Get all connections for a user
   */
  getConnectionsByUser(userId: string): SSEConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.userId === userId
    );
  }

  /**
   * Update connection state
   */
  updateConnectionState(
    connectionId: string,
    state: SSEConnection['state']
  ): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const previousState = connection.state;
    connection.state = state;
    connection.lastActivity = new Date();

    // Emit state change event
    this.emit('connection:stateChanged', {
      connectionId,
      previousState,
      newState: state,
      connection,
    });

    return true;
  }

  /**
   * Update connection activity timestamp
   */
  updateActivity(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.lastActivity = new Date();
    return true;
  }

  /**
   * Increment reconnect attempts
   */
  incrementReconnectAttempts(connectionId: string): number {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return 0;
    }

    connection.reconnectAttempts++;
    return connection.reconnectAttempts;
  }

  /**
   * Reset reconnect attempts
   */
  resetReconnectAttempts(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.reconnectAttempts = 0;
    return true;
  }

  /**
   * Find stale connections
   */
  findStaleConnections(): SSEConnection[] {
    const now = Date.now();
    const threshold = this.config.staleConnectionThreshold;

    return Array.from(this.connections.values()).filter(conn => {
      const timeSinceActivity = now - conn.lastActivity.getTime();
      return timeSinceActivity > threshold;
    });
  }

  /**
   * Find timed-out connections
   */
  findTimedOutConnections(): SSEConnection[] {
    const now = Date.now();
    const timeout = this.config.connectionTimeout;

    return Array.from(this.connections.values()).filter(conn => {
      const connectionDuration = now - conn.createdAt.getTime();
      return connectionDuration > timeout;
    });
  }

  /**
   * Clean up stale and timed-out connections
   */
  cleanupConnections(): number {
    const staleConnections = this.findStaleConnections();
    const timedOutConnections = this.findTimedOutConnections();

    // Combine and deduplicate
    const connectionsToCleanup = new Set([
      ...staleConnections.map(c => c.id),
      ...timedOutConnections.map(c => c.id),
    ]);

    let cleanedCount = 0;

    connectionsToCleanup.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        try {
          // Try to close the controller
          connection.controller.close();
        } catch (error) {
          // Controller might already be closed
        }

        // Unregister the connection
        if (this.unregisterConnection(connectionId)) {
          cleanedCount++;
          this.emit('connection:cleaned', connection);
        }
      }
    });

    if (cleanedCount > 0) {
      console.log(`[ConnectionManager] Cleaned up ${cleanedCount} stale/timed-out connections`);
    }

    return cleanedCount;
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    const connections = Array.from(this.connections.values());
    const now = Date.now();

    // Count by tenant
    const connectionsByTenant: Record<string, number> = {};
    this.connectionsByTenant.forEach((connectionIds, tenantId) => {
      connectionsByTenant[tenantId] = connectionIds.size;
    });

    // Count by state
    const connectionsByState: Record<string, number> = {
      connecting: 0,
      connected: 0,
      disconnected: 0,
      error: 0,
    };
    connections.forEach(conn => {
      connectionsByState[conn.state]++;
    });

    // Calculate average connection duration
    const totalDuration = connections.reduce((sum, conn) => {
      return sum + (now - conn.createdAt.getTime());
    }, 0);
    const averageConnectionDuration = connections.length > 0
      ? totalDuration / connections.length
      : 0;

    // Count total reconnect attempts
    const totalReconnectAttempts = connections.reduce(
      (sum, conn) => sum + conn.reconnectAttempts,
      0
    );

    // Count stale connections
    const staleConnections = this.findStaleConnections().length;

    const metrics: ConnectionMetrics = {
      totalConnections: this.connections.size,
      activeConnections: connectionsByState.connected,
      connectionsByTenant,
      connectionsByState,
      averageConnectionDuration,
      totalReconnectAttempts,
      staleConnections,
    };

    // Store metrics history if enabled
    if (this.config.enableMetrics) {
      this.metricsHistory.push({
        timestamp: new Date(),
        metrics,
      });

      // Keep only last 100 entries
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }
    }

    return metrics;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): Array<{ timestamp: Date; metrics: ConnectionMetrics }> {
    return [...this.metricsHistory];
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message: string): number {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);
    let successCount = 0;

    this.connections.forEach((connection, connectionId) => {
      try {
        connection.controller.enqueue(encoded);
        this.updateActivity(connectionId);
        successCount++;
      } catch (error) {
        console.error(`[ConnectionManager] Error broadcasting to ${connectionId}:`, error);
        this.updateConnectionState(connectionId, 'error');
      }
    });

    return successCount;
  }

  /**
   * Broadcast message to specific tenant
   */
  broadcastToTenant(tenantId: string, message: string): number {
    const connections = this.getConnectionsByTenant(tenantId);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);
    let successCount = 0;

    connections.forEach(connection => {
      try {
        connection.controller.enqueue(encoded);
        this.updateActivity(connection.id);
        successCount++;
      } catch (error) {
        console.error(`[ConnectionManager] Error broadcasting to ${connection.id}:`, error);
        this.updateConnectionState(connection.id, 'error');
      }
    });

    return successCount;
  }

  /**
   * Broadcast message to specific user
   */
  broadcastToUser(userId: string, message: string): number {
    const connections = this.getConnectionsByUser(userId);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);
    let successCount = 0;

    connections.forEach(connection => {
      try {
        connection.controller.enqueue(encoded);
        this.updateActivity(connection.id);
        successCount++;
      } catch (error) {
        console.error(`[ConnectionManager] Error broadcasting to ${connection.id}:`, error);
        this.updateConnectionState(connection.id, 'error');
      }
    });

    return successCount;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(tenantId: string, userId?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${tenantId}-${userId || 'anonymous'}-${timestamp}-${random}`;
  }

  /**
   * Process connection queue
   */
  private processQueue(): void {
    if (this.connectionQueue.length === 0) {
      return;
    }

    // Check if we have capacity
    const hasCapacity = this.connections.size < this.config.maxTotalConnections;
    if (!hasCapacity) {
      return;
    }

    // Process queued connections
    const processed: number[] = [];
    
    for (let i = 0; i < this.connectionQueue.length; i++) {
      const queued = this.connectionQueue[i];
      
      // Check if we still have capacity
      if (this.connections.size >= this.config.maxTotalConnections) {
        break;
      }

      // Check tenant-specific capacity
      const tenantConnections = this.connectionsByTenant.get(queued.tenantId);
      if (tenantConnections && tenantConnections.size >= this.config.maxConnectionsPerTenant) {
        continue;
      }

      try {
        // Extract controller from metadata
        const controller = queued.metadata.controller;
        delete queued.metadata.controller;

        // Register the connection
        const connection = this.registerConnection(
          controller,
          queued.tenantId,
          queued.userId,
          queued.metadata
        );

        // Resolve the promise
        queued.resolve(connection);
        processed.push(i);

        this.emit('connection:dequeued', { 
          connectionId: connection.id, 
          queueTime: Date.now() - queued.queuedAt.getTime() 
        });

        console.log(`[ConnectionManager] Processed queued connection for ${queued.tenantId}`);
      } catch (error) {
        // Reject the promise
        queued.reject(error as Error);
        processed.push(i);
      }
    }

    // Remove processed connections from queue (in reverse order to maintain indices)
    for (let i = processed.length - 1; i >= 0; i--) {
      this.connectionQueue.splice(processed[i], 1);
    }
  }

  /**
   * Get degradation status
   */
  getDegradationStatus(): DegradationStatus {
    const currentLoad = (this.connections.size / this.config.maxTotalConnections) * 100;
    const isDegraded = this.config.enableGracefulDegradation && 
                       currentLoad >= this.config.gracefulDegradationThreshold;

    let message: string | undefined;
    if (isDegraded) {
      if (currentLoad >= 95) {
        message = 'System is at critical capacity. New connections may be queued or rejected.';
      } else if (currentLoad >= 90) {
        message = 'System is under heavy load. Some features may be limited.';
      } else {
        message = 'System is experiencing high load. Performance may be affected.';
      }
    }

    return {
      isDegraded,
      currentLoad,
      threshold: this.config.gracefulDegradationThreshold,
      activeConnections: this.connections.size,
      maxConnections: this.config.maxTotalConnections,
      queuedConnections: this.connectionQueue.length,
      message,
    };
  }

  /**
   * Check if system should degrade gracefully
   */
  shouldDegradeGracefully(): boolean {
    const status = this.getDegradationStatus();
    return status.isDegraded;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueSize: number;
    maxQueueSize: number;
    oldestQueuedAt?: Date;
    averageQueueTime: number;
  } {
    const queueSize = this.connectionQueue.length;
    const oldestQueuedAt = queueSize > 0 
      ? this.connectionQueue[0].queuedAt 
      : undefined;

    // Calculate average queue time from recent metrics
    const now = Date.now();
    const averageQueueTime = queueSize > 0
      ? this.connectionQueue.reduce((sum, q) => sum + (now - q.queuedAt.getTime()), 0) / queueSize
      : 0;

    return {
      queueSize,
      maxQueueSize: this.config.maxQueueSize,
      oldestQueuedAt,
      averageQueueTime,
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupConnections();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Start queue processing timer
   */
  private startQueueProcessing(): void {
    this.queueProcessingTimer = setInterval(() => {
      this.processQueue();
    }, 1000); // Process queue every second
  }

  /**
   * Stop queue processing timer
   */
  private stopQueueProcessing(): void {
    if (this.queueProcessingTimer) {
      clearInterval(this.queueProcessingTimer);
      this.queueProcessingTimer = undefined;
    }
  }

  /**
   * Shutdown the connection manager
   */
  shutdown(): void {
    console.log('[ConnectionManager] Shutting down...');

    // Stop timers
    this.stopCleanupTimer();
    this.stopQueueProcessing();

    // Reject all queued connections
    this.connectionQueue.forEach(queued => {
      queued.reject(new Error('Connection manager is shutting down'));
    });
    this.connectionQueue = [];

    // Close all connections
    this.connections.forEach((connection, connectionId) => {
      try {
        connection.controller.close();
      } catch (error) {
        // Ignore errors during shutdown
      }
      this.unregisterConnection(connectionId);
    });

    // Clear all data
    this.connections.clear();
    this.connectionsByTenant.clear();
    this.metricsHistory = [];

    console.log('[ConnectionManager] Shutdown complete');
  }
}

// Export singleton instance
export const sseConnectionManager = new SSEConnectionManagerService({
  maxConnectionsPerTenant: 100,
  maxTotalConnections: 1000,
  connectionTimeout: 300000, // 5 minutes
  staleConnectionThreshold: 60000, // 1 minute
  cleanupInterval: 30000, // 30 seconds
  enableMetrics: true,
  enableConnectionQueue: true,
  maxQueueSize: 500,
  queueTimeout: 30000, // 30 seconds
  gracefulDegradationThreshold: 80, // 80%
  enableGracefulDegradation: true,
});
