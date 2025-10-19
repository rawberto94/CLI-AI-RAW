import { NextRequest, NextResponse } from 'next/server'
import { hybridRAGService } from '../../../../../../packages/data-orchestration/src/services/rag/hybrid-rag.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, tenantId, maxResults, filters } = body

    if (!query || !tenantId) {
      return NextResponse.json(
        { error: 'Query and tenantId are required' },
        { status: 400 }
      )
    }

    const results = await hybridRAGService.search(query, tenantId, {
      maxResults,
      filters
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('RAG search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
