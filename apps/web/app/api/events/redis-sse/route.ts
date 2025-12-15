/**
 * Server-Sent Events (SSE) Endpoint with Redis Pub/Sub
 * 
 * Streams real-time updates to connected clients by subscribing
 * to Redis events published by workers.
 */

import { NextRequest } from 'next/server';
import Redis from 'ioredis';

const CHANNEL_PREFIX = 'cli-ai:events';

// SSE connection tracking
interface SSEConnection {
  id: string;
  tenantId: string;
  userId?: string;
  controller: ReadableStreamDefaultController;
  createdAt: number;
  lastActivity: number;
}

const connections = new Map<string, SSEConnection>();

// Shared Redis subscriber for all SSE connections
let redisSubscriber: Redis | null = null;
let subscriberReady = false;

function getRedisUrl(): string {
  return process.env.REDIS_URL || 
    `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
}

async function ensureRedisSubscriber(): Promise<Redis> {
  if (redisSubscriber && subscriberReady) {
    return redisSubscriber;
  }

  try {
    redisSubscriber = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    await redisSubscriber.connect();
    await redisSubscriber.subscribe(CHANNEL_PREFIX);

    // Handle incoming messages and broadcast to SSE connections
    redisSubscriber.on('message', (channel, message) => {
      if (channel !== CHANNEL_PREFIX) return;

      try {
        const payload = JSON.parse(message);
        broadcastToConnections(payload);
      } catch (err) {
        console.error('[SSE] Failed to parse Redis message:', err);
      }
    });

    redisSubscriber.on('error', (err) => {
      console.error('[SSE] Redis subscriber error:', err);
      subscriberReady = false;
    });

    redisSubscriber.on('close', () => {
      console.log('[SSE] Redis subscriber closed');
      subscriberReady = false;
    });

    subscriberReady = true;
    console.log('[SSE] Redis subscriber connected');
    return redisSubscriber;
  } catch (err) {
    console.error('[SSE] Failed to connect Redis subscriber:', err);
    throw err;
  }
}

function broadcastToConnections(payload: {
  event: string;
  data: {
    contractId?: string;
    tenantId?: string;
    userId?: string;
    [key: string]: unknown;
  };
  timestamp: string;
  source?: string;
}): void {
  const encoder = new TextEncoder();
  const message = JSON.stringify({
    type: payload.event,
    data: payload.data,
    timestamp: payload.timestamp,
    source: payload.source,
  });

  connections.forEach((connection, id) => {
    try {
      // Filter by tenant
      if (payload.data.tenantId && payload.data.tenantId !== connection.tenantId) {
        return;
      }

      // Filter by user for user-specific events
      if (payload.data.userId && connection.userId && payload.data.userId !== connection.userId) {
        return;
      }

      connection.controller.enqueue(encoder.encode(`data: ${message}\n\n`));
      connection.lastActivity = Date.now();
    } catch (err) {
      console.error(`[SSE] Failed to send to connection ${id}:`, err);
      // Remove dead connection
      connections.delete(id);
    }
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantId = searchParams.get('tenantId') || 'demo';
  const userId = searchParams.get('userId') || undefined;

  // Ensure Redis subscriber is running
  try {
    await ensureRedisSubscriber();
  } catch (err) {
    console.warn('[SSE] Redis not available, falling back to local events only');
  }

  const stream = new ReadableStream({
    start(controller) {
      const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const encoder = new TextEncoder();

      // Register connection
      const connection: SSEConnection = {
        id: connectionId,
        tenantId,
        userId,
        controller,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      connections.set(connectionId, connection);
      
      console.log('[SSE] New connection:', connectionId, { tenantId, userId, total: connections.size });

      // Send connected message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'connected',
          connectionId,
          timestamp: new Date().toISOString(),
          redisConnected: subscriberReady,
        })}\n\n`)
      );

      // Keep-alive ping every 30 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          connection.lastActivity = Date.now();
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[SSE] Connection closed:', connectionId, { remaining: connections.size - 1 });
        clearInterval(keepAliveInterval);
        connections.delete(connectionId);
        
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Get SSE connection statistics
 */
export function getSSEStats() {
  return {
    totalConnections: connections.size,
    redisConnected: subscriberReady,
    connectionsByTenant: Array.from(connections.values()).reduce((acc, conn) => {
      acc[conn.tenantId] = (acc[conn.tenantId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}
