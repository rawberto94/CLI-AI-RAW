import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { chunkText as _chunkText, embedChunks as _embedChunks } from "clients-rag";
import { aiArtifactGeneratorService } from "data-orchestration/services";
import { getApiTenantId } from "@/lib/tenant-server";
import { queueRAGReindex } from "@/lib/rag/reindex-helper";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// aiArtifactGeneratorService is already an instance via getInstance()
const aiArtifactGenerator = aiArtifactGeneratorService;

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/regenerate
 * 
 * Regenerate a specific artifact for a contract
 * Used for error recovery and manual regeneration
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const artifactId = params.artifactId;
    const tenantId = await getApiTenantId(request);

    // Validate contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        status: true
      }
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (!contract.rawText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract has no extracted text. Please reprocess the contract.', 400);
    }

    // Validate artifact exists
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    if (artifact.contractId !== contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Artifact does not belong to this contract', 400);
    }

    // Mark artifact as processing
    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        validationStatus: 'PROCESSING',
        lastEditedAt: new Date()
      }
    });

    // Regenerate artifact in background (non-blocking)
    regenerateArtifactAsync(contractId, artifactId, artifact.type, contract.rawText, tenantId)
      .catch((err) => {
        console.error('[ArtifactRegenerate] Background regeneration error:', err);
      });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Artifact regeneration started',
      artifactId,
      contractId,
      type: artifact.type
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * Regenerate artifact asynchronously
 */
async function regenerateArtifactAsync(
  contractId: string,
  artifactId: string,
  artifactType: string,
  rawText: string,
  tenantId: string
) {
  try {
    const startTime = Date.now();

    // Generate new artifact content using AI generator
    const generateResult = await (aiArtifactGenerator.generateArtifact as any)(
      contractId,
      tenantId,
      artifactType,
      { rawText }
    ) as any; // Cast result to any for flexible shape handling

    if (!generateResult.success || !generateResult.artifact) {
      throw new Error(generateResult.error || 'Failed to generate artifact');
    }

    const newContent = generateResult.artifact.data;
    const processingTime = Date.now() - startTime;

    // Update artifact with new content
    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        validationStatus: 'COMPLETED',
        data: typeof newContent === 'string' ? JSON.parse(newContent) : newContent,
        processingTime,
        lastEditedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Queue RAG re-indexing when artifact content is regenerated
    await queueRAGReindex({
      contractId,
      tenantId,
      reason: `artifact ${artifactType} regenerated`,
    });

  } catch (error: unknown) {
    // Mark artifact as failed
    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        validationStatus: 'FAILED',
        validationIssues: [{
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString()
        }],
        lastEditedAt: new Date()
      }
    });
  }
}
/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/regenerate
 * 
 * Get regeneration status
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const artifactId = params.artifactId;

    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
      select: {
        id: true,
        type: true,
        validationStatus: true,
        data: true,
        updatedAt: true
      }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    return createSuccessResponse(ctx, {
      artifactId: artifact.id,
      type: artifact.type,
      status: artifact.validationStatus,
      data: artifact.data,
      updatedAt: artifact.updatedAt
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}
