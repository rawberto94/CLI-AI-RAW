/**
 * Multi-Language Contract API
 * 
 * Handles multi-language contract processing:
 * - Language detection
 * - Translation
 * - Locale-aware parsing (dates, currencies)
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import helper with proper typing
async function getMultiLanguageContractService() {
  const services = await import('data-orchestration/services');
  return (services as any).multiLanguageContractService;
}

export const GET = withAuthApiHandler(async (request, ctx) => {
    const multiLanguageContractService = await getMultiLanguageContractService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'supported';

    switch (action) {
      case 'supported': {
        const languages = multiLanguageContractService.getSupportedLanguages();
        return createSuccessResponse(ctx, { 
          languages,
          count: languages.length });
      }

      case 'locale-config': {
        const language = searchParams.get('language');
        if (!language) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'language parameter is required', 400);
        }
        const config = multiLanguageContractService.getLocaleConfig(language as any);
        return createSuccessResponse(ctx, config);
      }

      case 'prompt-additions': {
        const language = searchParams.get('language');
        if (!language) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'language parameter is required', 400);
        }
        const additions = multiLanguageContractService.generateExtractionPromptAdditions(language as any);
        return createSuccessResponse(ctx, { promptAdditions: additions });
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: supported, locale-config, prompt-additions', 400);
    }
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
    const multiLanguageContractService = await getMultiLanguageContractService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'detect': {
        const { text } = body;
        if (!text) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'text is required', 400);
        }
        const result = await multiLanguageContractService.detectLanguage(text);
        return createSuccessResponse(ctx, result);
      }

      case 'translate': {
        const { text, targetLanguage = 'en' } = body;
        if (!text) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'text is required', 400);
        }
        const result = await multiLanguageContractService.translateText(text, targetLanguage);
        return createSuccessResponse(ctx, result);
      }

      case 'parse-date': {
        const { dateString, language } = body;
        if (!dateString || !language) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'dateString and language are required', 400);
        }
        const result = multiLanguageContractService.parseLocalizedDate(dateString, language);
        return createSuccessResponse(ctx, result);
      }

      case 'parse-currency': {
        const { amountString, language } = body;
        if (!amountString || !language) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'amountString and language are required', 400);
        }
        const result = multiLanguageContractService.parseLocalizedCurrency(amountString, language);
        return createSuccessResponse(ctx, result);
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: detect, translate, parse-date, parse-currency', 400);
    }
  });
