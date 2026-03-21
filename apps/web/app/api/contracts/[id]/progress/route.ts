/**
 * Server-Sent Events API for Real-Time Artifact Progress
 * GET /api/contracts/[id]/progress
 */

import { NextRequest } from 'next/server'
import { progressTracker } from '@/lib/progress-tracker'
import { auth } from '@/lib/auth';
import getDb from '@/lib/prisma';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const contractId = params.id;

  // Authenticate — reject unauthenticated access
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Tenant isolation — verify contract belongs to the user's tenant
  const tenantId = session.user.tenantId;
  if (tenantId) {
    const db = await getDb();
    const contract = await db.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true },
    });
    if (!contract) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Create SSE response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const data = JSON.stringify({
        type: 'connected',
        contractId,
        timestamp: new Date().toISOString()
      })
      controller.enqueue(encoder.encode(`data: ${data}\n\n`))

      // Subscribe to Redis-backed progress events
      const unsubscribe = await progressTracker.subscribe(contractId, (event) => {
        try {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))

          // Close connection after completion or failure
          if (event.stage === 'completed' || event.stage === 'failed') {
            setTimeout(() => {
              clearInterval(heartbeat)
              unsubscribe()
              controller.close()
            }, 1000)
          }
        } catch {
          // SSE send failed
        }
      })

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch (_error) {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    }
  })
}
