import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service'
import { getServerTenantId } from '@/lib/tenant-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    const { id: contractId } = await params
    const body = await request.json().catch(() => ({}))
    const useSemanticChunking = body.semanticChunking !== false // Default to true

    const tenantId = await getServerTenantId()

    console.log(`🔍 RAG processing request for contract: ${contractId} (semantic: ${useSemanticChunking})`)

    // Get contract with text
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        rawText: true,
        fileName: true,
        tenantId: true,
        storagePath: true,
        mimeType: true,
      },
    })

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }

    if (!contract.rawText) {
      return NextResponse.json(
        { error: 'Contract has no text content. Upload and process the contract first.' },
        { status: 400 }
      )
    }

    console.log(`📄 Contract found: ${contract.fileName} (${contract.rawText.length} chars)`)

    let result: { chunksCreated: number; embeddingsGenerated: number }

    if (useSemanticChunking) {
      // Use new semantic chunking with advanced RAG
      result = await processContractWithSemanticChunking(
        contractId,
        contract.rawText,
        {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
        }
      )
    } else {
      // Legacy: use basic chunking from clients-rag
      const { chunkText, embedChunks } = await import('clients-rag')
      
      const chunks = chunkText(contract.rawText)
      console.log(`📦 Created ${chunks.length} text chunks (legacy)`)

      if (chunks.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No chunks generated from contract text',
          contractId,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          processingTime: Date.now() - startTime
        })
      }

      console.log(`🧠 Generating embeddings...`)
      const embeddedChunks = await embedChunks(contractId, tenantId, chunks, {
        apiKey: process.env['OPENAI_API_KEY'],
        model: process.env['RAG_EMBED_MODEL'] || 'text-embedding-3-small'
      })

      result = {
        chunksCreated: chunks.length,
        embeddingsGenerated: embeddedChunks.filter(c => c.embedding).length,
      }
    }

    const processingTime = Date.now() - startTime

    console.log(`✅ RAG processing complete: ${result.embeddingsGenerated} embeddings in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      contractId,
      fileName: contract.fileName,
      chunksCreated: result.chunksCreated,
      embeddingsGenerated: result.embeddingsGenerated,
      processingTime,
      averageChunkSize: Math.round(contract.rawText.length / result.chunksCreated),
      model: process.env['RAG_EMBED_MODEL'] || 'text-embedding-3-small',
      features: {
        semanticChunking: useSemanticChunking,
        structureAware: useSemanticChunking,
      },
    })

  } catch (error) {
    console.error('RAG processing error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        contractId: (await params).id,
        success: false,
        processingTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}
