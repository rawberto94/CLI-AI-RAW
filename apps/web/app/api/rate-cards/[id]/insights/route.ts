import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { AIInsightsGeneratorService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;

    // Get rate card entry
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id },
    });

    if (!rateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    // Generate AI insights
    const insightsService = new AIInsightsGeneratorService(prisma);
    const insights = await insightsService.generateBenchmarkInsights(id);

    return NextResponse.json({
      success: true,
      data: insights,
    });
  } catch (error: any) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate insights',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
