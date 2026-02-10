/**
 * API Endpoint: Bulk Reprocess Metadata
 * 
 * POST /api/contracts/bulk-extract-metadata
 * Queues metadata extraction for multiple contracts
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import type { Prisma } from '@prisma/client';
import { getContractQueue } from '@/lib/queue/contract-queue';
import { getApiTenantId } from '@/lib/tenant-server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
  // Auth check

  const tenantId = await getApiTenantId(request);

  // Parse request body
  const body = await request.json();
  const {
    contractIds,
    filter,
    autoApply = true,
    autoApplyThreshold = 0.85,
    priority = 'low',
    skipExisting = true,
  } = body;

  let targetContracts: Array<{ id: string; hasMetadata: boolean }> = [];

  if (contractIds && Array.isArray(contractIds)) {
    // Specific contracts
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        tenantId,
      },
      select: {
        id: true,
        contractMetadata: {
          select: { id: true },
        },
        rawText: true,
      },
    });

    targetContracts = contracts
      .filter(c => c.rawText && c.rawText.length >= 100)
      .map(c => ({
        id: c.id,
        hasMetadata: !!c.contractMetadata,
      }));
  } else if (filter) {
    // Filter-based selection
    const where: Prisma.ContractWhereInput = { tenantId };

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.missingMetadata) {
      where.contractMetadata = { is: null };
    }
    if (filter.contractType) {
      where.contractType = filter.contractType;
    }
    if (filter.createdAfter) {
      where.createdAt = { gte: new Date(filter.createdAfter) };
    }
    if (filter.createdBefore) {
      const current = (where.createdAt ?? {}) as Prisma.DateTimeFilter<'Contract'>;
      where.createdAt = { ...current, lte: new Date(filter.createdBefore) };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractMetadata: {
          select: { id: true },
        },
        rawText: true,
      },
      take: 500, // Limit to 500 contracts per batch
    });

    targetContracts = contracts
      .filter(c => c.rawText && c.rawText.length >= 100)
      .map(c => ({
        id: c.id,
        hasMetadata: !!c.contractMetadata,
      }));
  } else {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Either contractIds or filter must be provided', 400);
  }

  // Filter out contracts that already have metadata if skipExisting
  const contractsToProcess = skipExisting
    ? targetContracts.filter(c => !c.hasMetadata)
    : targetContracts;

  if (contractsToProcess.length === 0) {
    return createSuccessResponse(ctx, {
      queued: 0,
      skipped: targetContracts.length,
      message: 'No contracts need metadata extraction',
    });
  }

  // Queue all contracts for background processing
  try {
    const queue = getContractQueue();
    const jobIds: string[] = [];
    const priorityValue = priority as 'high' | 'normal' | 'low';
    
    // Queue each contract with a small delay between jobs
    for (let i = 0; i < contractsToProcess.length; i++) {
      const contract = contractsToProcess[i];
      if (!contract) continue;
      const jobId = await queue.queueMetadataExtraction({
        contractId: contract.id,
        tenantId,
        autoApply,
        autoApplyThreshold,
        source: 'bulk' as any,
        priority: priorityValue,
      }, {
        delay: i * 1000, // 1 second delay between each job
      });
      
      if (jobId) {
        jobIds.push(jobId);
      }
    }

    return createSuccessResponse(ctx, {
      queued: jobIds.length,
      skipped: targetContracts.length - contractsToProcess.length,
      message: `Queued ${jobIds.length} contracts for metadata extraction`,
      estimatedTime: `${Math.ceil(jobIds.length * 30 / 60)} minutes`,
      jobIds: jobIds.slice(0, 10),
    });
  } catch (queueError: unknown) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', queueError instanceof Error ? queueError.message : 'Failed to queue contracts for processing', 503);
  }
});

/**
 * GET - Get bulk extraction status
 */
export const GET = withAuthApiHandler(async (request, ctx) => {

  const tenantId = await getApiTenantId(request);

  // Get metadata statistics
  const [
    totalContracts,
    contractsWithMetadata,
    contractsProcessing,
    recentExtractions,
  ] = await Promise.all([
    prisma.contract.count({
      where: { tenantId, status: 'COMPLETED' },
    }),
    prisma.contract.count({
      where: {
        tenantId,
        status: 'COMPLETED',
        contractMetadata: { isNot: null },
      },
    }),
    prisma.contract.count({
      where: { tenantId, status: 'PROCESSING' },
    }),
    prisma.contract.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        contractMetadata: { isNot: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        contractTitle: true,
        updatedAt: true,
        contractMetadata: {
          select: {
            systemFields: true,
            customFields: true,
          },
        },
      },
    }),
  ]);

  return createSuccessResponse(ctx, {
    statistics: {
      totalContracts,
      contractsWithMetadata,
      contractsWithoutMetadata: totalContracts - contractsWithMetadata,
      coveragePercentage: totalContracts > 0
        ? Math.round((contractsWithMetadata / totalContracts) * 100)
        : 0,
      processing: contractsProcessing,
    },
    queue: null, // Queue not implemented
    recentExtractions: recentExtractions.map(c => ({
      id: c.id,
      title: c.contractTitle,
      updatedAt: c.updatedAt,
      fieldCount: c.contractMetadata
        ? Object.keys(c.contractMetadata.systemFields as object || {}).length +
          Object.keys(c.contractMetadata.customFields as object || {}).length
        : 0,
    })),
  });
});
