import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/security/tenant';
import { getContractQueue } from '@/lib/queue/contract-queue';
import { v4 as uuidv4 } from 'uuid';

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
  const contractId = params.id;
  const tenantId = await getApiTenantId(request);

  try {
    const body = await request.json();
    const { artifactType } = body;

    if (!artifactType) {
      return NextResponse.json(
        { error: 'artifactType is required' },
        { status: 400 }
      );
    }

    // Get contract text
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
      select: { rawText: true },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    if (!contract.rawText || contract.rawText.length < 100) {
      return NextResponse.json(
        { error: 'Contract text too short for artifact generation' },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      message: `${artifactType} generation triggered`,
      jobId,
      artifactType,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to trigger artifact generation' },
      { status: 500 }
    );
  }
}
