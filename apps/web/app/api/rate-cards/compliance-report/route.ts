import { NextRequest, NextResponse } from 'next/server';
import { complianceReportingService } from 'data-orchestration/services';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, startDate, endDate, reportType, userId, includeDetails } = body;

    if (!tenantId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, startDate, endDate' },
        { status: 400 }
      );
    }

    const report = await complianceReportingService.generateComplianceReport({
      tenantId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reportType,
      userId,
      includeDetails,
    });

    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate compliance report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate' },
        { status: 400 }
      );
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

    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate compliance report' },
      { status: 500 }
    );
  }
}
