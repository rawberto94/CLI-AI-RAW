/**
 * Circuit Breaker Metrics API (P3 #19)
 * 
 * GET /api/health/circuit-breakers
 * Returns the state of all registered circuit breakers for operational visibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllCircuitStats } from '@/lib/scalability/circuit-breaker';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const stats = getAllCircuitStats();
    
    // Summarize health
    const entries = Object.entries(stats);
    const openCount = entries.filter(([, s]) => s.state === 'OPEN').length;
    const halfOpenCount = entries.filter(([, s]) => s.state === 'HALF_OPEN').length;
    const closedCount = entries.filter(([, s]) => s.state === 'CLOSED').length;
    
    const overallHealth = openCount > 0 ? 'degraded' : halfOpenCount > 0 ? 'recovering' : 'healthy';

    return NextResponse.json({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      summary: {
        total: entries.length,
        closed: closedCount,
        halfOpen: halfOpenCount,
        open: openCount,
      },
      breakers: stats,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to retrieve circuit breaker metrics',
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
