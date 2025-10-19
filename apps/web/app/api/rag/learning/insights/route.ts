import { NextRequest, NextResponse } from 'next/server'
import { unifiedRAGOrchestrator } from '@/packages/data-orchestration/src/services/rag/unified-rag-orchestrator.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    }

    const insights = await unifiedRAGOrchestrator.getLearningInsights(tenantId)

    return NextResponse.json(insights)
  } catch (error) {
    console.error('Learning insights error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get insights' },
      { status: 500 }
    )
  }
}
