import { NextRequest, NextResponse } from 'next/server';
import { negotiationScenarioService } from '@/packages/data-orchestration/src/services/negotiation-scenario.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const volume = searchParams.get('volume');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
    }

    const scenarios = await negotiationScenarioService.generateScenarios(
      params.id,
      tenantId,
      volume ? parseInt(volume) : undefined
    );

    return NextResponse.json(scenarios);
  } catch (error: any) {
    console.error('Error generating scenarios:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate scenarios' },
      { status: 500 }
    );
  }
}
