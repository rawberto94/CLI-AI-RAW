/**
 * Agent SSE (Server-Sent Events) Endpoint
 * 
 * Provides real-time updates for:
 * - Agent activities
 * - New approvals
 * - Opportunity detection
 * - Chat messages
 * 
 * Usage: new EventSource('/api/agents/sse')
 */

import { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthenticatedApiContextWithSessionFallback } from '@/lib/api-middleware';

// Track connected clients
const clients = new Map<string, ReadableStreamDefaultController[]>();

/**
 * GET /api/agents/sse
 * 
 * Establish SSE connection for real-time updates
 */
export async function GET(req: NextRequest) {
  const ctx = await getAuthenticatedApiContextWithSessionFallback(req);
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  const clientId = `${tenantId}:${userId || 'anonymous'}:${Date.now()}`;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`));

      // Store controller for this client
      if (!clients.has(tenantId)) {
        clients.set(tenantId, []);
      }
      clients.get(tenantId)!.push(controller);

      // Send initial data burst
      sendInitialData(controller, tenantId);

      // Set up Redis subscription for this tenant
      setupRedisSubscription(tenantId);

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`));
        } catch {
          clearInterval(heartbeat);
          removeClient(tenantId, controller);
        }
      }, 30000);

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        removeClient(tenantId, controller);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST /api/agents/sse/broadcast
 * 
 * Broadcast event to all connected clients for a tenant
 * (Used by other API routes to trigger real-time updates)
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedApiContextWithSessionFallback(req);
    if (!ctx) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { event, data } = body;
    const tenantId = ctx.tenantId;

    if (!tenantId || !event) {
      return Response.json({ error: 'Missing tenantId or event' }, { status: 400 });
    }

    // Publish to Redis for cross-instance communication
    await redis.publish(`sse:${tenantId}`, JSON.stringify({ event, data, timestamp: Date.now() }));

    // Broadcast to local clients
    broadcastToTenant(tenantId, event, data);

    return Response.json({ success: true, clientsConnected: clients.get(tenantId)?.length || 0 });
  } catch (error) {
    logger.error('SSE broadcast error:', error);
    return Response.json({ error: 'Broadcast failed' }, { status: 500 });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function sendInitialData(controller: ReadableStreamDefaultController, tenantId: string) {
  const encoder = new TextEncoder();

  try {
    // Fetch recent activities
    const [activities, approvals, opportunities] = await Promise.all([
      prisma.agentEvent.findMany({
        where: { tenantId },
        orderBy: { timestamp: 'desc' },
        take: 5,
      }).catch(() => []),
      prisma.agentGoal.count({
        where: { tenantId, status: 'AWAITING_APPROVAL' },
      }).catch(() => 0),
      prisma.rFxOpportunity.count({
        where: { tenantId, status: 'IDENTIFIED' },
      }).catch(() => 0),
    ]);

    const initialData = {
      activities: activities || [],
      pendingApprovals: approvals || 0,
      newOpportunities: opportunities || 0,
      timestamp: new Date().toISOString(),
    };

    controller.enqueue(encoder.encode(`event: initial\ndata: ${JSON.stringify(initialData)}\n\n`));
  } catch (error) {
    logger.error('Error sending initial data:', error);
  }
}

function broadcastToTenant(tenantId: string, event: string, data: any) {
  const tenantClients = clients.get(tenantId);
  if (!tenantClients) return;

  const encoder = new TextEncoder();
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = encoder.encode(message);

  // Send to all connected clients for this tenant
  tenantClients.forEach(controller => {
    try {
      controller.enqueue(encoded);
    } catch (error) {
      // Client disconnected
      removeClient(tenantId, controller);
    }
  });
}

function removeClient(tenantId: string, controller: ReadableStreamDefaultController) {
  const tenantClients = clients.get(tenantId);
  if (tenantClients) {
    const index = tenantClients.indexOf(controller);
    if (index > -1) {
      tenantClients.splice(index, 1);
    }
    if (tenantClients.length === 0) {
      clients.delete(tenantId);
    }
  }
}

// Redis subscription for cross-instance communication
let redisSubscriber: any = null;
const subscribedTenants = new Set<string>();

async function setupRedisSubscription(tenantId: string) {
  if (subscribedTenants.has(tenantId)) return;
  subscribedTenants.add(tenantId);

  try {
    if (!redisSubscriber) {
      // Create a duplicate connection for subscribing (ioredis auto-connects)
      redisSubscriber = redis.duplicate();

      // ioredis delivers pub/sub messages via the 'message' event
      redisSubscriber.on('message', (channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message);
          if (!parsed || typeof parsed !== 'object') return;
          const { event, data } = parsed;
          // Extract tenantId from channel name (format: "sse:<tenantId>")
          const tid = channel.replace(/^sse:/, '');
          if (event) {
            broadcastToTenant(tid, event, data);
          }
        } catch (error) {
          logger.error('Error parsing Redis message:', error);
        }
      });
    }

    await redisSubscriber.subscribe(`sse:${tenantId}`);
  } catch (error) {
    logger.error('Redis subscription error:', error);
  }
}

// ============================================================================
// BROADCAST HELPERS (for use in other API routes)
// ============================================================================

export async function broadcastActivity(tenantId: string, activity: any) {
  try {
    await redis.publish(`sse:${tenantId}`, JSON.stringify({
      event: 'activity',
      data: activity,
    }));
  } catch (error) {
    logger.error('Broadcast error:', error);
  }
}

export async function broadcastApproval(tenantId: string, approval: any) {
  try {
    await redis.publish(`sse:${tenantId}`, JSON.stringify({
      event: 'approval',
      data: approval,
    }));
  } catch (error) {
    logger.error('Broadcast error:', error);
  }
}

export async function broadcastOpportunity(tenantId: string, opportunity: any) {
  try {
    await redis.publish(`sse:${tenantId}`, JSON.stringify({
      event: 'opportunity',
      data: opportunity,
    }));
  } catch (error) {
    logger.error('Broadcast error:', error);
  }
}

/**
 * Generic SSE broadcast function
 * Used by goals API and orchestrator for HITL events
 */
export async function broadcastSSE(tenantId: string, event: string, data: any) {
  try {
    if (tenantId === '*') {
      // Broadcast to all tenants - get all tenant keys and broadcast
      const tenantKeys = Array.from(clients.keys());
      await Promise.all(tenantKeys.map(tid => 
        redis.publish(`sse:${tid}`, JSON.stringify({ event, data }))
      ));
    } else {
      await redis.publish(`sse:${tenantId}`, JSON.stringify({ event, data }));
    }
  } catch (error) {
    logger.error('Broadcast SSE error:', error);
  }
}
