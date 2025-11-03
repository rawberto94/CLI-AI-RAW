/**
 * Rate Card Benchmarking API
 * Endpoints for calculating benchmarks, market intelligence, and savings opportunities
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardBenchmarkingEngine } from 'data-orchestration/services';

const benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);

/**
 * POST /api/benchmarking/calculate/:rateCardId
 * Calculate benchmark for a specific rate card
 */
export async function POST(request: NextRequest, props: { params: Promise<{ rateCardId: string }> }) {
  const params = await props.params;
  try {
    const { rateCardId } = params;

    const result = await benchmarkingEngine.calculateBenchmark(rateCardId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error calculating benchmark:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to calculate benchmark',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/benchmarking/calculate/:rateCardId
 * Get existing benchmark for a rate card
 */
export async function GET(request: NextRequest, props: { params: Promise<{ rateCardId: string }> }) {
  const params = await props.params;
  try {
    const { rateCardId } = params;

    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId },
      include: {
        benchmarkSnapshot: {
          take: 1,
          orderBy: { snapshotDate: 'desc' },
        },
      },
    });

    if (!rateCard) {
      return NextResponse.json(
        { success: false, error: 'Rate card not found' },
        { status: 404 }
      );
    }

    const benchmark = rateCard.benchmarkSnapshot[0];

    if (!benchmark) {
      // No benchmark exists, calculate one
      const result = await benchmarkingEngine.calculateBenchmark(rateCardId);
      return NextResponse.json({
        success: true,
        data: result,
        calculated: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        rateCard,
        benchmark,
      },
    });
  } catch (error: any) {
    console.error('Error getting benchmark:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get benchmark',
      },
      { status: 500 }
    );
  }
}
