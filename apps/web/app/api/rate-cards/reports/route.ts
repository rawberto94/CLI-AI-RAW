import { NextRequest, NextResponse } from 'next/server';
import { automatedReportingService } from '@/packages/data-orchestration/src/services/automated-reporting.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, reportType, startDate, endDate, filters } = body;

    if (!tenantId || !reportType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
