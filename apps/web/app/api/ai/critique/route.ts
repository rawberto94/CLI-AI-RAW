/**
 * Self-Critique API
 * 
 * Validates and optionally revises AI responses
 * using the SelfCritiqueService
 */

import { NextRequest } from 'next/server';
import { getSelfCritiqueService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { 
      response,
      tenantId,
      contractId,
      contractText = '',
      artifactType = 'general',
      options = {} } = body;

    if (!response) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Response text is required', 400);
    }

    const critiqueService = getSelfCritiqueService();
    
    // Build critique context
    const context = {
      contractId: contractId || '',
      contractText,
      artifactType,
      tenantId };

    // Build checks array based on options
    const checks: Array<'hallucination' | 'consistency' | 'completeness' | 'formatting' | 'factual' | 'citation' | 'tone' | 'relevance'> = [];
    if (options.checkFactualAccuracy ?? true) checks.push('factual', 'hallucination');
    if (options.checkCompleteness ?? true) checks.push('completeness');
    if (options.checkClarity ?? true) checks.push('formatting');
    if (options.checkTone ?? false) checks.push('tone');
    checks.push('consistency', 'relevance');

    // Run critique
    const result = await critiqueService.critique(response, context, {
      minScore: options.targetScore ?? 0.8,
      enableAutoRevision: options.autoRevise ?? true,
      maxRevisionAttempts: options.maxRevisions ?? 2,
      checks,
      model: 'gpt-4o-mini',
      temperature: 0.2 });

    return createSuccessResponse(ctx, {
      approved: result.passed,
      score: result.score,
      revisedResponse: result.revisedOutput,
      issues: result.issues,
      suggestions: result.suggestions });
  });
