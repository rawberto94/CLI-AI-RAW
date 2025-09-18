/**
 * Server-Sent Events Progress Service
 * Provides real-time progress updates via SSE for clients that prefer HTTP-based streaming
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { progressTrackingService, ProgressUpdate, ProcessingError } from './progress-tracking.service';

const logger = pino({ name: 'sse-progress' });

export interface SSEClient {
  id: string;
  reply: FastifyReply;
  tenantId: string;
  contractId?: string;
  subscriptions: Set<string>;
  lastPing: Date;
  authenticated: boolean;
}

export interface SSEMessage {
  id?: string;
  event?: string;
  data: any;
  retry?: number;
}

export class SSEProgressService {
  private clients = new Map<string, SSEClient>();
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

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Handle SSE connection request
   */
  async handleConnection(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const tenantId = (request as any).tenantId || query.tenantId || 'demo';
      const contractId = query.contractId || undefined;

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      });

      const clientId = this.generateClientId();
      const client: SSEClient = {
        id: clientId,
        reply,
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
          this.sendEvent(client, {
            event: 'progress',
            data: {
              contractId,
              progress: currentProgress
            }
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
          this.sendEvent(client, {
            event: 'progress',
            data: {
              contractId: progress.contractId,
              progress
            }
          });
        });
      }

      // Handle client disconnect
      request.raw.on('close', () => {
        this.handleDisconnection(clientId);
      });

      request.raw.on('error', (error: Error) => {
        logger.error({ clientId, error }, 'SSE client error');
        this.handleDisconnection(clientId);
      });

      logger.info({ 
        clientId, 
        tenantId, 
        contractId, 
        subscriptions: Array.from(client.subscriptions) 
      }, 'SSE client connected');

      // Send welcome message
      this.sendEvent(client, {
        event: 'connected',
        data: {
          message: 'Connected to progress tracking',
          clientId,
          subscriptions: Array.from(client.subscriptions)
        }
      });

      // Keep connection alive
      this.sendEvent(client, {
        event: 'ping',
        data: { timestamp: new Date().toISOString() }
      });

    } catch (error) {
      logger.error({ error }, 'Failed to handle SSE connection');
      reply.code(500).send({ error: 'Failed to establish SSE connection' });
    }
  }

  /**
   * Send SSE event to client
   */
  private sendEvent(client: SSEClient, message: SSEMessage): void {
    try {
      if (client.reply.raw.destroyed || client.reply.raw.writableEnded) {
        return;
      }

      let eventString = '';
      
      if (message.id) {
        eventString += `id: ${message.id}\n`;
      }
      
      if (message.event) {
        eventString += `event: ${message.event}\n`;
      }
      
      if (message.retry) {
        eventString += `retry: ${message.retry}\n`;
      }
      
      const dataString = typeof message.data === 'string' 
        ? message.data 
        : JSON.stringify(message.data);
      
      // Handle multi-line data
      const dataLines = dataString.split('\n');
      dataLines.forEach(line => {
        eventString += `data: ${line}\n`;
      });
      
      eventString += '\n';
      
      client.reply.raw.write(eventString);
      
    } catch (error) {
      logger.error({ 
        clientId: client.id, 
        error 
      }, 'Failed to send SSE event');
      this.handleDisconnection(client.id);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        if (!client.reply.raw.destroyed) {
          client.reply.raw.end();
        }
      } catch (error) {
        // Ignore errors when closing connection
      }
      
      this.clients.delete(clientId);
      logger.info({ 
        clientId, 
        tenantId: client.tenantId,
        subscriptions: Array.from(client.subscriptions)
      }, 'SSE client disconnected');
    }
  }

  /**
   * Broadcast progress update to subscribed clients
   */
  private broadcastProgress(progress: ProgressUpdate): void {
    const message: SSEMessage = {
      id: `progress-${Date.now()}`,
      event: 'progress',
      data: {
        contractId: progress.contractId,
        progress
      }
    };

    this.broadcastToSubscribers(progress.contractId, progress.tenantId, message);
  }

  /**
   * Broadcast error to subscribed clients
   */
  private broadcastError(contractId: string, error: ProcessingError): void {
    const progress = progressTrackingService.getProgress(contractId);
    if (!progress) return;

    const message: SSEMessage = {
      id: `error-${Date.now()}`,
      event: 'error',
      data: {
        contractId,
        error
      }
    };

    this.broadcastToSubscribers(contractId, progress.tenantId, message);
  }

  /**
   * Broadcast completion to subscribed clients
   */
  private broadcastCompleted(progress: ProgressUpdate): void {
    const message: SSEMessage = {
      id: `completed-${Date.now()}`,
      event: 'completed',
      data: {
        contractId: progress.contractId,
        progress
      }
    };

    this.broadcastToSubscribers(progress.contractId, progress.tenantId, message);
  }

  /**
   * Broadcast failure to subscribed clients
   */
  private broadcastFailed(progress: ProgressUpdate): void {
    const message: SSEMessage = {
      id: `failed-${Date.now()}`,
      event: 'failed',
      data: {
        contractId: progress.contractId,
        progress
      }
    };

    this.broadcastToSubscribers(progress.contractId, progress.tenantId, message);
  }

  /**
   * Broadcast message to all subscribers of a contract
   */
  private broadcastToSubscribers(contractId: string, tenantId: string, message: SSEMessage): void {
    let sentCount = 0;
    
    for (const client of this.clients.values()) {
      // Check tenant access and subscription
      if (client.tenantId === tenantId && client.subscriptions.has(contractId)) {
        this.sendEvent(client, message);
        sentCount++;
      }
    }

    logger.debug({ 
      contractId, 
      tenantId, 
      event: message.event, 
      sentCount 
    }, 'Broadcasted SSE message to subscribers');
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
          // Send ping to keep connection alive
          this.sendEvent(client, {
            event: 'ping',
            data: { timestamp: now.toISOString() }
          });
          client.lastPing = now;
        }

        // Remove clients that are no longer connected
        if (client.reply.raw.destroyed || client.reply.raw.writableEnded) {
          logger.warn({ clientId }, 'Removing disconnected SSE client');
          this.clients.delete(clientId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
   * Shutdown the SSE service
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        if (!client.reply.raw.destroyed) {
          client.reply.raw.end();
        }
      } catch (error) {
        // Ignore errors when closing connections
      }
    }
    this.clients.clear();

    logger.info('SSE progress service shut down');
  }
}

export const sseProgressService = new SSEProgressService();