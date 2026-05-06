import { NextRequest } from 'next/server';
import { automatedReportingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const body = await request.json();
    const { schedule } = body;

    if (!schedule) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    const scheduledReport = await automatedReportingService.scheduleReport(
      tenantId,
      ctx.userId,
      schedule
    );

    return createSuccessResponse(ctx, scheduledReport);
  });

export const GET = withAuthApiHandler(async (_request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const reports = await automatedReportingService.getScheduledReports(
      tenantId
    );

    return createSuccessResponse(ctx, reports);
  });

export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { reportId, updates } = body;

    if (!reportId || !updates) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    const updatedReport = await automatedReportingService.updateScheduledReport(
      reportId,
      updates
    );

    return createSuccessResponse(ctx, updatedReport);
  });

export const DELETE = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing reportId', 400);
    }

    await automatedReportingService.deleteScheduledReport(reportId);

    return createSuccessResponse(ctx, { success: true });
  });
