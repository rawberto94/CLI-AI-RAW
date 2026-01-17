/**
 * Metrics API Route
 * Prometheus-compatible metrics endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/metrics';

export async function GET(request: NextRequest) {
  try {
    const metrics = await getMetrics();
    
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
