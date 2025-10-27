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

    const talkingPoints = await negotiationService.getTalkingPoints(rateCardId);

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
