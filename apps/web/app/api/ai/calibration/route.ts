/**
 * Confidence Calibration API
 * 
 * Calibrates AI confidence scores based on actual accuracy:
 * - Record predictions and outcomes
 * - Get calibrated confidence scores
 * - View calibration curves and diagnostics
 */

import { NextRequest, NextResponse } from 'next/server';

// Dynamic import helper with proper typing
async function getConfidenceCalibrationService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).confidenceCalibrationService;
}

export async function GET(request: NextRequest) {
  try {
    const confidenceCalibrationService = await getConfidenceCalibrationService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'report';
    const artifactType = searchParams.get('artifactType');
    const tenantId = searchParams.get('tenantId') || 'default';

    if (!artifactType) {
      return NextResponse.json(
        { error: 'artifactType is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'report': {
        const report = confidenceCalibrationService.getCalibrationReport(artifactType, tenantId);
        return NextResponse.json(report);
      }

      case 'status': {
        const isCalibrated = confidenceCalibrationService.isCalibrated(artifactType, tenantId);
        const sampleCount = confidenceCalibrationService.getSampleCount(artifactType, tenantId);
        return NextResponse.json({
          artifactType,
          tenantId,
          isCalibrated,
          sampleCount,
          minRequired: 50,
        });
      }

      case 'calibrate': {
        const rawConfidence = parseFloat(searchParams.get('confidence') || '0.5');
        const calibrated = confidenceCalibrationService.calibrateConfidence(
          rawConfidence,
          artifactType,
          tenantId
        );
        return NextResponse.json(calibrated);
      }

      case 'field-calibration': {
        const fieldCalibration = await confidenceCalibrationService.getFieldCalibration(
          artifactType,
          tenantId
        );
        return NextResponse.json(fieldCalibration);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: report, status, calibrate, field-calibration' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const confidenceCalibrationService = await getConfidenceCalibrationService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'record': {
        const { artifactType, tenantId = 'default', predictedConfidence, wasCorrect, fieldName } = body;
        if (!artifactType || predictedConfidence === undefined || wasCorrect === undefined) {
          return NextResponse.json(
            { error: 'artifactType, predictedConfidence, and wasCorrect are required' },
            { status: 400 }
          );
        }
        await confidenceCalibrationService.recordPrediction(
          artifactType,
          tenantId,
          predictedConfidence,
          wasCorrect,
          fieldName
        );
        return NextResponse.json({ success: true });
      }

      case 'record-batch': {
        const { predictions } = body;
        if (!predictions || !Array.isArray(predictions)) {
          return NextResponse.json(
            { error: 'predictions array is required' },
            { status: 400 }
          );
        }
        await confidenceCalibrationService.recordBatchPredictions(predictions);
        return NextResponse.json({ 
          success: true, 
          recordedCount: predictions.length 
        });
      }

      case 'recalculate': {
        const { artifactType, tenantId = 'default' } = body;
        if (!artifactType) {
          return NextResponse.json(
            { error: 'artifactType is required' },
            { status: 400 }
          );
        }
        const curve = await confidenceCalibrationService.recalculateCalibration(
          artifactType,
          tenantId
        );
        if (!curve) {
          return NextResponse.json(
            { error: 'Not enough samples to calculate calibration (min: 50)' },
            { status: 400 }
          );
        }
        return NextResponse.json(curve);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: record, record-batch, recalculate' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
