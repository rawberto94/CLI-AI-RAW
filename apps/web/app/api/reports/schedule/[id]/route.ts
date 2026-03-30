import { NextRequest } from "next/server";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params;
  const body = await request.json();
  const { prisma } = await import('@/lib/prisma');

  const existing = await prisma.scheduledReport.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
  }

  const schedule = await prisma.scheduledReport.update({
    where: { id },
    data: { enabled: body.enabled ?? existing.enabled },
  });

  return createSuccessResponse(ctx, {
    message: `Schedule ${schedule.enabled ? 'enabled' : 'disabled'}`,
    schedule,
  });
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params;
  const { prisma } = await import('@/lib/prisma');

  const existing = await prisma.scheduledReport.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Schedule not found', 404);
  }

  await prisma.scheduledReport.delete({ where: { id } });

  return createSuccessResponse(ctx, { message: 'Schedule deleted', id });
});
