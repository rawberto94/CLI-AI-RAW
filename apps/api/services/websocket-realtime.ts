/**
 * Real-time WebSocket Service for Processing Updates
 * Provides live updates for contract processing status
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { jobQueue } from './job-queue';
import { processingPipeline } from './processing-pipeline';
import { processingStateManager } from './processing-state';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'status_update' | 'job_update' | 'error';
  data: any;
  timestamp: Date;
  clientId?: string;
  tenantId?: string;
}

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  tenantId: string;
  subscriptions: Set<string>;
  lastActivity: Date;
  metadata: {
    userAgent?: string;
    ip?: string;
    userId?: string;
  };
}

export class RealTimeService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ClientConnection>();
  private subscriptions = new Map<string, Set<string>>(); // topic -> clientIds
  private heartbeatInterval = 30000; // 30 seconds

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.startHeartbeat();
    console.log('Real-time WebSocket service initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tenantId = this.extractTenantId(request);

    const client: ClientConnection = {
      id: clientId,
      ws,
      tenantId,
      subscriptions: new Set(),
      lastActivity: new Date(),
      metadata: {
        userAgent: request.headers['user-agent'],
        ip: request.socket.remoteAddress,
        userId: this.extractUserId(request)
      }
    };

    this.clients.set(clientId, client);

    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      data: {
        clientId,
        serverTime: new Date(),
        features: ['job_updates', 'processing_status', 'queue_stats']
      }
    });

    this.emit('client:connected', client);
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      message.clientId = clientId;
      message.timestamp = new Date();

      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message.data);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.data);
          break;

        default:
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: `Unknown message type: ${message.type}` }
          });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle client subscription
   */
  private handleSubscription(clientId: string, subscriptionData: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = subscriptionData;
    if (!Array.isArray(topics)) return;

    for (const topic of topics) {
      // Validate topic access based on tenant
      if (this.canAccessTopic(client.tenantId, topic)) {
        client.subscriptions.add(topic);
        
        if (!this.subscriptions.has(topic)) {
          this.subscriptions.set(topic, new Set());
        }
        this.subscriptions.get(topic)!.add(clientId);

        // Send current state for the topic
        this.sendCurrentState(clientId, topic);
      }
    }

    this.sendToClient(clientId, {
      type: 'subscribed',
      data: { topics: Array.from(client.subscriptions) }
    });
  }

  /**
   * Handle client unsubscription
   */
  private handleUnsubscription(clientId: string, unsubscriptionData: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = unsubscriptionData;
    if (!Array.isArray(topics)) return;

    for (const topic of topics) {
      client.subscriptions.delete(topic);
      this.subscriptions.get(topic)?.delete(clientId);
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      data: { topics }
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all subscriptions
    for (const topic of client.subscriptions) {
      this.subscriptions.get(topic)?.delete(clientId);
    }

    this.clients.delete(clientId);
    this.emit('client:disconnected', client);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: Partial<WebSocketMessage>): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    const fullMessage: WebSocketMessage = {
      type: message.type || 'status_update',
      data: message.data,
      timestamp: new Date(),
      clientId
    };

    try {
      client.ws.send(JSON.stringify(fullMessage));
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    }
  }

  /**
   * Broadcast message to topic subscribers
   */
  private broadcastToTopic(topic: string, message: Partial<WebSocketMessage>): void {
    const subscribers = this.subscriptions.get(topic);
    if (!subscribers) return;

    for (const clientId of subscribers) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Send current state for a topic
   */
  private async sendCurrentState(clientId: string, topic: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      let currentState: any = {};

      if (topic === 'queue_stats') {
        currentState = jobQueue.getQueueStats();
      } else if (topic === 'processing_jobs') {
        const jobs = jobQueue.getJobsByTenant(client.tenantId);
        currentState = { jobs };
      } else if (topic.startsWith('job:')) {
        const jobId = topic.split(':')[1];
        const jobStatus = jobQueue.getJobStatus(jobId);
        const processingState = await processingStateManager.loadState(jobId);
        currentState = { ...jobStatus, processingState };
      } else if (topic.startsWith('contract:')) {
        const contractId = topic.split(':')[1];
        // Get contract processing status
        const jobs = jobQueue.getJobsByTenant(client.tenantId)
          .filter(job => job.contractId === contractId);
        currentState = { contractId, jobs };
      }

      this.sendToClient(clientId, {
        type: 'status_update',
        data: { topic, state: currentState }
      });
    } catch (error) {
      console.error(`Failed to send current state for topic ${topic}:`, error);
    }
  }

  /**
   * Check if client can access topic
   */
  private canAccessTopic(tenantId: string, topic: string): boolean {
    // Basic tenant isolation
    if (topic.includes('tenant:') && !topic.includes(`tenant:${tenantId}`)) {
      return false;
    }

    // Allow access to general topics
    const allowedTopics = [
      'queue_stats',
      'processing_jobs',
      'system_status'
    ];

    if (allowedTopics.includes(topic)) {
      return true;
    }

    // Allow access to job and contract specific topics
    if (topic.startsWith('job:') || topic.startsWith('contract:')) {
      return true;
    }

    return false;
  }

  /**
   * Extract tenant ID from request
   */
  private extractTenantId(request: any): string {
    return request.headers['x-tenant-id'] || 'demo';
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(request: any): string | undefined {
    return request.headers['x-user-id'];
  }

  /**
   * Setup event listeners for processing updates
   */
  private setupEventListeners(): void {
    // Job queue events
    jobQueue.on('job:added', (job) => {
      this.broadcastToTopic('processing_jobs', {
        type: 'job_update',
        data: { event: 'job_added', job }
      });
      
      this.broadcastToTopic(`contract:${job.contractId}`, {
        type: 'job_update',
        data: { event: 'job_added', job }
      });
    });

    jobQueue.on('job:assigned', (job, worker) => {
      this.broadcastToTopic(`job:${job.id}`, {
        type: 'job_update',
        data: { event: 'job_assigned', job, worker }
      });
    });

    jobQueue.on('job:completed', (job, worker, result) => {
      this.broadcastToTopic(`job:${job.id}`, {
        type: 'job_update',
        data: { event: 'job_completed', job, worker, result }
      });
      
      this.broadcastToTopic(`contract:${job.contractId}`, {
        type: 'job_update',
        data: { event: 'job_completed', job, result }
      });
    });

    jobQueue.on('job:failed', (job, worker, error) => {
      this.broadcastToTopic(`job:${job.id}`, {
        type: 'job_update',
        data: { event: 'job_failed', job, worker, error }
      });
    });

    // Processing pipeline events
    processingPipeline.on('stage:started', (job, stage) => {
      this.broadcastToTopic(`job:${job.id}`, {
        type: 'status_update',
        data: { event: 'stage_started', job, stage }
      });
    });

    processingPipeline.on('stage:progress', (job, stage) => {
      this.broadcastToTopic(`job:${job.id}`, {
        type: 'status_update',
        data: { event: 'stage_progress', job, stage }
      });
    });

    processingPipeline.on('stage:completed', (job, stage) => {
      this.broadcastToTopic(`job:${job.id}`, {
        type: 'status_update',
        data: { event: 'stage_completed', job, stage }
      });
    });

    processingPipeline.on('stage:failed', (job, stage, error) => {
      this.broadcastToTopic(`job:${job.id}`, {
        type: 'status_update',
        data: { event: 'stage_failed', job, stage, error }
      });
    });
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    setInterval(() => {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - this.heartbeatInterval * 2);

      for (const [clientId, client] of this.clients.entries()) {
        if (client.lastActivity < staleThreshold) {
          // Client is stale, disconnect
          this.handleDisconnection(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          // Send ping
          client.ws.ping();
        }
      }

      // Broadcast queue stats to subscribers
      this.broadcastToTopic('queue_stats', {
        type: 'status_update',
        data: { stats: jobQueue.getQueueStats() }
      });
    }, this.heartbeatInterval);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    connectedClients: number;
    totalSubscriptions: number;
    subscriptionsByTopic: Record<string, number>;
    clientsByTenant: Record<string, number>;
  } {
    const subscriptionsByTopic: Record<string, number> = {};
    for (const [topic, clients] of this.subscriptions.entries()) {
      subscriptionsByTopic[topic] = clients.size;
    }

    const clientsByTenant: Record<string, number> = {};
    for (const client of this.clients.values()) {
      clientsByTenant[client.tenantId] = (clientsByTenant[client.tenantId] || 0) + 1;
    }

    return {
      connectedClients: this.clients.size,
      totalSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, clients) => sum + clients.size, 0),
      subscriptionsByTopic,
      clientsByTenant
    };
  }

  /**
   * Broadcast system-wide message
   */
  broadcastSystemMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, {
        type: 'system_message',
        data: { message, messageType: type, timestamp: new Date() }
      });
    }
  }
}

// Export singleton instance
export const realTimeService = new RealTimeService();