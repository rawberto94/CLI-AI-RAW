import { NextRequest, NextResponse } from 'next/server'
import { unifiedRAGOrchestrator } from '@/packages/data-orchestration/src/services/rag/unified-rag-orchestrator.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, userId, tenantId, options } = body

    if (!query || !userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields: query, userId, tenantId' },
        { status: 400 }
      )
    }

    const result = await unifiedRAGOrchestrator.intelligentQuery(
      query,
      userId,
      tenantId,
      options
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Advanced query error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    )
  }
}
