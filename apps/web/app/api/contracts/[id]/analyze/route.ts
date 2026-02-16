/**
 * Custom AI Analysis API
 * 
 * POST /api/contracts/[id]/analyze
 * 
 * Allows users to ask custom questions about a contract
 * or use pre-built analysis templates.
 */

import { NextRequest } from 'next/server';
import { 
  customContractAnalysis, 
  continueConversation as _continueConversation,
  getAnalysisTemplates,
  type AnalysisTemplate,
  type ConversationMessage,
} from '@/lib/ai/custom-analysis';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// ============================================================================
// POST - Custom Analysis
// ============================================================================

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const contractId = params.id;

  try {
    const body = await request.json();
    const {
      prompt,
      template,
      conversationHistory,
      focusAreas,
      language,
      format,
    } = body;

    // Validate request
    if (!prompt && !template) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Either prompt or template is required', 400);
    }

    // Fetch contract text
    const { dbAdaptor } = await import('data-orchestration');
    const contract = await dbAdaptor.getClient().contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        contractArtifacts: {
          select: {
            type: true,
            value: true,
          },
        },
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get contract text - prefer rawText, fall back to artifact data
    let contractText = contract.rawText || '';
    
    if (!contractText && contract.contractArtifacts) {
      // Compile text from artifacts
      const textParts: string[] = [];
      for (const artifact of contract.contractArtifacts) {
        if (artifact.value && typeof artifact.value === 'object') {
          textParts.push(JSON.stringify(artifact.value, null, 2));
        }
      }
      contractText = textParts.join('\n\n');
    }

    if (!contractText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No contract text available for analysis', 400);
    }

    // Perform analysis
    const result = await customContractAnalysis({
      prompt: prompt || '',
      contractText,
      template: template as AnalysisTemplate || 'custom',
      conversationHistory: conversationHistory as ConversationMessage[],
      focusAreas,
      language,
      format,
    });

    return createSuccessResponse(ctx, {
      success: true,
      contractId,
      contractName: contract.fileName,
      analysis: result,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

// ============================================================================
// GET - Get Available Templates
// ============================================================================

export async function GET() {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const templates = getAnalysisTemplates();
    
    return createSuccessResponse(ctx, {
      templates,
      supportedLanguages: ['en', 'de', 'fr', 'it'],
      supportedFormats: ['text', 'json', 'markdown', 'bullet-points'],
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
