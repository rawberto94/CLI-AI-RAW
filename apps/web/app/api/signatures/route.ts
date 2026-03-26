import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
import { eSignatureService } from '@/lib/esignature/docusign.service';
import { sendEmail } from '@/lib/email-service';
// Types
interface Signer {
  id?: string;
  name: string;
  email: string;
  role: 'signer' | 'approver' | 'viewer';
  order: number;
  status?: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signedAt?: string;
}

interface CreateSignatureRequest {
  contractId: string;
  signers: Signer[];
  message?: string;
  expiresAt?: string;
  expiresInDays?: number;
  provider?: 'docusign' | 'adobe_sign' | 'hellosign' | 'manual';
}

// GET /api/signatures - List signature requests
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const status = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10') || 10), 200);

  // Build filter
  const where: Record<string, unknown> = { tenantId };
  if (contractId) where.contractId = contractId;
  if (status) where.status = status;

  const [signatureRequests, total] = await Promise.all([
    prisma.signatureRequest.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            fileName: true,
            contractTitle: true,
            supplierName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.signatureRequest.count({ where }),
  ]);

  // Transform to include parsed signers
  const items = signatureRequests.map(sr => ({
    ...sr,
    signers: sr.signers as unknown as Signer[],
  }));

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    },
    source: 'database'
  });
});

// POST /api/signatures - Create signature request
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const body: CreateSignatureRequest = await request.json();
  const { contractId, signers, message, expiresAt, expiresInDays, provider = 'manual' } = body;

  // Validation
  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  if (!signers || signers.length === 0) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'At least one signer is required', 400);
  }

  // Validate signers have required fields
  for (const signer of signers) {
    if (!signer.name || !signer.email) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'All signers must have name and email', 400);
    }
  }

  // Calculate expiry
  const expiryDays = expiresInDays || (expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    : 14);

  // Use the e-signature service (DocuSign when configured, internal fallback)
  const result = await eSignatureService.createEnvelope({
    contractId,
    tenantId,
    userId,
    signers: signers.map((s, i) => ({
      name: s.name,
      email: s.email,
      role: s.role || 'signer',
      order: s.order ?? i + 1,
    })) as any,
    message,
    expiresInDays: expiryDays,
    provider: provider === 'hellosign' ? 'manual' : provider as 'docusign' | 'adobe_sign' | 'manual',
  });

  // Publish realtime event
  try {
    void publishRealtimeEvent({
      event: 'signature:created',
      data: {
        tenantId,
        contractId,
        signatureRequestId: result.envelopeId,
        provider: result.provider,
        externalEnvelopeId: result.externalEnvelopeId,
      },
      source: 'api:signatures',
    });
  } catch {
    // best-effort only
  }

  // Send email notifications to signers with signing links
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { contractTitle: true, originalName: true, fileName: true },
    });
    const contractTitle = contract?.contractTitle || contract?.originalName || contract?.fileName || 'Document';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';

    for (const signer of result.signers || []) {
      if (!signer.email || signer.role === 'cc') continue;

      const signingUrl = signer.signingUrl
        || `${baseUrl}/signatures/${result.envelopeId}/sign?token=${Buffer.from(
          JSON.stringify({ contractId, email: signer.email, exp: Date.now() + 14 * 86400000 })
        ).toString('base64url')}`;

      await sendEmail({
        to: signer.email,
        subject: `✍️ Signature requested: ${contractTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Signature Requested</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #1f2937;">Hi ${signer.name || 'there'},</p>
              <p style="color: #4b5563;">${message || 'You have been asked to sign the following document:'}</p>
              <div style="background: white; border-left: 4px solid #6366f1; padding: 16px; margin: 16px 0; border-radius: 4px;">
                <strong style="color: #1f2937;">${contractTitle}</strong>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${signingUrl}"
                   style="background: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                  Review &amp; Sign
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 13px; text-align: center;">
                This link expires in 14 days. If you have questions, please contact the sender.
              </p>
            </div>
            <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>ConTigo CLM Platform &middot; Secure e-Signature</p>
            </div>
          </div>
        `,
        text: `Signature Requested\n\nHi ${signer.name || 'there'},\n\n${message || 'You have been asked to sign a document.'}\n\nDocument: ${contractTitle}\n\nReview & Sign: ${signingUrl}\n\nThis link expires in 14 days.`,
      }).catch(() => { /* best effort */ });
    }
  } catch {
    // Email sending is best-effort — don't fail the request
  }

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      id: result.envelopeId,
      provider: result.provider,
      status: result.status,
      externalEnvelopeId: result.externalEnvelopeId,
      signers: result.signers,
      isDocuSignConfigured: eSignatureService.isDocuSignConfigured(),
    },
    message: result.provider === 'docusign'
      ? 'Signature request sent via DocuSign'
      : 'Signature request created — signing links sent to signers',
    source: 'database'
  }, { status: 201 });

});
