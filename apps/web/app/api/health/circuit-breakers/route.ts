/**
 * Circuit Breaker Metrics API (P3 #19)
 * 
 * GET /api/health/circuit-breakers
 * Returns the state of all registered circuit breakers for operational visibility.
 */

import { NextRequest } from 'next/server';
import { getAllCircuitStats } from '@/lib/scalability/circuit-breaker';
import { getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const ctx = getApiContext(_request);
  try {
    const stats = getAllCircuitStats();
    
    // Summarize health
    const entries = Object.entries(stats);
    const openCount = entries.filter(([, s]) => s.state === 'OPEN').length;
    const halfOpenCount = entries.filter(([, s]) => s.state === 'HALF_OPEN').length;
    const closedCount = entries.filter(([, s]) => s.state === 'CLOSED').length;
    
    const overallHealth = openCount > 0 ? 'degraded' : halfOpenCount > 0 ? 'recovering' : 'healthy';

    return createSuccessResponse(ctx, {
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
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to retrieve circuit breaker metrics', 500, { details: (error as Error).message });
  }
}
