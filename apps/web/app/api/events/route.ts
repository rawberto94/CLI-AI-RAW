/**
 * Server-Sent Events (SSE) Endpoint
 * Streams real-time updates to connected clients
 * 
 * NOTE: Completely standalone implementation to avoid dependency issues
 * with data-orchestration package. Event bus implemented inline.
 */

import { NextRequest } from 'next/server';
import { EventEmitter } from 'events';

// Inline event bus to avoid any data-orchestration imports
enum Events {
  CONTRACT_CREATED = 'contract:created',
  CONTRACT_UPDATED = 'contract:updated',
  PROCESSING_COMPLETED = 'processing:completed',
  ARTIFACT_GENERATED = 'artifact:generated',
  ARTIFACT_UPDATED = 'artifact:updated',
  RATE_CARD_CREATED = 'ratecard:created',
  RATE_CARD_UPDATED = 'ratecard:updated',
  RATE_CARD_IMPORTED = 'ratecard:imported',
  BENCHMARK_CALCULATED = 'benchmark:calculated',
  BENCHMARK_INVALIDATED = 'benchmark:invalidated',
  JOB_PROGRESS = 'job:progress',
  JOB_STATUS_CHANGED = 'job:status:changed',
}

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
}

const eventBus = EventBus.getInstance();

// Inline SSE connection management to avoid data-orchestration/services
interface SSEConnection {
  id: string;
  tenantId: string;
  userId?: string;
  controller: ReadableStreamDefaultController;
  createdAt: number;
  lastActivity: number;
}

const connections = new Map<string, SSEConnection>();

const sseConnectionManager = {
  registerConnection: (
    controller: ReadableStreamDefaultController,
    tenantId: string,
    userId?: string,
    metadata?: Record<string, any>
  ): SSEConnection => {
    const id = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection: SSEConnection = {
      id,
      controller,
      tenantId,
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    connections.set(id, connection);
    console.log('[SSE] Registered connection:', id, { tenantId, userId, total: connections.size });
    return connection;
  },

  unregisterConnection: (id: string) => {
    const existed = connections.delete(id);
    if (existed) {
      console.log('[SSE] Unregistered connection:', id, { remaining: connections.size });
    }
  },

  updateActivity: (id: string) => {
    const conn = connections.get(id);
    if (conn) {
      conn.lastActivity = Date.now();
    }
  },

  getMetrics: () => ({
    totalConnections: connections.size,
    activeConnections: connections.size,
  }),
};

const healthCheckService = {
  updateSSEConnectionCount: (count: number) => {
    console.log('[SSE] Active connections:', count);
  },
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantId = searchParams.get('tenantId') || 'demo';
  const userId = searchParams.get('userId') || undefined;

  // Create a readable stream
  const stream = new ReadableStream({
    start(controller) {
      let connection;
      let keepAliveInterval: NodeJS.Timeout;
      
      try {
        // Register connection with the manager
        connection = sseConnectionManager.registerConnection(
          controller,
          tenantId,
          userId,
          {
            userAgent: request.headers.get('user-agent'),
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          }
        );

        // Update health check service with connection count
        const metrics = sseConnectionManager.getMetrics();
        healthCheckService.updateSSEConnectionCount(metrics.activeConnections);

        // Send initial connection message
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'connected', 
            connectionId: connection.id,
            timestamp: new Date().toISOString()
          })}\n\n`)
        );

        // Setup event listeners
        const eventHandlers = setupEventHandlers(controller, connection.id, tenantId, userId);

        // Keep-alive ping every 30 seconds
        keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keep-alive\n\n'));
            sseConnectionManager.updateActivity(connection!.id);
          } catch (e) {
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          console.log(`[SSE] Connection ${connection!.id} closed`);
          
          // Clear keep-alive interval
          clearInterval(keepAliveInterval);
          
          // Unregister connection
          sseConnectionManager.unregisterConnection(connection!.id);
          
          // Update health check service
          const metrics = sseConnectionManager.getMetrics();
          healthCheckService.updateSSEConnectionCount(metrics.activeConnections);
          
          // Cleanup event handlers
          cleanupEventHandlers(eventHandlers);
          
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      } catch (error) {
        console.error('[SSE] Error setting up connection:', error);
        
        // Send error message
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Connection failed',
            timestamp: new Date().toISOString()
          })}\n\n`)
        );
        
        // Close the connection
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Setup event handlers for this connection
 */
function setupEventHandlers(
  controller: ReadableStreamDefaultController,
  connectionId: string,
  tenantId: string,
  userId?: string
) {
  const encoder = new TextEncoder();
  const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  const sendEvent = (type: string, data: any) => {
    try {
      // Filter by tenant
      if (data.tenantId && data.tenantId !== tenantId) {
        return;
      }

      const message = {
        type,
        data,
        timestamp: new Date().toISOString(),
      };

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
      );
      
      // Update activity timestamp
      sseConnectionManager.updateActivity(connectionId);
    } catch (e) {
      console.error('[SSE] Error sending event:', e);
      // Connection errored, but we don't track state in simplified manager
    }
  };

  // Contract events
  const contractCreatedHandler = (data: any) => sendEvent('contract:created', data);
  const contractUpdatedHandler = (data: any) => sendEvent('contract:updated', data);
  const processingCompletedHandler = (data: any) => sendEvent('contract:completed', data);

  eventBus.on(Events.CONTRACT_CREATED, contractCreatedHandler);
  eventBus.on(Events.CONTRACT_UPDATED, contractUpdatedHandler);
  eventBus.on(Events.PROCESSING_COMPLETED, processingCompletedHandler);

  handlers.push(
    { event: Events.CONTRACT_CREATED, handler: contractCreatedHandler },
    { event: Events.CONTRACT_UPDATED, handler: contractUpdatedHandler },
    { event: Events.PROCESSING_COMPLETED, handler: processingCompletedHandler }
  );

  // Artifact events
  const artifactGeneratedHandler = (data: any) => sendEvent('artifact:generated', data);
  const artifactUpdatedHandler = (data: any) => sendEvent('artifact:updated', data);

  eventBus.on(Events.ARTIFACT_GENERATED, artifactGeneratedHandler);
  eventBus.on(Events.ARTIFACT_UPDATED, artifactUpdatedHandler);

  handlers.push(
    { event: Events.ARTIFACT_GENERATED, handler: artifactGeneratedHandler },
    { event: Events.ARTIFACT_UPDATED, handler: artifactUpdatedHandler }
  );

  // Rate card events
  const rateCardCreatedHandler = (data: any) => sendEvent('ratecard:created', data);
  const rateCardUpdatedHandler = (data: any) => sendEvent('ratecard:updated', data);
  const rateCardImportedHandler = (data: any) => sendEvent('ratecard:imported', data);

  eventBus.on(Events.RATE_CARD_CREATED, rateCardCreatedHandler);
  eventBus.on(Events.RATE_CARD_UPDATED, rateCardUpdatedHandler);
  eventBus.on(Events.RATE_CARD_IMPORTED, rateCardImportedHandler);

  handlers.push(
    { event: Events.RATE_CARD_CREATED, handler: rateCardCreatedHandler },
    { event: Events.RATE_CARD_UPDATED, handler: rateCardUpdatedHandler },
    { event: Events.RATE_CARD_IMPORTED, handler: rateCardImportedHandler }
  );

  // Benchmark events
  const benchmarkCalculatedHandler = (data: any) => sendEvent('benchmark:calculated', data);
  const benchmarkInvalidatedHandler = (data: any) => sendEvent('benchmark:invalidated', data);

  eventBus.on(Events.BENCHMARK_CALCULATED, benchmarkCalculatedHandler);
  eventBus.on(Events.BENCHMARK_INVALIDATED, benchmarkInvalidatedHandler);

  handlers.push(
    { event: Events.BENCHMARK_CALCULATED, handler: benchmarkCalculatedHandler },
    { event: Events.BENCHMARK_INVALIDATED, handler: benchmarkInvalidatedHandler }
  );

  // Job progress events
  const jobProgressHandler = (data: any) => sendEvent('job:progress', data);
  const jobStatusChangedHandler = (data: any) => sendEvent('job:status', data);

  eventBus.on(Events.JOB_PROGRESS, jobProgressHandler);
  eventBus.on(Events.JOB_STATUS_CHANGED, jobStatusChangedHandler);

  handlers.push(
    { event: Events.JOB_PROGRESS, handler: jobProgressHandler },
    { event: Events.JOB_STATUS_CHANGED, handler: jobStatusChangedHandler }
  );

  // Notification events
  const notificationHandler = (data: any) => {
    // Filter by user if specified
    if (userId && data.userId && data.userId !== userId) {
      return;
    }
    sendEvent('notification', data);
  };

  eventBus.on('notification', notificationHandler);
  handlers.push({ event: 'notification', handler: notificationHandler });

  return handlers;
}

/**
 * Cleanup event handlers
 */
function cleanupEventHandlers(handlers: Array<{ event: string; handler: (...args: unknown[]) => void }>) {
  handlers.forEach(({ event, handler }) => {
    eventBus.off(event as any, handler as any);
  });
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  return sseConnectionManager.getMetrics();
}

// Note: broadcast functions removed - not needed for basic SSE functionality
// Restore from git history if needed after fixing data-orchestration package
