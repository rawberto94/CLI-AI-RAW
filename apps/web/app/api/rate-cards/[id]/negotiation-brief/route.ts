import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NegotiationAssistantService } from '@/packages/data-orchestration/src/services/negotiation-assistant.service';

const negotiationService = new NegotiationAssistantService(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateCardId = params.id;

    // Generate comprehensive negotiation brief
    const brief = await negotiationService.generateNegotiationBrief(rateCardId);

    return NextResponse.json({
      success: true,
      data: brief,
    });
  } catch (error: any) {
    console.error('Error generating negotiation brief:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate negotiation brief',
      },
      { status: 500 }
    );
  }
}
