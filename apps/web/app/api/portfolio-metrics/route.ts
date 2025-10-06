import { NextRequest, NextResponse } from 'next/server';
import { mockDatabase } from '@/lib/mock-database';

export async function GET(request: NextRequest) {
  try {
    const metrics = await mockDatabase.getPortfolioMetrics();

    return NextResponse.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching portfolio metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portfolio metrics' },
      { status: 500 }
    );
  }
}