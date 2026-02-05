/**
 * OCR Enhancement Test API
 * 
 * Endpoint for testing the OCR enhancement pipeline
 * Only available in development mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Check if we're in development
const isDev = process.env.NODE_ENV === 'development';

/**
 * POST /api/ocr/test
 * Test the OCR enhancement pipeline
 */
export async function POST(request: NextRequest) {
  if (!isDev) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, options } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Dynamic import to avoid loading in production
    const {
      runUnifiedOCRPipeline,
      extractLegalEntities,
      detectLanguage,
      classifyDocument,
    } = await import('@repo/workers/ocr-enhancement-suite');

    const results: Record<string, unknown> = {};

    // Test language detection
    if (options?.testLanguageDetection !== false) {
      try {
        const langResult = await detectLanguage(text);
        results.languageDetection = langResult;
      } catch (e) {
        results.languageDetection = { error: String(e) };
      }
    }

    // Test document classification
    if (options?.testClassification !== false) {
      try {
        const classResult = await classifyDocument(text, { quickMode: true });
        results.classification = classResult;
      } catch (e) {
        results.classification = { error: String(e) };
      }
    }

    // Test NER
    if (options?.testNER !== false) {
      try {
        const nerResult = await extractLegalEntities(text, { language: 'auto' });
        results.ner = {
          entityCount: nerResult.entities.length,
          entities: nerResult.entities.slice(0, 10), // Limit for response size
        };
      } catch (e) {
        results.ner = { error: String(e) };
      }
    }

    // Test full pipeline
    if (options?.testFullPipeline !== false) {
      try {
        const pipelineResult = await runUnifiedOCRPipeline(text, {
          enablePreClassification: true,
          enableHandwritingDetection: true,
          enableLocalEnhancements: false, // Requires image buffer
          enableLLMCorrection: options?.enableLLM ?? false, // Opt-in for cost
          enableNER: true,
          enableMultiLang: true,
          autoRouteToReview: false, // Don't create real review items in test
        });
        results.pipeline = {
          confidence: pipelineResult.confidence,
          documentCategory: pipelineResult.documentCategory,
          contractType: pipelineResult.contractType,
          detectedLanguage: pipelineResult.detectedLanguage,
          isMixedLanguage: pipelineResult.isMixedLanguage,
          hasHandwriting: pipelineResult.hasHandwriting,
          needsReview: pipelineResult.needsReview,
          processingSteps: pipelineResult.processingSteps,
          totalTime: pipelineResult.totalTime,
          warnings: pipelineResult.warnings,
          entityCount: Array.isArray(pipelineResult.entities) ? pipelineResult.entities.length : 0,
        };
      } catch (e) {
        results.pipeline = { error: String(e) };
      }
    }

    return NextResponse.json({
      success: true,
      inputLength: text.length,
      results,
    });
  } catch (error) {
    console.error('[OCR Test] Error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ocr/test
 * Get info about the test endpoint
 */
export async function GET() {
  if (!isDev) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  return NextResponse.json({
    available: true,
    description: 'Test endpoint for OCR enhancement pipeline',
    usage: {
      method: 'POST',
      body: {
        text: 'The contract text to process',
        options: {
          testLanguageDetection: 'boolean (default: true)',
          testClassification: 'boolean (default: true)',
          testNER: 'boolean (default: true)',
          testFullPipeline: 'boolean (default: true)',
          enableLLM: 'boolean (default: false) - enable LLM correction (costs money)',
        },
      },
    },
    modules: [
      'Language Detection (DE/FR/IT/EN)',
      'Document Pre-Classification',
      'Legal Named Entity Recognition',
      'Unified OCR Pipeline',
      'Handwriting Detection',
      'Human Review Queue Integration',
    ],
  });
}
