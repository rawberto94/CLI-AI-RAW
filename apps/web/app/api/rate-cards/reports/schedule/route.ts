import { NextRequest, NextResponse } from 'next/server';
import { automatedReportingService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { userId, schedule } = body;

    if (!userId || !schedule) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const scheduledReport = await automatedReportingService.scheduleReport(
      tenantId,
      userId,
      schedule
    );

    return NextResponse.json(scheduledReport);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to schedule report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const reports = await automatedReportingService.getScheduledReports(
      tenantId
    );

    return NextResponse.json(reports);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch scheduled reports' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, updates } = body;

    if (!reportId || !updates) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const updatedReport = await automatedReportingService.updateScheduledReport(
      reportId,
      updates
    );

    return NextResponse.json(updatedReport);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update scheduled report' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json(
        { error: 'Missing reportId' },
        { status: 400 }
      );
    }

    await automatedReportingService.deleteScheduledReport(reportId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}
