import { NextRequest, NextResponse } from 'next/server';
import { alertManagementService } from '@/packages/data-orchestration/src/services/alert-management.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, userId, rule } = body;

    if (!tenantId || !userId || !rule) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const alertRule = await alertManagementService.createAlertRule(
      tenantId,
      userId,
      rule
    );

    return NextResponse.json(alertRule);
  } catch (error: any) {
    console.error('Error creating alert rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create alert rule' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
    }

    const rules = await alertManagementService.getAlertRules(
      tenantId,
      userId || undefined
    );

    return NextResponse.json(rules);
  } catch (error: any) {
    console.error('Error fetching alert rules:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch alert rules' },
      { status: 500 }
    );
  }
}
