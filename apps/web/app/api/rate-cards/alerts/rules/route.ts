import { NextRequest } from 'next/server';
import { AlertManagementService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const alertManagementService = new AlertManagementService(prisma);

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const body = await request.json();
    const { rule } = body;

    if (!rule) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    const alertRule = await alertManagementService.createAlertRule({
      ...rule,
      tenantId,
      userId: ctx.userId,
    });

    return createSuccessResponse(ctx, alertRule);
  });

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const rules = await alertManagementService.getAlerts(
      tenantId,
      ctx.userId,
      { limit: 100 }
    );

    return createSuccessResponse(ctx, rules);
  });
