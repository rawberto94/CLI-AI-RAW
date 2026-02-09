/**
 * Contract Health Score API
 * Calculate and retrieve health scores for contracts
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateContractHealth, calculatePortfolioHealth } from '@/lib/health/contract-health-score';
import { getApiTenantId } from '@/lib/tenant-server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const tenantId = await getApiTenantId(request);
    const type = searchParams.get('type') || 'contract';
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    if (type === 'portfolio') {
      const health = await calculatePortfolioHealth(tenantId);
      return createSuccessResponse(ctx, health);
    }

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required for contract health', 400);
    }

    const health = await calculateContractHealth(contractId);
    return createSuccessResponse(ctx, health);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', (error as Error).message, 500);
  }
});

/**
 * Batch calculate health scores
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { contractIds, tenantId: _tenantId } = body;

    if (!contractIds || !Array.isArray(contractIds)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractIds array is required', 400);
    }

    const results = await Promise.allSettled(
      contractIds.slice(0, 50).map(id => calculateContractHealth(id))
    );

    const scores = results.map((result, index) => ({
      contractId: contractIds[index],
      success: result.status === 'fulfilled',
      ...(result.status === 'fulfilled' 
        ? { health: result.value } 
        : { error: result.reason?.message || 'Failed to calculate health' }
      ),
    }));

    return createSuccessResponse(ctx, {
      processed: scores.length,
      successful: scores.filter(s => s.success).length,
      failed: scores.filter(s => !s.success).length,
      scores,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', (error as Error).message, 500);
  }
});
