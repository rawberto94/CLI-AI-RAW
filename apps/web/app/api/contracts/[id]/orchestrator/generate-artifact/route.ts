import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { getContractQueue } from '@/lib/queue/contract-queue';
import { v4 as uuidv4 } from 'uuid';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/orchestrator/generate-artifact
 * 
 * Trigger generation of a specific artifact type
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const contractId = params.id;
  const tenantId = await getApiTenantId(request);

  try {
    const body = await request.json();
    const { artifactType } = body;

    if (!artifactType) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType is required', 400);
    }

    // Get contract text
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
      select: { rawText: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (!contract.rawText || contract.rawText.length < 100) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract text too short for artifact generation', 400);
    }

    const queueManager = getContractQueue();
    const traceId = uuidv4();

    // Enqueue artifact generation job
    const jobId = await queueManager.queueArtifactGeneration(
      {
        contractId,
        tenantId,
        contractText: contract.rawText,
        artifactTypes: [artifactType], // Request specific artifact
        priority: 'high',
        traceId,
        requestId: uuidv4(),
      },
      {
        priority: 35,
      }
    );

    return createSuccessResponse(ctx, {
      success: true,
      message: `${artifactType} generation triggered`,
      jobId,
      artifactType,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
