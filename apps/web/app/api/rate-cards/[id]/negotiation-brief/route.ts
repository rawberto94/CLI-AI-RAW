import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationAssistantService } from 'data-orchestration/services';

const negotiationService = new negotiationAssistantService(prisma);

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const rateCardId = params.id;

    // Generate comprehensive negotiation brief
    const brief = await negotiationService.generateNegotiationBrief(rateCardId);

    return NextResponse.json({
      success: true,
      data: brief,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate negotiation brief',
      },
      { status: 500 }
    );
  }
}
