/**
 * AI Feedback & Learning API
 * 
 * Record user corrections to improve AI extractions over time:
 * - Stores correction patterns
 * - Enables prompt enhancement based on learnings
 * - Supports per-tenant customization
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

interface CorrectionRequest {
  contractId: string;
  artifactType: string;
  originalData: Record<string, unknown>;
  correctedData: Record<string, unknown>;
  tenantId: string;
  userId: string;
  feedbackType?: 'correction' | 'validation' | 'rejection';
}

/**
 * POST - Record a user correction for AI learning
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const services = await import('@repo/data-orchestration/services');
    const aiLearningService = services.aiLearningService;

    const body = await request.json() as CorrectionRequest;

    // Validate required fields
    if (!body.contractId || !body.artifactType) {
      return NextResponse.json(
        { error: 'contractId and artifactType are required' },
        { status: 400 }
      );
    }

    if (!body.originalData || !body.correctedData) {
      return NextResponse.json(
        { error: 'originalData and correctedData are required' },
        { status: 400 }
      );
    }

    // Calculate which fields were corrected
    const correctionFields = Object.keys(body.correctedData).filter(
      key => JSON.stringify(body.originalData[key]) !== JSON.stringify(body.correctedData[key])
    );

    // Record the correction
    await aiLearningService.recordCorrection({
      contractId: body.contractId,
      tenantId: body.tenantId || 'default',
      artifactType: body.artifactType,
      originalData: body.originalData as Record<string, unknown>,
      correctedData: body.correctedData as Record<string, unknown>,
      correctionFields,
      userId: body.userId || 'anonymous',
      feedbackType: body.feedbackType || 'correction',
    });

    return NextResponse.json({
      success: true,
      message: 'Correction recorded for AI learning',
      data: {
        contractId: body.contractId,
        artifactType: body.artifactType,
        correctionFields,
        recordedAt: new Date().toISOString(),
      },
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to record correction' },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve learned patterns or stats
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const services = await import('@repo/data-orchestration/services');
    const aiLearningService = services.aiLearningService;

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const artifactType = searchParams.get('artifactType') || undefined;

    // Get learned patterns
    const patterns = await aiLearningService.getLearningPatterns(
      tenantId,
      artifactType
    );

    return NextResponse.json({
      tenantId,
      artifactType: artifactType || 'all',
      patterns,
      patternCount: patterns.length,
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve learning data' },
      { status: 500 }
    );
  }
}
