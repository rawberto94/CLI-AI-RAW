import { NextRequest } from 'next/server'
import { advancedRAGService } from '@/packages/data-orchestration/src/services/rag/advanced-rag.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, userId, tenantId, conversationId, context } = body

    if (!query || !userId || !tenantId) {
      return new Response('Missing required fields', { status: 400 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamGenerator = advancedRAGService.streamChat(
            conversationId || `conv:${Date.now()}`,
            query,
            userId,
            tenantId,
            context
          )

          for await (const chunk of streamGenerator) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`
            controller.enqueue(encoder.encode(data))
          }

          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Stream error:', error)
    return new Response('Stream failed', { status: 500 })
  }
}
