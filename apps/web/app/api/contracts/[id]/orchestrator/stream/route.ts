import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/contracts/[id]/orchestrator/stream
 * 
 * Server-Sent Events endpoint for real-time orchestrator progress
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const contractId = params.id;
  const tenantId = await getApiTenantId(request);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let eventId = 0;
      let consecutiveErrors = 0;
      const MAX_ERRORS = 5;

      const sendEvent = (data: object) => {
        eventId++;
        controller.enqueue(
          encoder.encode(`id: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial connection
      sendEvent({
        type: 'connected',
        contractId,
        timestamp: new Date().toISOString(),
      });

      // Poll for updates
      const pollInterval = setInterval(async () => {
        try {
          const processingJob = await prisma.processingJob.findFirst({
            where: { tenantId, contractId },
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              checkpointData: true,
              updatedAt: true,
            },
          });

          if (!processingJob) {
            sendEvent({
              type: 'error',
              message: 'No processing job found',
            });
            clearInterval(pollInterval);
            controller.close();
            return;
          }

          const checkpoint = (processingJob.checkpointData ?? {}) as any;
          const agent = checkpoint.agent ?? null;
          const steps = checkpoint.steps ?? {};
          const plan = checkpoint.plan ?? null;

          // Get artifacts count
          const artifactsCount = await prisma.artifact.count({
            where: { contractId, tenantId, validationStatus: 'valid' },
          });

          const progress = {
            contractId,
            tenantId,
            status: agent?.done ? 'completed' : 'running',
            iteration: agent?.iteration ?? 0,
            maxIterations: 20,
            plan,
            steps,
            agent,
            artifacts: {
              completed: artifactsCount,
            },
            lastUpdated: processingJob.updatedAt?.toISOString(),
          };

          sendEvent({
            type: 'progress',
            progress,
          });

          // Check if done
          if (agent?.done || processingJob.status === 'COMPLETED') {
            sendEvent({
              type: 'complete',
              progress,
            });
            clearInterval(pollInterval);
            setTimeout(() => controller.close(), 1000);
          }

          consecutiveErrors = 0; // Reset on success
        } catch {
          consecutiveErrors++;

          if (consecutiveErrors >= MAX_ERRORS) {
            sendEvent({
              type: 'error',
              message: 'Too many errors, closing connection',
            });
            clearInterval(pollInterval);
            controller.close();
          }
        }
      }, 2000);

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15000);

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeat);
        controller.close();
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        clearInterval(heartbeat);
        sendEvent({ type: 'timeout' });
        controller.close();
      }, 300000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
