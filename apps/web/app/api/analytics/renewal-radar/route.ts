import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '../../../../../packages/data-orchestration/src/services/analytical-intelligence.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const contractId = searchParams.get('contractId');
    const tenantId = searchParams.get('tenantId') || 'default';

    const renewalEngine = analyticalIntelligenceService.getRenewalEngine();

    switch (action) {
      case 'extract':
        if (!contractId) {
          return NextResponse.json({ error: 'Contract ID required' }, { status: 400 });
        }
        const renewalData = await renewalEngine.extractRenewalData(contractId);
        return NextResponse.json(renewalData);

      case 'calendar':
        const filters = {
          tenantId,
          supplierId: searchParams.get('supplierId') || undefined,
          category: searchParams.get('category') || undefined,
          riskLevel: searchParams.get('riskLevel') as any || undefined,
          daysUntilExpiry: searchParams.get('daysUntilExpiry') ? parseInt(searchParams.get('daysUntilExpiry')!) : undefined
        };
        const calendar = await renewalEngine.generateRenewalCalendar(filters);
        return NextResponse.json(calendar);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Renewal radar API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, renewalData } = body;

    const renewalEngine = analyticalIntelligenceService.getRenewalEngine();

    switch (action) {
      case 'schedule-alerts':
        if (!renewalData) {
          return NextResponse.json({ error: 'Renewal data required' }, { status: 400 });
        }
        await renewalEngine.scheduleAlerts(renewalData);
        return NextResponse.json({ success: true });

      case 'trigger-rfx':
        if (!contractId) {
          return NextResponse.json({ error: 'Contract ID required' }, { status: 400 });
        }
        const rfxEvent = await renewalEngine.triggerRfxGeneration(contractId);
        return NextResponse.json(rfxEvent);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Renewal radar API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}