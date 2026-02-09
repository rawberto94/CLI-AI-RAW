import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/ai/audit
 * Get AI decision audit trail, usage stats, or compliance reports
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'decisions';
    const featureId = searchParams.get('featureId');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const auditService = (services as any).aiDecisionAuditService;

    if (!auditService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Decision Audit service not available', 503);
    }

    let result;

    switch (action) {
      case 'decisions':
        result = await auditService.getDecisions({
          tenantId,
          featureId,
          from: fromDate ? new Date(fromDate) : undefined,
          to: toDate ? new Date(toDate) : undefined,
          limit });
        break;

      case 'stats':
        result = await auditService.getUsageStats(
          tenantId,
          fromDate ? new Date(fromDate) : undefined,
          toDate ? new Date(toDate) : undefined
        );
        break;

      case 'compliance':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for compliance report', 400);
        }
        result = await auditService.generateComplianceReport(tenantId);
        break;

      case 'risk-flags':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for risk flags', 400);
        }
        result = await auditService.getRiskFlags(tenantId);
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

/**
 * POST /api/ai/audit
 * Log AI decision or record user feedback
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action = 'log', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const auditService = (services as any).aiDecisionAuditService;

    if (!auditService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Decision Audit service not available', 503);
    }

    let result;

    switch (action) {
      case 'log':
        const { 
          contractId, 
          feature, 
          input, 
          output, 
          model, 
          confidence, 
          citations,
          processingTimeMs, 
          tokenUsage 
        } = data;

        if (!feature || !input || !output) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'feature, input, and output are required', 400);
        }

        result = await auditService.logDecision({
          tenantId,
          contractId,
          feature,
          input,
          output,
          model: model || 'gpt-4o',
          confidence: confidence || 0.85,
          citations: citations || [],
          processingTimeMs: processingTimeMs || 0,
          tokenUsage: tokenUsage || { input: 0, output: 0, total: 0 } });
        break;

      case 'feedback':
        const { decisionId, userId, rating, correction, comment } = data;

        if (!decisionId || !userId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'decisionId and userId are required for feedback', 400);
        }

        result = await auditService.recordFeedback({
          decisionId,
          userId,
          rating,
          correction,
          comment });
        break;

      case 'flag':
        const { 
          decisionId: flagDecisionId, 
          flagType, 
          reason, 
          severity 
        } = data;

        if (!flagDecisionId || !flagType || !reason) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'decisionId, flagType, and reason are required', 400);
        }

        result = await auditService.flagDecision(
          flagDecisionId,
          flagType,
          reason,
          severity || 'medium'
        );
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });
