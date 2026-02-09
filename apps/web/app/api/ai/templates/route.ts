/**
 * Contract Template Learning API
 * Learn and apply company-specific contract templates
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

// Dynamic import to avoid build-time resolution issues
async function getTemplateLearningService() {
  const services = await import('data-orchestration/services');
  return (services as any).contractTemplateLearningService;
}

/**
 * GET /api/ai/templates
 * Retrieve learned templates
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const sessionId = searchParams.get('sessionId');

    const templateService = await getTemplateLearningService();

    // Get learning session progress
    if (sessionId) {
      const progress = templateService.getLearningProgress(sessionId);
      
      if (!progress) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Learning session not found', 404);
      }

      return createSuccessResponse(ctx, { session: progress });
    }

    // Get specific template
    if (templateId) {
      const templates = templateService.getTemplates(tenantId);
      const template = templates.find((t: any) => t.id === templateId);
      
      if (!template) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
      }

      return createSuccessResponse(ctx, { template });
    }

    // List all templates
    const templates = templateService.getTemplates(tenantId);

    return createSuccessResponse(ctx, {
      templates: templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        sourceCompany: t.sourceCompany,
        usageCount: t.usageCount,
        confidenceScore: t.confidenceScore,
        status: t.status,
        createdAt: t.createdAt,
        lastUsed: t.lastUsed })),
      totalCount: templates.length });
  });

/**
 * POST /api/ai/templates
 * Start template learning or match contracts to templates
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action, ...data } = body;

    const templateService = await getTemplateLearningService();

    // Start learning from a contract
    if (action === 'learn') {
      const { contractText, contractId, sourceCompany, knownType } = data;

      if (!contractText) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'contractText is required', 400);
      }

      const sessionId = await templateService.startLearning(tenantId, {
        contractText,
        contractId,
        sourceCompany,
        knownType });

      return createSuccessResponse(ctx, {
        sessionId,
        message: 'Template learning started. Poll for progress using GET with sessionId.',
        progressUrl: `/api/ai/templates?sessionId=${sessionId}` });
    }

    // Match a contract to learned templates
    if (action === 'match') {
      const { contractText, minConfidence = 0.6 } = data;

      if (!contractText) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'contractText is required', 400);
      }

      const matches = templateService.matchTemplate(tenantId, contractText, minConfidence);

      return createSuccessResponse(ctx, {
        matches: matches.map((m: any) => ({
          templateId: m.template.id,
          templateName: m.template.name,
          templateType: m.template.type,
          confidence: m.confidence,
          matchedPatterns: m.matchedPatterns,
          fieldHints: m.fieldHints })),
        bestMatch: matches[0] ? {
          templateId: matches[0].template.id,
          templateName: matches[0].template.name,
          confidence: matches[0].confidence } : null });
    }

    // Apply a template to extract fields from a contract
    if (action === 'apply') {
      const { templateId, contractText } = data;

      if (!templateId || !contractText) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'templateId and contractText are required', 400);
      }

      const result = templateService.applyTemplate(templateId, contractText);

      if (!result) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found or application failed', 404);
      }

      return createSuccessResponse(ctx, {
        templateId,
        extractedFields: result });
    }

    // Approve a template (make it active)
    if (action === 'approve') {
      const { templateId } = data;

      if (!templateId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'templateId is required', 400);
      }

      const success = templateService.approveTemplate(templateId);

      if (!success) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
      }

      return createSuccessResponse(ctx, { message: 'Template approved and activated' });
    }

    // Reject a template
    if (action === 'reject') {
      const { templateId } = data;

      if (!templateId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'templateId is required', 400);
      }

      const success = templateService.rejectTemplate(templateId);

      if (!success) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
      }

      return createSuccessResponse(ctx, { message: 'Template rejected' });
    }

    // Get field hints for a template
    if (action === 'hints') {
      const { templateId, fieldName } = data;

      if (!templateId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'templateId is required', 400);
      }

      const templates = templateService.getTemplates(tenantId);
      const template = templates.find((t: any) => t.id === templateId);

      if (!template) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
      }

      const hints = fieldName 
        ? template.structure.fieldMappings.filter((f: any) => f.artifactField === fieldName)
        : template.structure.fieldMappings;

      return createSuccessResponse(ctx, {
        templateId,
        fieldHints: hints });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: learn, match, apply, approve, reject, or hints', 400);
  });

/**
 * DELETE /api/ai/templates
 * Delete a learned template
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'templateId is required', 400);
    }

    const templateService = await getTemplateLearningService();
    const success = templateService.deleteTemplate(tenantId, templateId);

    if (!success) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    return createSuccessResponse(ctx, { message: 'Template deleted' });
  });
