/**
 * Contract Status API
 * GET /api/contracts/[id]/status
 * 
 * Returns real-time status of contract processing for the ArtifactGenerationTracker component.
 * Polls this endpoint to track upload → OCR → artifact generation progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;

    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Fetch contract with artifacts
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: {
          select: {
            type: true,
            confidence: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Count artifacts by type
    const artifactTypes = contract.artifacts.map(a => a.type.toLowerCase());
    const hasOverview = artifactTypes.includes('overview');
    const hasFinancial = artifactTypes.includes('financial');
    const hasRisk = artifactTypes.includes('risk');
    const hasCompliance = artifactTypes.includes('compliance');
    const hasClauses = artifactTypes.includes('clauses');

    const artifactsGenerated = contract.artifacts.length;
    const totalArtifacts = 5;

    // Determine current processing step
    let currentStep: 'upload' | 'ocr' | 'artifacts' | 'complete' = 'upload';
    let progress = 0;

    if (contract.status === 'UPLOADED') {
      currentStep = 'upload';
      progress = 25;
    } else if (contract.status === 'PROCESSING') {
      if (artifactsGenerated === 0) {
        currentStep = 'ocr';
        progress = 50;
      } else {
        currentStep = 'artifacts';
        // Progress from 50% to 90% based on artifacts generated
        progress = 50 + (artifactsGenerated / totalArtifacts) * 40;
      }
    } else if (contract.status === 'COMPLETED') {
      currentStep = 'complete';
      progress = 100;
    } else if (contract.status === 'FAILED') {
      progress = 0;
    }

    return NextResponse.json({
      contractId: contract.id,
      status: contract.status,
      currentStep,
      progress: Math.round(progress),
      fileName: contract.fileName,
      fileSize: Number(contract.fileSize),
      mimeType: contract.mimeType,
      artifactsGenerated,
      totalArtifacts,
      artifactTypes,
      hasOverview,
      hasFinancial,
      hasRisk,
      hasCompliance,
      hasClauses,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      error: contract.status === 'FAILED' ? 'Processing failed' : null,
    });
  } catch (error) {
    console.error('Error fetching contract status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch contract status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
