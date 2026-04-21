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
      return getMetrics(ctx);

    case 'history':
      return getMetricsHistory(ctx);

    case 'tenant':
      return getConnectionsByTenant(ctx, tenantId);

    case 'user':
      return getConnectionsByUser(ctx, searchParams.get('userId'));

    case 'stale':
      return getStaleConnections(ctx);

    case 'degradation':
      return getDegradationStatus(ctx);

    case 'queue':
      return getQueueStatus(ctx);

    default:
      return getMetrics(ctx);
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
      return performCleanup(ctx);

    case 'disconnect':
      if (!connectionId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'connectionId is required for disconnect', 400);
      }
      return disconnectConnection(ctx, connectionId);

    case 'broadcast':
      return broadcastMessage(ctx, body);

    default:
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action specified', 400);
  }
});

/**
 * Get connection metrics
 */
function getMetrics(ctx: any) {
  const metrics = sseConnectionManager.getMetrics();
  
  return createSuccessResponse(ctx, {
    ...metrics,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get metrics history
 */
function getMetricsHistory(ctx: any) {
  const history = sseConnectionManager.getMetricsHistory();
  
  return createSuccessResponse(ctx, {
    ...history,
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
function getConnectionsByUser(ctx: any, userId: string | null) {
  if (!userId) {
    return createErrorResponse(ctx, 'MISSING_PARAMETER', 'userId parameter is required', 400);
  }

  const connections = sseConnectionManager.getConnectionsByUser(userId);
  
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
function getStaleConnections(ctx: any) {
  const staleConnections = sseConnectionManager.findStaleConnections();
  const timedOutConnections = sseConnectionManager.findTimedOutConnections();
  
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
function performCleanup(ctx: any) {
  const cleanedCount = sseConnectionManager.cleanupConnections();
  
  return createSuccessResponse(ctx, {
    cleanedCount,
    message: `Cleaned up ${cleanedCount} stale/timed-out connections`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Disconnect a specific connection
 */
function disconnectConnection(ctx: any, connectionId: string) {
  if (!connectionId) {
    return createErrorResponse(ctx, 'MISSING_PARAMETER', 'connectionId is required', 400);
  }

  const connection = sseConnectionManager.getConnection(connectionId);
  if (!connection) {
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
 * Get degradation status
 */
function getDegradationStatus(ctx: any) {
  const status = sseConnectionManager.getDegradationStatus();
  
  return createSuccessResponse(ctx, {
    ...status,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get queue status
 */
function getQueueStatus(ctx: any) {
  const status = sseConnectionManager.getQueueStatus();
  
  return createSuccessResponse(ctx, {
    ...status,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast message to connections
 */
function broadcastMessage(ctx: any, body: Record<string, unknown>) {
  const { target, tenantId, userId, message } = body as {
    target?: string;
    tenantId?: string;
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

  switch (target) {
    case 'all':
      successCount = sseConnectionManager.broadcast(payload);
      break;
    
    case 'tenant':
      if (!tenantId) {
        return createErrorResponse(ctx, 'MISSING_PARAMETER', 'tenantId is required for tenant broadcast', 400);
      }
      successCount = sseConnectionManager.broadcastToTenant(tenantId as string, payload);
      break;
    
    case 'user':
      if (!userId) {
        return createErrorResponse(ctx, 'MISSING_PARAMETER', 'userId is required for user broadcast', 400);
      }
      successCount = sseConnectionManager.broadcastToUser(userId as string, payload);
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
