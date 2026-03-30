import { NextRequest } from "next/server";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { prisma } = await import('@/lib/prisma');

  const templates = await prisma.reportTemplate.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return createSuccessResponse(ctx, { templates });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { prisma } = await import('@/lib/prisma');

  if (!body.name || !body.type) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'name and type are required', 400);
  }

  const template = await prisma.reportTemplate.create({
    data: {
      tenantId: ctx.tenantId!,
      name: body.name,
      type: body.type,
      fields: body.fields || [],
      filters: body.filters || {},
      createdBy: ctx.userId,
    },
  });

  return createSuccessResponse(ctx, { template }, { status: 201 });
});
