import { NextRequest, NextResponse } from 'next/server';
import { negotiationScenarioService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    const volume = searchParams.get('volume');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const scenarios = await negotiationScenarioService.generateScenarios(
      params.id,
      tenantId,
      volume ? parseInt(volume) : undefined
    );

    return NextResponse.json(scenarios);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate scenarios' },
      { status: 500 }
    );
  }
}
