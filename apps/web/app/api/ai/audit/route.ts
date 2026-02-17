import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { z } from 'zod';

const auditGetSchema = z.object({
  action: z.enum(['decisions', 'stats', 'compliance', 'risk-flags']).default('decisions'),
  featureId: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  to: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

const auditPostSchema = z.object({
  action: z.enum(['log', 'feedback', 'flag']).default('log'),
  contractId: z.string().optional(),
  feature: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  model: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  citations: z.array(z.unknown()).optional(),
  processingTimeMs: z.number().int().optional(),
  tokenUsage: z.record(z.number()).optional(),
  decisionId: z.string().optional(),
  userId: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  correction: z.unknown().optional(),
  comment: z.string().optional(),
  flagType: z.string().optional(),
  reason: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/ai/audit
 * Get AI decision audit trail, usage stats, or compliance reports
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const parsed = auditGetSchema.safeParse({
      action: searchParams.get('action') || undefined,
      featureId: searchParams.get('featureId') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      limit: searchParams.get('limit') || undefined,
    });
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid parameters: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { action, featureId, from: fromDate, to: toDate, limit } = parsed.data;

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
    const parsed = auditPostSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid body: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { action, ...data } = parsed.data;

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
