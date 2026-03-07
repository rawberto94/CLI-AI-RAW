import { NextRequest, NextResponse } from 'next/server';
import { complianceReportingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { tenantId, startDate, endDate, reportType, userId, includeDetails } = body;

    if (!tenantId || !startDate || !endDate) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields: tenantId, startDate, endDate', 400);
    }

    const report = await complianceReportingService.generateComplianceReport({
      tenantId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reportType,
      userId,
      includeDetails,
    });

    return createSuccessResponse(ctx, report);
  });

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    if (!startDate || !endDate) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required parameters: startDate, endDate', 400);
    }

    const report = await complianceReportingService.generateComplianceReport({
      tenantId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      includeDetails: true,
    });

    if (format === 'csv') {
      const csv = await complianceReportingService.exportToCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="compliance-report-${report.reportId}.csv"`,
        },
      });
    }

    return createSuccessResponse(ctx, report);
  });
