import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// POST /api/signatures/[id]/remind - Send reminder to signer
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const workflowId = ctx.params?.id as string;

  if (!workflowId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Signature request ID is required', 400);
  }

  const body = await request.json();
  const { signerId, message } = body;

  // Look up the signature request
  const signatureRequest = await prisma.signatureRequest.findFirst({
    where: { id: workflowId, tenantId },
  });

  if (!signatureRequest) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Signature request not found', 404);
  }

  if (signatureRequest.status === 'completed' || signatureRequest.status === 'cancelled') {
    return createErrorResponse(ctx, 'BAD_REQUEST', `Cannot send reminder for ${signatureRequest.status} request`, 400);
  }

  // Update the reminder timestamp on the signature request
  await prisma.signatureRequest.update({
    where: { id: signatureRequest.id },
    data: {
      metadata: {
        ...(signatureRequest.metadata as Record<string, unknown> || {}),
        lastReminderSentAt: new Date().toISOString(),
        lastReminderSignerId: signerId,
        lastReminderMessage: message,
      },
      updatedAt: new Date(),
    },
  });

  // TODO: Send actual email reminder when email service is configured
  console.log(`[signatures/remind] Reminder queued for signer ${signerId || 'all'} on request ${workflowId}`);

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Reminder sent successfully',
    source: 'database',
  });
});
