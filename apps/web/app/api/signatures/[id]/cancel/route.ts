import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// POST /api/signatures/[id]/cancel - Cancel a signature workflow
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const workflowId = ctx.params?.id as string;

  if (!workflowId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Signature request ID is required', 400);
  }

  // Look up the signature request
  const signatureRequest = await prisma.signatureRequest.findFirst({
    where: { id: workflowId, tenantId },
  });

  if (!signatureRequest) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Signature request not found', 404);
  }

  if (signatureRequest.status === 'completed') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Cannot cancel a completed signature request', 400);
  }

  if (signatureRequest.status === 'cancelled') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Signature request is already cancelled', 400);
  }

  // Cancel the signature request
  await prisma.signatureRequest.update({
    where: { id: signatureRequest.id },
    data: {
      status: 'cancelled',
      updatedAt: new Date(),
    },
  });

  // Publish realtime event
  try {
    void publishRealtimeEvent({
      event: 'signature:cancelled',
      data: {
        tenantId,
        signatureRequestId: workflowId,
        contractId: signatureRequest.contractId,
      },
      source: 'api:signatures:cancel',
    });
  } catch {
    // best-effort only
  }

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Signature request cancelled successfully',
    source: 'database',
  });
});
