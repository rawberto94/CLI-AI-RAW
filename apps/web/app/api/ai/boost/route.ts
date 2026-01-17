import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/ai/boost
 * Boost extraction confidence using multiple strategies
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      extraction, 
      contractText,
      strategy,
      config = {}
    } = body;

    if (!extraction || !contractText) {
      return NextResponse.json(
        { error: 'extraction and contractText are required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const boostingService = (services as any).extractionConfidenceBoostingService;

    if (!boostingService) {
      return NextResponse.json(
        { error: 'Confidence boosting service not available' },
        { status: 503 }
      );
    }

    // Apply boosting strategy
    let result;
    if (strategy) {
      // Single strategy
      switch (strategy) {
        case 'multi_model':
          result = await boostingService.boostWithMultiModel(
            extraction,
            contractText,
            config
          );
          break;
        case 'evidence_chain':
          result = await boostingService.boostWithEvidence(
            extraction,
            contractText,
            config
          );
          break;
        case 'historical_calibration':
          result = await boostingService.boostWithHistoricalCalibration(
            extraction,
            config
          );
          break;
        default:
          result = await boostingService.boostExtraction(
            extraction,
            contractText,
            { ...config, strategy }
          );
      }
    } else {
      // Use ensemble (all strategies)
      result = await boostingService.boostExtraction(
        extraction,
        contractText,
        { ...config, strategy: 'ensemble' }
      );
    }

    return NextResponse.json({
      success: true,
      strategy: strategy || 'ensemble',
      ...result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to boost extraction confidence', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/boost/feedback
 * Submit human feedback to improve future boosting
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      fieldName, 
      originalValue,
      correctedValue,
      originalConfidence,
      wasCorrect
    } = body;

    if (!fieldName) {
      return NextResponse.json(
        { error: 'fieldName is required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const boostingService = (services as any).extractionConfidenceBoostingService;

    if (!boostingService) {
      return NextResponse.json(
        { error: 'Confidence boosting service not available' },
        { status: 503 }
      );
    }

    // Record human feedback
    boostingService.recordHumanFeedback({
      fieldName,
      originalValue,
      correctedValue,
      originalConfidence,
      wasCorrect: wasCorrect !== false,
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded successfully',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to record feedback', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/boost
 * Get available boosting strategies and stats
 */
export async function GET() {
  try {
    const services = await import('@repo/data-orchestration/services');
    const boostingService = (services as any).extractionConfidenceBoostingService;

    const strategies = [
      { 
        name: 'multi_model', 
        description: 'Use multiple AI models for consensus voting' 
      },
      { 
        name: 'evidence_chain', 
        description: 'Build evidence chains with document quotes' 
      },
      { 
        name: 'historical_calibration', 
        description: 'Adjust confidence based on historical accuracy' 
      },
      { 
        name: 'cross_validation', 
        description: 'Cross-validate with related field values' 
      },
      { 
        name: 'ensemble', 
        description: 'Combine all strategies for maximum accuracy' 
      },
    ];

    let accuracyStats = null;
    if (boostingService) {
      accuracyStats = boostingService.getHistoricalAccuracy?.();
    }

    return NextResponse.json({
      strategies,
      accuracyStats,
      recommendedThresholds: {
        highConfidence: 0.85,
        mediumConfidence: 0.65,
        lowConfidence: 0.45,
        humanReviewRequired: 0.45,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get boosting options' },
      { status: 500 }
    );
  }
}
