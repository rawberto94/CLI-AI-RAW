import { NextRequest, NextResponse } from 'next/server'

/**
 * Semantic Search API
 * POST /api/search/semantic
 * 
 * Performs semantic search across contract using RAG embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, contractId, tenantId = 'demo', k = 6 } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Semantic search: "${query}" in contract: ${contractId || 'all'}`)

    // Import RAG utilities
    const { retrieve } = await import('@/packages/clients/rag')

    let results: Array<{ text: string; score: number; chunkIndex: number }> = []

    if (contractId) {
      // Search in specific contract
      results = await retrieve(contractId, tenantId, query, k, {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small'
      })
    } else {
      // For cross-contract search, we'd need to implement a different approach
      // This is a placeholder for future implementation
      return NextResponse.json({
        error: 'Cross-contract search not yet implemented. Please specify a contractId.',
        hint: 'Use contractId parameter to search within a specific contract'
      }, { status: 400 })
    }

    console.log(`✅ Found ${results.length} relevant chunks`)

    return NextResponse.json({
      success: true,
      query,
      contractId,
      results: results.map(r => ({
        text: r.text,
        score: r.score,
        chunkIndex: r.chunkIndex,
        relevance: (r.score * 100).toFixed(1) + '%'
      })),
      count: results.length,
      model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small'
    })

  } catch (error) {
    console.error('Semantic search error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/search/semantic
 * 
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/search/semantic',
    method: 'POST',
    description: 'Performs semantic search across contract using RAG embeddings',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Natural language search query'
      },
      contractId: {
        type: 'string',
        required: true,
        description: 'Contract ID to search within'
      },
      tenantId: {
        type: 'string',
        required: false,
        default: 'demo',
        description: 'Tenant ID for multi-tenancy'
      },
      k: {
        type: 'number',
        required: false,
        default: 6,
        description: 'Number of results to return'
      }
    },
    example: {
      query: 'payment terms and conditions',
      contractId: 'cmh641ydq0001ep2ycwu7sr6f',
      tenantId: 'demo',
      k: 6
    }
  })
}
