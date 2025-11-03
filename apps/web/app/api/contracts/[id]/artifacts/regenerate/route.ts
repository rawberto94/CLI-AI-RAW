/**
 * Artifact Regeneration API Route
 * 
 * Regenerates specific artifacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiArtifactGeneratorService } from 'data-orchestration/services';

/**
 * POST /api/contracts/[id]/artifacts/regenerate
 * Regenerate specific artifact type
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const contractId = params.id;
    const body = await request.json();
    const { artifactType, tenantId, userId, contractText } = body;

    if (!artifactType || !tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: artifactType, tenantId, userId' },
        { status: 400 }
      );
    }

    if (!contractText) {
      return NextResponse.json(
        { error: 'Contract text is required for regeneration' },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          error: 'Regeneration failed',
          message: result.error || 'Unknown error',
          method: result.method
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
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
  } catch (error) {
    console.error('Artifact regeneration error:', error);
    
    return NextResponse.json(
      {
        error: 'Regeneration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
