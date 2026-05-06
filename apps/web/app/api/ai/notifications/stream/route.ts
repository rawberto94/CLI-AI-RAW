/**
 * Agent Notifications SSE Stream
 * 
 * GET /api/ai/notifications/stream — Server-Sent Events for real-time agent notifications.
 * Uses `subscribeToNotifications()` instead of client polling.
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApiContextWithSessionFallback } from '@/lib/api-middleware';
import { subscribeToNotifications, type AgentNotification } from '@/lib/ai/agent-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const ctx = await getAuthenticatedApiContextWithSessionFallback(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId, userId } = ctx;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Subscribe to real-time notifications
      const unsubscribe = subscribeToNotifications(tenantId, userId, (notification: AgentNotification) => {
        try {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify(notification)}\n\n`
          ));
        } catch {
          // Stream closed
          unsubscribe();
        }
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30_000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
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
