import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/comparisons
 * List saved comparisons for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = searchParams.get('userId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

  const where: Record<string, unknown> = { tenantId };
    const comparisons = await prisma.rateComparison.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        targetRate: true,
      },
    });

    return NextResponse.json({ comparisons });
  } catch (error: unknown) {
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
    const { name, description, rateCardIds, comparisonType, userId } = body;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    if (!name || !rateCardIds || rateCardIds.length < 2) {
      return NextResponse.json(
        { error: 'Name and at least 2 rate card IDs are required' },
        { status: 400 }
      );
    }

    // Create the comparison
    const comparison = await prisma.rateComparison.create({
      data: {
        tenantId,
        comparisonName: name,
        comparisonType: comparisonType || 'CUSTOM',
        createdBy: userId || 'system',
        targetRateId: rateCardIds[0],
        comparisonRates: rateCardIds.slice(1),
        results: {},
        summary: description || '',
      },
      include: {
        targetRate: true,
      },
    });

    return NextResponse.json({ comparison }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to save comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
