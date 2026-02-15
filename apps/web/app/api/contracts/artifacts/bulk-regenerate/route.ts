import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiArtifactGeneratorService } from "data-orchestration/services";
import { getApiTenantId } from "@/lib/tenant-server";
import { queueRAGReindex } from "@/lib/rag/reindex-helper";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const aiArtifactGenerator = aiArtifactGeneratorService;

const MAX_BULK_CONTRACTS = 50;
const MAX_BULK_ARTIFACTS = 200;

interface BulkRegenerateRequest {
  contractIds?: string[];
  artifactTypes?: string[];
  filter?: {
    status?: string;
    qualityBelow?: number;
    olderThanDays?: number;
  };
}

/**
 * POST /api/contracts/artifacts/bulk-regenerate
 * 
 * Bulk regenerate artifacts across multiple contracts.
 * Accepts contract IDs and/or artifact type filters.
 * Processes asynchronously with progress tracking.
 */
export async function POST(request: NextRequest) {
  const ctx = getApiContext(request);
  try {
    const tenantId = await getApiTenantId(request);
    const body: BulkRegenerateRequest = await request.json();
    const { contractIds, artifactTypes, filter } = body;

    if (!contractIds?.length && !artifactTypes?.length && !filter) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Provide contractIds, artifactTypes, or a filter', 400);
    }

    // Build artifact query
    const where: Record<string, unknown> = {
      contract: { tenantId },
    };

    if (contractIds?.length) {
      if (contractIds.length > MAX_BULK_CONTRACTS) {
        return createErrorResponse(ctx, 'BAD_REQUEST', `Maximum ${MAX_BULK_CONTRACTS} contracts per bulk operation`, 400);
      }
      where.contractId = { in: contractIds };
    }

    if (artifactTypes?.length) {
      where.type = { in: artifactTypes };
    }

    if (filter?.status) {
      where.validationStatus = filter.status;
    }

    if (filter?.qualityBelow !== undefined) {
      where.qualityScore = { lt: filter.qualityBelow };
    }

    if (filter?.olderThanDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filter.olderThanDays);
      where.updatedAt = { lt: cutoff };
    }

    // Find matching artifacts
    const artifacts = await prisma.artifact.findMany({
      where: where as any,
      select: {
        id: true,
        type: true,
        contractId: true,
        validationStatus: true,
        qualityScore: true,
      },
      take: MAX_BULK_ARTIFACTS,
      orderBy: { updatedAt: 'asc' }, // oldest first
    });

    if (artifacts.length === 0) {
      return createSuccessResponse(ctx, {
        success: true,
        message: 'No matching artifacts found',
        queued: 0,
        artifacts: [],
      });
    }

    // Load contract texts for all involved contracts
    const uniqueContractIds = [...new Set(artifacts.map(a => a.contractId))];
    const contracts = await prisma.contract.findMany({
      where: { id: { in: uniqueContractIds }, tenantId },
      select: { id: true, rawText: true },
    });
    const contractTextMap = new Map(contracts.map(c => [c.id, c.rawText]));

    // Mark all artifacts as processing
    await prisma.artifact.updateMany({
      where: { id: { in: artifacts.map(a => a.id) } },
      data: {
        validationStatus: 'PROCESSING',
        lastEditedAt: new Date(),
      },
    });

    // Track job IDs for status reporting
    const jobSummary = {
      queued: artifacts.length,
      skipped: 0,
      contractCount: uniqueContractIds.length,
      artifactIds: artifacts.map(a => a.id),
      types: [...new Set(artifacts.map(a => a.type))],
    };

    // Process artifacts in background (non-blocking)
    processBulkRegeneration(artifacts, contractTextMap, tenantId).catch((err) => {
      console.error('[BulkRegenerate] Background processing error:', err);
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: `Bulk regeneration started for ${jobSummary.queued} artifacts across ${jobSummary.contractCount} contracts`,
      ...jobSummary,
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * Process bulk regeneration asynchronously
 * Processes sequentially to avoid overwhelming AI providers
 */
async function processBulkRegeneration(
  artifacts: Array<{ id: string; type: string; contractId: string }>,
  contractTextMap: Map<string, string | null>,
  tenantId: string
) {
  let succeeded = 0;
  let failed = 0;

  for (const artifact of artifacts) {
    const rawText = contractTextMap.get(artifact.contractId);
    if (!rawText) {
      console.warn(`[BulkRegenerate] No rawText for contract ${artifact.contractId}, skipping artifact ${artifact.id}`);
      await prisma.artifact.update({
        where: { id: artifact.id },
        data: {
          validationStatus: 'FAILED',
          validationIssues: [{ error: 'No contract text available', failedAt: new Date().toISOString() }],
          lastEditedAt: new Date(),
        },
      });
      failed++;
      continue;
    }

    try {
      const startTime = Date.now();

      const generateResult = await (aiArtifactGenerator.generateArtifact as any)(
        artifact.contractId,
        tenantId,
        artifact.type,
        { rawText }
      ) as any;

      if (!generateResult.success || !generateResult.artifact) {
        throw new Error(generateResult.error || 'Failed to generate artifact');
      }

      const newContent = generateResult.artifact.data;
      const processingTime = Date.now() - startTime;

      await prisma.artifact.update({
        where: { id: artifact.id },
        data: {
          validationStatus: 'COMPLETED',
          data: typeof newContent === 'string' ? JSON.parse(newContent) : newContent,
          processingTime,
          lastEditedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      succeeded++;

      // Queue RAG re-indexing
      await queueRAGReindex({
        contractId: artifact.contractId,
        tenantId,
        reason: `bulk artifact ${artifact.type} regenerated`,
      }).catch(() => {}); // Non-critical

      // Small delay between artifacts to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: unknown) {
      failed++;
      await prisma.artifact.update({
        where: { id: artifact.id },
        data: {
          validationStatus: 'FAILED',
          validationIssues: [{
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date().toISOString(),
          }],
          lastEditedAt: new Date(),
        },
      });
    }
  }

  console.log(`[BulkRegenerate] Complete: ${succeeded} succeeded, ${failed} failed out of ${artifacts.length} total`);
}

/**
 * GET /api/contracts/artifacts/bulk-regenerate?contractIds=id1,id2
 * 
 * Check status of bulk regeneration by querying artifact statuses
 */
export async function GET(request: NextRequest) {
  const ctx = getApiContext(request);
  try {
    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    const contractIdsParam = searchParams.get('contractIds');
    const artifactIdsParam = searchParams.get('artifactIds');

    const where: Record<string, unknown> = {
      contract: { tenantId },
    };

    if (artifactIdsParam) {
      where.id = { in: artifactIdsParam.split(',') };
    } else if (contractIdsParam) {
      where.contractId = { in: contractIdsParam.split(',') };
    } else {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Provide contractIds or artifactIds query parameter', 400);
    }

    const artifacts = await prisma.artifact.findMany({
      where: where as any,
      select: {
        id: true,
        type: true,
        contractId: true,
        validationStatus: true,
        qualityScore: true,
        processingTime: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const statusCounts = artifacts.reduce((acc, a) => {
      const status = a.validationStatus || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalCount = artifacts.length;
    const completedCount = statusCounts['COMPLETED'] || 0;
    const failedCount = statusCounts['FAILED'] || 0;
    const processingCount = statusCounts['PROCESSING'] || 0;

    return createSuccessResponse(ctx, {
      totalCount,
      completedCount,
      failedCount,
      processingCount,
      progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      isComplete: processingCount === 0,
      statusCounts,
      artifacts,
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}
