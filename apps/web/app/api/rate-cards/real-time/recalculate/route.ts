/**
 * Real-Time Benchmark Recalculation API
 * POST /api/rate-cards/real-time/recalculate
 * 
 * Triggers manual recalculation of benchmarks for a rate card
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/security/tenant';
import { realTimeBenchmarkService } from 'data-orchestration/services';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { rateCardEntryId } = body;

    if (!rateCardEntryId) {
      return NextResponse.json(
        { error: 'rateCardEntryId is required' },
        { status: 400 }
      );
    }

    // Verify rate card exists with tenant isolation
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId, tenantId },
    });

    if (!rateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    // Initialize service
    const realTimeService = new realTimeBenchmarkService(prisma);

    // Trigger recalculation
    const result = await realTimeService.recalculateBenchmark(rateCardEntryId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Benchmark recalculated successfully',
        rateCardEntryId: result.rateCardEntryId,
        durationMs: result.durationMs,
        affectedCount: result.affectedCount,
        benchmark: result.benchmark,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Recalculation failed',
          rateCardEntryId: result.rateCardEntryId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error recalculating benchmark:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate benchmark' },
      { status: 500 }
    );
  }
}
