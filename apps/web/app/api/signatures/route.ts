import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
import { eSignatureService } from '@/lib/esignature/docusign.service';
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
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

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
