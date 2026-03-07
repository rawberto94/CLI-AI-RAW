/**
 * Document Quality Analysis API
 * 
 * POST: Analyze document quality before OCR
 * Returns quality metrics and preprocessing recommendations
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { 
  DocumentPreprocessor as _DocumentPreprocessor, 
  analyzeDocumentQuality, 
  shouldPreprocess,
  preprocessForOCR,
  smartPreprocessForOCR,
} from '@/lib/ai/document-preprocessor';
// ============================================================================
// POST - Analyze Document Quality
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const action = formData.get('action') as string || 'analyze';

  if (!file) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'No file provided', 400);
  }

  // Get file buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  switch (action) {
    case 'analyze': {
      // Just analyze quality without processing
      const quality = await analyzeDocumentQuality(buffer);
      const recommendation = await shouldPreprocess(buffer);

      return createSuccessResponse(ctx, {
        success: true,
        data: {
          quality,
          recommendation,
          filename: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
      });
    }

    case 'preprocess': {
      // Preprocess the document
      const preset = (formData.get('preset') as 'fast' | 'balanced' | 'quality') || 'balanced';
      const result = await preprocessForOCR(buffer, preset);

      // Return the processed image as base64 for preview, plus metrics
      return createSuccessResponse(ctx, {
        success: true,
        data: {
          qualityBefore: result.qualityBefore,
          qualityAfter: result.qualityAfter,
          stepsApplied: result.stepsApplied,
          processingTimeMs: result.processingTimeMs,
          estimatedAccuracyImprovement: result.estimatedAccuracyImprovement,
          // Include base64 preview (limited to 1MB for response size)
          preview: result.buffer.length < 1024 * 1024 
            ? result.buffer.toString('base64')
            : null,
          previewTruncated: result.buffer.length >= 1024 * 1024,
          outputSize: result.buffer.length,
        },
      });
    }

    case 'smart-preprocess': {
      // Smart preprocessing that only processes if needed
      const result = await smartPreprocessForOCR(buffer);

      return createSuccessResponse(ctx, {
        success: true,
        data: {
          qualityBefore: result.qualityBefore,
          qualityAfter: result.qualityAfter,
          stepsApplied: result.stepsApplied,
          processingTimeMs: result.processingTimeMs,
          estimatedAccuracyImprovement: result.estimatedAccuracyImprovement,
          wasProcessed: !result.stepsApplied.includes('skipped-good-quality'),
        },
      });
    }

    case 'batch-analyze': {
      // For multiple files, return summary analysis
      // Note: In production, this would handle multiple files
      const quality = await analyzeDocumentQuality(buffer);

      return createSuccessResponse(ctx, {
        success: true,
        data: {
          files: [{
            filename: file.name,
            quality,
            needsPreprocessing: quality.qualityScore < 75,
          }],
          summary: {
            totalFiles: 1,
            needsPreprocessing: quality.qualityScore < 75 ? 1 : 0,
            averageQuality: quality.qualityScore,
          },
        },
      });
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
  }
});

// ============================================================================
// GET - Get Quality Analysis Guidelines
// ============================================================================

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  return createSuccessResponse(ctx, {
    success: true,
    data: {
      qualityMetrics: {
        estimatedDpi: {
          description: 'Dots per inch - higher is better',
          optimal: '300+',
          minimum: '150',
          unit: 'DPI',
        },
        sharpness: {
          description: 'Image clarity score',
          optimal: '0.7+',
          minimum: '0.4',
          unit: '0-1',
        },
        contrast: {
          description: 'Difference between light and dark areas',
          optimal: '0.6+',
          minimum: '0.3',
          unit: '0-1',
        },
        brightness: {
          description: 'Average pixel brightness',
          optimal: '100-180',
          minimum: '50-220',
          unit: '0-255',
        },
        noiseLevel: {
          description: 'Amount of visual noise',
          optimal: '<0.3',
          acceptable: '<0.5',
          unit: '0-1',
        },
        skewAngle: {
          description: 'Document rotation from straight',
          optimal: '< 0.5°',
          acceptable: '< 5°',
          unit: 'degrees',
        },
        qualityScore: {
          description: 'Overall document quality',
          excellent: '80+',
          good: '60-80',
          needsImprovement: '<60',
          unit: '0-100',
        },
      },
      preprocessingOptions: {
        deskew: 'Correct document rotation',
        denoise: 'Remove visual noise',
        enhanceContrast: 'Improve text visibility',
        binarize: 'Convert to black and white',
        sharpenText: 'Make text edges clearer',
        trimBorders: 'Remove empty borders',
        targetDpi: 'Upscale low-resolution images',
      },
      presets: {
        fast: {
          description: 'Minimal processing for already good documents',
          processingTime: '< 1 second',
          accuracyImprovement: '5-10%',
        },
        balanced: {
          description: 'Good balance of speed and quality',
          processingTime: '1-3 seconds',
          accuracyImprovement: '20-30%',
        },
        quality: {
          description: 'Maximum preprocessing for poor quality scans',
          processingTime: '3-5 seconds',
          accuracyImprovement: '30-50%',
        },
      },
      recommendations: [
        'For scanned documents, use "balanced" or "quality" preset',
        'Native PDFs (not scanned) usually need no preprocessing',
        'Enable preprocessing for documents with quality score < 75',
        'Use "quality" preset for handwritten documents or old scans',
      ],
    },
  });
});
