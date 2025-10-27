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

    const alternatives = await negotiationService.findAlternatives(rateCardId);

    return NextResponse.json({
      success: true,
      data: alternatives,
    });
  } catch (error: any) {
    console.error('Error finding alternative suppliers:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to find alternative suppliers',
      },
      { status: 500 }
    );
  }
}
