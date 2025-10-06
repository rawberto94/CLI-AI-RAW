import { NextRequest, NextResponse } from 'next/server';
import { mockDatabase } from '@/lib/mock-database';

export async function GET(request: NextRequest) {
  try {
    const insights = await mockDatabase.getBusinessInsights();

    return NextResponse.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Error fetching business insights:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch business insights' },
      { status: 500 }
    );
  }
}