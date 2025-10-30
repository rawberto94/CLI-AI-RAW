/**
 * Server-Sent Events (SSE) Endpoint
 * Streams real-time updates to connected clients
 */

import { NextRequest } from 'next/server';
import { eventBus, Events } from '@/../../packages/data-orchestration/src/events/event-bus';
import { healthCheckService } from '@/../../packages/data-orchestration/src/services/health-check.service';
import { sseConnectionManager } from '@/../../packages/data-orchestration/src/services/sse-connection-manager.service';

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
  const handlers: Array<{ event: string; handler: Function }> = [];

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
      sseConnectionManager.updateConnectionState(connectionId, 'error');
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
function cleanupEventHandlers(handlers: Array<{ event: string; handler: Function }>) {
  handlers.forEach(({ event, handler }) => {
    eventBus.off(event as any, handler as any);
  });
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcastToAll(type: string, data: any) {
  const message = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  const messageStr = `data: ${JSON.stringify(message)}\n\n`;
  return sseConnectionManager.broadcast(messageStr);
}

/**
 * Broadcast to specific tenant
 */
export function broadcastToTenant(tenantId: string, type: string, data: any) {
  const message = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  const messageStr = `data: ${JSON.stringify(message)}\n\n`;
  return sseConnectionManager.broadcastToTenant(tenantId, messageStr);
}

/**
 * Broadcast to specific user
 */
export function broadcastToUser(userId: string, type: string, data: any) {
  const message = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  const messageStr = `data: ${JSON.stringify(message)}\n\n`;
  return sseConnectionManager.broadcastToUser(userId, messageStr);
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  return sseConnectionManager.getMetrics();
}
