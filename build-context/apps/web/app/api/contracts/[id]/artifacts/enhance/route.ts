/**
 * AI Artifact Enhancement API
 * 
 * POST /api/contracts/[id]/artifacts/enhance
 * 
 * Uses AI to enhance or improve specific artifact fields with better wording,
 * more detail, or clearer explanations.
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EnhanceRequest {
  fieldId: string;
  currentValue: any;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const _contractId = params.id;

  try {
    const body: EnhanceRequest = await request.json();
    const { fieldId, currentValue } = body;

    if (!fieldId || currentValue === undefined || currentValue === null) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'fieldId and currentValue are required', 400);
    }

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return createSuccessResponse(ctx, {
        success: false,
        enhancedValue: currentValue,
        message: 'AI enhancement not available (OpenAI not configured)',
      });
    }

    // Determine enhancement type based on field
    const enhancementPrompt = getEnhancementPrompt(fieldId, currentValue);

    // Call OpenAI for enhancement
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a legal and business writing expert. Your task is to enhance contract-related text to make it more clear, professional, and comprehensive while maintaining accuracy. Keep enhancements concise and focused.`,
        },
        {
          role: 'user',
          content: enhancementPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const enhancedValue = completion.choices[0]?.message?.content?.trim() || currentValue;

    return createSuccessResponse(ctx, {
      success: true,
      enhancedValue,
      originalValue: currentValue,
      tokensUsed: completion.usage?.total_tokens,
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

function getEnhancementPrompt(fieldId: string, currentValue: any): string {
  const valueStr = typeof currentValue === 'string' 
    ? currentValue 
    : JSON.stringify(currentValue);

  // Customize prompt based on field type
  if (fieldId.includes('summary') || fieldId.includes('overview')) {
    return `Enhance this contract summary to be more comprehensive and insightful while keeping it concise (max 150 words):

Current: ${valueStr}

Provide only the enhanced text, no explanations.`;
  }

  if (fieldId.includes('risk') || fieldId.includes('concern')) {
    return `Enhance this risk description to be more specific and actionable:

Current: ${valueStr}

Provide only the enhanced text, no explanations.`;
  }

  if (fieldId.includes('obligation') || fieldId.includes('requirement')) {
    return `Enhance this obligation/requirement to be more clear and specific about responsibilities:

Current: ${valueStr}

Provide only the enhanced text, no explanations.`;
  }

  if (fieldId.includes('clause') || fieldId.includes('term')) {
    return `Enhance this clause description to be more clear and understandable:

Current: ${valueStr}

Provide only the enhanced text, no explanations.`;
  }

  if (fieldId.includes('recommendation') || fieldId.includes('action')) {
    return `Enhance this recommendation to be more specific and actionable:

Current: ${valueStr}

Provide only the enhanced text, no explanations.`;
  }

  // Generic enhancement
  return `Enhance this contract-related text to be more clear, professional, and comprehensive:

Current: ${valueStr}

Provide only the enhanced text, no explanations.`;
}
