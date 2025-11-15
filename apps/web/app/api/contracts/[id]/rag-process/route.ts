import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    const { id: contractId } = await params
    const body = await request.json()
    const tenantId = body.tenantId || request.headers.get('x-tenant-id') || 'demo'

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 RAG processing request for contract: ${contractId}`)

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

    // Import RAG utilities
    const { chunkText, embedChunks } = await import('clients-rag')
    
    // Chunk the text
    const chunks = chunkText(contract.rawText)
    console.log(`📦 Created ${chunks.length} text chunks`)

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

    // Generate embeddings
    console.log(`🧠 Generating embeddings...`)
    const embeddedChunks = await embedChunks(contractId, tenantId, chunks, {
      apiKey: process.env['OPENAI_API_KEY'],
      model: process.env['RAG_EMBED_MODEL'] || 'text-embedding-3-small'
    })

    const embeddingsGenerated = embeddedChunks.filter(c => c.embedding).length
    const processingTime = Date.now() - startTime

    console.log(`✅ RAG processing complete: ${embeddingsGenerated} embeddings in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      contractId,
      fileName: contract.fileName,
      chunksCreated: chunks.length,
      embeddingsGenerated,
      processingTime,
      averageChunkSize: Math.round(contract.rawText.length / chunks.length),
      model: process.env['RAG_EMBED_MODEL'] || 'text-embedding-3-small'
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
  } finally {
    await prisma.$disconnect()
  }
}
