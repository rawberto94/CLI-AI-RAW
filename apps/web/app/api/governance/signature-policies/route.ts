import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Signature Policy API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const policies = await prisma.signaturePolicy.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return createSuccessResponse(ctx, { policies });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch signature policies', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const policy = await prisma.signaturePolicy.create({
      data: {
        tenantId: ctx.tenantId,
        name: body.name,
        description: body.description || null,
        contractTypes: body.contractTypes || [],
        minValue: body.minValue || null,
        maxValue: body.maxValue || null,
        currency: body.currency || 'USD',
        requiredSignatories: body.requiredSignatories || [],
        signingOrder: body.signingOrder || 'SEQUENTIAL',
        requiresWetSignature: body.requiresWetSignature ?? false,
        requiresNotarization: body.requiresNotarization ?? false,
        provider: body.provider || 'DOCUSIGN',
        isActive: body.isActive ?? true,
        createdBy: ctx.userId,
      },
    });
    return createSuccessResponse(ctx, { policy }, { status: 201 });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create signature policy', 500);
  }
});
