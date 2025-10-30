import { NextRequest, NextResponse } from 'next/server';
import { automatedReportingService } from '@/packages/data-orchestration/src/services/automated-reporting.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, userId, schedule } = body;

    if (!tenantId || !userId || !schedule) {
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
  } catch (error: any) {
    console.error('Error scheduling report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
    }

    const reports = await automatedReportingService.getScheduledReports(
      tenantId
    );

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error('Error fetching scheduled reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scheduled reports' },
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
  } catch (error: any) {
    console.error('Error updating scheduled report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update scheduled report' },
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
  } catch (error: any) {
    console.error('Error deleting scheduled report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}
