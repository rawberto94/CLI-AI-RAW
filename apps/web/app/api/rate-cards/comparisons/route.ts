import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/comparisons
 * List saved comparisons for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || 'default-tenant';
    const userId = searchParams.get('userId');

    const where: any = { tenantId };
    if (userId) {
      where.userId = userId;
    }

    const comparisons = await prisma.rateComparison.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        rateCardEntries: {
          include: {
            rateCardEntry: {
              select: {
                id: true,
                supplierName: true,
                roleStandardized: true,
                seniority: true,
                dailyRateUSD: true,
                country: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ comparisons });
  } catch (error) {
    console.error('Error fetching comparisons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comparisons', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rate-cards/comparisons
 * Save a new comparison
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, rateCardIds, comparisonType, tenantId, userId } = body;

    if (!name || !rateCardIds || rateCardIds.length < 2) {
      return NextResponse.json(
        { error: 'Name and at least 2 rate card IDs are required' },
        { status: 400 }
      );
    }

    // Create the comparison
    const comparison = await prisma.rateComparison.create({
      data: {
        tenantId: tenantId || 'default-tenant',
        userId: userId || 'system',
        name,
        description,
        comparisonType: comparisonType || 'CUSTOM',
        rateCardEntries: {
          create: rateCardIds.map((rateCardId: string, index: number) => ({
            rateCardEntryId: rateCardId,
            displayOrder: index,
          })),
        },
      },
      include: {
        rateCardEntries: {
          include: {
            rateCardEntry: true,
          },
        },
      },
    });

    return NextResponse.json({ comparison }, { status: 201 });
  } catch (error) {
    console.error('Error saving comparison:', error);
    return NextResponse.json(
      { error: 'Failed to save comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
