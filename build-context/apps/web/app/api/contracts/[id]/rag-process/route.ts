import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contractService } from 'data-orchestration/services'
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service'
import { getServerTenantId } from '@/lib/tenant-server'
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const startTime = Date.now()
  
  try {
    const { id: contractId } = await params
    const body = await request.json().catch(() => ({}))
    const useSemanticChunking = body.semanticChunking !== false // Default to true

    const tenantId = await getServerTenantId()

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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (!contract.rawText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract has no text content. Upload and process the contract first.', 400);
    }

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

      if (chunks.length === 0) {
        return createSuccessResponse(ctx, {
          success: false,
          error: 'No chunks generated from contract text',
          contractId,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          processingTime: Date.now() - startTime
        });
      }

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

    return createSuccessResponse(ctx, {
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
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
