import { NextRequest, NextResponse } from 'next/server'
import { crossContractIntelligenceService } from '@/packages/data-orchestration/src/services/rag/cross-contract-intelligence.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    }

    const risks = await crossContractIntelligenceService.correlateRisks(tenantId)

    return NextResponse.json({ risks })
  } catch (error) {
    console.error('Risk correlation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Risk correlation failed' },
      { status: 500 }
    )
  }
}
