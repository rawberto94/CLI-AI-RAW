/**
 * Connection Management API
 * Provides endpoints for monitoring and managing SSE connections
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sseConnectionManager } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

const ConnectionActionSchema = z.object({
  action: z.enum(['cleanup', 'disconnect', 'broadcast']),
  connectionId: z.string().optional(),
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  message: z.unknown().optional(),
});
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/connections
 * Get connection metrics and statistics
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  // Admin-only route for connection management
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
  }
  const tenantId = ctx.tenantId;

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  switch (action) {
    case 'metrics':
      return getMetrics(ctx, tenantId);

    case 'history':
      return getMetricsHistory(ctx, tenantId);

    case 'tenant':
      return getConnectionsByTenant(ctx, tenantId);

    case 'user':
      return getConnectionsByUser(ctx, searchParams.get('userId'), tenantId);

    case 'stale':
      return getStaleConnections(ctx, tenantId);

    case 'degradation':
      return createErrorResponse(ctx, 'FORBIDDEN', 'Global connection status is not available in tenant-scoped view', 403);

    case 'queue':
      return createErrorResponse(ctx, 'FORBIDDEN', 'Global connection status is not available in tenant-scoped view', 403);

    default:
      return getMetrics(ctx, tenantId);
  }
});

/**
 * POST /api/connections
 * Perform connection management actions
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
  }

  const body = await request.json();
  const parsed = ConnectionActionSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid request body', 400);
  }
  const { action, connectionId } = parsed.data;

  switch (action) {
    case 'cleanup':
      return performCleanup(ctx, ctx.tenantId);

    case 'disconnect':
      if (!connectionId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'connectionId is required for disconnect', 400);
      }
      return disconnectConnection(ctx, connectionId, ctx.tenantId);

    case 'broadcast':
      return broadcastMessage(ctx, body, ctx.tenantId);

    default:
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action specified', 400);
  }
});

/**
 * Get connection metrics
 */
function getMetrics(ctx: any, tenantId: string) {
  const connections = sseConnectionManager.getConnectionsByTenant(tenantId);
  const now = Date.now();
  const connectionsByState: Record<string, number> = {
    connecting: 0,
    connected: 0,
    disconnected: 0,
    error: 0,
  };

  connections.forEach(conn => {
    if (conn.state in connectionsByState) {
      connectionsByState[conn.state]++;
    }
  });

  const metrics = {
    totalConnections: connections.length,
    activeConnections: connectionsByState.connected,
    connectionsByTenant: { [tenantId]: connections.length },
    connectionsByState,
    averageConnectionDuration: connections.length > 0
      ? connections.reduce((sum, conn) => sum + (now - conn.createdAt.getTime()), 0) / connections.length
      : 0,
    totalReconnectAttempts: connections.reduce((sum, conn) => sum + conn.reconnectAttempts, 0),
    staleConnections: sseConnectionManager.findStaleConnections().filter(conn => conn.tenantId === tenantId).length,
  };
  
  return createSuccessResponse(ctx, {
    ...metrics,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get metrics history
 */
function getMetricsHistory(ctx: any, tenantId: string) {
  const history = sseConnectionManager.getMetricsHistory().map(entry => ({
    timestamp: entry.timestamp,
    metrics: {
      totalConnections: entry.metrics.connectionsByTenant?.[tenantId] || 0,
      connectionsByTenant: { [tenantId]: entry.metrics.connectionsByTenant?.[tenantId] || 0 },
    },
  }));
  
  return createSuccessResponse(ctx, {
    history,
    tenantId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get connections by tenant
 */
function getConnectionsByTenant(ctx: any, tenantId: string | null) {
  if (!tenantId) {
    return createErrorResponse(ctx, 'MISSING_PARAMETER', 'tenantId parameter is required', 400);
  }

  const connections = sseConnectionManager.getConnectionsByTenant(tenantId);
  
  return createSuccessResponse(ctx, {
    tenantId,
    count: connections.length,
    connections: connections.map(conn => ({
      id: conn.id,
      userId: conn.userId,
      state: conn.state,
      createdAt: conn.createdAt,
      lastActivity: conn.lastActivity,
      reconnectAttempts: conn.reconnectAttempts,
    })),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get connections by user
 */
function getConnectionsByUser(ctx: any, userId: string | null, tenantId: string) {
  if (!userId) {
    return createErrorResponse(ctx, 'MISSING_PARAMETER', 'userId parameter is required', 400);
  }

  const connections = sseConnectionManager.getConnectionsByUser(userId).filter(conn => conn.tenantId === tenantId);
  
  return createSuccessResponse(ctx, {
    userId,
    count: connections.length,
    connections: connections.map(conn => ({
      id: conn.id,
      tenantId: conn.tenantId,
      state: conn.state,
      createdAt: conn.createdAt,
      lastActivity: conn.lastActivity,
      reconnectAttempts: conn.reconnectAttempts,
    })),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get stale connections
 */
function getStaleConnections(ctx: any, tenantId: string) {
  const staleConnections = sseConnectionManager.findStaleConnections().filter(conn => conn.tenantId === tenantId);
  const timedOutConnections = sseConnectionManager.findTimedOutConnections().filter(conn => conn.tenantId === tenantId);
  
  return createSuccessResponse(ctx, {
    stale: {
      count: staleConnections.length,
      connections: staleConnections.map(conn => ({
        id: conn.id,
        tenantId: conn.tenantId,
        userId: conn.userId,
        state: conn.state,
        lastActivity: conn.lastActivity,
        inactiveDuration: Date.now() - conn.lastActivity.getTime(),
      })),
    },
    timedOut: {
      count: timedOutConnections.length,
      connections: timedOutConnections.map(conn => ({
        id: conn.id,
        tenantId: conn.tenantId,
        userId: conn.userId,
        state: conn.state,
        createdAt: conn.createdAt,
        connectionDuration: Date.now() - conn.createdAt.getTime(),
      })),
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Perform connection cleanup
 */
function performCleanup(ctx: any, tenantId: string) {
  const connectionsToCleanup = new Set([
    ...sseConnectionManager.findStaleConnections().filter(conn => conn.tenantId === tenantId).map(conn => conn.id),
    ...sseConnectionManager.findTimedOutConnections().filter(conn => conn.tenantId === tenantId).map(conn => conn.id),
  ]);

  let cleanedCount = 0;
  connectionsToCleanup.forEach(connectionId => {
    const connection = sseConnectionManager.getConnection(connectionId);
    if (!connection || connection.tenantId !== tenantId) {
      return;
    }

    try {
      connection.controller.close();
    } catch (_error) {
      // Controller might already be closed
    }

    if (sseConnectionManager.unregisterConnection(connectionId)) {
      cleanedCount++;
    }
  });
  
  return createSuccessResponse(ctx, {
    cleanedCount,
    message: `Cleaned up ${cleanedCount} stale/timed-out connections`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Disconnect a specific connection
 */
function disconnectConnection(ctx: any, connectionId: string, tenantId: string) {
  if (!connectionId) {
    return createErrorResponse(ctx, 'MISSING_PARAMETER', 'connectionId is required', 400);
  }

  const connection = sseConnectionManager.getConnection(connectionId);
  if (!connection || connection.tenantId !== tenantId) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Connection not found', 404);
  }

  try {
    connection.controller.close();
  } catch (_error) {
    // Controller might already be closed
  }

  const success = sseConnectionManager.unregisterConnection(connectionId);
  
  return createSuccessResponse(ctx, {
    connectionId,
    message: success ? 'Connection disconnected' : 'Failed to disconnect connection',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast message to connections
 */
function broadcastMessage(ctx: any, body: Record<string, unknown>, tenantId: string) {
  const { target, userId, message } = body as {
    target?: string;
    userId?: string;
    message?: unknown;
  };

  if (!message) {
    return createErrorResponse(ctx, 'MISSING_PARAMETER', 'message is required', 400);
  }

  const payload =
    typeof message === 'string'
      ? message
      : (() => {
          try {
            return JSON.stringify(message);
          } catch {
            return String(message);
          }
        })();

  let successCount = 0;

  const sendToConnections = (connections: Array<{ id: string; tenantId: string; controller: ReadableStreamDefaultController<Uint8Array> }>) => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(payload);
    let count = 0;

    connections.forEach(connection => {
      try {
        connection.controller.enqueue(encoded);
        sseConnectionManager.updateActivity(connection.id);
        count++;
      } catch {
        sseConnectionManager.updateConnectionState(connection.id, 'error');
      }
    });

    return count;
  };

  switch (target) {
    case 'all':
      successCount = sseConnectionManager.broadcastToTenant(tenantId, payload);
      break;
    
    case 'tenant':
      successCount = sseConnectionManager.broadcastToTenant(tenantId, payload);
      break;
    
    case 'user':
      if (!userId) {
        return createErrorResponse(ctx, 'MISSING_PARAMETER', 'userId is required for user broadcast', 400);
      }
      successCount = sendToConnections(
        sseConnectionManager
          .getConnectionsByUser(userId as string)
          .filter(connection => connection.tenantId === tenantId)
      );
      break;
    
    default:
      return createErrorResponse(ctx, 'INVALID_TARGET', 'Invalid broadcast target', 400);
  }

  return createSuccessResponse(ctx, {
    successCount,
    message: `Broadcast sent to ${successCount} connections`,
    timestamp: new Date().toISOString(),
  });
}
