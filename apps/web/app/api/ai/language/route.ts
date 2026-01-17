/**
 * Multi-Language Contract API
 * 
 * Handles multi-language contract processing:
 * - Language detection
 * - Translation
 * - Locale-aware parsing (dates, currencies)
 */

import { NextRequest, NextResponse } from 'next/server';

// Dynamic import helper with proper typing
async function getMultiLanguageContractService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).multiLanguageContractService;
}

export async function GET(request: NextRequest) {
  try {
    const multiLanguageContractService = await getMultiLanguageContractService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'supported';

    switch (action) {
      case 'supported': {
        const languages = multiLanguageContractService.getSupportedLanguages();
        return NextResponse.json({ 
          languages,
          count: languages.length,
        });
      }

      case 'locale-config': {
        const language = searchParams.get('language');
        if (!language) {
          return NextResponse.json(
            { error: 'language parameter is required' },
            { status: 400 }
          );
        }
        const config = multiLanguageContractService.getLocaleConfig(language as any);
        return NextResponse.json(config);
      }

      case 'prompt-additions': {
        const language = searchParams.get('language');
        if (!language) {
          return NextResponse.json(
            { error: 'language parameter is required' },
            { status: 400 }
          );
        }
        const additions = multiLanguageContractService.generateExtractionPromptAdditions(language as any);
        return NextResponse.json({ promptAdditions: additions });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: supported, locale-config, prompt-additions' },
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
    const multiLanguageContractService = await getMultiLanguageContractService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'detect': {
        const { text } = body;
        if (!text) {
          return NextResponse.json(
            { error: 'text is required' },
            { status: 400 }
          );
        }
        const result = await multiLanguageContractService.detectLanguage(text);
        return NextResponse.json(result);
      }

      case 'translate': {
        const { text, targetLanguage = 'en' } = body;
        if (!text) {
          return NextResponse.json(
            { error: 'text is required' },
            { status: 400 }
          );
        }
        const result = await multiLanguageContractService.translateText(text, targetLanguage);
        return NextResponse.json(result);
      }

      case 'parse-date': {
        const { dateString, language } = body;
        if (!dateString || !language) {
          return NextResponse.json(
            { error: 'dateString and language are required' },
            { status: 400 }
          );
        }
        const result = multiLanguageContractService.parseLocalizedDate(dateString, language);
        return NextResponse.json(result);
      }

      case 'parse-currency': {
        const { amountString, language } = body;
        if (!amountString || !language) {
          return NextResponse.json(
            { error: 'amountString and language are required' },
            { status: 400 }
          );
        }
        const result = multiLanguageContractService.parseLocalizedCurrency(amountString, language);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: detect, translate, parse-date, parse-currency' },
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
