import { NextRequest } from 'next/server';
import { getContractQueue } from '@/lib/queue/contract-queue';
import { v4 as uuidv4 } from 'uuid';
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/orchestrator/trigger
 * 
 * Manually trigger the agent orchestrator
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  const tenantId = ctx.tenantId;

  try {
    const queueManager = getContractQueue();
    const requestId = uuidv4();
    const traceId = uuidv4();

    // Enqueue orchestrator job
    const jobId = await queueManager.queueAgentOrchestration(
      {
        contractId,
        tenantId,
        traceId,
        requestId,
        iteration: 0,
      },
      {
        priority: 40,
      }
    );

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Orchestrator triggered successfully',
      jobId,
      traceId,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
})
