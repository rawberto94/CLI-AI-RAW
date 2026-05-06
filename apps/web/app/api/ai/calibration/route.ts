/**
 * Confidence Calibration API
 * 
 * Calibrates AI confidence scores based on actual accuracy:
 * - Record predictions and outcomes
 * - Get calibrated confidence scores
 * - View calibration curves and diagnostics
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import helper with proper typing
async function getConfidenceCalibrationService() {
  const services = await import('data-orchestration/services');
  return (services as any).confidenceCalibrationService;
}

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required', 400);
    }
    const confidenceCalibrationService = await getConfidenceCalibrationService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'report';
    const artifactType = searchParams.get('artifactType');

    if (!artifactType) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType is required', 400);
    }

    switch (action) {
      case 'report': {
        const report = confidenceCalibrationService.getCalibrationReport(artifactType, tenantId);
        return createSuccessResponse(ctx, report);
      }

      case 'status': {
        const isCalibrated = confidenceCalibrationService.isCalibrated(artifactType, tenantId);
        const sampleCount = confidenceCalibrationService.getSampleCount(artifactType, tenantId);
        return createSuccessResponse(ctx, {
          artifactType,
          tenantId,
          isCalibrated,
          sampleCount,
          minRequired: 50 });
      }

      case 'calibrate': {
        const rawConfidence = parseFloat(searchParams.get('confidence') || '0.5');
        const calibrated = confidenceCalibrationService.calibrateConfidence(
          rawConfidence,
          artifactType,
          tenantId
        );
        return createSuccessResponse(ctx, calibrated);
      }

      case 'field-calibration': {
        const fieldCalibration = await confidenceCalibrationService.getFieldCalibration(
          artifactType,
          tenantId
        );
        return createSuccessResponse(ctx, fieldCalibration);
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: report, status, calibrate, field-calibration', 400);
    }
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required', 400);
    }
    const confidenceCalibrationService = await getConfidenceCalibrationService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'record': {
        const { artifactType, predictedConfidence, wasCorrect, fieldName } = body;
        if (!artifactType || predictedConfidence === undefined || wasCorrect === undefined) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType, predictedConfidence, and wasCorrect are required', 400);
        }
        await confidenceCalibrationService.recordPrediction(
          artifactType,
          tenantId,
          predictedConfidence,
          wasCorrect,
          fieldName
        );
        return createSuccessResponse(ctx, {});
      }

      case 'record-batch': {
        const { predictions } = body;
        if (!predictions || !Array.isArray(predictions)) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'predictions array is required', 400);
        }
        await confidenceCalibrationService.recordBatchPredictions(
          predictions.map((prediction: Record<string, unknown>) => ({
            ...prediction,
            tenantId,
          }))
        );
        return createSuccessResponse(ctx, { recordedCount: predictions.length });
      }

      case 'recalculate': {
        const { artifactType } = body;
        if (!artifactType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType is required', 400);
        }
        const curve = await confidenceCalibrationService.recalculateCalibration(
          artifactType,
          tenantId
        );
        if (!curve) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Not enough samples to calculate calibration (min: 50)', 400);
        }
        return createSuccessResponse(ctx, curve);
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: record, record-batch, recalculate', 400);
    }
  });
