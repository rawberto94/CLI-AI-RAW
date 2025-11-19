import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { SavingsOpportunityService } from 'data-orchestration/services';
import { withCache, CacheKeys } from '@/lib/cache';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || 'demo-tenant';
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const minSavings = searchParams.get('minSavings');
    const sortBy = searchParams.get('sortBy') || 'annualSavings';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const where: any = { tenantId };
    
    if (status) {
      where.status = status;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (minSavings) {
      where.annualSavingsPotential = { gte: parseFloat(minSavings) };
    }

    // Cache key based on filters
    const cacheKey = CacheKeys.rateCardOpportunities();
    const filters = { tenantId, status, category, minSavings, sortBy, sortOrder };
    const fullCacheKey = `${cacheKey}:${JSON.stringify(filters)}`;

    // Wrap expensive database query with caching (10 minutes)
    const opportunities = await withCache(
      fullCacheKey,
      async () => prisma.rateSavingsOpportunity.findMany({
        where,
        include: {
          rateCardEntry: {
            include: {
              supplier: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      { ttl: 600 } // Cache for 10 minutes
    );

    // Calculate summary statistics
    const summary = {
      totalOpportunities: opportunities.length,
      totalSavings: opportunities.reduce(
        (sum, opp) => sum + parseFloat(opp.annualSavingsPotential.toString()),
        0
      ),
      byStatus: opportunities.reduce((acc, opp) => {
        acc[opp.status] = (acc[opp.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: opportunities.reduce((acc, opp) => {
        acc[opp.category] = (acc[opp.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      success: true,
      opportunities: opportunities.map((opp) => ({
        ...opp,
        currentAnnualCost: parseFloat(opp.currentAnnualCost.toString()),
        projectedAnnualCost: parseFloat(opp.projectedAnnualCost.toString()),
        annualSavings: parseFloat(opp.annualSavingsPotential.toString()),
        savingsPercentage: parseFloat(opp.savingsPercentage.toString()),
        confidence: parseFloat(opp.confidence.toString()),
        actualSavings: (opp as any).actualSavings ? parseFloat((opp as any).actualSavings.toString()) : null,
      })),
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId = 'demo-tenant', options = {} } = body;

    const service = new SavingsOpportunityService(prisma);

    // Detect opportunities
    const detectedOpportunities = await service.detectOpportunities(
      tenantId,
      options
    );

    // Create opportunities in database
    await service.createOpportunities(detectedOpportunities);

    return NextResponse.json({
      success: true,
      message: `Detected ${detectedOpportunities.length} opportunities`,
      count: detectedOpportunities.length,
      opportunities: detectedOpportunities,
    });
  } catch (error: any) {
    console.error('Error detecting opportunities:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
