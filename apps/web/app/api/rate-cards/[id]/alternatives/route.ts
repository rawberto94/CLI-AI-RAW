import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NegotiationAssistantService } from 'data-orchestration/services';

const negotiationService = new NegotiationAssistantService(prisma);

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const rateCardId = params.id;

    const alternatives = await negotiationService.findAlternatives(rateCardId);

    return NextResponse.json({
      success: true,
      data: alternatives,
    });
  } catch (error: unknown) {
    console.error('Error finding alternative suppliers:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find alternative suppliers',
      },
      { status: 500 }
    );
  }
}
