/**
 * Artifact Regeneration API Route
 * 
 * Regenerates specific artifacts
 */

import { NextRequest } from 'next/server';
import { aiArtifactGeneratorService } from 'data-orchestration/services';
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
    const { artifactType, tenantId, userId, contractText } = body;

    if (!artifactType || !tenantId || !userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Missing required fields: artifactType, tenantId, userId', 400);
    }

    if (!contractText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract text is required for regeneration', 400);
    }

    // Regenerate the artifact
    const result = await aiArtifactGeneratorService.generateArtifact(
      artifactType,
      contractText,
      contractId,
      tenantId,
      {
        preferredMethod: 'ai',
        enableFallback: true,
        userId
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
