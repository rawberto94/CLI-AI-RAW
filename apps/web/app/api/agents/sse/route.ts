/**
 * Agent SSE (Server-Sent Events) Endpoint for Real-Time HITL Notifications
 * 
 * Provides a streaming connection for the frontend to receive instant updates about:
 * - New goals requiring approval (approval_required)
 * - Goal status changes (goal_updated)
 * - Goal completion/failure events (goal_completed, goal_failed)
 * 
 * Usage from frontend:
 *   const es = new EventSource('/api/agents/sse');
 *   es.addEventListener('approval_required', (e) => { ... });
 *   es.addEventListener('goal_updated', (e) => { ... });
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// =============================================================================
// In-memory subscriber tracking
// =============================================================================

const MAX_SUBSCRIBERS = 1000; // M5: prevent memory exhaustion

interface SSESubscriber {
  tenantId: string;
  controller: ReadableStreamDefaultController;
  lastEventId: number;
  connectedAt: Date;
}

const subscribers = new Map<string, SSESubscriber>();
let subscriberIdCounter = 0;

/**
 * Broadcast an SSE event to all subscribers for a given tenant.
 * Called from the goals API or orchestrator when HITL-relevant events occur.
 */
export function broadcastSSE(tenantId: string, event: string, data: Record<string, unknown>): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();

  for (const [id, sub] of subscribers) {
    if (sub.tenantId === tenantId) {
      try {
        sub.controller.enqueue(encoder.encode(payload));
      } catch {
        // Subscriber disconnected — clean up
        subscribers.delete(id);
      }
    }
  }
}

/**
 * Get current subscriber count for monitoring.
 */
export function getSSESubscriberCount(): number {
  return subscribers.size;
}

// =============================================================================
// GET - Open SSE connection
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  // C1: Defense-in-depth auth — require x-user-id header (injected by edge middleware)
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tenantId = request.headers.get('x-tenant-id') || 'demo';

  // M5: Rate limit — reject if at capacity
  if (subscribers.size >= MAX_SUBSCRIBERS) {
    return new Response(JSON.stringify({ error: 'Too many active connections' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const subscriberId = `sse-${++subscriberIdCounter}`;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Register subscriber
      subscribers.set(subscriberId, {
        tenantId,
        controller,
        lastEventId: 0,
        connectedAt: new Date(),
      });

      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ subscriberId, tenantId, timestamp: new Date().toISOString() })}\n\n`));

      // Heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`));
        } catch {
          clearInterval(heartbeat);
          subscribers.delete(subscriberId);
        }
      }, 30_000);

      // Send current pending approvals on connect (catch-up)
      sendPendingApprovals(tenantId, controller, encoder).catch(() => {});

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        subscribers.delete(subscriberId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    cancel() {
      subscribers.delete(subscriberId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Send current pending approval goals to a newly connected subscriber.
 */
async function sendPendingApprovals(
  tenantId: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  try {
    const pendingGoals = await prisma.agentGoal.findMany({
      where: {
        tenantId,
        status: 'AWAITING_APPROVAL',
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (pendingGoals.length > 0) {
      const payload = `event: pending_approvals\ndata: ${JSON.stringify({ goals: pendingGoals, count: pendingGoals.length })}\n\n`;
      controller.enqueue(encoder.encode(payload));
    }
  } catch {
    // DB unavailable — subscriber will get updates via polling fallback
  }
}
