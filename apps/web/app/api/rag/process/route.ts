import { NextRequest, NextResponse } from 'next/server'
import { hybridRAGService } from '../../../../../../packages/data-orchestration/src/services/rag/hybrid-rag.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contractId, tenantId, artifacts } = body

    if (!contractId || !tenantId || !artifacts) {
      return NextResponse.json(
        { error: 'contractId, tenantId, and artifacts are required' },
        { status: 400 }
      )
    }

    const result = await hybridRAGService.processContract(
      contractId,
      tenantId,
      artifacts
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('RAG processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
