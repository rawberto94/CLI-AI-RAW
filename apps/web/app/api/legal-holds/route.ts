import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Legal Holds API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const { prisma } = await import('@/lib/prisma');

    const where: any = { tenantId: ctx.tenantId };
    if (status) where.status = status;

    const holds = await prisma.legalHold.findMany({ where, orderBy: { issuedAt: 'desc' } });

    return createSuccessResponse(ctx, { holds });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch legal holds', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const hold = await prisma.legalHold.create({
      data: {
        tenantId: ctx.tenantId,
        name: body.name,
        description: body.description || null,
        matterId: body.matterId || null,
        holdType: body.holdType || 'LITIGATION',
        contractIds: body.contractIds || [],
        obligationIds: body.obligationIds || [],
        custodians: body.custodians || [],
        issuedBy: ctx.userId,
      },
    });

    return createSuccessResponse(ctx, { hold }, { status: 201 });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create legal hold', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    if (body.action === 'release') {
      const existing = await prisma.legalHold.findFirst({ where: { id: body.id, tenantId: ctx.tenantId } });
      if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Legal hold not found', 404);

      const hold = await prisma.legalHold.update({
        where: { id: body.id },
        data: {
          status: 'RELEASED',
          releasedBy: ctx.userId,
          releasedAt: new Date(),
          releaseReason: body.reason || '',
        },
      });
      return createSuccessResponse(ctx, { hold });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update legal hold', 500);
  }
});
