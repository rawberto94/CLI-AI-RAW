import { NextRequest, NextResponse } from 'next/server'
import { crossContractIntelligenceService } from '@/packages/data-orchestration/src/services/rag/cross-contract-intelligence.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenantId, metric, contractIds } = body

    if (!tenantId || !metric) {
      return NextResponse.json(
        { error: 'Missing tenantId or metric' },
        { status: 400 }
      )
    }

    const comparison = await crossContractIntelligenceService.compareContracts(
      tenantId,
      metric,
      contractIds
    )

    return NextResponse.json(comparison)
  } catch (error) {
    console.error('Comparison error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    )
  }
}
