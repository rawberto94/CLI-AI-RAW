/**
 * Server-Sent Events API for Real-Time Artifact Progress
 * GET /api/contracts/[id]/progress
 */

import { NextRequest } from 'next/server'
import { progressTracker } from '@/lib/progress-tracker'
import { getAuthenticatedApiContextWithSessionFallback, getApiContext, createErrorResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getAuthenticatedApiContextWithSessionFallback(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const contractId = params.id;

  // Note: SSE handlers return Response (not NextResponse) so they keep the imperative
  // auth pattern, but now share the same session fallback as withContractSessionApiHandler.

  // Create SSE response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = JSON.stringify({
        type: 'connected',
        contractId,
        timestamp: new Date().toISOString()
      })
      controller.enqueue(encoder.encode(`data: ${data}\n\n`))

      // Subscribe to progress events
      const unsubscribe = progressTracker.subscribe(contractId, (event) => {
        try {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))

          // Close connection after completion or failure
          if (event.stage === 'completed' || event.stage === 'failed') {
            setTimeout(() => {
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
