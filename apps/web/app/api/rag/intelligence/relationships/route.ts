import { NextRequest, NextResponse } from 'next/server'
import { crossContractIntelligenceService } from '@/packages/data-orchestration/src/services/rag/cross-contract-intelligence.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contractId')
    const tenantId = searchParams.get('tenantId')

    if (!contractId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing contractId or tenantId' },
        { status: 400 }
      )
    }

    const relationships = await crossContractIntelligenceService.analyzeRelationships(
      contractId,
      tenantId
    )

    return NextResponse.json(relationships)
  } catch (error) {
    console.error('Relationship analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
