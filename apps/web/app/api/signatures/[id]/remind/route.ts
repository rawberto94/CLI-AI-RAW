import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { sendEmail } from '@/lib/email/email-service';
import { logger } from '@/lib/logger';

// POST /api/signatures/[id]/remind - Send reminder to signer
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const workflowId = (ctx as any).params?.id as string;

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

  // Send email reminder to the signer
  const signers = (signatureRequest.signers as Array<{ id?: string; email?: string; name?: string }>) || [];
  const targetSigners = signerId
    ? signers.filter(s => s.id === signerId || s.email === signerId)
    : signers;

  let emailsSent = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  const signUrl = `${baseUrl}/signatures/${workflowId}/sign`;

  for (const signer of targetSigners) {
    if (signer.email) {
      const sent = await sendEmail({
        to: signer.email,
        subject: `Reminder: Signature requested on "${signatureRequest.title || 'Document'}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Signature Reminder</h2>
            <p>Hi${signer.name ? ` ${signer.name}` : ''},</p>
            <p>${message || 'You have a pending signature request. Please review and sign the document at your earliest convenience.'}</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Review &amp; Sign
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">ConTigo CLM Platform</p>
          </div>
        `,
        text: `Signature Reminder\n\n${message || 'You have a pending signature request.'}\n\nReview and sign: ${signUrl}`,
      });
      if (sent) emailsSent++;
    }
  }

  logger.info(`[signatures/remind] Sent ${emailsSent} reminder(s) for request ${workflowId}`);

  return createSuccessResponse(ctx, {
    success: true,
    message: emailsSent > 0 ? `${emailsSent} reminder(s) sent successfully` : 'Reminder recorded (no email addresses found)',
    emailsSent,
    source: 'database',
  });
});
