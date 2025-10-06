/**
 * WebSocket Service for Real-Time Notifications
 * Manages WebSocket connections and real-time message delivery
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

export interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  tenantId: string;
  userId?: string;
  subscriptions: Set<string>;
  lastActivity: Date;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: Date;
  };
}

export interface RealtimeMessage {
  type: string;
  data: any;
  timestamp: Date;
  id?: string;
}

export interface ConnectionStats {
  totalConnections: number;
  connectionsByTenant: Record<string, number>;
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  uptime: number;
}

export class WebSocketService extends EventEmitter {
  private connections = new Map<string, WebSocketConnection>();
  private messageQueue = new Map<string, RealtimeMessage[]>();
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    startTime: Date.now()
  };

  constructor() {
    super();
    this.startHeartbeat();
    this.startStatsCollection();
  }

  /**
   * Add a new WebSocket connection
   */
  addConnection(
    socket: WebSocket,
    tenantId: string,
    userId?: string,
    metadata: any = {}
  ): string {
    const connectionId = this.generateConnectionId();
    
    const connection: WebSocketConnection = {
      id: connectionId,
      socket,
      tenantId,
      userId,
      subscriptions: new Set(),
      lastActivity: new Date(),
      metadata: {
        connectedAt: new Date(),
        ...metadata
      }
    };

    this.connections.set(connectionId, connection);

    // Set up socket event handlers
    this.setupSocketHandlers(connection);

    this.emit('connection:added', connection);
    
    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connection.established',
      data: {
        connectionId,
        serverTime: new Date().toISOString()
      },
      timestamp: new Date()
    });

    // Send any queued messages
    this.deliverQueuedMessages(connectionId);

    return connectionId;
  }

  /**
   * Remove a WebSocket connection
   */
  removeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Close socket if still open
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close();
    }

    this.connections.delete(connectionId);
    this.emit('connection:removed', connection);

    return true;
  }

  /**
   * Send message to a specific connection
   */
  sendToConnection(connectionId: string, message: RealtimeMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      // Queue message for later delivery
      this.queueMessage(connectionId, message);
      return false;
    }

    try {
      const messageWithId = {
        ...message,
        id: message.id || this.generateMessageId()
      };

      connection.socket.send(JSON.stringify(messageWithId));
      connection.lastActivity = new Date();
      this.stats.messagesSent++;
      
      this.emit('message:sent', connectionId, messageWithId);
      return true;
    } catch (error) {
      this.emit('message:error', connectionId, message, error);
      return false;
    }
  }

  /**
   * Broadcast message to all connections for a tenant
   */
  broadcastToTenant(tenantId: string, message: RealtimeMessage): number {
    let sentCount = 0;
    
    for (const connection of this.connections.values()) {
      if (connection.tenantId === tenantId) {
        if (this.sendToConnection(connection.id, message)) {
          sentCount++;
        }
      }
    }

    this.emit('message:broadcast', tenantId, message, sentCount);
    return sentCount;
  }

  /**
   * Send message to specific user
   */
  sendToUser(tenantId: string, userId: string, message: RealtimeMessage): number {
    let sentCount = 0;
    
    for (const connection of this.connections.values()) {
      if (connection.tenantId === tenantId && connection.userId === userId) {
        if (this.sendToConnection(connection.id, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Subscribe connection to specific event types
   */
  subscribe(connectionId: string, eventTypes: string[]): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    eventTypes.forEach(eventType => {
      connection.subscriptions.add(eventType);
    });

    this.emit('subscription:added', connectionId, eventTypes);
    return true;
  }

  /**
   * Unsubscribe connection from event types
   */
  unsubscribe(connectionId: string, eventTypes: string[]): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    eventTypes.forEach(eventType => {
      connection.subscriptions.delete(eventType);
    });

    this.emit('subscription:removed', connectionId, eventTypes);
    return true;
  }

  /**
   * Send message to subscribers of specific event type
   */
  sendToSubscribers(
    tenantId: string,
    eventType: string,
    message: RealtimeMessage
  ): number {
    let sentCount = 0;
    
    for (const connection of this.connections.values()) {
      if (
        connection.tenantId === tenantId &&
        connection.subscriptions.has(eventType)
      ) {
        if (this.sendToConnection(connection.id, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    const connectionsByTenant: Record<string, number> = {};
    
    for (const connection of this.connections.values()) {
      connectionsByTenant[connection.tenantId] = 
        (connectionsByTenant[connection.tenantId] || 0) + 1;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByTenant,
      messagesSent: this.stats.messagesSent,
      messagesReceived: this.stats.messagesReceived,
      averageLatency: 50, // Mock latency
      uptime: Date.now() - this.stats.startTime
    };
  }

  /**
   * Get connections for a tenant
   */
  getConnectionsForTenant(tenantId: string): WebSocketConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.tenantId === tenantId);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Send processing status update
   */
  sendProcessingUpdate(
    tenantId: string,
    jobId: string,
    update: {
      status: string;
      progress: number;
      stage?: string;
      message?: string;
    }
  ): void {
    const message: RealtimeMessage = {
      type: 'processing.update',
      data: {
        jobId,
        ...update
      },
      timestamp: new Date()
    };

    this.sendToSubscribers(tenantId, 'processing.update', message);
  }

  /**
   * Send contract analysis completion notification
   */
  sendAnalysisComplete(
    tenantId: string,
    contractId: string,
    analysis: any
  ): void {
    const message: RealtimeMessage = {
      type: 'analysis.complete',
      data: {
        contractId,
        analysis: {
          riskScore: analysis.risk?.riskScore,
          complianceScore: analysis.compliance?.complianceScore,
          totalValue: analysis.financial?.totalValue,
          summary: 'Analysis completed successfully'
        }
      },
      timestamp: new Date()
    };

    this.broadcastToTenant(tenantId, message);
  }

  /**
   * Send system alert
   */
  sendSystemAlert(
    tenantId: string,
    alert: {
      level: 'info' | 'warning' | 'error' | 'critical';
      title: string;
      message: string;
      data?: any;
    }
  ): void {
    const message: RealtimeMessage = {
      type: 'system.alert',
      data: alert,
      timestamp: new Date()
    };

    this.broadcastToTenant(tenantId, message);
  }

  // Private helper methods

  private setupSocketHandlers(connection: WebSocketConnection): void {
    const { socket } = connection;

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleIncomingMessage(connection, message);
      } catch (error) {
        this.sendToConnection(connection.id, {
          type: 'error',
          data: { message: 'Invalid JSON message' },
          timestamp: new Date()
        });
      }
    });

    socket.on('close', () => {
      this.removeConnection(connection.id);
    });

    socket.on('error', (error) => {
      this.emit('connection:error', connection, error);
      this.removeConnection(connection.id);
    });

    socket.on('pong', () => {
      connection.lastActivity = new Date();
    });
  }

  private handleIncomingMessage(
    connection: WebSocketConnection,
    message: any
  ): void {
    this.stats.messagesReceived++;
    connection.lastActivity = new Date();

    switch (message.type) {
      case 'ping':
        this.sendToConnection(connection.id, {
          type: 'pong',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date()
        });
        break;

      case 'subscribe':
        if (message.events && Array.isArray(message.events)) {
          this.subscribe(connection.id, message.events);
          this.sendToConnection(connection.id, {
            type: 'subscription.confirmed',
            data: { events: message.events },
            timestamp: new Date()
          });
        }
        break;

      case 'unsubscribe':
        if (message.events && Array.isArray(message.events)) {
          this.unsubscribe(connection.id, message.events);
          this.sendToConnection(connection.id, {
            type: 'subscription.removed',
            data: { events: message.events },
            timestamp: new Date()
          });
        }
        break;

      default:
        this.emit('message:received', connection, message);
    }
  }

  private queueMessage(connectionId: string, message: RealtimeMessage): void {
    if (!this.messageQueue.has(connectionId)) {
      this.messageQueue.set(connectionId, []);
    }

    const queue = this.messageQueue.get(connectionId)!;
    queue.push(message);

    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  private deliverQueuedMessages(connectionId: string): void {
    const queue = this.messageQueue.get(connectionId);
    if (!queue || queue.length === 0) {
      return;
    }

    // Send all queued messages
    queue.forEach(message => {
      this.sendToConnection(connectionId, message);
    });

    // Clear the queue
    this.messageQueue.delete(connectionId);
  }

  private startHeartbeat(): void {
    setInterval(() => {
      const now = new Date();
      const staleThreshold = 60000; // 1 minute

      for (const [connectionId, connection] of this.connections.entries()) {
        const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
        
        if (timeSinceActivity > staleThreshold) {
          if (connection.socket.readyState === WebSocket.OPEN) {
            // Send ping to check if connection is alive
            try {
              connection.socket.ping();
            } catch (error) {
              this.removeConnection(connectionId);
            }
          } else {
            this.removeConnection(connectionId);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private startStatsCollection(): void {
    setInterval(() => {
      const stats = this.getStats();
      this.emit('stats:collected', stats);
    }, 60000); // Collect stats every minute
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();