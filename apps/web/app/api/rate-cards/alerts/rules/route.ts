import { NextRequest, NextResponse } from 'next/server';
import { AlertManagementService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';

const alertManagementService = new AlertManagementService(prisma);

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

    const alertRule = await alertManagementService.createAlertRule({
      ...rule,
      tenantId,
      userId,
    });

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

    const rules = await alertManagementService.getAlerts(
      tenantId,
      userId || undefined,
      { limit: 100 }
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
