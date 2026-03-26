import { NextRequest } from 'next/server';
import { complianceReportingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId') || undefined;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100') || 100), 200);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    const result = await complianceReportingService.getAuditLogs({
      tenantId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userId,
      action,
      entityType,
      limit,
      offset,
    });

    return createSuccessResponse(ctx, result);
  });
