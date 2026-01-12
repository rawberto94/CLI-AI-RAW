import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from '@/lib/security/tenant';
import { strategicRecommendationsService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Generate strategic recommendations
    const recommendationsService = new strategicRecommendationsService(prisma);
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
  } catch (error: unknown) {
    console.error('Error generating strategic recommendations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate strategic recommendations',
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
