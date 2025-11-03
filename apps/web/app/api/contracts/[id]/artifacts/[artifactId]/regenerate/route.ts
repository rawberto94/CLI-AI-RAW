import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/packages/clients/db';
import { generateRealArtifact } from '@/lib/real-artifact-generator';

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
    const tenantId = request.headers.get('x-tenant-id') || 'demo';

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
        status: 'PROCESSING',
        content: null,
        metadata: {
          ...((artifact.metadata as any) || {}),
          regeneratedAt: new Date().toISOString(),
          previousStatus: artifact.status
        }
      }
    });

    // Regenerate artifact in background (non-blocking)
    regenerateArtifactAsync(contractId, artifactId, artifact.type, contract.rawText, tenantId)
      .catch(error => {
        console.error(`Failed to regenerate artifact ${artifactId}:`, error);
      });

    return NextResponse.json({
      success: true,
      message: 'Artifact regeneration started',
      artifactId,
      contractId,
      type: artifact.type
    });

  } catch (error) {
    console.error('Error initiating artifact regeneration:', error);
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
    console.log(`Regenerating artifact ${artifactType} for contract ${contractId}`);

    const startTime = Date.now();

    // Generate new artifact content using the same generator
    const newContent = await generateRealArtifact(rawText, artifactType);

    const processingTime = Date.now() - startTime;

    // Update artifact with new content
    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        status: 'COMPLETED',
        content: typeof newContent === 'string' ? newContent : JSON.stringify(newContent),
        metadata: {
          regenerated: true,
          regeneratedAt: new Date().toISOString(),
          processingTime,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
        },
        updatedAt: new Date()
      }
    });

    console.log(`✅ Artifact ${artifactType} regenerated in ${processingTime}ms`);

  } catch (error) {
    console.error(`❌ Failed to regenerate artifact ${artifactId}:`, error);

    // Mark artifact as failed
    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        status: 'FAILED',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString()
        }
      }
    });
  } finally {
    await prisma.$disconnect();
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
        status: true,
        metadata: true,
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
      status: artifact.status,
      metadata: artifact.metadata,
      updatedAt: artifact.updatedAt
    });

  } catch (error) {
    console.error('Error fetching regeneration status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
