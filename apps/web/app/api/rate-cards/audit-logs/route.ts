import { NextRequest, NextResponse } from 'next/server';
import { complianceReportingService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId') || undefined;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

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

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
