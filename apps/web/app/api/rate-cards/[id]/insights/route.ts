import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from '@/lib/security/tenant';
import { aiInsightsGeneratorService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const { id } = params;

    // Get rate card entry with tenant isolation
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id, tenantId },
    });

    if (!rateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    // Generate AI insights
    const insightsService = new aiInsightsGeneratorService(prisma);
    const insights = await insightsService.generateBenchmarkInsights(id);

    return NextResponse.json({
      success: true,
      data: insights,
    });
  } catch (error: unknown) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate insights',
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
