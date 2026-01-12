import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationAssistantService } from 'data-orchestration/services';

const negotiationService = new negotiationAssistantService(prisma);

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const rateCardId = params.id;

    const targetRates = await negotiationService.suggestTargetRates(rateCardId);

    return NextResponse.json({
      success: true,
      data: targetRates,
    });
  } catch (error: unknown) {
    console.error('Error suggesting target rates:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suggest target rates',
      },
      { status: 500 }
    );
  }
}
