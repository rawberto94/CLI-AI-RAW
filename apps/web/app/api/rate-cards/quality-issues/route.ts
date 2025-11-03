import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { DataQualityScorerService } from 'data-orchestration/services';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const qualityService = new DataQualityScorerService(prisma);
    const report = await qualityService.generateQualityReport(tenantId);

    // Filter by score if provided
    let lowQualityRateCards = report.lowQualityRateCards;
    if (minScore || maxScore) {
      lowQualityRateCards = lowQualityRateCards.filter(rc => {
        if (minScore && rc.score < parseFloat(minScore)) return false;
        if (maxScore && rc.score > parseFloat(maxScore)) return false;
        return true;
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        lowQualityRateCards,
      },
    });
  } catch (error: any) {
    console.error('Error fetching quality issues:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch quality issues',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
