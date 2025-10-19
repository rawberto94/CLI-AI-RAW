import { NextResponse } from 'next/server'
import { hybridRAGService } from '../../../../../../packages/data-orchestration/src/services/rag/hybrid-rag.service'

export async function GET() {
  try {
    const health = await hybridRAGService.healthCheck()
    return NextResponse.json(health)
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
