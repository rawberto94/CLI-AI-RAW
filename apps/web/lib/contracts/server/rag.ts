import { NextRequest } from 'next/server';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service';

import type { ContractApiContext } from '@/lib/contracts/server/context';

async function loadLegacyRagClient() {
  const moduleName = 'clients-rag';
  return import(moduleName);
}

export async function postContractRagProcess(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const useSemanticChunking = body.semanticChunking !== false;
    const tenantId = context.tenantId;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        rawText: true,
        fileName: true,
        tenantId: true,
        storagePath: true,
        mimeType: true,
      },
    });

    if (!contract) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (!contract.rawText) {
      return createErrorResponse(
        context,
        'BAD_REQUEST',
        'Contract has no text content. Upload and process the contract first.',
        400,
      );
    }

    let result: { chunksCreated: number; embeddingsGenerated: number };

    if (useSemanticChunking) {
      result = await processContractWithSemanticChunking(contractId, contract.rawText, {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
      });
    } else {
      const { chunkText, embedChunks } = await loadLegacyRagClient();
      const chunks = chunkText(contract.rawText);

      if (chunks.length === 0) {
        return createSuccessResponse(context, {
          success: false,
          error: 'No chunks generated from contract text',
          contractId,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          processingTime: Date.now() - startTime,
        });
      }

      const embeddedChunks = await embedChunks(contractId, tenantId, chunks, {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
      });

      result = {
        chunksCreated: chunks.length,
        embeddingsGenerated: embeddedChunks.filter((chunk) => chunk.embedding).length,
      };
    }

    const processingTime = Date.now() - startTime;

    return createSuccessResponse(context, {
      success: true,
      contractId,
      fileName: contract.fileName,
      chunksCreated: result.chunksCreated,
      embeddingsGenerated: result.embeddingsGenerated,
      processingTime,
      averageChunkSize: Math.round(contract.rawText.length / result.chunksCreated),
      model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
      features: {
        semanticChunking: useSemanticChunking,
        structureAware: useSemanticChunking,
      },
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}