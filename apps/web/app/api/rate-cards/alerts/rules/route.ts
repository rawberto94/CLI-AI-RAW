import { NextRequest, NextResponse } from 'next/server';
import { AlertManagementService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/security/tenant';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

const alertManagementService = new AlertManagementService(prisma);

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const body = await request.json();
    const { userId, rule } = body;

    if (!userId || !rule) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    const alertRule = await alertManagementService.createAlertRule({
      ...rule,
      tenantId,
      userId,
    });

    return createSuccessResponse(ctx, alertRule);
  });

export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    const userId = searchParams.get('userId');

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const rules = await alertManagementService.getAlerts(
      tenantId,
      userId || undefined,
      { limit: 100 }
    );

    return createSuccessResponse(ctx, rules);
  });
