import { NextRequest, NextResponse } from 'next/server';
import { negotiationAssistantEnhancedService } from '@/packages/data-orchestration/src/services/negotiation-assistant-enhanced.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
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
