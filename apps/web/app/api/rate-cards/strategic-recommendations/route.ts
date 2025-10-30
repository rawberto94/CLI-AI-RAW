import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { StrategicRecommendationsService } from '@/packages/data-orchestration/src/services/strategic-recommendations.service';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Generate strategic recommendations
    const recommendationsService = new StrategicRecommendationsService(prisma);
    const recommendations = await recommendationsService.generateRecommendations(tenantId);

    // Also get portfolio analysis
    const portfolio = await recommendationsService.analyzePortfolio(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        portfolio,
      },
    });
  } catch (error: any) {
    console.error('Error generating strategic recommendations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate strategic recommendations',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
