import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || '30d';

    // TODO: Replace with actual database query
    // const metrics = await prisma.contract.aggregate({...});
    
    // Mock data for demonstration
    const mockMetrics = {
      totalContracts: timeframe === '7d' ? 198 : timeframe === '30d' ? 214 : timeframe === '90d' ? 245 : 289,
      activeContracts: timeframe === '7d' ? 134 : timeframe === '30d' ? 145 : timeframe === '90d' ? 167 : 198,
      totalValue: timeframe === '7d' ? 3.4 : timeframe === '30d' ? 3.8 : timeframe === '90d' ? 4.2 : 5.1,
      avgRiskScore: timeframe === '7d' ? 33 : timeframe === '30d' ? 31 : timeframe === '90d' ? 29 : 27,
      pendingApprovals: timeframe === '7d' ? 15 : timeframe === '30d' ? 18 : timeframe === '90d' ? 22 : 28,
      expiringThisMonth: timeframe === '7d' ? 8 : timeframe === '30d' ? 12 : timeframe === '90d' ? 18 : 24,
      trends: {
        contractsChange: timeframe === '7d' ? 8 : timeframe === '30d' ? 12 : timeframe === '90d' ? 15 : 18,
        valueChange: timeframe === '7d' ? 12 : timeframe === '30d' ? 18 : timeframe === '90d' ? 22 : 26,
        riskChange: timeframe === '7d' ? -5 : timeframe === '30d' ? -8 : timeframe === '90d' ? -12 : -15,
      },
    };

    return NextResponse.json({
      success: true,
      metrics: mockMetrics,
      timeframe,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
