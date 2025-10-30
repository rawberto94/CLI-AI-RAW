import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AIInsightsGeneratorService } from '@/packages/data-orchestration/src/services/ai-insights-generator.service';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
