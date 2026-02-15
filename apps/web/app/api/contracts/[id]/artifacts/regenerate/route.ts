/**
 * Artifact Regeneration API Route
 * 
 * Regenerates specific artifacts by type.
 * Reads contract text from database (no longer requires client to send it).
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { aiArtifactGeneratorService } from 'data-orchestration/services';
import { getApiTenantId } from "@/lib/tenant-server";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/artifacts/regenerate
 * Regenerate specific artifact type
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const body = await request.json();
    const { artifactType, userId } = body;
    const tenantId = body.tenantId || await getApiTenantId(request);

    if (!artifactType || !tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Missing required fields: artifactType, tenantId', 400);
    }

    // Read contract text from DB instead of requiring client to send it
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, rawText: true, status: true }
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (!contract.rawText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract has no extracted text. Please reprocess the contract.', 400);
    }

    // Regenerate the artifact
    const result = await aiArtifactGeneratorService.generateArtifact(
      artifactType,
      contract.rawText,
      contractId,
      tenantId,
      {
        preferredMethod: 'ai',
        enableFallback: true,
        userId: userId || 'system'
      }
    );

    if (!result.success) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Regeneration failed', 500);
    }

    return createSuccessResponse(ctx, {
      success: true,
      contractId,
      artifactType,
      artifact: result.data,
      confidence: result.confidence,
      completeness: result.completeness,
      validation: result.validation,
      method: result.method,
      processingTime: result.processingTime,
      regeneratedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
