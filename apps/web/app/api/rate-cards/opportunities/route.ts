import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SavingsOpportunityService } from 'data-orchestration/services';

const prisma = new PrismaClient();

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
      where.annualSavings = { gte: parseFloat(minSavings) };
    }

    const opportunities = await prisma.rateSavingsOpportunity.findMany({
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
    });

    // Calculate summary statistics
    const summary = {
      totalOpportunities: opportunities.length,
      totalSavings: opportunities.reduce(
        (sum, opp) => sum + parseFloat(opp.annualSavings.toString()),
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
        annualSavings: parseFloat(opp.annualSavings.toString()),
        savingsPercentage: parseFloat(opp.savingsPercentage.toString()),
        confidence: parseFloat(opp.confidence.toString()),
        actualSavings: opp.actualSavings ? parseFloat(opp.actualSavings.toString()) : null,
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
