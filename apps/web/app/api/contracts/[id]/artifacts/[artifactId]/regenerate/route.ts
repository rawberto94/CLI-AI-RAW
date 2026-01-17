import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chunkText, embedChunks } from "clients-rag";
import { aiArtifactGeneratorService } from "data-orchestration/services";
import { getApiTenantId } from "@/lib/tenant-server";
import { queueRAGReindex } from "@/lib/rag/reindex-helper";

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
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    if (!contract.rawText) {
      return NextResponse.json(
        { error: 'Contract has no extracted text. Please reprocess the contract.' },
        { status: 400 }
      );
    }

    // Validate artifact exists
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId }
    });

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    if (artifact.contractId !== contractId) {
      return NextResponse.json(
        { error: 'Artifact does not belong to this contract' },
        { status: 400 }
      );
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
      .catch(() => {
        // Error handled in regenerateArtifactAsync
      });

    return NextResponse.json({
      success: true,
      message: 'Artifact regeneration started',
      artifactId,
      contractId,
      type: artifact.type
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to initiate regeneration' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      artifactId: artifact.id,
      type: artifact.type,
      status: artifact.validationStatus,
      data: artifact.data,
      updatedAt: artifact.updatedAt
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
