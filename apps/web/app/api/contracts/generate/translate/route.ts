/**
 * Contract Translation API
 * 
 * Translate contracts to different languages
 * 
 * @module api/contracts/generate/translate
 */

import { NextRequest } from 'next/server';
import { 
  getContractGenerationService, 
  GenerationLanguage 
} from 'data-orchestration/services';
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

/**
 * POST /api/contracts/generate/translate
 * 
 * Translate a contract to another language
 */
export const POST = withContractApiHandler(async (request, ctx) => {

  const body = await request.json();
  const {
    content,
    targetLanguage,
    preserveFormatting,
    legalTerminology,
  } = body;

  if (!content || typeof content !== 'string') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Content is required', 400);
  }

  if (!targetLanguage || typeof targetLanguage !== 'string') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Target language is required', 400);
  }

  const validLanguages: GenerationLanguage[] = [
    'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ja', 'zh', 'ko'
  ];

  if (!validLanguages.includes(targetLanguage as GenerationLanguage)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid language. Supported: ${validLanguages.join(', ')}`, 400);
  }

  const generationService = getContractGenerationService();

  const result = await generationService.translateContract(
    content,
    targetLanguage as GenerationLanguage,
    {
      preserveFormatting: preserveFormatting !== false,
      legalTerminology: legalTerminology !== false,
    }
  );

  return createSuccessResponse(ctx, {
    translation: result,
  });
});
