import { NextRequest, NextResponse } from 'next/server';
import { negotiationAssistantEnhancedService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const talkingPoints = await negotiationAssistantEnhancedService.generateEnhancedTalkingPoints(
      params.id,
      tenantId
    );

    return NextResponse.json({
      success: true,
      data: talkingPoints,
    });
  } catch (error: any) {
    console.error('Error generating talking points:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate talking points',
      },
      { status: 500 }
    );
  }
}
