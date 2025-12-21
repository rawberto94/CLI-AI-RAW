/**
 * Connection Management API
 * Provides endpoints for monitoring and managing SSE connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { sseConnectionManager } from 'data-orchestration/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/connections
 * Get connection metrics and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'metrics':
        return getMetrics();
      
      case 'history':
        return getMetricsHistory();
      
      case 'tenant':
        return getConnectionsByTenant(searchParams.get('tenantId'));
      
      case 'user':
        return getConnectionsByUser(searchParams.get('userId'));
      
      case 'stale':
        return getStaleConnections();
      
      case 'degradation':
        return getDegradationStatus();
      
      case 'queue':
        return getQueueStatus();
      
      default:
        return getMetrics();
    }
  } catch (error) {
    console.error('[Connections API] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get connection data',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections
 * Perform connection management actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, connectionId, tenantId, userId } = body;

    switch (action) {
      case 'cleanup':
        return performCleanup();
      
      case 'disconnect':
        return disconnectConnection(connectionId);
      
      case 'broadcast':
        return broadcastMessage(body);
      
      default:
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_ACTION',
              message: 'Invalid action specified',
            },
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Connections API] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to perform action',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Get connection metrics
 */
function getMetrics() {
  const metrics = sseConnectionManager.getMetrics();
  
  return NextResponse.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get metrics history
 */
function getMetricsHistory() {
  const history = sseConnectionManager.getMetricsHistory();
  
  return NextResponse.json({
    success: true,
    data: history,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get connections by tenant
 */
function getConnectionsByTenant(tenantId: string | null) {
  if (!tenantId) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_PARAMETER',
          message: 'tenantId parameter is required',
        },
      },
      { status: 400 }
    );
  }

  const connections = sseConnectionManager.getConnectionsByTenant(tenantId);
  
  return NextResponse.json({
    success: true,
    data: {
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
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get connections by user
 */
function getConnectionsByUser(userId: string | null) {
  if (!userId) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_PARAMETER',
          message: 'userId parameter is required',
        },
      },
      { status: 400 }
    );
  }

  const connections = sseConnectionManager.getConnectionsByUser(userId);
  
  return NextResponse.json({
    success: true,
    data: {
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
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get stale connections
 */
function getStaleConnections() {
  const staleConnections = sseConnectionManager.findStaleConnections();
  const timedOutConnections = sseConnectionManager.findTimedOutConnections();
  
  return NextResponse.json({
    success: true,
    data: {
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
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Perform connection cleanup
 */
function performCleanup() {
  const cleanedCount = sseConnectionManager.cleanupConnections();
  
  return NextResponse.json({
    success: true,
    data: {
      cleanedCount,
      message: `Cleaned up ${cleanedCount} stale/timed-out connections`,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Disconnect a specific connection
 */
function disconnectConnection(connectionId: string) {
  if (!connectionId) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_PARAMETER',
          message: 'connectionId is required',
        },
      },
      { status: 400 }
    );
  }

  const connection = sseConnectionManager.getConnection(connectionId);
  if (!connection) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Connection not found',
        },
      },
      { status: 404 }
    );
  }

  try {
    connection.controller.close();
  } catch (error) {
    // Controller might already be closed
  }

  const success = sseConnectionManager.unregisterConnection(connectionId);
  
  return NextResponse.json({
    success,
    data: {
      connectionId,
      message: success ? 'Connection disconnected' : 'Failed to disconnect connection',
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get degradation status
 */
function getDegradationStatus() {
  const status = sseConnectionManager.getDegradationStatus();
  
  return NextResponse.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get queue status
 */
function getQueueStatus() {
  const status = sseConnectionManager.getQueueStatus();
  
  return NextResponse.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast message to connections
 */
function broadcastMessage(body: Record<string, unknown>) {
  const { target, tenantId, userId, message } = body as {
    target?: string;
    tenantId?: string;
    userId?: string;
    message?: unknown;
  };

  if (!message) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_PARAMETER',
          message: 'message is required',
        },
      },
      { status: 400 }
    );
  }

  let successCount = 0;

  switch (target) {
    case 'all':
      successCount = sseConnectionManager.broadcast(message);
      break;
    
    case 'tenant':
      if (!tenantId) {
        return NextResponse.json(
          {
            error: {
              code: 'MISSING_PARAMETER',
              message: 'tenantId is required for tenant broadcast',
            },
          },
          { status: 400 }
        );
      }
      successCount = sseConnectionManager.broadcastToTenant(tenantId as string, message);
      break;
    
    case 'user':
      if (!userId) {
        return NextResponse.json(
          {
            error: {
              code: 'MISSING_PARAMETER',
              message: 'userId is required for user broadcast',
            },
          },
          { status: 400 }
        );
      }
      successCount = sseConnectionManager.broadcastToUser(userId as string, message);
      break;
    
    default:
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TARGET',
            message: 'Invalid broadcast target',
          },
        },
        { status: 400 }
      );
  }

  return NextResponse.json({
    success: true,
    data: {
      successCount,
      message: `Broadcast sent to ${successCount} connections`,
    },
    timestamp: new Date().toISOString(),
  });
}
