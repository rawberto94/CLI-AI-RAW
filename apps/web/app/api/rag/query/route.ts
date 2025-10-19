import { NextRequest, NextResponse } from 'next/server'
import { hybridRAGService } from '../../../../../../packages/data-orchestration/src/services/rag/hybrid-rag.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, tenantId, contractId, filters, options } = body

    if (!query || !tenantId) {
      return NextResponse.json(
        { error: 'Query and tenantId are required' },
        { status: 400 }
      )
    }

    const response = await hybridRAGService.query({
      query,
      tenantId,
      contractId,
      filters,
      options
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('RAG query error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
