/**
 * Contract Translation API
 * 
 * Translate contracts to different languages
 * 
 * @module api/contracts/generate/translate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { 
  getContractGenerationService, 
  GenerationLanguage 
} from '@repo/data-orchestration/services/contract-generation.service';

/**
 * POST /api/contracts/generate/translate
 * 
 * Translate a contract to another language
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      content,
      targetLanguage,
      preserveFormatting,
      legalTerminology,
    } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return NextResponse.json(
        { error: 'Target language is required' },
        { status: 400 }
      );
    }

    const validLanguages: GenerationLanguage[] = [
      'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ja', 'zh', 'ko'
    ];

    if (!validLanguages.includes(targetLanguage as GenerationLanguage)) {
      return NextResponse.json(
        { error: `Invalid language. Supported: ${validLanguages.join(', ')}` },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      translation: result,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Failed to translate contract' },
      { status: 500 }
    );
  }
}
