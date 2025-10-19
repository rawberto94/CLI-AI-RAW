import { NextRequest, NextResponse } from 'next/server'
import { crossContractIntelligenceService } from '@/packages/data-orchestration/src/services/rag/cross-contract-intelligence.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const patternType = searchParams.get('type') as 'clause' | 'term' | 'pricing' | 'risk'

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    }

    const patterns = await crossContractIntelligenceService.detectPatterns(
      tenantId,
      patternType || 'clause'
    )

    return NextResponse.json({ patterns })
  } catch (error) {
    console.error('Pattern detection error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pattern detection failed' },
      { status: 500 }
    )
  }
}
