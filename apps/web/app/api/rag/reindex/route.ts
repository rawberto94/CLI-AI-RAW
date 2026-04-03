/**
 * RAG Re-indexing Trigger API
 * 
 * POST /api/rag/reindex - Trigger re-indexing for contracts
 * 
 * This endpoint allows triggering RAG re-indexing when:
 * - Contract rawText has been updated
 * - Embeddings are stale or missing
 * - Manual refresh is requested
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { aiArtifactGeneratorService } from 'data-orchestration/services';

/**
 * POST /api/rag/reindex
 * Trigger re-indexing for specific contracts or stale embeddings
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const body = await request.json();
    const {
      contractIds,           // Specific contracts to reindex
      staleThresholdHours,   // Reindex if embeddings older than X hours
      forceAll,              // Force reindex all contracts
      limit = 50,            // Max contracts to process
      onlyMissing = false,   // Only process contracts without embeddings
    } = body;

    const results: Array<{ contractId: string; status: 'success' | 'skipped' | 'error'; message?: string }> = [];
    const whereClause: Prisma.ContractWhereInput = { tenantId, isDeleted: false };

    // Build query based on options
    if (contractIds && contractIds.length > 0) {
      whereClause.id = { in: contractIds };
    }

    // Get contracts
    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        fileName: true,
        rawText: true,
        updatedAt: true,
        contractEmbeddings: {
          select: {
            id: true,
            createdAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' } } },
      take: limit,
      orderBy: { updatedAt: 'desc' } });

    // Filter contracts that need reindexing
    const now = new Date();
    const staleThreshold = staleThresholdHours ? staleThresholdHours * 60 * 60 * 1000 : null;

    const contractsToProcess = contracts.filter(contract => {
      // Skip if no text
      if (!contract.rawText || contract.rawText.length < 100) {
        return false;
      }

      // If onlyMissing, skip if has embeddings
      if (onlyMissing && contract.contractEmbeddings.length > 0) {
        return false;
      }

      // If forceAll, include all with text
      if (forceAll) {
        return true;
      }

      // Check if embeddings are stale
      if (staleThreshold && contract.contractEmbeddings.length > 0) {
        const embeddingAge = now.getTime() - new Date(contract.contractEmbeddings[0].createdAt).getTime();
        if (embeddingAge > staleThreshold) {
          return true;
        }
      }

      // Check if contract updated after embeddings
      if (contract.contractEmbeddings.length > 0) {
        const contractUpdated = new Date(contract.updatedAt);
        const embeddingCreated = new Date(contract.contractEmbeddings[0].createdAt);
        if (contractUpdated > embeddingCreated) {
          return true;
        }
      }

      // No embeddings - needs processing
      if (contract.contractEmbeddings.length === 0) {
        return true;
      }

      return false;
    });

    if (contractsToProcess.length === 0) {
      return createSuccessResponse(ctx, {
        message: 'No contracts need reindexing',
        processed: 0,
        skipped: contracts.length });
    }

    // Process contracts
    let processed = 0;
    let failed = 0;

    for (const contract of contractsToProcess) {
      try {
        // Delete existing embeddings
        await prisma.contractEmbedding.deleteMany({
          where: { contractId: contract.id } });

        // Process with semantic chunking
        const result = await processContractWithSemanticChunking(
          contract.id,
          contract.rawText || '',
          undefined
        );

        if (result.embeddingsGenerated > 0) {
          results.push({ contractId: contract.id, status: 'success' });
          processed++;
        } else {
          results.push({
            contractId: contract.id,
            status: 'error',
            message: 'No embeddings generated' });
          failed++;
        }
      } catch (error) {
        console.error(`[RAG/Reindex] Failed contract ${contract.id}:`, error);
        results.push({
          contractId: contract.id,
          status: 'error',
          message: 'Reindexing failed' });
        failed++;
      }
    }

    return createSuccessResponse(ctx, {
      message: `Reindexed ${processed} contracts`,
      processed,
      failed,
      skipped: contracts.length - contractsToProcess.length,
      results });
  });

/**
 * GET /api/rag/reindex
 * Check which contracts need reindexing
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get contracts with their embedding status
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        rawText: { not: null } },
      select: {
        id: true,
        fileName: true,
        updatedAt: true,
        _count: { select: { embeddings: true } },
        embeddings: {
          select: { createdAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' } } },
      take: limit });

    // Categorize contracts
    const stats = {
      total: contracts.length,
      indexed: 0,
      needsIndexing: 0,
      stale: 0 };

    const needsReindexing: Array<{
      contractId: string;
      fileName: string;
      reason: 'missing' | 'stale' | 'updated';
    }> = [];

    for (const contract of contracts) {
      if (contract._count.embeddings === 0) {
        stats.needsIndexing++;
        needsReindexing.push({
          contractId: contract.id,
          fileName: contract.fileName || 'Unknown',
          reason: 'missing' });
      } else if (contract.embeddings.length > 0) {
        const embeddingDate = new Date(contract.embeddings[0].createdAt);
        const contractDate = new Date(contract.updatedAt);
        
        if (contractDate > embeddingDate) {
          stats.stale++;
          needsReindexing.push({
            contractId: contract.id,
            fileName: contract.fileName || 'Unknown',
            reason: 'updated' });
        } else {
          stats.indexed++;
        }
      }
    }

    return createSuccessResponse(ctx, {
      stats,
      needsReindexing: needsReindexing.slice(0, 50),
      hasMore: needsReindexing.length > 50 });
  });
