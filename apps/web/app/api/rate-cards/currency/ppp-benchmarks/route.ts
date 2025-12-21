import { NextRequest, NextResponse } from 'next/server';
import { PPPAdjustmentService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';

const pppAdjustmentService = new PPPAdjustmentService();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = await getApiTenantId(request);
    const roleStandardized = searchParams.get('role');
    const seniority = searchParams.get('seniority');
    const targetCountry = searchParams.get('targetCountry') || 'USA';

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    if (!roleStandardized || !seniority) {
      return NextResponse.json(
        { error: 'Missing required parameters: role, seniority' },
        { status: 400 }
      );
    }

    const benchmarks = await pppAdjustmentService.calculatePPPAdjustedBenchmarks(
      tenantId,
      roleStandardized,
      seniority,
      targetCountry
    );

    return NextResponse.json({
      ...benchmarks,
      targetCountry,
      message: 'PPP-adjusted benchmarks calculated successfully',
    });
  } catch (error: unknown) {
    console.error('Error calculating PPP-adjusted benchmarks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate PPP-adjusted benchmarks' },
      { status: 500 }
    );
  }
}
