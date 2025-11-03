import { NextRequest, NextResponse } from 'next/server';
import { negotiationScenarioService } from 'data-orchestration/services';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
