/**
 * RAG Re-indexing Utility
 * 
 * Provides functions to trigger re-indexing when contract content changes.
 * This can be used by components or API routes to ensure embeddings stay fresh.
 */

import { prisma } from '@/lib/prisma';
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service';

export interface ReindexOptions {
  tenantId: string;
  deleteExisting?: boolean;
  async?: boolean;
}

export interface ReindexResult {
  success: boolean;
  contractId: string;
  chunksCreated?: number;
  embeddingsGenerated?: number;
  error?: string;
}

/**
 * Trigger re-indexing for a single contract
 * Call this when rawText is updated
 */
export async function triggerContractReindex(
  contractId: string,
  options: ReindexOptions
): Promise<ReindexResult> {
  const { tenantId, deleteExisting = true } = options;

  try {
    // Get contract text
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { rawText: true },
    });

    if (!contract || !contract.rawText) {
      return { success: false, contractId, error: 'Contract not found or has no text' };
    }

    // Delete existing embeddings if requested
    if (deleteExisting) {
      await prisma.embedding.deleteMany({
        where: { contractId },
      });
    }

    // Process with semantic chunking
    const result = await processContractWithSemanticChunking(
      contractId,
      contract.rawText,
      undefined
    );

    return {
      success: result.embeddingsGenerated > 0,
      contractId,
      chunksCreated: result.chunksCreated,
      embeddingsGenerated: result.embeddingsGenerated,
    };
  } catch (error) {
    console.error(`Error reindexing contract ${contractId}:`, error);
    return {
      success: false,
      contractId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queue a contract for background re-indexing
 * Use this for async processing to avoid blocking requests
 */
export async function queueContractReindex(
  contractId: string,
  tenantId: string
): Promise<{ queued: boolean; message: string }> {
  try {
    // Mark contract as needing reindex by updating a field
    // This can be picked up by a background job
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        // Use updatedAt to trigger stale detection
        updatedAt: new Date(),
      },
    });

    // In a production system, you would publish to a message queue here
    // For now, we'll trigger async processing
    triggerContractReindex(contractId, { tenantId }).catch(err => {
      console.error(`Background reindex failed for ${contractId}:`, err);
    });

    return { queued: true, message: 'Reindex queued for background processing' };
  } catch (error) {
    console.error(`Error queuing reindex for ${contractId}:`, error);
    return { queued: false, message: error instanceof Error ? error.message : 'Queue failed' };
  }
}

/**
 * Check if a contract needs re-indexing
 */
export async function checkContractNeedsReindex(
  contractId: string,
  tenantId: string
): Promise<{ needsReindex: boolean; reason?: string }> {
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        rawText: true,
        updatedAt: true,
        embeddings: {
          select: { createdAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contract) {
      return { needsReindex: false, reason: 'Contract not found' };
    }

    if (!contract.rawText || contract.rawText.length < 100) {
      return { needsReindex: false, reason: 'No extractable text' };
    }

    if (contract.embeddings.length === 0) {
      return { needsReindex: true, reason: 'No embeddings exist' };
    }

    const embeddingDate = new Date(contract.embeddings[0].createdAt);
    const contractDate = new Date(contract.updatedAt);

    if (contractDate > embeddingDate) {
      return { needsReindex: true, reason: 'Contract updated after last indexing' };
    }

    return { needsReindex: false };
  } catch (error) {
    console.error(`Error checking reindex status for ${contractId}:`, error);
    return { needsReindex: false, reason: 'Error checking status' };
  }
}

/**
 * Batch check for contracts needing re-indexing
 */
export async function findContractsNeedingReindex(
  tenantId: string,
  limit: number = 50
): Promise<string[]> {
  try {
    // Find contracts with text but no embeddings
    const withoutEmbeddings = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        rawText: { not: null },
        embeddings: { none: {} },
      },
      select: { id: true },
      take: limit,
    });

    // Find contracts updated after their embeddings
    const staleEmbeddings = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c.id
      FROM contracts c
      INNER JOIN embeddings e ON e."contractId" = c.id
      WHERE c."tenantId" = ${tenantId}
        AND c."isDeleted" = false
        AND c."rawText" IS NOT NULL
      GROUP BY c.id
      HAVING c."updatedAt" > MAX(e."createdAt")
      LIMIT ${limit}
    `;

    const contractIds = [
      ...withoutEmbeddings.map(c => c.id),
      ...staleEmbeddings.map(c => c.id),
    ];

    // Remove duplicates
    return [...new Set(contractIds)].slice(0, limit);
  } catch (error) {
    console.error('Error finding contracts needing reindex:', error);
    return [];
  }
}
