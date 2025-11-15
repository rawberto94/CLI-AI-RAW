import { NextRequest, NextResponse } from 'next/server';
import { PPPAdjustmentService } from 'data-orchestration/services';

const pppAdjustmentService = new PPPAdjustmentService();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const roleStandardized = searchParams.get('role');
    const seniority = searchParams.get('seniority');
    const targetCountry = searchParams.get('targetCountry') || 'USA';

    if (!tenantId || !roleStandardized || !seniority) {
      return NextResponse.json(
        { error: 'Missing required parameters: tenantId, role, seniority' },
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
  } catch (error: any) {
    console.error('Error calculating PPP-adjusted benchmarks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate PPP-adjusted benchmarks' },
      { status: 500 }
    );
  }
}
