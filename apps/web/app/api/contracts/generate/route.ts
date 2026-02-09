/**
 * Contract Generation API
 * 
 * Generate contracts from natural language descriptions
 * 
 * @module api/contracts/generate
 */

import { NextRequest } from 'next/server';
import { 
  getContractGenerationService, 
  ContractTemplateType,
  GenerationLanguage 
} from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * POST /api/contracts/generate
 * 
 * Generate a contract from natural language description
 */
export const POST = withAuthApiHandler(async (request, ctx) => {

  const body = await request.json();
  const {
    prompt,
    templateType,
    variables,
    options,
  } = body;

  if (!prompt || typeof prompt !== 'string') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Prompt is required', 400);
  }

  const generationService = getContractGenerationService();

  const result = await generationService.generateContract({
    prompt,
    templateType: templateType as ContractTemplateType,
    variables: variables || {},
    options: {
      language: options?.language as GenerationLanguage || 'en',
      tone: options?.tone || 'balanced',
      complexity: options?.complexity || 'standard',
      jurisdiction: options?.jurisdiction,
      includeSchedules: options?.includeSchedules,
      complianceRequirements: options?.complianceRequirements || [],
      playbookId: options?.playbookId,
      maxLength: options?.maxLength,
      styleGuide: options?.styleGuide,
    },
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });

  return createSuccessResponse(ctx, {
    contract: result,
  });
});
