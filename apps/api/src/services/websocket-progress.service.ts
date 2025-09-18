/**
 * WebSocket Progress Service
 * Provides real-time progress updates via WebSocket connections
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import pino from 'pino';
import { progressTrackingService, ProgressUpdate, ProcessingError } from './progress-tracking.service';

const logger = pino({ name: 'websocket-progress' });

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  tenantId: string;
  contractId?: string;
  subscriptions: Set<string>;
  lastPing: Date;
  authenticated: boolean;
}

export interface ProgressMessage {
  type: 'progress' | 'error' | 'completed' | 'failed' | 'ping' | 'pong';
  contractId?: string;
  data?: ProgressUpdate | ProcessingError | any;
  timestamp: Date;
}

export class WebSocketProgressService {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, WebSocketClient>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Listen to progress tracking events
    progressTrackingService.on('progress', (progress: ProgressUpdate) => {
      this.broadcastProgress(progress);
    });

    progressTrackingService.on('error', ({ progress, error }: { progress: ProgressUpdate; error: ProcessingError }) => {
      this.broadcastError(progress.contractId, error);
    });

    progressTrackingService.on('completed', (progress: ProgressUpdate) => {
      this.broadcastCompleted(progress);
    });

    progressTrackingService.on('failed', (progress: ProgressUpdate) => {
      this.broadcastFailed(progress);
    });
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/progress',
      verifyClient: (info) => this.verifyClient(info)
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Start heartbeat to keep connections alive
    this.startHeartbeat();

    logger.info('WebSocket progress service initialized');
  }

  /**
   * Verify client connection
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
      const tenantId = url.searchParams.get('tenantId');
      
      // Basic validation - in production, add proper authentication
      if (!tenantId || tenantId.length < 1) {
        logger.warn({ origin: info.origin }, 'WebSocket connection rejected: missing tenantId');
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error }, 'WebSocket client verification failed');
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const tenantId = url.searchParams.get('tenantId') || 'demo';
      const contractId = url.searchParams.get('contractId') || undefined;
      
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        tenantId,
        contractId,
        subscriptions: new Set(),
        lastPing: new Date(),
        authenticated: true // In production, implement proper auth
      };

      this.clients.set(clientId, client);

      // Subscribe to contract if specified
      if (contractId) {
        client.subscriptions.add(contractId);
        
        // Send current progress if available
        const currentProgress = progressTrackingService.getProgress(contractId);
        if (currentProgress && currentProgress.tenantId === tenantId) {
          this.sendMessage(client, {
            type: 'progress',
            contractId,
            data: currentProgress,
            timestamp: new Date()
          });
        }
      } else {
        // Subscribe to all tenant contracts
        const tenantProgress = progressTrackingService.getTenantProgress(tenantId);
        tenantProgress.forEach(progress => {
          client.subscriptions.add(progress.contractId);
        });

        // Send current progress for all contracts
        tenantProgress.forEach(progress => {
          this.sendMessage(client, {
            type: 'progress',
            contractId: progress.contractId,
            data: progress,
            timestamp: new Date()
          });
        });
      }

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        this.handleMessage(client, data);
      });

      // Handle connection close
      ws.on('close', () => {
        this.handleDisconnection(clientId);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        logger.error({ clientId, error }, 'WebSocket client error');
        this.handleDisconnection(clientId);
      });

      logger.info({ 
        clientId, 
        tenantId, 
        contractId, 
        subscriptions: Array.from(client.subscriptions) 
      }, 'WebSocket client connected');

      // Send welcome message
      this.sendMessage(client, {
        type: 'ping',
        data: { 
          message: 'Connected to progress tracking',
          clientId,
          subscriptions: Array.from(client.subscriptions)
        },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error({ error }, 'Failed to handle WebSocket connection');
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(client: WebSocketClient, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'ping':
          client.lastPing = new Date();
          this.sendMessage(client, {
            type: 'pong',
            timestamp: new Date()
          });
          break;

        case 'subscribe':
          if (message.contractId && typeof message.contractId === 'string') {
            client.subscriptions.add(message.contractId);
            
            // Send current progress if available
            const progress = progressTrackingService.getProgress(message.contractId);
            if (progress && progress.tenantId === client.tenantId) {
              this.sendMessage(client, {
                type: 'progress',
                contractId: message.contractId,
                data: progress,
                timestamp: new Date()
              });
            }
            
            logger.debug({ 
              clientId: client.id, 
              contractId: message.contractId 
            }, 'Client subscribed to contract');
          }
          break;

        case 'unsubscribe':
          if (message.contractId && typeof message.contractId === 'string') {
            client.subscriptions.delete(message.contractId);
            logger.debug({ 
              clientId: client.id, 
              contractId: message.contractId 
            }, 'Client unsubscribed from contract');
          }
          break;

        default:
          logger.warn({ 
            clientId: client.id, 
            messageType: message.type 
          }, 'Unknown WebSocket message type');
      }
    } catch (error) {
      logger.error({ 
        clientId: client.id, 
        error 
      }, 'Failed to handle WebSocket message');
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.info({ 
        clientId, 
        tenantId: client.tenantId,
        subscriptions: Array.from(client.subscriptions)
      }, 'WebSocket client disconnected');
    }
  }

  /**
   * Send message to a specific client
   */
  private sendMessage(client: WebSocketClient, message: ProgressMessage): void {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error({ 
        clientId: client.id, 
        error 
      }, 'Failed to send WebSocket message');
    }
  }

  /**
   * Broadcast progress update to subscribed clients
   */
  private broadcastProgress(progress: ProgressUpdate): void {
    const message: ProgressMessage = {
      type: 'progress',
      contractId: progress.contractId,
      data: progress,
      timestamp: new Date()
    };

    this.broadcastToSubscribers(progress.contractId, progress.tenantId, message);
  }

  /**
   * Broadcast error to subscribed clients
   */
  private broadcastError(contractId: string, error: ProcessingError): void {
    const progress = progressTrackingService.getProgress(contractId);
    if (!progress) return;

    const message: ProgressMessage = {
      type: 'error',
      contractId,
      data: error,
      timestamp: new Date()
    };

    this.broadcastToSubscribers(contractId, progress.tenantId, message);
  }

  /**
   * Broadcast completion to subscribed clients
   */
  private broadcastCompleted(progress: ProgressUpdate): void {
    const message: ProgressMessage = {
      type: 'completed',
      contractId: progress.contractId,
      data: progress,
      timestamp: new Date()
    };

    this.broadcastToSubscribers(progress.contractId, progress.tenantId, message);
  }

  /**
   * Broadcast failure to subscribed clients
   */
  private broadcastFailed(progress: ProgressUpdate): void {
    const message: ProgressMessage = {
      type: 'failed',
      contractId: progress.contractId,
      data: progress,
      timestamp: new Date()
    };

    this.broadcastToSubscribers(progress.contractId, progress.tenantId, message);
  }

  /**
   * Broadcast message to all subscribers of a contract
   */
  private broadcastToSubscribers(contractId: string, tenantId: string, message: ProgressMessage): void {
    let sentCount = 0;
    
    for (const client of this.clients.values()) {
      // Check tenant access and subscription
      if (client.tenantId === tenantId && client.subscriptions.has(contractId)) {
        this.sendMessage(client, message);
        sentCount++;
      }
    }

    logger.debug({ 
      contractId, 
      tenantId, 
      messageType: message.type, 
      sentCount 
    }, 'Broadcasted message to subscribers');
  }

  /**
   * Start heartbeat to maintain connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 60000; // 1 minute

      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
        
        if (timeSinceLastPing > staleThreshold) {
          // Send ping to check if client is still alive
          this.sendMessage(client, {
            type: 'ping',
            timestamp: now
          });
        }

        // Remove clients that haven't responded in a long time
        if (timeSinceLastPing > staleThreshold * 3) {
          logger.warn({ clientId }, 'Removing stale WebSocket client');
          client.ws.close(1000, 'Connection timeout');
          this.clients.delete(clientId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    connectionsByTenant: Record<string, number>;
    totalSubscriptions: number;
  } {
    const connectionsByTenant: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const client of this.clients.values()) {
      connectionsByTenant[client.tenantId] = (connectionsByTenant[client.tenantId] || 0) + 1;
      totalSubscriptions += client.subscriptions.size;
    }

    return {
      totalConnections: this.clients.size,
      connectionsByTenant,
      totalSubscriptions
    };
  }

  /**
   * Shutdown the WebSocket service
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('WebSocket progress service shut down');
  }
}

export const webSocketProgressService = new WebSocketProgressService();