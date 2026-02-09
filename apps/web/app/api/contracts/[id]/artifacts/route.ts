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
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  const startTime = Date.now();

  try {
    const { id: contractId } = await params;
    const tenantId = await getServerTenantId();

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    // Use data-orchestration service (handles caching automatically)
    const result = await artifactService.getContractArtifacts(
      contractId,
      tenantId
    );

    if (!result.success) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', result.error?.message, 500);
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
    const transformedArtifacts = artifactsData.map((artifact: ArtifactData) => {
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
        success: true,
        data: transformedArtifacts,
        meta: {
          count: transformedArtifacts.length,
          contractId,
          responseTime: `${responseTime}ms`,
          cached: responseTime < 50,
          dataSource: "data-orchestration",
        },
      },
      {
        headers: {
          "X-Response-Time": `${responseTime}ms`,
          "X-Data-Source": "data-orchestration",
        },
      });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
