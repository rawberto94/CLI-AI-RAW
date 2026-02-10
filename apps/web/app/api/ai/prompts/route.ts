/**
 * Prompt Optimization API
 * 
 * Manages AI prompt versions and optimization:
 * - Create and track prompt versions
 * - Get optimization suggestions
 * - Activate optimized prompts
 * - Compare prompt versions
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import helper with proper typing
async function getAutoPromptOptimizerService() {
  const services = await import('data-orchestration/services');
  // Type assertion for runtime module
  return (services as any).autoPromptOptimizerService;
}

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const autoPromptOptimizerService = await getAutoPromptOptimizerService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const artifactType = searchParams.get('artifactType');

    switch (action) {
      case 'list': {
        if (!artifactType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType is required', 400);
        }
        const versions = autoPromptOptimizerService.getAllVersions(artifactType, tenantId);
        const active = autoPromptOptimizerService.getActivePrompt(artifactType, tenantId);
        return createSuccessResponse(ctx, { versions, activeVersion: active?.id });
      }

      case 'active': {
        if (!artifactType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType is required', 400);
        }
        const activePrompt = autoPromptOptimizerService.getActivePrompt(artifactType, tenantId);
        if (!activePrompt) {
          return createErrorResponse(ctx, 'NOT_FOUND', 'No active prompt found', 404);
        }
        return createSuccessResponse(ctx, activePrompt);
      }

      case 'suggestions': {
        if (!artifactType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType is required', 400);
        }
        const promptId = searchParams.get('promptId');
        if (!promptId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'promptId is required', 400);
        }
        const suggestions = autoPromptOptimizerService.suggestOptimizations(promptId, artifactType);
        return createSuccessResponse(ctx, { suggestions });
      }

      case 'compare': {
        if (!artifactType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType is required', 400);
        }
        const promptId1 = searchParams.get('promptId1');
        const promptId2 = searchParams.get('promptId2');
        if (!promptId1 || !promptId2) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'promptId1 and promptId2 are required', 400);
        }
        const comparison = autoPromptOptimizerService.compareVersions(promptId1, promptId2, artifactType);
        if (!comparison) {
          return createErrorResponse(ctx, 'NOT_FOUND', 'Could not compare versions', 404);
        }
        return createSuccessResponse(ctx, comparison);
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: list, active, suggestions, compare', 400);
    }
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const autoPromptOptimizerService = await getAutoPromptOptimizerService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { artifactType, prompt, parentId } = body;
        if (!artifactType || !prompt) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType and prompt are required', 400);
        }
        const version = autoPromptOptimizerService.createPromptVersion(
          artifactType,
          prompt,
          tenantId,
          parentId
        );
        return createSuccessResponse(ctx, version, { status: 201 });
      }

      case 'activate': {
        const { artifactType, promptId, tenantId = 'default' } = body;
        if (!artifactType || !promptId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType and promptId are required', 400);
        }
        const success = autoPromptOptimizerService.activateVersion(promptId, artifactType, tenantId);
        if (!success) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Failed to activate version', 400);
        }
        return createSuccessResponse(ctx, { activatedId: promptId });
      }

      case 'record-metrics': {
        const { artifactType, promptId, metrics, tenantId = 'default' } = body;
        if (!artifactType || !promptId || !metrics) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType, promptId, and metrics are required', 400);
        }
        autoPromptOptimizerService.recordExtractionResult(
          promptId,
          artifactType,
          metrics.wasCorrect,
          metrics.confidence,
          metrics.fieldResults || {},
          tenantId
        );
        return createSuccessResponse(ctx, {});
      }

      case 'optimize': {
        const { artifactType, promptId, tenantId = 'default' } = body;
        if (!artifactType || !promptId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'artifactType and promptId are required', 400);
        }
        const optimized = await autoPromptOptimizerService.autoOptimize(
          promptId,
          artifactType,
          tenantId
        );
        if (!optimized) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Could not optimize prompt. Check if version exists and has metrics.', 400);
        }
        return createSuccessResponse(ctx, optimized, { status: 201 });
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: create, activate, record-metrics, optimize', 400);
    }
  });
