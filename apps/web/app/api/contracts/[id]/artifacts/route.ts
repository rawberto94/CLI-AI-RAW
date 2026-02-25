/**
 * Contract Artifacts API
 * GET /api/contracts/[id]/artifacts - Get all artifacts for a contract
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ArtifactService with automatic caching
 * - Type-safe with consistent error handling
 */

import { NextRequest } from "next/server";
import { artifactService } from "@/lib/data-orchestration";
import { getServerTenantId } from "@/lib/tenant-server";
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const startTime = Date.now();

  try {
    const { id: contractId } = await params;
    const tenantId = await getServerTenantId();

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    // Pagination & filtering params
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

    // Use data-orchestration service (handles caching automatically)
    const result = await artifactService.getContractArtifacts(
      contractId,
      tenantId,
      { type, page, limit }
    );

    if (!result.success) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', result.error?.message ?? 'Unknown error', 500);
    }

    const responseTime = Date.now() - startTime;

    interface ArtifactData {
      id?: string;
      type?: string;
      data?: Record<string, unknown> | null;
      confidence?: number;
    }

    // Transform artifacts for UI compatibility
    const artifactsData = result.data ?? [];
    const transformedArtifacts = (artifactsData as ArtifactData[]).map((artifact: ArtifactData) => {
        const artifactData = (artifact.data as Record<string, unknown>) || {};
        return {
          id: artifact.id,
          type: artifact.type,
          data: artifact.data,
          confidence: Number(artifact.confidence || 0),
          completeness: (artifactData.completeness as number) || 0,
        };
    });

    return createSuccessResponse(ctx, {
        artifacts: transformedArtifacts,
        pagination: {
          page,
          limit,
          total: transformedArtifacts.length,
          hasMore: transformedArtifacts.length === limit,
        },
      },
      {
        headers: {
          "X-Response-Time": `${responseTime}ms`,
          "X-Data-Source": "data-orchestration",
          "X-Artifact-Count": String(transformedArtifacts.length),
        },
      });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
