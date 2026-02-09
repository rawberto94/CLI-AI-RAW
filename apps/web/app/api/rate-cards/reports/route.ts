import { NextRequest, NextResponse } from 'next/server';
import { automatedReportingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { tenantId, reportType, startDate, endDate, filters } = body;

    if (!tenantId || !reportType) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields', 400);
    }

    let report;

    switch (reportType) {
      case 'executive':
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        report = await automatedReportingService.generateExecutiveSummary(
          tenantId,
          start,
          end
        );
        break;

      case 'detailed':
        report = await automatedReportingService.generateDetailedReport(
          tenantId,
          filters
        );
        break;

      case 'opportunities':
        report = await automatedReportingService.generateOpportunitiesReport(
          tenantId
        );
        break;

      case 'suppliers':
        report = await automatedReportingService.generateSupplierReport(
          tenantId
        );
        break;

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid report type', 400);
    }

    return createSuccessResponse(ctx, report);
  });
