/**
 * Server-Sent Events (SSE) Endpoint with Redis Pub/Sub
 * 
 * Streams real-time updates to connected clients by subscribing
 * to Redis events published by workers.
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { withAuthApiHandler } from '@/lib/api-middleware';

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
let redisSubscriber: InstanceType<typeof Redis> | null = null;
let subscriberReady = false;

function getRedisUrl(): string {
  return process.env.REDIS_URL || 
    `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
}

async function ensureRedisSubscriber(): Promise<InstanceType<typeof Redis>> {
  if (redisSubscriber && subscriberReady) {
    return redisSubscriber;
  }

  try {
    redisSubscriber = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    await redisSubscriber.connect();
    await redisSubscriber.subscribe(CHANNEL_PREFIX);

    // Handle incoming messages and broadcast to SSE connections
    redisSubscriber.on('message', (channel: string, message: string) => {
      if (channel !== CHANNEL_PREFIX) return;

      try {
        const payload = JSON.parse(message);
        broadcastToConnections(payload);
      } catch {
        // Failed to parse Redis message - ignore invalid messages
      }
    });

    redisSubscriber.on('error', () => {
      subscriberReady = false;
    });

    redisSubscriber.on('close', () => {
      subscriberReady = false;
    });

    subscriberReady = true;
    return redisSubscriber;
  } catch (err) {
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
    } catch {
      // Remove dead connection
      connections.delete(id);
    }
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return new NextResponse('Tenant ID is required', { status: 400 });
  }

  const userId = ctx.userId || undefined;

  // Ensure Redis subscriber is running
  try {
    await ensureRedisSubscriber();
  } catch {
    // Redis not available, falling back to local events only
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

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

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
