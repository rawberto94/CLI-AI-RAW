import { NextRequest, NextResponse } from 'next/server'
import { unifiedRAGOrchestrator } from '@/packages/data-orchestration/src/services/rag/unified-rag-orchestrator.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, query, response, rating, userId, tenantId } = body

    if (!conversationId || !query || !response || !rating || !userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await unifiedRAGOrchestrator.submitFeedback(
      conversationId,
      query,
      response,
      rating,
      userId,
      tenantId
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback submission error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Feedback submission failed' },
      { status: 500 }
    )
  }
}
