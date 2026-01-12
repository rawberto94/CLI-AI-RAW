import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { dataQualityScorerService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const qualityService = new dataQualityScorerService(prisma);
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
  } catch (error: unknown) {
    console.error('Error fetching quality issues:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch quality issues',
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
