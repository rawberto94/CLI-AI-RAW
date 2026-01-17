/**
 * Real-Time Benchmark Status API
 * GET /api/rate-cards/real-time/status
 * 
 * Returns the current status of real-time benchmark calculations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { realTimeBenchmarkService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rateCardEntryId = searchParams.get('rateCardEntryId');

    if (!rateCardEntryId) {
      return NextResponse.json(
        { error: 'rateCardEntryId is required' },
        { status: 400 }
      );
    }

    // Initialize service
    const realTimeService = new realTimeBenchmarkService(prisma);

    // Get calculation status
    const status = realTimeService.getCalculationStatus(rateCardEntryId);

    if (!status) {
      return NextResponse.json({
        rateCardEntryId,
        status: 'IDLE',
        message: 'No recent calculation activity',
      });
    }

    return NextResponse.json({
      rateCardEntryId: status.rateCardEntryId,
      status: status.status,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      durationMs: status.durationMs,
      error: status.error,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch real-time status' },
      { status: 500 }
    );
  }
}
