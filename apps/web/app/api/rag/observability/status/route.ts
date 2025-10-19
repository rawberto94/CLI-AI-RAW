import { NextRequest, NextResponse } from 'next/server'
import { unifiedRAGOrchestrator } from '@/packages/data-orchestration/src/services/rag/unified-rag-orchestrator.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    }

    const status = await unifiedRAGOrchestrator.getSystemStatus(tenantId)

    return NextResponse.json(status)
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
