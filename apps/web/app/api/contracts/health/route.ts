/**
 * Contract Health Score API
 * Calculate and retrieve health scores for contracts
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateContractHealth, calculatePortfolioHealth } from '@/lib/health/contract-health-score';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const tenantId = getApiTenantId(request);
    const type = searchParams.get('type') || 'contract';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    if (type === 'portfolio') {
      const health = await calculatePortfolioHealth(tenantId);
      return NextResponse.json(health);
    }

    if (!contractId) {
      return NextResponse.json(
        { error: 'contractId is required for contract health' },
        { status: 400 }
      );
    }

    const health = await calculateContractHealth(contractId);
    return NextResponse.json(health);
  } catch (error) {
    console.error('Health score error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Batch calculate health scores
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractIds, tenantId } = body;

    if (!contractIds || !Array.isArray(contractIds)) {
      return NextResponse.json(
        { error: 'contractIds array is required' },
        { status: 400 }
      );
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

    return NextResponse.json({
      processed: scores.length,
      successful: scores.filter(s => s.success).length,
      failed: scores.filter(s => !s.success).length,
      scores,
    });
  } catch (error) {
    console.error('Batch health score error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
