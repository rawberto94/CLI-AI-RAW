/**
 * Rate Card Benchmarking API
 * Endpoints for calculating benchmarks, market intelligence, and savings opportunities
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/security/tenant';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { getErrorMessage } from '@/lib/types/common';

const benchmarkingEngine = new rateCardBenchmarkingService(prisma);

/**
 * POST /api/benchmarking/calculate/:rateCardId
 * Calculate benchmark for a specific rate card
 */
export async function POST(request: NextRequest, props: { params: Promise<{ rateCardId: string }> }) {
  const params = await props.params;
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const { rateCardId } = params;

    // Verify rate card belongs to tenant before calculating
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId, tenantId },
    });

    if (!rateCard) {
      return NextResponse.json({ error: 'Rate card not found' }, { status: 404 });
    }

    const result = await benchmarkingEngine.calculateBenchmark(rateCardId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
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
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const { rateCardId } = params;

    // Tenant-isolated query
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId, tenantId },
      include: {
        benchmarkSnapshots: {
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

    const benchmark = rateCard.benchmarkSnapshots[0];

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
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
