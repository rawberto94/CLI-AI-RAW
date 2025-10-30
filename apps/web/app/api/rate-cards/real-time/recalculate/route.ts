/**
 * Real-Time Benchmark Recalculation API
 * POST /api/rate-cards/real-time/recalculate
 * 
 * Triggers manual recalculation of benchmarks for a rate card
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { RealTimeBenchmarkService } from '@/../../packages/data-orchestration/src/services/real-time-benchmark.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rateCardEntryId } = body;

    if (!rateCardEntryId) {
      return NextResponse.json(
        { error: 'rateCardEntryId is required' },
        { status: 400 }
      );
    }

    // Verify rate card exists
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    // Initialize service
    const realTimeService = new RealTimeBenchmarkService(prisma);

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
